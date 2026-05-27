import { useState } from "react";
import { X, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import styles from "../styles/DashboardView.module.css";

interface ObsSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamKey: string;
  onResetKey: () => void;
}

export const ObsSetupModal = ({
  isOpen,
  onClose,
  streamKey,
  onResetKey,
}: ObsSetupModalProps) => {
  const rtmpUrl = "rtmp://rtmp.onyekachi.dev/live";
  const [showKey, setShowKey] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(rtmpUrl);
    toast.success("Server URL copied to clipboard");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(streamKey);
    toast.success("Stream Key copied to clipboard");
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Encoder Setup Instructions</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div key="obs-setup" className={styles.stepContent}>
            <div className={styles.inputGroup}>
              <label>RTMP Server URL</label>
              <div className={styles.inputRow}>
                <input
                  type="text"
                  className={styles.customInput}
                  value={rtmpUrl}
                  readOnly
                  style={{ flex: 1 }}
                />
                <button
                  className={styles.actionBtn}
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Stream Key</label>
              <div className={styles.inputRow}>
                <input
                  type={showKey ? "text" : "password"}
                  className={styles.customInput}
                  value={streamKey}
                  readOnly
                  style={{ flex: 1 }}
                />
                <button
                  className={styles.actionBtn}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={handleCopyKey}
                  title="Copy Stream Key"
                >
                  <Copy size={18} />
                </button>
                <button
                  className={styles.actionBtn}
                  onClick={onResetKey}
                  title="Generate new key"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            <div
              className={styles.termsText}
              style={{ textAlign: "left", marginTop: "1rem" }}
            >
              <strong>Universal Connection Guide:</strong>
              <br />
              <br />
              1. Open your streaming software (OBS, vMix, Wirecast, etc.).
              <br />
              2. Locate the "Stream" settings and choose "Custom RTMP" or
              "Custom Server".
              <br />
              3. Paste the Server URL and Stream Key provided above.
              <br />
              4. Apply settings and go live!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
