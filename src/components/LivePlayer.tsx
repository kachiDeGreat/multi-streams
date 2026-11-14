import { useEffect, useRef, useState, useCallback, memo } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Radio,
  WifiOff,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  Square,
} from "lucide-react";
import toast from "react-hot-toast";
import type { StreamHealthStatus } from "./MetricsPanel";

interface LivePlayerProps {
  streamUrl: string;
  streamKey: string;
  serverHost?: string;
  onLiveStatusChange?: (isLive: boolean) => void;
  onHealthChange?: (health: StreamHealthStatus, secondsLeft?: number) => void;
  onActiveStreamDetected?: (detectedKey: string) => void;
  onStopAllDestinations?: () => void;
}

const LivePlayerComponent = ({
  streamUrl,
  streamKey,
  serverHost = "multi-stream.duckdns.org",
  onLiveStatusChange,
  onHealthChange,
  onActiveStreamDetected,
  onStopAllDestinations,
}: LivePlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const [isLive, setIsLive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [streamTime, setStreamTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState(60);
  const [showControls, setShowControls] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLiveRef = useRef(false);
  isLiveRef.current = isLive;

  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onLiveStatusChangeRef = useRef(onLiveStatusChange);
  onLiveStatusChangeRef.current = onLiveStatusChange;

  const onHealthChangeRef = useRef(onHealthChange);
  onHealthChangeRef.current = onHealthChange;

  const onActiveStreamDetectedRef = useRef(onActiveStreamDetected);
  onActiveStreamDetectedRef.current = onActiveStreamDetected;

  const onStopAllDestinationsRef = useRef(onStopAllDestinations);
  onStopAllDestinationsRef.current = onStopAllDestinations;

  // Immediate Stop Broadcast handler (Emergency Off for all platforms)
  const handleEndBroadcast = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    stopHlsPlayback();
    onStopAllDestinationsRef.current?.();
    toast.success("Broadcast stopped. All platform routes disconnected.", {
      icon: "⏹️",
      id: "broadcast-stopped-manual",
    });
  };

  // Notify parent of live status without re-triggering effect
  useEffect(() => {
    onLiveStatusChangeRef.current?.(isLive);
  }, [isLive]);

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Main stream detection and Hls lifecycle
  useEffect(() => {
    let hls: Hls | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let isSubscribed = true;

    const video = videoRef.current;
    if (!video) return;

    // Ensure initial muted and playsInline for autoplay policy compliance
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    let consecutiveMisses = 0;

    // Zero-console-error stream detector: checks /stat (always returns HTTP 200 OK)
    // Never requests .m3u8 when offline so browser console stays completely clean
    const checkServerStatus = async (): Promise<string | null> => {
      const cleanCurrentKey = (streamKey || "").trim();
      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

      try {
        const primaryUrl = isHttps ? `/relay-stat?t=${Date.now()}` : `http://${serverHost}/stat?t=${Date.now()}`;
        let res = await fetch(primaryUrl);
        if (!res.ok && isHttps) {
          res = await fetch(`/api/relay-stat?t=${Date.now()}`);
        }
        if (!res.ok) return null;
        const xml = await res.text();

        // 1. Configured stream key is actively publishing
        if (
          cleanCurrentKey &&
          xml.includes(`<name>${cleanCurrentKey}</name>`) &&
          xml.includes("<publishing/>")
        ) {
          return cleanCurrentKey;
        }

        // 2. Auto-detect ANY active publishing stream on the server
        const streamRegex = /<stream>([\s\S]*?)<\/stream>/g;
        let match;
        while ((match = streamRegex.exec(xml)) !== null) {
          const streamBlock = match[1];
          if (
            streamBlock.includes("<publishing/>") ||
            streamBlock.includes("<publishing>")
          ) {
            const nameMatch = streamBlock.match(/<name>(.*?)<\/name>/);
            if (nameMatch && nameMatch[1]) {
              const activeKey = nameMatch[1].trim();
              if (activeKey) {
                return activeKey;
              }
            }
          }
        }

        return null;
      } catch {
        return null;
      }
    };

    const stopHlsPlayback = () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
      setIsLive(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setIsReconnecting(false);
      onHealthChangeRef.current?.("OFFLINE", 0);
      toast("Broadcast stopped by encoder.", { icon: "⏹️", id: "stream-stopped" });
      pollNext(2500);
    };

    const enterReconnectingMode = () => {
      if (reconnectIntervalRef.current) return;

      setIsReconnecting(true);
      setReconnectSeconds(60);
      onHealthChangeRef.current?.("RECONNECTING", 60);

      toast.loading("Stream connection interrupted. Holding your live broadcast session (60s)...", {
        id: "reconnect-hold",
      });

      if (hls) {
        hls.destroy();
        hls = null;
      }

      reconnectIntervalRef.current = setInterval(async () => {
        if (!isSubscribed) return;

        const activeKey = await checkServerStatus();
        if (activeKey) {
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          setIsReconnecting(false);
          toast.success("Encoder reconnected! Broadcast resumed smoothly.", {
            id: "reconnect-hold",
          });
          startHlsPlayback(activeKey);
          return;
        }

        setReconnectSeconds((prev) => {
          if (prev <= 1) {
            stopHlsPlayback();
            toast.error("Broadcast session ended after 60s timeout.", {
              id: "reconnect-hold",
            });
            return 0;
          }
          const nextSec = prev - 1;
          onHealthChangeRef.current?.("RECONNECTING", nextSec);
          return nextSec;
        });
      }, 1000);
    };

    const startHlsPlayback = (activeKey?: string) => {
      if (!isSubscribed || hls) return;

      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      setIsReconnecting(false);

      const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
      const targetKey = (activeKey || streamKey || "").trim();
      const targetUrl = targetKey
        ? (isHttps ? `/relay-hls/${targetKey}.m3u8` : `http://${serverHost}/hls/${targetKey}.m3u8`)
        : streamUrl;

      if (activeKey && activeKey !== streamKey.trim()) {
        onActiveStreamDetectedRef.current?.(activeKey);
      }

      if (Hls.isSupported()) {
        // Standard, rock-solid Hls configuration with resilient startup retries
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxLiveSyncPlaybackRate: 1.5,
          manifestLoadingMaxRetry: 20,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 30000,
          fragLoadingMaxRetry: 12,
          fragLoadingRetryDelay: 1000,
        });

        // Ensure video is unmuted or muted properly before attach
        video.muted = isMuted;
        video.defaultMuted = isMuted;

        hls.loadSource(targetUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isSubscribed) return;
          setIsLive(true);
          setIsBuffering(false);
          onHealthChangeRef.current?.("EXCELLENT", 0);
          video.play().catch(() => {
            // If browser autoplay policy blocked audio, mute and try again
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
          toast.success("Live preview connected!", { id: "live-signal" });
        });

        hls.on(Hls.Events.FRAG_PARSED, () => {
          if (!isSubscribed) return;
          setIsBuffering(false);
          if (video.paused) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (!isSubscribed) return;
          setIsLive(true);
          onHealthChangeRef.current?.("EXCELLENT", 0);
          if (video.paused) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.ERROR, async (_, data) => {
          if (!isSubscribed) return;

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Check if the stream is still publishing on the server
                const stillActive = await checkServerStatus();
                if (stillActive && hls) {
                  // Manifest may still be generating on cold start - retry cleanly
                  setTimeout(() => {
                    if (isSubscribed && hls) {
                      hls.loadSource(targetUrl);
                      hls.startLoad();
                    }
                  }, 1500);
                } else if (isLiveRef.current) {
                  enterReconnectingMode();
                } else {
                  // Give it one more check before declaring stopped
                  setTimeout(async () => {
                    if (!isSubscribed) return;
                    const confirmActive = await checkServerStatus();
                    if (confirmActive && hls) {
                      hls.loadSource(targetUrl);
                      hls.startLoad();
                    } else if (hls) {
                      stopHlsPlayback();
                    }
                  }, 2000);
                }
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
                hls?.recoverMediaError();
                break;

              default:
                if (isLiveRef.current) {
                  enterReconnectingMode();
                } else {
                  stopHlsPlayback();
                }
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          setIsLive(true);
          setIsBuffering(false);
          onHealthChangeRef.current?.("EXCELLENT", 0);
          video.play().catch(() => {});
        });
        video.addEventListener("error", () => {
          if (isLiveRef.current) {
            enterReconnectingMode();
          } else {
            setIsLive(false);
            setIsBuffering(false);
            onHealthChangeRef.current?.("OFFLINE", 0);
            pollNext(3000);
          }
        });
      }
    };

    const pollLoop = async () => {
      if (!isSubscribed) return;

      if (!hls && !reconnectIntervalRef.current) {
        const activeKey = await checkServerStatus();
        if (activeKey) {
          consecutiveMisses = 0;
          startHlsPlayback(activeKey);
        } else {
          pollNext(2000);
        }
      } else if (hls) {
        // While streaming, monitor if operator stopped encoder
        const activeKey = await checkServerStatus();
        if (!activeKey) {
          consecutiveMisses++;
          // Only trigger reconnection after 3 consecutive failed checks (~8s)
          if (consecutiveMisses >= 3) {
            consecutiveMisses = 0;
            enterReconnectingMode();
          } else {
            pollNext(2500);
          }
        } else {
          consecutiveMisses = 0;
          pollNext(3000);
        }
      }
    };

    const pollNext = (delayMs: number) => {
      if (!isSubscribed) return;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = setTimeout(pollLoop, delayMs);
    };

    // Begin background monitoring
    pollLoop();

    return () => {
      isSubscribed = false;
      if (pollTimer) clearTimeout(pollTimer);
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      if (hls) {
        hls.destroy();
        hls = null;
      }
    };
  }, [serverHost, streamKey, streamUrl]);

  // Live timer tick
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isLive && !isReconnecting) {
      interval = setInterval(() => {
        setStreamTime((prev) => prev + 1);
      }, 1000);
    } else if (!isLive) {
      setStreamTime(0);
    }

    return () => clearInterval(interval);
  }, [isLive, isReconnecting]);

  // Auto-hide controls overlay on mouse inactivity
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && videoRef.current.volume === 0) {
      videoRef.current.volume = 1;
      setVolume(1);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const toggleFullScreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onClick={() => {
        if (isLive && videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          } else {
            togglePlay();
          }
        }
      }}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        backgroundColor: "#000000",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        border: "1px solid rgba(63, 63, 70, 0.6)",
        cursor: isLive ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {/* 
        CRITICAL: Video element MUST ALWAYS be display: block!
        Never hide with display: none, otherwise Chromium fails to initialize 
        hardware decoder pipeline and paints black.
      */}
      <video
        ref={videoRef}
        autoPlay
        muted={isMuted}
        playsInline
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        onWaiting={() => {
          if (videoRef.current && videoRef.current.readyState < 3) {
            setIsBuffering(true);
          }
        }}
        onTimeUpdate={() => {
          if (isBuffering) setIsBuffering(false);
        }}
        onCanPlay={() => {
          setIsBuffering(false);
          if (videoRef.current?.paused) {
            videoRef.current.play().catch(() => {});
          }
        }}
        onLoadedData={() => {
          setIsBuffering(false);
          videoRef.current?.play().catch(() => {});
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: "#000000",
          display: "block",
        }}
      />

      {/* YouTube Studio Live Status Bar (Top Header Overlay) */}
      {isLive && !isReconnecting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "1rem 1.25rem",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 75%, transparent 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 15,
            opacity: showControls || !isPlaying ? 1 : 0,
            transition: "opacity 0.25s ease",
            pointerEvents: showControls || !isPlaying ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: YouTube Studio LIVE Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                backgroundColor: "#cc0000",
                padding: "0.3rem 0.65rem",
                borderRadius: "4px",
                boxShadow: "0 2px 6px rgba(204,0,0,0.4)",
              }}
            >
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  animation: "yt-pulse 1.5s infinite",
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                }}
              >
                LIVE
              </span>
            </div>

            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(6px)",
                padding: "0.3rem 0.65rem",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span
                style={{
                  color: "#e4e4e7",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              >
                {formatTime(streamTime)}
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.35)",
                backdropFilter: "blur(4px)",
                padding: "0.3rem 0.65rem",
                borderRadius: "4px",
                color: "#4ade80",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={13} /> EXCELLENT CONNECTION
            </div>
          </div>

          {/* Right: End Stream Action */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={handleEndBroadcast}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                backgroundColor: "#dc2626",
                border: "none",
                borderRadius: "4px",
                padding: "0.35rem 0.8rem",
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "0.05em",
                boxShadow: "0 2px 8px rgba(220,38,38,0.45)",
                transition: "all 0.15s ease",
              }}
              title="Stop stream and turn off all platform destinations"
            >
              <Square size={12} fill="white" /> END STREAM
            </button>
          </div>
        </div>
      )}

      {/* YouTube Studio Center Buffering Spinner */}
      {isLive && isBuffering && !isReconnecting && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
            }}
          >
            <style>{`
              @keyframes yt-spinner-rot {
                100% {
                  transform: rotate(360deg);
                }
              }
              @keyframes yt-spinner-dash {
                0% {
                  stroke-dasharray: 1, 200;
                  stroke-dashoffset: 0;
                }
                50% {
                  stroke-dasharray: 120, 200;
                  stroke-dashoffset: -30;
                }
                100% {
                  stroke-dasharray: 120, 200;
                  stroke-dashoffset: -125;
                }
              }
              @keyframes yt-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(1.1); }
              }
            `}</style>
            <svg
              viewBox="0 0 100 100"
              style={{
                width: "100%",
                height: "100%",
                animation: "yt-spinner-rot 1.4s linear infinite",
              }}
            >
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="#ffffff"
                strokeWidth="5.5"
                strokeLinecap="round"
                style={{
                  animation: "yt-spinner-dash 1.4s ease-in-out infinite",
                }}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Audio Muted Indicator Banner (Like YouTube Studio preview) */}
      {isLive && isMuted && !isReconnecting && (
        <div
          onClick={toggleMute}
          style={{
            position: "absolute",
            top: "4.5rem",
            left: "1.25rem",
            backgroundColor: "rgba(24, 24, 27, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(8px)",
            padding: "0.45rem 0.85rem",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.78rem",
            color: "#e4e4e7",
            zIndex: 16,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            transition: "all 0.2s ease",
          }}
          title="Click to enable church audio"
        >
          <VolumeX size={15} color="#ef4444" />
          <span>Audio muted for preview — Click to listen</span>
        </div>
      )}

      {/* YouTube Studio Live Controls Bar (Bottom) */}
      {isLive && !isReconnecting && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "1.5rem 1.25rem 0.85rem 1.25rem",
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 65%, transparent 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 15,
            opacity: showControls || !isPlaying ? 1 : 0,
            transition: "opacity 0.25s ease",
            pointerEvents: showControls || !isPlaying ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Controls: Play/Pause, Volume, Live badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={togglePlay}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "6px",
                borderRadius: "50%",
                transition: "background 0.15s ease",
              }}
              title={isPlaying ? "Pause (k)" : "Play (k)"}
            >
              {isPlaying ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
            </button>

            {/* Volume Control */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <button
                onClick={toggleMute}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "6px",
                }}
                title={isMuted ? "Unmute (m)" : "Mute (m)"}
              >
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  width: "65px",
                  height: "4px",
                  cursor: "pointer",
                  accentColor: "#ffffff",
                }}
                title={`Volume ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Red Live Dot Indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginLeft: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#cc0000",
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                LIVE
              </span>
            </div>
          </div>

          {/* Right Controls: Zero-Transcode badge & Fullscreen */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                color: "#a1a1aa",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Radio size={14} color="#22c55e" /> Zero Transcode Active
            </span>

            <button
              onClick={toggleFullScreen}
              style={{
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "6px",
                borderRadius: "4px",
              }}
              title="Full screen (f)"
            >
              <Maximize size={19} />
            </button>
          </div>
        </div>
      )}

      {/* YouTube-Style Stream Interrupted / Reconnecting Overlay */}
      {isReconnecting && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(15, 15, 18, 0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            padding: "2rem",
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(249, 115, 22, 0.15)",
              border: "2px solid #f97316",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#f97316",
              marginBottom: "1rem",
              animation: "pulse 1.8s infinite",
            }}
          >
            <WifiOff size={30} />
          </div>

          <h3
            style={{
              color: "#f4f4f5",
              fontSize: "1.25rem",
              fontWeight: 700,
              margin: "0 0 0.5rem 0",
              letterSpacing: "-0.01em",
            }}
          >
            Stream Interrupted — Reconnecting...
          </h3>
          <p
            style={{
              color: "#a1a1aa",
              fontSize: "0.85rem",
              maxWidth: "440px",
              lineHeight: "1.5",
              margin: "0 0 1.25rem 0",
            }}
          >
            Waiting for streaming software (vMix, OBS) to re-establish connection. Your broadcast session and destination routes are held active.
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "rgba(249, 115, 22, 0.12)",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              padding: "0.45rem 0.95rem",
              borderRadius: "20px",
              fontSize: "0.82rem",
              color: "#fb923c",
              fontWeight: 600,
            }}
          >
            <Clock size={15} /> Holding Session: {reconnectSeconds}s remaining
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={handleEndBroadcast}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#dc2626",
                border: "none",
                borderRadius: "6px",
                padding: "0.55rem 1.25rem",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(220, 38, 38, 0.45)",
                transition: "all 0.2s ease",
              }}
            >
              <Square size={13} fill="white" /> End Broadcast Now (Off All Platforms)
            </button>
          </div>
        </div>
      )}

      {/* 
        Awaiting Broadcast Standby Screen (YouTube Studio Style)
        Overlaid on top of the <video> element when not live.
      */}
      {!isLive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            color: "#a1a1aa",
            textAlign: "center",
            background: "radial-gradient(circle at center, #18181b 0%, #09090b 100%)",
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Radar Transmission Animation */}
          <div
            style={{
              position: "relative",
              width: "76px",
              height: "76px",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "2px solid #ef4444",
                opacity: 0.35,
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ef4444",
                boxShadow: "0 0 15px rgba(239, 68, 68, 0.25)",
              }}
            >
              <Radio size={24} style={{ animation: "pulse 2s infinite" }} />
            </div>
          </div>

          <h2
            style={{
              color: "#f4f4f5",
              marginBottom: "0.5rem",
              fontSize: "1.3rem",
              fontWeight: "700",
              letterSpacing: "-0.01em",
            }}
          >
            Connect Streaming Software to Start Preview
          </h2>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a1a1aa",
              maxWidth: "480px",
              lineHeight: "1.5",
              margin: "0 0 1.5rem 0",
            }}
          >
            Send a video stream from your broadcast software (vMix, OBS, Wirecast, Atem Mini) using the ingest settings below. The preview will automatically appear.
          </p>

          {/* YouTube Studio Style Stream Ingest Credentials Box */}
          <div
            style={{
              backgroundColor: "rgba(24, 24, 27, 0.85)",
              border: "1px solid rgba(63, 63, 70, 0.6)",
              padding: "0.85rem 1.25rem",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              fontSize: "0.82rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <span
                style={{
                  color: "#71717a",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                }}
              >
                Stream URL
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <code style={{ color: "#38bdf8", fontFamily: "monospace", fontSize: "0.85rem" }}>
                  rtmp://{serverHost}/live
                </code>
                <button
                  onClick={() => handleCopy(`rtmp://${serverHost}/live`, "Stream URL")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copiedField === "Stream URL" ? "#22c55e" : "#a1a1aa",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Copy Stream URL"
                >
                  {copiedField === "Stream URL" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ width: "1px", height: "30px", backgroundColor: "#3f3f46" }} />

            <div style={{ textAlign: "left" }}>
              <span
                style={{
                  color: "#71717a",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  marginBottom: "2px",
                }}
              >
                Stream Key
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <code style={{ color: "#a855f7", fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {streamKey}
                </code>
                <button
                  onClick={() => handleCopy(streamKey, "Stream Key")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: copiedField === "Stream Key" ? "#22c55e" : "#a1a1aa",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Copy Stream Key"
                >
                  {copiedField === "Stream Key" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const LivePlayer = memo(LivePlayerComponent);
function stopHlsPlayback() {
  throw new Error("Function not implemented.");
}

