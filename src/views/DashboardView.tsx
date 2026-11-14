import { useState, useRef, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  MultiStreamCard,
  type Destination,
} from "../components/MultiStreamCard";
import { DestinationModal } from "../components/DestinationModal";
import { ObsSetupCard } from "../components/ObsSetupCard";
import { ObsSetupModal } from "../components/ObsSetupModal";
import { ObsSettingsModal } from "../components/ObsSettingsModal";
import { LivePlayer } from "../components/LivePlayer";
import { BroadcastStatusCard } from "../components/BroadcastStatusCard";
import { MetricsPanel, type StreamHealthStatus } from "../components/MetricsPanel";
import styles from "../styles/DashboardView.module.css";

const SERVER_HOST =
  typeof window !== "undefined" &&
  window.location.hostname &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? window.location.hostname
    : (import.meta.env.VITE_RELAY_HOST || "multi-stream.duckdns.org");

const generateStreamKey = () => {
  const p1 = Math.random().toString(36).substring(2, 5);
  const p2 = Math.random().toString(36).substring(2, 4);
  const p3 = Math.random().toString(36).substring(2, 5);
  return `${p1}-${p2}-${p3}`;
};

const DEFAULT_DESTINATIONS: Destination[] = [
  {
    id: "yt-1",
    platform: "YouTube",
    label: "YouTube Channel",
    enabled: false,
    rtmpUrl: "rtmp://a.rtmp.youtube.com/live2/",
    streamKey: "",
  },
  {
    id: "fb-1",
    platform: "Facebook",
    label: "Facebook Page",
    enabled: false,
    rtmpUrl: "rtmps://live-api-s.facebook.com:443/rtmp/",
    streamKey: "",
  },
];

