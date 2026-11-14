import {
  CheckCircle2,
  AlertTriangle,
  Radio,
  WifiOff,
  Clock,
  ShieldCheck,
  Activity,
} from "lucide-react";
import styles from "../styles/DashboardView.module.css";

export type StreamHealthStatus =
  | "OFFLINE"
  | "EXCELLENT"
  | "GOOD"
  | "FAIR"
  | "RECONNECTING";

interface MetricsPanelProps {
  healthStatus?: StreamHealthStatus;
  reconnectTimeRemaining?: number;
}

export const MetricsPanel = ({
  healthStatus = "OFFLINE",
  reconnectTimeRemaining = 0,
}: MetricsPanelProps) => {
  const getHealthConfig = (health: StreamHealthStatus) => {
    switch (health) {
      case "EXCELLENT":
        return {
          label: "Excellent Connection",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
          border: "rgba(34, 197, 94, 0.3)",
          icon: <CheckCircle2 size={16} color="#22c55e" />,
          desc: "Stream is healthy. High bandwidth and stable keyframes ready for multi-platform delivery.",
        };
      case "GOOD":
        return {
          label: "Good Connection",
          color: "#38bdf8",
          bg: "rgba(56, 189, 248, 0.12)",
          border: "rgba(56, 189, 248, 0.3)",
          icon: <Activity size={16} color="#38bdf8" />,
          desc: "Stream signal is stable and streaming smoothly across active destinations.",
        };
      case "FAIR":
        return {
          label: "Fair (High Latency)",
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.3)",
          icon: <AlertTriangle size={16} color="#f59e0b" />,
          desc: "Connection latency detected. Check church upload bandwidth.",
        };
      case "RECONNECTING":
        return {
          label: "Stream Interrupted (Reconnecting...)",
          color: "#f97316",
          bg: "rgba(249, 115, 22, 0.15)",
          border: "rgba(249, 115, 22, 0.4)",
          icon: <WifiOff size={16} color="#f97316" />,
          desc: `Encoder connection interrupted (router/Wi-Fi lost). Holding your live session: ${reconnectTimeRemaining}s remaining.`,
        };
      case "OFFLINE":
      default:
        return {
          label: "Standby (Awaiting Signal)",
          color: "#71717a",
          bg: "rgba(113, 113, 122, 0.12)",
          border: "rgba(113, 113, 122, 0.25)",
          icon: <Radio size={16} color="#a1a1aa" />,
          desc: "Ready for incoming RTMP broadcast. Click Start Streaming in your streaming software (vMix, OBS, etc.).",
        };
    }
  };

  const healthConfig = getHealthConfig(healthStatus);

  return (
    <div className={styles.metricsList}>
      {/* Stream Health Card */}
      <div
        style={{
          backgroundColor: healthConfig.bg,
          border: `1px solid ${healthConfig.border}`,
          borderRadius: "10px",
          padding: "1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#a1a1aa",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <ShieldCheck size={14} color="#a1a1aa" /> Stream Health
          </span>

          {healthStatus === "RECONNECTING" && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "#f97316",
                fontFamily: "monospace",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Clock size={12} /> {reconnectTimeRemaining}s
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: healthConfig.color,
              boxShadow: `0 0 10px ${healthConfig.color}`,
            }}
          >
            {healthStatus !== "OFFLINE" && (
              <div
                style={{
                  position: "absolute",
                  inset: "-3px",
                  borderRadius: "50%",
                  border: `2px solid ${healthConfig.color}`,
                  opacity: 0.6,
                  animation: "ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            )}
          </div>

          <span
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: healthConfig.color,
              letterSpacing: "-0.01em",
            }}
          >
            {healthConfig.label}
          </span>
        </div>

        <p
          style={{
            fontSize: "0.82rem",
            color: "#d4d4d8",
            lineHeight: "1.5",
            margin: 0,
          }}
        >
          {healthConfig.desc}
        </p>
      </div>
    </div>
  );
};
