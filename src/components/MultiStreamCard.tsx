import { Plus, Trash2, Edit2, Radio, Square } from "lucide-react";
import { FaYoutube, FaFacebook, FaTwitch } from "react-icons/fa";
import styles from "../styles/DashboardView.module.css";

export interface Destination {
  id: string;
  platform: string;
  label: string;
  enabled: boolean;
  rtmpUrl: string;
  streamKey: string;
}

interface MultiStreamCardProps {
  destinations: Destination[];
  isLive?: boolean;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (dest: Destination) => void;
  onDelete: (id: string) => void;
  onStopAll?: () => void;
}

export const MultiStreamCard = ({
  destinations,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onStopAll,
}: MultiStreamCardProps) => {
  const renderPlatformLogo = (platform: string) => {
    const name = platform.toLowerCase();
    if (name.includes("youtube"))
      return <FaYoutube size={20} color="#ef4444" />;
    if (name.includes("facebook"))
      return <FaFacebook size={20} color="#3b82f6" />;
    if (name.includes("twitch")) return <FaTwitch size={20} color="#a855f7" />;
    return <Radio size={20} color="#6366f1" />;
  };

  const hasActiveStreams = destinations.some((d) => d.enabled);

  return (
    <div className={styles.multiStreamCard}>
      <div className={styles.sidebarHeader}>
        <h2>Multistreaming</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {hasActiveStreams && (
            <button
              onClick={onStopAll}
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.15)",
                border: "1px solid rgba(220, 38, 38, 0.4)",
                color: "#f87171",
                padding: "0.25rem 0.6rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.2s ease",
              }}
              title="Stop and disconnect all active streaming platforms"
            >
              <Square size={10} fill="#f87171" /> Stop All
            </button>
          )}
          <button className={styles.addButton} onClick={onAdd} title="Add Destination">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className={styles.destinationList}>
        {destinations.map((dest) => (
          <div key={dest.id} className={styles.destinationCard}>
            <div className={styles.destInfo}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "38px",
                  height: "38px",
                  backgroundColor: "#27272a",
                  borderRadius: "10px",
                  flexShrink: 0,
                }}
              >
                {renderPlatformLogo(dest.platform)}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#f4f4f5",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {dest.label}
                </h3>
                <p
                  style={{
                    margin: "3px 0 0 0",
                    fontSize: "0.78rem",
                    color: "#a1a1aa",
                  }}
                >
                  {dest.platform}
                </p>
              </div>
            </div>

            <div className={styles.destControls}>
              <button
                className={
                  dest.enabled ? styles.toggleButtonActive : styles.toggleButton
                }
                onClick={() => onToggle(dest.id)}
                style={{ marginRight: "0.4rem" }}
                title={dest.enabled ? "Disable destination" : "Enable destination"}
              >
                <div
                  className={
                    dest.enabled ? styles.toggleThumbActive : styles.toggleThumb
                  }
                />
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => onEdit(dest)}
                title="Edit destination"
              >
                <Edit2 size={15} />
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => onDelete(dest.id)}
                title="Remove destination"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
