import { useState } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Radio,
  Key,
} from "lucide-react";
import { FaYoutube, FaFacebook, FaTwitch } from "react-icons/fa";
import styles from "../styles/DashboardView.module.css";
import type { Destination } from "./MultiStreamCard";

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (destination: Destination) => void;
  initialData?: Destination | null;
}

const PRESET_CONFIGS: Record<
  string,
  { name: string; url: string; help: string }
> = {
  YouTube: {
    name: "YouTube",
    url: "rtmp://a.rtmp.youtube.com/live2/",
    help: "Found in YouTube Studio > Stream Settings > Stream Key",
  },
  Facebook: {
    name: "Facebook",
    url: "rtmps://live-api-s.facebook.com:443/rtmp/",
    help: "Found in Facebook Live Producer > Stream Setup > Stream Key",
  },
  Twitch: {
    name: "Twitch",
    url: "rtmp://live.twitch.tv/app/",
    help: "Found in Twitch Creator Dashboard > Settings > Stream",
  },
};

export const DestinationModal = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}: DestinationModalProps) => {
  const [modalStep, setModalStep] = useState(() => (initialData ? 2 : 1));

  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    if (!initialData) return "";
    return PRESET_CONFIGS[initialData.platform] ? initialData.platform : "";
  });

  const [rtmpUrl, setRtmpUrl] = useState(() => initialData?.rtmpUrl || "");
  const [streamKey, setStreamKey] = useState(
    () => initialData?.streamKey || "",
  );
  const [customPlatformName, setCustomPlatformName] = useState(() => {
    if (!initialData) return "";
    return PRESET_CONFIGS[initialData.platform] ? "" : initialData.platform;
  });

  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Sync state when modal opens
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    if (initialData) {
      const isPreset = Boolean(PRESET_CONFIGS[initialData.platform]);
      setSelectedPlatform(isPreset ? initialData.platform : "");
      setCustomPlatformName(isPreset ? "" : initialData.platform);
      setRtmpUrl(initialData.rtmpUrl || "");
      setStreamKey(initialData.streamKey || "");
      setModalStep(2); // Jump straight to key/edit for existing destination
    } else {
      setSelectedPlatform("");
      setCustomPlatformName("");
      setRtmpUrl("");
      setStreamKey("");
      setModalStep(1);
    }
    setShowKey(false);
    setError("");
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  if (!isOpen) return null;

  const handleSelectPreset = (platformKey: string) => {
    const config = PRESET_CONFIGS[platformKey];
    if (!config) return;

    setSelectedPlatform(config.name);
    setCustomPlatformName("");
    setRtmpUrl(config.url);
    setError("");
    setModalStep(2);
  };

  const handleSelectCustom = () => {
    setSelectedPlatform("");
    if (!customPlatformName) setCustomPlatformName("Custom Platform");
    if (!rtmpUrl) setRtmpUrl("rtmp://");
    setError("");
    setModalStep(2);
  };

  const handleCustomNext = () => {
    setError("");
    if (selectedPlatform && PRESET_CONFIGS[selectedPlatform]) {
      setRtmpUrl(PRESET_CONFIGS[selectedPlatform].url);
      setModalStep(2);
      return;
    }

    let url = rtmpUrl.trim();
    if (!url) {
      // If nothing entered, default to custom setup
      handleSelectCustom();
      return;
    }

    if (!url.startsWith("rtmp://") && !url.startsWith("rtmps://")) {
      url = `rtmp://${url}`;
    }

    setRtmpUrl(url);
    setSelectedPlatform("");
    if (!customPlatformName) setCustomPlatformName("Custom Destination");
    setModalStep(2);
  };

  const resetState = () => {
    setModalStep(1);
    setSelectedPlatform("");
    setRtmpUrl("");
    setStreamKey("");
    setCustomPlatformName("");
    setError("");
    setShowKey(false);
  };

  const handleSave = () => {
    const cleanKey = streamKey.trim();
    if (!cleanKey) {
      setError("Stream key cannot be empty. Please paste your platform stream key.");
      return;
    }

    let finalUrl = rtmpUrl.trim();
    if (!finalUrl) {
      if (selectedPlatform && PRESET_CONFIGS[selectedPlatform]) {
        finalUrl = PRESET_CONFIGS[selectedPlatform].url;
      } else {
        setError("RTMP server address cannot be empty.");
        return;
      }
    }

    if (!finalUrl.startsWith("rtmp://") && !finalUrl.startsWith("rtmps://")) {
      finalUrl = `rtmp://${finalUrl}`;
    }

    const finalPlatform = selectedPlatform || customPlatformName.trim() || "Custom";

    const newDest: Destination = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      platform: finalPlatform,
      label: initialData?.label || `${finalPlatform} Stream`,
      enabled: initialData ? initialData.enabled : false,
      rtmpUrl: finalUrl,
      streamKey: cleanKey,
    };

    onSave(newDest);
    resetState();
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "youtube":
        return <FaYoutube size={22} color="#ef4444" />;
      case "facebook":
        return <FaFacebook size={22} color="#3b82f6" />;
      case "twitch":
        return <FaTwitch size={22} color="#a855f7" />;
      default:
        return <Radio size={22} color="#818cf8" />;
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ maxWidth: "480px" }}>
        <div className={styles.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {modalStep === 2 && !initialData && (
              <button
                onClick={() => setModalStep(1)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 0.25rem 0 0",
                }}
                title="Back to platform choices"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2>
              {initialData
                ? `Edit ${initialData.label}`
                : modalStep === 1
                ? "Add Destination"
                : `Connect ${selectedPlatform || "Custom Platform"}`}
            </h2>
          </div>

          <button className={styles.closeButton} onClick={handleModalClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {modalStep === 1 ? (
            <div key="step1" className={styles.stepContent}>
              <p
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.85rem",
                  margin: "0 0 0.5rem 0",
                  lineHeight: "1.4",
                }}
              >
                Choose a platform to automatically configure its RTMP server settings:
              </p>

              {/* 1-Click Platform Selection Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <button
                  type="button"
                  className={styles.platformBtn}
                  onClick={() => handleSelectPreset("YouTube")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.9rem",
                    justifyContent: "flex-start",
                  }}
                >
                  <FaYoutube size={24} color="#ef4444" />
                  <span style={{ fontWeight: 600 }}>YouTube</span>
                </button>

                <button
                  type="button"
                  className={styles.platformBtn}
                  onClick={() => handleSelectPreset("Facebook")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.9rem",
                    justifyContent: "flex-start",
                  }}
                >
                  <FaFacebook size={24} color="#3b82f6" />
                  <span style={{ fontWeight: 600 }}>Facebook</span>
                </button>

                <button
                  type="button"
                  className={styles.platformBtn}
                  onClick={() => handleSelectPreset("Twitch")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.9rem",
                    justifyContent: "flex-start",
                  }}
                >
                  <FaTwitch size={24} color="#a855f7" />
                  <span style={{ fontWeight: 600 }}>Twitch</span>
                </button>

                <button
                  type="button"
                  className={styles.platformBtn}
                  onClick={handleSelectCustom}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.9rem",
                    justifyContent: "flex-start",
                  }}
                >
                  <Radio size={24} color="#818cf8" />
                  <span style={{ fontWeight: 600 }}>Custom RTMP</span>
                </button>
              </div>

              <div className={styles.divider}>OR MANUAL URL</div>

              <div className={styles.inputGroup}>
                <label>Custom server address</label>
                <input
                  type="text"
                  className={styles.customInput}
                  placeholder="rtmp://custom.server.com/live"
                  value={rtmpUrl}
                  onChange={(e) => {
                    setRtmpUrl(e.target.value);
                    setError("");
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginTop: "-0.5rem",
                  }}
                >
                  {error}
                </div>
              )}

              <button className={styles.nextButton} onClick={handleCustomNext}>
                Continue <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div key="step2" className={styles.stepContent}>
              {/* Platform Confirmation Banner */}
              <div
                style={{
                  backgroundColor: "rgba(39, 39, 42, 0.7)",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {getPlatformIcon(selectedPlatform || customPlatformName)}
                  <div>
                    <div style={{ fontWeight: 600, color: "white", fontSize: "0.95rem" }}>
                      {selectedPlatform || customPlatformName || "Custom RTMP Destination"}
                    </div>
                  </div>
                </div>

                {!initialData && (
                  <button
                    onClick={() => setModalStep(1)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Change
                  </button>
                )}
              </div>

              {!selectedPlatform && (
                <>
                  <div className={styles.inputGroup}>
                    <label>Platform Name</label>
                    <input
                      type="text"
                      className={styles.customInput}
                      placeholder="e.g. Church Website / Kick / Restream"
                      value={customPlatformName}
                      onChange={(e) => setCustomPlatformName(e.target.value)}
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>RTMP Ingest Server URL</label>
                    <input
                      type="text"
                      className={styles.customInput}
                      placeholder="rtmp://custom.server.com/live"
                      value={rtmpUrl}
                      onChange={(e) => {
                        setRtmpUrl(e.target.value);
                        setError("");
                      }}
                    />
                  </div>
                </>
              )}

              {/* Stream Key Input - The Core Requirement */}
              <div className={styles.inputGroup}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.35rem",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Key size={13} color="#a1a1aa" /> Stream Key (Required)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#a1a1aa",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>

                <input
                  type={showKey ? "text" : "password"}
                  className={styles.customInput}
                  placeholder={`Paste your secret ${selectedPlatform || "destination"} stream key here`}
                  value={streamKey}
                  autoFocus
                  onChange={(e) => {
                    setStreamKey(e.target.value);
                    setError("");
                  }}
                />

                {selectedPlatform && PRESET_CONFIGS[selectedPlatform] && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#71717a",
                      marginTop: "0.35rem",
                      display: "block",
                    }}
                  >
                    💡 {PRESET_CONFIGS[selectedPlatform].help}
                  </span>
                )}
              </div>

              {error && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginTop: "-0.5rem",
                  }}
                >
                  {error}
                </div>
              )}

              <button className={styles.nextButton} onClick={handleSave}>
                Save Destination
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
