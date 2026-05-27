import { useState } from "react";
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
import { MetricsPanel } from "../components/MetricsPanel";
import styles from "../styles/DashboardView.module.css";

const cloudFrontDomain = "d1ctqd14d924df.cloudfront.net";

// Helper to generate xxx-xx-xxx key
const generateStreamKey = () => {
  const p1 = Math.random().toString(36).substring(2, 5);
  const p2 = Math.random().toString(36).substring(2, 4);
  const p3 = Math.random().toString(36).substring(2, 5);
  return `${p1}-${p2}-${p3}`;
};

export const DashboardView = () => {
  const [streamKey, setStreamKey] = useState(() => {
    const savedKey = localStorage.getItem("app_stream_key");
    if (savedKey) return savedKey;

    const newKey = generateStreamKey();
    localStorage.setItem("app_stream_key", newKey);
    return newKey;
  });

  const streamUrl = `https://${cloudFrontDomain}/hls/${streamKey}.m3u8`;

  const [destinations, setDestinations] = useState<Destination[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<Destination | null>(null);

  const [isRtmpModalOpen, setIsRtmpModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [liveMetrics, setLiveMetrics] = useState({
    videoBitrate: 0,
    audioBitrate: 0,
  });

  const syncRouterToAWS = async (currentDestinations: Destination[]) => {
    const syncToast = toast.loading("Syncing routes to AWS server...");
    try {
      const response = await fetch("/api/sync-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinations: currentDestinations }),
      });

      const result = await response.json();
      if (!result.success) {
        toast.error(`System Error: ${result.error}`, { id: syncToast });
      } else {
        toast.success("Routes active & synced!", { id: syncToast });
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Network error: Failed to reach the broadcast bridge.", {
        id: syncToast,
      });
    }
  };

  const toggleDestination = (id: string) => {
    const updated = destinations.map((dest) =>
      dest.id === id ? { ...dest, enabled: !dest.enabled } : dest,
    );
    setDestinations(updated);
    syncRouterToAWS(updated);
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

    setDestinations(updated);
    syncRouterToAWS(updated);

    setIsModalOpen(false);
    setEditingDest(null);
    toast.success("Destination saved");
  };

  const openEditModal = (dest: Destination) => {
    setEditingDest(dest);
    setIsModalOpen(true);
  };

  const removeDestination = (id: string) => {
    const updated = destinations.filter((dest) => dest.id !== id);
    setDestinations(updated);
    syncRouterToAWS(updated);
    toast.success("Destination removed");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDest(null);
  };

  return (
    <div className={styles.dashboardContainer}>
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

      <aside className={styles.leftSidebar}>
        <MultiStreamCard
          destinations={destinations}
          onToggle={toggleDestination}
          onAdd={() => setIsModalOpen(true)}
          onEdit={openEditModal}
          onDelete={removeDestination}
        />

        <ObsSetupCard
          onRtmpClick={() => setIsRtmpModalOpen(true)}
          onSettingsClick={() => setIsSettingsModalOpen(true)}
        />
      </aside>

      <main className={styles.mainCanvas}>
        <LivePlayer
          streamKey={streamKey}
          streamUrl={streamUrl}
          onMetricsUpdate={setLiveMetrics}
        />
        <div className={styles.streamInfoBar}>
          <div className={styles.infoInputWrapper} style={{ flex: 2 }}>
            <label>Stream title</label>
            <input type="text" defaultValue="Sunday Service Broadcast" />
          </div>
          <div className={styles.infoInputWrapper}>
            <label>Category</label>
            <select>
              <option>Education</option>
              <option>Entertainment</option>
              <option>Nonprofits & Activism</option>
            </select>
          </div>
          <div className={styles.infoInputWrapper}>
            <label>Content Rating</label>
            <select>
              <option>Not set</option>
              <option>Everyone</option>
              <option>Mature</option>
            </select>
          </div>
        </div>
      </main>

      <aside className={styles.rightSidebar}>
        <div className={styles.rightHeader}>
          <h2>System Monitoring</h2>
          <ExternalLink size={18} className={styles.headerIcon} />
        </div>

        <MetricsPanel
          videoBitrate={liveMetrics.videoBitrate}
          audioBitrate={liveMetrics.audioBitrate}
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
