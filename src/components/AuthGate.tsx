import { useState, useEffect, type ReactNode } from "react";
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, LogOut } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const SESSION_KEY = "church_multi_stream_session";
const SESSION_DURATION_MS = 10 * 60 * 60 * 1000; // 10 hours

interface SessionData {
  authenticated: boolean;
  expiresAt: number;
}

interface AuthGateProps {
  children: ReactNode;
}

export const AuthGate = ({ children }: AuthGateProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const rawEnvPassword =
    import.meta.env.VITE_DASHBOARD_PASSWORD || "church2026";
  const expectedPassword = String(rawEnvPassword)
    .replace(/^["']|["']$/g, "")
    .trim();

  const checkAuth = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        setIsAuthenticated(false);
        return;
      }

      const session: SessionData = JSON.parse(raw);
      const now = Date.now();

      if (session.authenticated && session.expiresAt > now) {
        setIsAuthenticated(true);
        const hoursLeft = Math.ceil((session.expiresAt - now) / (1000 * 60 * 60));
        setRemainingTime(`${hoursLeft}h left`);
      } else {
        localStorage.removeItem(SESSION_KEY);
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkAuth();
    const interval = setInterval(checkAuth, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const entered = passwordInput.trim();

    if (!entered) {
      const msg = "Please enter the console password.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    // Match against configured env password OR default "church2026"
    if (entered === expectedPassword || entered === "church2026") {
      const session: SessionData = {
        authenticated: true,
        expiresAt: Date.now() + SESSION_DURATION_MS,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setIsAuthenticated(true);
      toast.success("Access granted! Active session: 10 hours.");
    } else {
      const msg = "Incorrect password. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setPasswordInput("");
    setErrorMessage("");
    setIsAuthenticated(false);
    toast.success("Logged out successfully.");
  };

  if (isAuthenticated === null) {
    return (
      <div
        style={{
          height: "100vh",
          backgroundColor: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#a1a1aa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#27272a",
              color: "#fff",
              border: "1px solid #3f3f46",
            },
          }}
        />

        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            backgroundColor: "#18181b",
            border: "1px solid rgba(63, 63, 70, 0.7)",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(168, 85, 247, 0.15)",
              color: "#a855f7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem auto",
            }}
          >
            <Lock size={28} />
          </div>

          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: "700",
              color: "#f4f4f5",
              margin: "0 0 0.5rem 0",
              letterSpacing: "-0.02em",
            }}
          >
            Broadcast Console
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a1a1aa",
              margin: "0 0 1.75rem 0",
              lineHeight: "1.4",
            }}
          >
            Church Media Control Room • Multi-Platform Relay
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ position: "relative", textAlign: "left" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: "#a1a1aa",
                  letterSpacing: "0.05em",
                  marginBottom: "0.4rem",
                }}
              >
                Access Password
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#121215",
                  border: errorMessage ? "1px solid #ef4444" : "1px solid #3f3f46",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                }}
              >
                <KeyRound size={18} color="#71717a" style={{ marginRight: "0.6rem" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  placeholder="Enter console password"
                  autoFocus
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f4f4f5",
                    fontSize: "0.95rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#71717a",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {errorMessage && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.8rem",
                    marginTop: "0.4rem",
                    fontWeight: 500,
                  }}
                >
                  {errorMessage}
                </div>
              )}
            </div>

            <button
              type="submit"
              onClick={handleLogin}
              style={{
                backgroundColor: "#a855f7",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background 0.2s",
                boxShadow: "0 4px 14px rgba(168, 85, 247, 0.4)",
              }}
            >
              Unlock Console
            </button>
          </form>

          <div
            style={{
              marginTop: "2rem",
              paddingTop: "1.25rem",
              borderTop: "1px solid rgba(63, 63, 70, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "#71717a",
            }}
          >
            <ShieldCheck size={14} color="#22c55e" />
            <span>Active session persists for 10 hours on this device</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* Top Session Status Bar */}
      <div
        style={{
          position: "fixed",
          top: "12px",
          right: "20px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          backgroundColor: "rgba(24, 24, 27, 0.85)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(63, 63, 70, 0.6)",
          padding: "0.35rem 0.75rem",
          borderRadius: "20px",
          fontSize: "0.8rem",
          color: "#a1a1aa",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
            }}
          />
          Session: {remainingTime || "10h"}
        </span>
        <button
          onClick={handleLogout}
          title="Log out & Lock Dashboard"
          style={{
            background: "transparent",
            border: "none",
            color: "#f43f5e",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px",
          }}
        >
          <LogOut size={14} />
        </button>
      </div>

      {children}
    </div>
  );
};
