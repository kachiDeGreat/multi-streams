#!/usr/bin/env python3
import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 5000
DEST_CONF = "/etc/nginx/destinations.conf"
STAT_URL = "http://127.0.0.1:8080/stat"
ROUTES_FILE = "/opt/stream-bridge/routes.json"
LOG_DIR = "/var/log/stream-bridge"

os.makedirs(LOG_DIR, exist_ok=True)

# Global state
saved_destinations = []
active_processes = {}  # dest_id -> { proc, stream_name, target_url, log_file, start_time }
active_stream_key = "myStream"
lock = threading.Lock()

def log(msg):
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{timestamp}] {msg}\n")
    sys.stderr.flush()

def load_routes_from_disk():
    global saved_destinations
    if os.path.exists(ROUTES_FILE):
        try:
            with open(ROUTES_FILE, "r") as f:
                saved_destinations = json.load(f)
            log(f"Loaded {len(saved_destinations)} destinations from {ROUTES_FILE}")
        except Exception as e:
            log(f"Error loading {ROUTES_FILE}: {e}")
            saved_destinations = []
    else:
        saved_destinations = []

def save_routes_to_disk(dest_list):
    global saved_destinations
    saved_destinations = dest_list
    try:
        with open(ROUTES_FILE, "w") as f:
            json.dump(dest_list, f, indent=2)
        log(f"Saved {len(dest_list)} destinations to {ROUTES_FILE}")
    except Exception as e:
        log(f"Error saving {ROUTES_FILE}: {e}")

def get_active_publishers():
    """Query nginx-rtmp /stat endpoint and return list of actively publishing stream keys."""
    try:
        req = urllib.request.Request(STAT_URL, headers={"User-Agent": "stream-router"})
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            raw_xml = resp.read().decode("utf-8", errors="ignore")
            keys = []

            # Check for <stream> with <publishing>
            try:
                root = ET.fromstring(raw_xml)
                for stream in root.findall(".//stream"):
                    name_elem = stream.find("name")
                    if name_elem is not None and name_elem.text:
                        s_name = name_elem.text.strip()
                        for client in stream.findall(".//client"):
                            if client.find("publishing") is not None:
                                keys.append(s_name)
                                break
            except Exception:
                pass

            if not keys:
                stream_blocks = re.findall(r"<stream>([\s\S]*?)</stream>", raw_xml)
                for block in stream_blocks:
                    if "<publishing/>" in block or "<publishing>" in block:
                        m = re.search(r"<name>(.*?)</name>", block)
                        if m and m.group(1).strip():
                            keys.append(m.group(1).strip())

            return keys
    except Exception:
        return []

def get_target_push_url(dest):
    """
    Format the outgoing push URL.
    Facebook Live requires tunneling through the local stunnel instance on 127.0.0.1:19350.
    """
    clean_key = (dest.get("streamKey") or "").strip()
    rtmp_url = (dest.get("rtmpUrl") or "").strip()
    platform = (dest.get("platform") or "").lower()

    if not clean_key or not rtmp_url:
        return None

    # Stunnel bridge for Facebook / RTMPS
    if platform == "facebook" or "facebook.com" in rtmp_url.lower() or rtmp_url.startswith("rtmps://"):
        return f"rtmp://127.0.0.1:19350/rtmp/{clean_key}"

    base_url = rtmp_url if rtmp_url.endswith("/") else rtmp_url + "/"
    return f"{base_url}{clean_key}"

def start_forwarder(dest_id, stream_name, target_url):
    global active_processes
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", str(dest_id))
    log_path = os.path.join(LOG_DIR, f"forwarder_{safe_name}.log")
    try:
        log_file = open(log_path, "a")
        log_file.write(f"\n--- Starting forwarder at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
        log_file.write(f"Source: rtmp://127.0.0.1/live/{stream_name} -> Target: {target_url}\n")
        log_file.flush()

        cmd = [
            "ffmpeg",
            "-nostdin",
            "-i", f"rtmp://127.0.0.1/live/{stream_name}",
            "-c", "copy",
            "-flvflags", "no_duration_filesize",
            "-f", "flv",
            target_url
        ]

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=log_file,
            preexec_fn=os.setsid
        )

        active_processes[dest_id] = {
            "proc": proc,
            "stream_name": stream_name,
            "target_url": target_url,
            "log_file": log_file,
            "start_time": time.time()
        }
        log(f"[RELAY ACTIVE] Forwarder {dest_id} -> {target_url} (PID {proc.pid})")
    except Exception as e:
        log(f"Failed to start forwarder {dest_id}: {e}")

def stop_forwarder(dest_id):
    global active_processes
    if dest_id in active_processes:
        info = active_processes.pop(dest_id)
        proc = info["proc"]
        log_file = info["log_file"]
        log(f"[RELAY STOP] Stopping forwarder {dest_id} (PID {proc.pid})")
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=1.5)
        except Exception:
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except Exception:
                pass
        try:
            log_file.write(f"--- Stopped forwarder at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")
            log_file.close()
        except Exception:
            pass

