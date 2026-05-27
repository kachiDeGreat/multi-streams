import { useState, useEffect } from "react";
import { Activity, Volume2 } from "lucide-react";
import styles from "../styles/DashboardView.module.css";

interface MetricsPanelProps {
  videoBitrate: number;
  audioBitrate: number;
}

export const MetricsPanel = ({
  videoBitrate,
  audioBitrate,
}: MetricsPanelProps) => {
  // Keep a history of the last 20 data points to draw the graph
  const [videoHistory, setVideoHistory] = useState<number[]>(Array(20).fill(0));
  const [audioHistory, setAudioHistory] = useState<number[]>(Array(20).fill(0));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideoHistory((prev) => [...prev.slice(1), videoBitrate]);
  }, [videoBitrate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAudioHistory((prev) => [...prev.slice(1), audioBitrate]);
  }, [audioBitrate]);

  // Determine if the signal is weak (only color it red if it's actively trying to stream > 0)
  const isVideoLow = videoBitrate > 0 && videoBitrate < 2000;
  const isAudioLow = audioBitrate > 0 && audioBitrate < 128;

  const maxVideo = Math.max(...videoHistory, 6000); // Scale graph up to at least 6000 kbps
  const maxAudio = Math.max(...audioHistory, 320); // Scale graph up to at least 320 kbps

  const renderGraph = (history: number[], max: number, color: string) => {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: "40px",
          gap: "2px",
          marginTop: "12px",
        }}
      >
        {history.map((val, i) => {
          const heightPct = max > 0 ? Math.max((val / max) * 100, 2) : 2;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                backgroundColor: color,
                height: `${heightPct}%`,
                opacity: 0.8,
                borderRadius: "2px 2px 0 0",
                transition: "height 0.3s ease, background-color 0.3s ease",
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.metricsList}>
      <div className={styles.metricItem}>
        <div className={styles.metricHeader}>
          <span>Video Bitrate</span>
          <Activity size={16} color={isVideoLow ? "#ef4444" : "#818cf8"} />
        </div>
        <div
          className={styles.metricValue}
          style={{
            color: isVideoLow ? "#ef4444" : "white",
            transition: "color 0.3s ease",
          }}
        >
          {videoBitrate.toLocaleString()} kbps
        </div>
        {renderGraph(
          videoHistory,
          maxVideo,
          isVideoLow ? "#ef4444" : "#818cf8",
        )}
      </div>

      <div className={styles.metricItem}>
        <div className={styles.metricHeader}>
          <span>Audio Bitrate</span>
          <Volume2 size={16} color={isAudioLow ? "#ef4444" : "#34d399"} />
        </div>
        <div
          className={styles.metricValue}
          style={{
            color: isAudioLow ? "#ef4444" : "white",
            transition: "color 0.3s ease",
          }}
        >
          {audioBitrate} kbps
        </div>
        {renderGraph(
          audioHistory,
          maxAudio,
          isAudioLow ? "#ef4444" : "#34d399",
        )}
      </div>
    </div>
  );
};
