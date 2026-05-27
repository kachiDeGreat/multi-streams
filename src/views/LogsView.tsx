import { useState, useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import styles from "../styles/LogsView.module.css";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

export const LogsView = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "1",
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
      level: "info",
      message: "AWS NGINX Relay Engine initialized. Listening on port 1935...",
    },
  ]);

  const endOfLogsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfLogsRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const fakeLogMessages = [
      {
        level: "info" as const,
        message: "Incoming RTMP connection from 192.168.1.45",
      },
      {
        level: "success" as const,
        message: "Stream [myStream] published successfully",
      },
      {
        level: "info" as const,
        message: "HLS Segmenter: writing fragment stream-0.ts",
      },
      {
        level: "warn" as const,
        message: "Keyframe interval drift detected (2.1s)",
      },
      {
        level: "info" as const,
        message: "Pushing stream to YouTube active gateway...",
      },
    ];

    const interval = setInterval(() => {
      const randomLog =
        fakeLogMessages[Math.floor(Math.random() * fakeLogMessages.length)];

      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          level: randomLog.level,
          message: randomLog.message,
        },
      ]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className={styles.logsContainer}>
      <div className={styles.terminalHeader}>
        <div className={styles.headerTitle}>
          <Terminal size={20} color="#a855f7" />
          Server Relay Logs
        </div>
        <div className={styles.headerControls}>
          <button className={styles.clearBtn} onClick={clearLogs}>
            <Trash2
              size={14}
              style={{
                display: "inline",
                marginRight: "4px",
                verticalAlign: "middle",
              }}
            />
            Clear Output
          </button>
        </div>
      </div>

      <div className={styles.terminalWindow}>
        {logs.map((log) => (
          <div key={log.id} className={styles.logLine}>
            <span className={styles.timestamp}>[{log.timestamp}]</span>
            <span className={styles[`level_${log.level}`]}>
              {log.level.toUpperCase()}
            </span>
            <span className={styles.message}>{log.message}</span>
          </div>
        ))}
        <div ref={endOfLogsRef} />
      </div>
    </div>
  );
};