export const DashboardView = () => {
  const [streamKey, setStreamKey] = useState(() => {
    const savedKey = localStorage.getItem("app_stream_key");
    if (savedKey) return savedKey;

    const newKey = "myStream";
    localStorage.setItem("app_stream_key", newKey);
    return newKey;
  });

  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const streamUrl = isHttps
    ? `/relay-hls/${streamKey}.m3u8`
    : `http://${SERVER_HOST}/hls/${streamKey}.m3u8`;

  const [destinations, setDestinations] = useState<Destination[]>(() => {
    const saved = localStorage.getItem("app_destinations");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return DEFAULT_DESTINATIONS;
  });

  const [isLiveStreamActive, setIsLiveStreamActive] = useState(false);
  const [streamHealth, setStreamHealth] = useState<StreamHealthStatus>("OFFLINE");
  const [reconnectSeconds, setReconnectSeconds] = useState(0);

  const handleLiveStatusChange = useCallback((isLive: boolean) => {
    setIsLiveStreamActive(isLive);
  }, []);

  const handleHealthChange = useCallback(
    (health: StreamHealthStatus, secondsLeft?: number) => {
      setStreamHealth(health);
      if (secondsLeft !== undefined) {
        setReconnectSeconds(secondsLeft);
      }
    },
    []
  );

  const handleActiveStreamDetected = useCallback((detectedKey: string) => {
    setStreamKey((prev) => {
      if (detectedKey && detectedKey !== prev) {
        localStorage.setItem("app_stream_key", detectedKey);
        return detectedKey;
      }
      return prev;
    });
  }, []);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("app_sidebar_width");
    return saved ? Math.max(300, Math.min(540, parseInt(saved, 10))) : 380;
  });

  const isResizingRef = useRef(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(300, Math.min(540, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setSidebarWidth((curr) => {
        localStorage.setItem("app_sidebar_width", curr.toString());
        return curr;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);
  const [isRtmpModalOpen, setIsRtmpModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const saveDestinations = (updated: Destination[]) => {
    setDestinations(updated);
    localStorage.setItem("app_destinations", JSON.stringify(updated));
  };

  interface SyncOptions {
    silent?: boolean;
    platformName?: string;
    isStarting?: boolean;
  }

  const syncRouterToAWS = async (
    currentDestinations: Destination[],
    options?: SyncOptions
  ) => {
    const isSilent = options?.silent === true;
    const platformName = options?.platformName;
    const isStarting = options?.isStarting;

    let syncToast: string | undefined;
    if (!isSilent) {
      if (platformName) {
        syncToast = toast.loading(
          isStarting ? `Starting ${platformName}...` : `Stopping ${platformName}...`
        );
      } else {
        syncToast = toast.loading("Connecting destinations...");
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("/api/sync-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinations: currentDestinations,
          streamKey: streamKey || "myStream",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        if (!isSilent && syncToast) {
          toast.error(`Could not update stream: ${result.error || "Server error"}`, { id: syncToast });
        }
      } else {
        if (!isSilent && syncToast) {
          if (platformName) {
            toast.success(
              isStarting
                ? `Success! ${platformName} is now live.`
                : `${platformName} stopped.`,
              { id: syncToast }
            );
          } else {
            toast.success("Multicast streams connected!", { id: syncToast });
          }
        }
        if (result.warnings && Array.isArray(result.warnings)) {
          result.warnings.forEach((warn: string) => {
            toast.error(warn, { duration: 6000, icon: "⚠️" });
          });
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === "AbortError";
      if (!isSilent && syncToast) {
        toast.error(
          isTimeout
            ? "Connection took too long. Please check your internet."
            : `Network error: ${err?.message || "Failed to reach server"}.`,
          { id: syncToast, duration: 6000 }
        );
      }
    }
  };

  const toggleDestination = (id: string) => {
    const target = destinations.find((d) => d.id === id);
    if (!target) return;

    if (!target.enabled) {
      // 1. Validation: Stream key missing
      if (!target.streamKey || target.streamKey.trim() === "") {
        toast.error(
          `Please enter your stream key for ${target.label || target.platform} first. Click the pencil icon to edit.`,
          { duration: 5500, icon: "🔑" }
        );
        openEditModal(target);
        return;
      }
    }

    const willBeEnabled = !target.enabled;
    const platformName = target.label || target.platform;

    const updated = destinations.map((dest) =>
      dest.id === id ? { ...dest, enabled: willBeEnabled } : dest,
    );
    saveDestinations(updated);
    syncRouterToAWS(updated, {
      silent: false,
      platformName: platformName,
      isStarting: willBeEnabled,
    });
  };

  const handleSaveDestination = (savedDest: Destination) => {
    let updated: Destination[];
    if (editingDest) {
      updated = destinations.map((d) =>
        d.id === savedDest.id ? savedDest : d,
      );
    } else {
      updated = [...destinations, savedDest];
    }

    saveDestinations(updated);
    setIsModalOpen(false);
    setEditingDest(null);
    toast.success("Destination saved");
    // Update routes silently in background without noisy popup
    syncRouterToAWS(updated, { silent: true });
  };

  const openEditModal = (dest: Destination) => {
    setEditingDest(dest);
    setIsModalOpen(true);
  };

  const removeDestination = (id: string) => {
    const updated = destinations.filter((dest) => dest.id !== id);
    saveDestinations(updated);
    toast.success("Destination removed");
    // Update routes silently in background without noisy popup
    syncRouterToAWS(updated, { silent: true });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDest(null);
  };

  const stopAllDestinations = useCallback(() => {
    const updated = destinations.map((d) => ({ ...d, enabled: false }));
    saveDestinations(updated);
    syncRouterToAWS(updated, {
      silent: false,
      platformName: "All streams",
      isStarting: false,
    });
  }, [destinations, streamKey]);

  return (
    <div
      className={styles.dashboardContainer}
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr 340px` }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#27272a",
            color: "#fff",
            border: "1px solid #3f3f46",
          },
        }}
      />

      <aside className={styles.leftSidebar} style={{ position: "relative" }}>
        <MultiStreamCard
          destinations={destinations}
          isLive={isLiveStreamActive}
          onToggle={toggleDestination}
          onAdd={() => setIsModalOpen(true)}
          onEdit={openEditModal}
          onDelete={removeDestination}
          onStopAll={stopAllDestinations}
        />

        <ObsSetupCard
          onRtmpClick={() => setIsRtmpModalOpen(true)}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
        />

        {/* Resizable Drag Splitter */}
        <div
          onMouseDown={startResizing}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "-12px",
            width: "12px",
            cursor: "col-resize",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Drag to resize panel"
        >
          <div
            style={{
              width: "3px",
              height: "44px",
              borderRadius: "2px",
              backgroundColor: "rgba(113, 113, 122, 0.4)",
              transition: "all 0.2s ease",
            }}
          />
        </div>
      </aside>

      <main className={styles.mainCanvas}>
        {/* Live Video Preview Window */}
        <LivePlayer
          streamKey={streamKey}
          streamUrl={streamUrl}
          serverHost={SERVER_HOST}
          onLiveStatusChange={handleLiveStatusChange}
          onHealthChange={handleHealthChange}
          onActiveStreamDetected={handleActiveStreamDetected}
          onStopAllDestinations={stopAllDestinations}
        />

        {/* Relay Engine Telemetry Card */}
        <BroadcastStatusCard
          serverHost={SERVER_HOST}
          streamKey={streamKey}
        />
      </main>

      <aside className={styles.rightSidebar}>
        <div className={styles.rightHeader}>
          <h2>System Telemetry</h2>
          <ExternalLink size={18} className={styles.headerIcon} />
        </div>

        <MetricsPanel
          healthStatus={streamHealth}
          reconnectTimeRemaining={reconnectSeconds}
        />
      </aside>

      <DestinationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveDestination}
        initialData={editingDest}
      />

      <ObsSetupModal
        isOpen={isRtmpModalOpen}
        onClose={() => setIsRtmpModalOpen(false)}
        streamKey={streamKey}
        onResetKey={() => {
          const newKey = generateStreamKey();
          setStreamKey(newKey);
          localStorage.setItem("app_stream_key", newKey);
          toast.success("Stream key regenerated! Update your encoder.");
        }}
      />

      <ObsSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
  );
};
