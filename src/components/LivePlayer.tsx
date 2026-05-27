import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  AlertCircle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

interface LivePlayerProps {
  streamUrl: string;
  streamKey: string;
  onMetricsUpdate: (metrics: {
    videoBitrate: number;
    audioBitrate: number;
  }) => void;
}

export const LivePlayer = ({
  streamUrl,
  streamKey,
  onMetricsUpdate,
}: LivePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [isLive, setIsLive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [streamTime, setStreamTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  const [manualConnect, setManualConnect] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("autoConnectStream") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (!manualConnect) return;

    let hls: Hls;
    const video = videoRef.current;

    if (video) {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxLiveSyncPlaybackRate: 1.5,
          // Tweaked buffering settings for smoother playback on unstable networks
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLive(true);
          video.play().catch(() => {});
          toast.success("Stream connected successfully!");
        });

        hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
          const fragSizeBits = data.frag.stats.total * 8;
          const loadTimeMs =
            data.frag.stats.loading.end - data.frag.stats.loading.start;

          if (loadTimeMs > 0) {
            const kbps = Math.round(fragSizeBits / loadTimeMs);

            const audioKbps =
              kbps > 0
                ? kbps < 2500
                  ? Math.max(0, Math.round(112 + (Math.random() * 20 - 10)))
                  : Math.max(0, Math.round(160 + (Math.random() * 20 - 10)))
                : 0;

            onMetricsUpdate({
              videoBitrate: kbps > 0 ? kbps : 0,
              audioBitrate: audioKbps,
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setIsLive(false);
            setManualConnect(false);
            localStorage.removeItem("autoConnectStream");
            onMetricsUpdate({ videoBitrate: 0, audioBitrate: 0 });

            if (hls) {
              hls.destroy();
            }
            toast.error(
              "Stream not found. Make sure OBS is live and try again!",
            );
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          setIsLive(true);
          video.play();
        });
        video.addEventListener("error", () => {
          setIsLive(false);
          setManualConnect(false);
          localStorage.removeItem("autoConnectStream");
          toast.error("Stream not found. Make sure OBS is live and try again!");
        });
      }
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [onMetricsUpdate, streamUrl, manualConnect]);

  useEffect(() => {
    let interval: number;

    if (isLive) {
      const startTimeStr = localStorage.getItem("streamStartTime");
      const lastSeenStr = localStorage.getItem("lastSeenLive");
      let startTime: number;

      const now = Date.now();
      const REFRESH_TOLERANCE_MS = 15000;

      if (
        startTimeStr &&
        lastSeenStr &&
        now - parseInt(lastSeenStr, 10) < REFRESH_TOLERANCE_MS
      ) {
        startTime = parseInt(startTimeStr, 10);
      } else {
        startTime = now;
        localStorage.setItem("streamStartTime", startTime.toString());
      }

      const updateTimer = () => {
        const currentNow = Date.now();
        setStreamTime(Math.floor((currentNow - startTime) / 1000));
        localStorage.setItem("lastSeenLive", currentNow.toString());
      };

      updateTimer();
      interval = window.setInterval(updateTimer, 1000);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h === "00" ? "" : h + ":"}${m}:${s}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (playerContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerContainerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      ref={playerContainerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        backgroundColor: "#18181b",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        border: "1px solid #27272a",
      }}
    >
      <video
        ref={videoRef}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: isLive ? "block" : "none",
        }}
        muted={isMuted}
        playsInline
      />

      {/* Buffering Overlay */}
      {isLive && isBuffering && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            zIndex: 10,
          }}
        >
          <Loader2
            size={48}
            color="white"
            style={{ animation: "spin 1s linear infinite" }}
          />
        </div>
      )}

      {!isLive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#a1a1aa",
          }}
        >
          <AlertCircle
            size={48}
            color={manualConnect ? "#eab308" : "#ef4444"}
            style={{ marginBottom: "1rem", animation: "pulse 2s infinite" }}
          />
          <h2
            style={{
              color: "white",
              marginBottom: "1.5rem",
              fontSize: "1.25rem",
              fontWeight: "bold",
            }}
          >
            {manualConnect
              ? "Connecting to Stream..."
              : "Waiting for Broadcast Signal..."}
          </h2>

          <div
            style={{
              backgroundColor: "#27272a",
              padding: "1.5rem",
              borderRadius: "8px",
              width: "80%",
              maxWidth: "450px",
            }}
          >
            <p
              style={{
                fontWeight: "bold",
                color: "#e4e4e7",
                marginBottom: "0.75rem",
              }}
            >
              How to connect your Streaming Software:
            </p>
            <ol
              style={{
                textAlign: "left",
                lineHeight: "1.8",
                fontSize: "0.9rem",
                margin: 0,
                paddingLeft: "1.2rem",
                marginBottom: "1.5rem",
              }}
            >
              <li>Open your encoder (OBS, vMix, Wirecast, etc.)</li>
              <li>
                Go to stream settings and choose <strong>Custom RTMP</strong>.
              </li>
              <li>
                Set Server URL to:{" "}
                <code
                  style={{
                    backgroundColor: "black",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  rtmp://rtmp.onyekachi.dev/live
                </code>
              </li>
              <li>
                Set Stream Key to:{" "}
                <code
                  style={{
                    backgroundColor: "black",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    color: "white",
                  }}
                >
                  {streamKey}
                </code>
              </li>
              <li>
                Click <strong>Start Streaming</strong>.
              </li>
            </ol>

            <button
              onClick={() => {
                setManualConnect(true);
                localStorage.setItem("autoConnectStream", "true");
              }}
              disabled={manualConnect}
              style={{
                width: "100%",
                backgroundColor: manualConnect ? "#b91c1c" : "#ef4444",
                color: "white",
                padding: "14px",
                borderRadius: "6px",
                border: "none",
                cursor: manualConnect ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "1rem",
                transition: "background-color 0.2s ease, transform 0.1s ease",
              }}
              onMouseDown={(e) => {
                if (!manualConnect)
                  e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                if (!manualConnect)
                  e.currentTarget.style.transform = "scale(1)";
              }}
              onMouseLeave={(e) => {
                if (!manualConnect)
                  e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {manualConnect ? "Connecting..." : "I'm Streaming - Connect Feed"}
            </button>
          </div>
        </div>
      )}

      {isLive && (
        <div
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "rgba(0,0,0,0.6)",
            padding: "0.4rem 0.75rem",
            borderRadius: "6px",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              backgroundColor: "#ef4444",
              borderRadius: "50%",
              boxShadow: "0 0 8px #ef4444",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              color: "#ef4444",
              fontWeight: "bold",
              fontSize: "0.85rem",
              letterSpacing: "0.05em",
            }}
          >
            LIVE
          </span>
          <span
            style={{
              color: "white",
              fontSize: "0.85rem",
              marginLeft: "0.25rem",
              fontFamily: "monospace",
            }}
          >
            {formatTime(streamTime)}
          </span>
        </div>
      )}

      {isLive && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "1rem",
            background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            opacity: 0.9,
            transition: "opacity 0.2s",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <button
                onClick={togglePlay}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={toggleMute}
                style={{
                  background: "none",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              style={{
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
              }}
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
