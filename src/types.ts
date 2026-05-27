export interface StreamDestination {
  id: string;
  platform: string;
  label: string;
  rtmpUrl: string;
  streamKey: string;
  enabled: boolean;
  status: "online" | "offline" | "connecting";
  bitrate: string;
}
