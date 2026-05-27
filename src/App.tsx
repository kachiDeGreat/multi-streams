import { useState } from "react";
import { LayoutDashboard, Terminal } from "lucide-react";
import { DashboardView } from "./views/DashboardView";
import { LogsView } from "./views/LogsView";
import styles from "./styles/App.module.css";

function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "logs">("dashboard");

  return (
    <div className={styles.appWorkspace}>
      <nav className={styles.navDock}>
        <div className={styles.logoMark}>M</div>

        <button
          onClick={() => setActiveTab("dashboard")}
          className={
            activeTab === "dashboard" ? styles.navItemActive : styles.navItem
          }
          title="Dashboard Console"
        >
          <LayoutDashboard size={22} />
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={
            activeTab === "logs" ? styles.navItemActive : styles.navItem
          }
          title="Live Server Logs"
        >
          <Terminal size={22} />
        </button>
      </nav>

      <div className={styles.viewStage}>
        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "logs" && <LogsView />}
      </div>
    </div>
  );
}

export default App;
