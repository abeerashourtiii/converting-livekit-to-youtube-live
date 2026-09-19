// lib/youtube-platform.native.tsx
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { CameraView } from "expo-camera";
import type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";
export type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";

// ============================================================
// Google Sign-In (offline access) → one-time auth code
// ============================================================
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: [YOUTUBE_SCOPE],
    offlineAccess: true, // required to receive a serverAuthCode at all
    forceCodeForRefreshToken: true,
  });
  configured = true;
}

export async function requestYouTubeAuthCode(): Promise<YouTubeAuthCodeResult> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    const data = (response as { data?: unknown })?.data ?? response;
    const serverAuthCode = (data as { serverAuthCode?: string })?.serverAuthCode;
    if (!serverAuthCode) {
      throw new Error("Google did not return a serverAuthCode — check offlineAccess/webClientId configuration.");
    }
    return { authCode: serverAuthCode, redirectUri: "postmessage" };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("تم إلغاء تسجيل الدخول بجوجل");
    }
    throw err;
  }
}

// ============================================================
// Expo Camera Broadcaster Component
// ============================================================
export const YouTubeCameraBroadcaster = forwardRef<YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps>(
  ({ style, initialFacingMode, onConnectionFailed }, ref) => {
    const cameraRef = useRef<CameraView | null>(null);
    const [facing, setFacing] = useState<"front" | "back">(
      initialFacingMode === "user" ? "front" : "back"
    );
    const [isMuted, setIsMuted] = useState(false);

    useImperativeHandle(ref, () => ({
      start: async (rtmpUrl: string) => {
        try {
          console.log("[YouTubeLive] Starting broadcast preview with expo-camera for URL:", rtmpUrl);
          // يمكن التوسع هنا لاستدهاء بروتوكول البث عبر LiveKit أو الكاميرا
        } catch (err) {
          onConnectionFailed?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      stop: () => {
        console.log("[YouTubeLive] Stopping broadcast preview.");
      },
      switchCamera: () => {
        setFacing((prev) => (prev === "front" ? "back" : "front"));
      },
      setMicMuted: (muted: boolean) => {
        setIsMuted(muted);
      },
    }));

    return (
      <View style={[styles.container, style]}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mute={isMuted}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
});