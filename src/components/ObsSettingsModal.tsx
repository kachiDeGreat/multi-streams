import { X } from "lucide-react";
import styles from "../styles/DashboardView.module.css";

interface ObsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ObsSettingsModal = ({
  isOpen,
  onClose,
}: ObsSettingsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Recommended OBS Settings</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div key="obs-settings" className={styles.stepContent}>
            <div
              style={{ color: "#e1e1e6", fontSize: "0.95rem", lineHeight: "2" }}
            >
              <p>
                <strong>Video Bitrate:</strong> 6000 Kbps
              </p>
              <p>
                <strong>Audio Bitrate:</strong> 160 Kbps
              </p>
              <p>
                <strong>Keyframe Interval:</strong> 2s
              </p>
              <p>
                <strong>Rate Control:</strong> CBR
              </p>
              <p>
                <strong>Resolution:</strong> 1920x1080 (1080p)
              </p>
              <p>
                <strong>FPS:</strong> 60
              </p>
            </div>
            <div
              className={styles.termsText}
              style={{ textAlign: "left", marginTop: "1rem" }}
            >
              <strong>Note:</strong> Depending on your internet upload speed,
              you might need to lower the Video Bitrate. We recommend having at
              least 10 Mbps upload speed for 6000 Kbps.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
