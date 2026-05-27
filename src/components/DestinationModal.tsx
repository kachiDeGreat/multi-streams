import { useState } from "react";
import { X, ArrowRight } from "lucide-react";
import styles from "../styles/DashboardView.module.css";
import type { Destination } from "./MultiStreamCard";

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (destination: Destination) => void;
  initialData?: Destination | null;
}

export const DestinationModal = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}: DestinationModalProps) => {
  // Initialize state directly from initialData to avoid cascading renders in useEffect
  const [modalStep, setModalStep] = useState(1);

  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    if (!initialData) return "";
    return ["YouTube", "Facebook", "Twitch", "Kick"].includes(
      initialData.platform,
    )
      ? initialData.platform
      : "";
  });

  const [rtmpUrl, setRtmpUrl] = useState(() => initialData?.rtmpUrl || "");
  const [streamKey, setStreamKey] = useState(
    () => initialData?.streamKey || "",
  );

  const [customPlatformName, setCustomPlatformName] = useState(() => {
    if (!initialData) return "";
    return ["YouTube", "Facebook", "Twitch", "Kick"].includes(
      initialData.platform,
    )
      ? ""
      : initialData.platform;
  });

  const [error, setError] = useState("");

  const isPresetPlatform = (platform: string) => {
    return ["YouTube", "Facebook", "Twitch", "Kick"].includes(platform);
  };

  const handleNext = () => {
    setError("");

    if (!rtmpUrl) {
      setError("Please select a platform or enter a custom RTMP URL.");
      return;
    }

    if (!rtmpUrl.startsWith("rtmp://") && !rtmpUrl.startsWith("rtmps://")) {
      setError("Server address must start with rtmp:// or rtmps://");
      return;
    }

    let currentPlatform = selectedPlatform;
    if (!currentPlatform) {
      const urlLower = rtmpUrl.toLowerCase();
      if (urlLower.includes("youtube")) currentPlatform = "YouTube";
      else if (urlLower.includes("facebook")) currentPlatform = "Facebook";
      else if (urlLower.includes("twitch")) currentPlatform = "Twitch";
      else if (urlLower.includes("kick")) currentPlatform = "Kick";

      if (currentPlatform) {
        setSelectedPlatform(currentPlatform);
      }
    }

    setModalStep(2);
  };

  const resetState = () => {
    setModalStep(1);
    setSelectedPlatform("");
    setRtmpUrl("");
    setStreamKey("");
    setCustomPlatformName("");
    setError("");
  };

  // Use a key on the modal component in the parent (DashboardView) to reset state
  // or handle reset when the modal is closed/opened via the onClose/onSave handlers.
  // To fix the cascading render, we ensure state is only updated when isOpen changes
  // from false to true, effectively acting as an initialization.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    const isPreset = initialData
      ? isPresetPlatform(initialData.platform)
      : false;
    setModalStep(1);
    setSelectedPlatform(initialData && isPreset ? initialData.platform : "");
    setCustomPlatformName(initialData && !isPreset ? initialData.platform : "");
    setRtmpUrl(initialData?.rtmpUrl || "");
    setStreamKey(initialData?.streamKey || "");
    setError("");
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  if (!isOpen) return null;

  const handleSave = () => {
    const finalPlatform = selectedPlatform || customPlatformName || "Custom";

    const newDest: Destination = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      platform: finalPlatform,
      label: `${finalPlatform} Stream`,
      enabled: initialData ? initialData.enabled : false,
      rtmpUrl: rtmpUrl,
      streamKey: streamKey,
    };

    onSave(newDest);
    resetState();
  };

  const handleModalClose = () => {
    resetState();
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>New destination</h2>
          <button className={styles.closeButton} onClick={handleModalClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {modalStep === 1 ? (
            <div key="step1" className={styles.stepContent}>
              <div className={styles.platformGrid}>
                <button
                  className={
                    selectedPlatform === "YouTube"
                      ? styles.platformBtnSelected
                      : styles.platformBtn
                  }
                  onClick={() => {
                    setSelectedPlatform("YouTube");
                    setRtmpUrl("rtmp://a.rtmp.youtube.com/live2");
                    setError("");
                  }}
                >
                  YouTube
                </button>

                <button
                  className={
                    selectedPlatform === "Facebook"
                      ? styles.platformBtnSelected
                      : styles.platformBtn
                  }
                  onClick={() => {
                    setSelectedPlatform("Facebook");
                    setRtmpUrl("rtmps://live-api-s.facebook.com:443/rtmp/");
                    setError("");
                  }}
                >
                  Facebook
                </button>
              </div>

              <div className={styles.termsText}>
                By continuing, you agree to the <br />
                <a href="#" className={styles.termsLink}>
                  Terms of Service
                </a>{" "}
                of the services you use.
              </div>

              <div className={styles.divider}>OR</div>

              <div className={styles.inputGroup}>
                <label>Custom server address</label>
                <input
                  type="text"
                  className={styles.customInput}
                  placeholder="rtmps://live.example.com:443/stream"
                  value={rtmpUrl}
                  onChange={(e) => {
                    setRtmpUrl(e.target.value);
                    setSelectedPlatform("");
                    setError("");
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.875rem",
                    marginTop: "-0.5rem",
                  }}
                >
                  {error}
                </div>
              )}

              <button className={styles.nextButton} onClick={handleNext}>
                Next <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <div key="step2" className={styles.stepContent}>
              {!selectedPlatform && (
                <div className={styles.inputGroup}>
                  <label>Platform Name</label>
                  <input
                    type="text"
                    className={styles.customInput}
                    placeholder="e.g. My Custom Server"
                    value={customPlatformName}
                    onChange={(e) => setCustomPlatformName(e.target.value)}
                  />
                </div>
              )}
              <div className={styles.inputGroup}>
                <label>Stream Key</label>
                <input
                  type="password"
                  className={styles.customInput}
                  placeholder="Enter your secret stream key"
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                />
              </div>
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
