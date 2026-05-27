import { Info, Key, Settings as SettingsIcon } from "lucide-react";
import styles from "../styles/DashboardView.module.css";

interface ObsSetupCardProps {
  onRtmpClick: () => void;
  onSettingsClick: () => void;
}

export const ObsSetupCard = ({
  onRtmpClick,
  onSettingsClick,
}: ObsSetupCardProps) => {
  return (
    <div className={styles.obsSetupCard}>
      <div className={styles.obsHeader}>
        <Info size={18} /> Encoder Setup
      </div>
      <div className={styles.obsItem} onClick={onRtmpClick}>
        <Key size={16} /> RTMP Key and URL
      </div>
      <div className={styles.obsItem} onClick={onSettingsClick}>
        <SettingsIcon size={16} /> Recommended Settings
      </div>
    </div>
  );
};
