// lib/youtube-platform.web.tsx
import { forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";
export type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";

type GoogleCodeClient = { requestCode: () => void };
type GoogleIdentity = {
  accounts?: { oauth2?: { initCodeClient: (options: {
    client_id: string;
    scope: string;
    ux_mode: "popup";
    access_type: "offline";
    callback: (response: { code?: string; error?: string }) => void;
  }) => GoogleCodeClient } };
};
type GoogleWindow = Window & { google?: GoogleIdentity };

// ============================================================
// Google Identity Services (web) — offline-access auth code
// ============================================================
// Loaded lazily so the script tag is never injected on native (this
// file only bundles for web). The OAuth Client used here must be a
// "Web application" type with this exact origin registered under
// "Authorized JavaScript origins" AND "Authorized redirect URIs" in
// Google Cloud Console. See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md.
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gisLoadPromise: Promise<void> | null = null;
function loadGisScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("No DOM available"));
  if ((window as GoogleWindow).google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services script"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

export async function requestYouTubeAuthCode(): Promise<YouTubeAuthCodeResult> {
  await loadGisScript();
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured");

  return new Promise((resolve, reject) => {
    try {
      const google = (window as GoogleWindow).google;
      if (!google?.accounts?.oauth2) throw new Error("Google Identity Services is unavailable");
      const client = google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: YOUTUBE_SCOPE,
        ux_mode: "popup",
        access_type: "offline",
        callback: (response: { code?: string; error?: string }) => {
          if (response.error || !response.code) {
            reject(new Error(response.error || "لم يتم منح صلاحية يوتيوب"));
            return;
          }
          // Web's auth-code flow (unlike native offline access) uses the
          // page's own origin as the implicit redirect target — Google's
          // token endpoint expects the *exact* registered redirect_uri
          // for this OAuth Client's web flow, which for `initCodeClient`
          // popup mode is the current origin. Confirm this matches what
          // was registered in Cloud Console for this deployment.
          resolve({ authCode: response.code, redirectUri: window.location.origin });
        },
      });
      client.requestCode();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ============================================================
// RTMP camera broadcaster — NOT supported in a browser
// ============================================================
// There is no supported way for a web page to encode camera input to
// H.264/RTMP and push it to YouTube directly — browsers can only send
// WebRTC (which YouTube Live's ingest does not accept) or raw
// MediaRecorder blobs (no RTMP muxing). Hosting a broadcast from the web
// build therefore is NOT possible from inside this screen; the practical
// path is: create the broadcast here (to get a stream key), then push to
// it from OBS/other RTMP encoder software running on the host's computer.
// See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md, section "Web platform".
export const YouTubeCameraBroadcaster = forwardRef<YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps>(
  ({ style, onConnectionFailed }, ref) => {
    useImperativeHandle(ref, () => ({
      start: () => {
        onConnectionFailed?.(
          new Error("البث من المتصفح غير متاح — استخدم تطبيق الموبايل، أو انسخ مفتاح البث لبرنامج مثل OBS.")
        );
      },
      stop: () => undefined,
      switchCamera: () => undefined,
      setMicMuted: () => undefined,
    }));

    return (
      <View style={[style, styles.container]}>
        <Text style={styles.text}>
          البث المباشر بالكاميرا غير متاح من المتصفح. استخدم تطبيق الموبايل، أو استخدم مفتاح البث مع برنامج مثل OBS.
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { backgroundColor: "#111", alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "#e5e7eb", fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 20 },
});