def sync_processes(preferred_key=None):
    """Ensure running forwarders match enabled destinations and active stream."""
    global saved_destinations, active_processes, active_stream_key
    with lock:
        publishers = get_active_publishers()
        if publishers:
            active_stream_key = publishers[0]
        elif preferred_key:
            active_stream_key = preferred_key
        elif not active_stream_key:
            active_stream_key = "myStream"

        current_stream = active_stream_key

        active_dest_map = {}
        for d in saved_destinations:
            if d.get("enabled"):
                d_id = d.get("id") or d.get("platform")
                active_dest_map[d_id] = d

        # 1. Stop forwarders that are disabled or whose target changed
        for dest_id in list(active_processes.keys()):
            proc_info = active_processes[dest_id]
            expected_dest = active_dest_map.get(dest_id)

            if not expected_dest:
                log(f"[RELAY] Destination {dest_id} disabled.")
                stop_forwarder(dest_id)
            elif proc_info["proc"].poll() is not None:
                # Process exited unexpectedly
                exit_code = proc_info["proc"].poll()
                log(f"[RELAY EXITED] Forwarder {dest_id} exited with code {exit_code}.")
                stop_forwarder(dest_id)
            else:
                expected_url = get_target_push_url(expected_dest)
                if expected_url and (proc_info["target_url"] != expected_url or proc_info["stream_name"] != current_stream):
                    log(f"[RELAY UPDATE] Destination {dest_id} updated. Restarting forwarder.")
                    stop_forwarder(dest_id)

        # 2. Launch forwarders for all enabled destinations
        for dest_id, dest in active_dest_map.items():
            if dest_id not in active_processes:
                target_url = get_target_push_url(dest)
                if target_url:
                    start_forwarder(dest_id, current_stream, target_url)

def background_monitor():
    while True:
        try:
            sync_processes()
        except Exception as e:
            log(f"Monitor notice: {e}")
        time.sleep(3)

class RouterHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        if self.path == "/api/sync-router" or self.path.startswith("/api/sync-router?"):
            with lock:
                self._send_json(200, {
                    "success": True,
                    "destinations": saved_destinations,
                    "activeStream": active_stream_key,
                    "runningForwarders": list(active_processes.keys())
                })
        else:
            self._send_json(404, {"success": False, "error": "Not Found"})

    def do_POST(self):
        if self.path != "/api/sync-router":
            self._send_json(404, {"success": False, "error": "Not Found"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._send_json(400, {"success": False, "error": "Empty body"})
            return

        try:
            body = self.rfile.read(content_length)
            raw_text = body.decode("utf-8")
            data = json.loads(raw_text)
            new_destinations = data.get("destinations", [])
            stream_key = data.get("streamKey") or "myStream"

            warnings = []
            valid_active_count = 0
            nginx_lines = []

            for dest in new_destinations:
                if dest.get("enabled"):
                    clean_key = (dest.get("streamKey") or "").strip()
                    rtmp_url = (dest.get("rtmpUrl") or "").strip()
                    target_url = get_target_push_url(dest)

                    if not clean_key:
                        warnings.append(f"{dest.get('platform', 'Platform')}: Stream key is missing")
                        continue
                    if not rtmp_url:
                        warnings.append(f"{dest.get('platform', 'Platform')}: Ingest URL is missing")
                        continue

                    valid_active_count += 1
                    nginx_lines.append(f"push {target_url};")

            save_routes_to_disk(new_destinations)

            # Write fallback file for reference, but DO NOT reload nginx to avoid dropping OBS!
            conf_content = "\n".join(nginx_lines) + "\n" if nginx_lines else "# No active routes\n"
            try:
                with open(DEST_CONF, "w") as f:
                    f.write(conf_content)
            except Exception:
                pass

            # Dynamically synchronize running FFmpeg forwarders with ZERO encoder disruption
            sync_processes(preferred_key=stream_key)

            log(f"Routes synchronized: {len(new_destinations)} total, {valid_active_count} active (Forwarders: {list(active_processes.keys())})")

            self._send_json(200, {
                "success": True,
                "message": f"Broadcast routes synchronized ({valid_active_count} active)",
                "warnings": warnings,
                "activeCount": valid_active_count,
                "runningForwarders": list(active_processes.keys())
            })
        except Exception as e:
            log(f"POST handler exception: {e}")
            self._send_json(500, {"success": False, "error": str(e)})

    def log_message(self, format, *args):
        log(f"HTTP: {format % args}")

if __name__ == "__main__":
    load_routes_from_disk()
    t = threading.Thread(target=background_monitor, daemon=True)
    t.start()
    server = HTTPServer(("127.0.0.1", PORT), RouterHandler)
    log(f"Stream router service active on 127.0.0.1:{PORT}")
    server.serve_forever()
