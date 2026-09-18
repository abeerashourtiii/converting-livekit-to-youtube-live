import type { StyleProp, ViewStyle } from "react-native";

export type YouTubeAuthCodeResult = { authCode: string; redirectUri: string };

export type YouTubeCameraBroadcasterRef = {
  start: (rtmpUrl: string) => void;
  stop: () => void;
  switchCamera: () => void;
  setMicMuted: (muted: boolean) => void;
};

export type YouTubeCameraBroadcasterProps = {
  style?: StyleProp<ViewStyle>;
  initialFacingMode: "user" | "environment";
  onConnectionFailed?: (error: Error) => void;
};