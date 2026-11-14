import { useState } from "react";
import {
  Radio,
  Server,
  Copy,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";
interface BroadcastStatusCardProps {
  serverHost: string;
  streamKey: string;
}

export const BroadcastStatusCard = ({
  serverHost,
  streamKey,
}: BroadcastStatusCardProps) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const ingestUrl = `rtmp://${serverHost}/live`;

  const copyToClipboard = (text: string, type: "url" | "key") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast.success("RTMP Server URL copied!");
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast.success("Stream Key copied!");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid rgba(63, 63, 70, 0.6)",
        borderRadius: "14px",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Header Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: "700",
                color: "#f4f4f5",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Broadcast Relay Engine
            </h2>
            <p
              style={{
                fontSize: "0.8rem",
                color: "#71717a",
                margin: "0.25rem 0 0 0",
              }}
            >
              Real-time RTMP Multicast Ingestion
            </p>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            padding: "0.35rem 0.75rem",
            borderRadius: "6px",
            color: "#4ade80",
            fontSize: "0.78rem",
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
            }}
          />
          Direct Ingestion Engine
        </div>
      </div>

      {/* Ingest Details Box */}
      <div
        style={{
          backgroundColor: "#121215",
          border: "1px solid #27272a",
          borderRadius: "10px",
          padding: "1.25rem",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.25rem",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#a1a1aa",
              marginBottom: "0.4rem",
            }}
          >
            RTMP Ingest URL (vMix, OBS, Wirecast, Atem, etc.)
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              gap: "0.5rem",
            }}
          >
            <Server size={16} color="#38bdf8" />
            <input
              type="text"
              readOnly
              value={ingestUrl}
              style={{
                background: "transparent",
                border: "none",
                color: "#f4f4f5",
                fontSize: "0.9rem",
                fontFamily: "monospace",
                width: "100%",
                outline: "none",
              }}
            />
            <button
              onClick={() => copyToClipboard(ingestUrl, "url")}
              style={{
                background: "transparent",
                border: "none",
                color: copiedUrl ? "#22c55e" : "#a1a1aa",
                cursor: "pointer",
                padding: "4px",
              }}
              title="Copy URL"
            >
              {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#a1a1aa",
              marginBottom: "0.4rem",
            }}
          >
            Encoder Stream Key
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              padding: "0.5rem 0.75rem",
              gap: "0.5rem",
            }}
          >
            <Radio size={16} color="#a855f7" />
            <input
              type="text"
              readOnly
              value={streamKey}
              style={{
                background: "transparent",
                border: "none",
                color: "#f4f4f5",
                fontSize: "0.9rem",
                fontFamily: "monospace",
                width: "100%",
                outline: "none",
              }}
            />
            <button
              onClick={() => copyToClipboard(streamKey, "key")}
              style={{
                background: "transparent",
                border: "none",
                color: copiedKey ? "#22c55e" : "#a1a1aa",
                cursor: "pointer",
                padding: "4px",
              }}
              title="Copy Key"
            >
              {copiedKey ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
