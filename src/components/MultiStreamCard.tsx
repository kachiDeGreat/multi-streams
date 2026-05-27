import { Plus, Trash2, Edit2, Radio } from "lucide-react";
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
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (dest: Destination) => void;
  onDelete: (id: string) => void;
}

export const MultiStreamCard = ({
  destinations,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
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

  return (
    <div className={styles.multiStreamCard}>
      <div className={styles.sidebarHeader}>
        <h2>Multistreaming</h2>
        <button className={styles.addButton} onClick={onAdd}>
          <Plus size={16} />
        </button>
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
                  width: "32px",
                  height: "32px",
                  backgroundColor: "#27272a",
                  borderRadius: "8px",
                }}
              >
                {renderPlatformLogo(dest.platform)}
              </div>

              <div>
                <h3>{dest.label}</h3>
                <p>{dest.platform}</p>
              </div>
            </div>

            <div className={styles.destControls}>
              <button
                className={
                  dest.enabled ? styles.toggleButtonActive : styles.toggleButton
                }
                onClick={() => onToggle(dest.id)}
                style={{ marginRight: "0.5rem" }}
              >
                <div
                  className={
                    dest.enabled ? styles.toggleThumbActive : styles.toggleThumb
                  }
                ></div>
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => onEdit(dest)}
                title="Edit destination"
              >
                <Edit2 size={16} />
              </button>

              <button
                className={styles.deleteButton}
                onClick={() => onDelete(dest.id)}
                title="Remove destination"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
