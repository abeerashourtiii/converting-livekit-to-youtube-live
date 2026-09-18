// lib/youtube-platform.native.tsx
import { forwardRef, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import type { ComponentType } from "react";
import type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";
export type { YouTubeAuthCodeResult, YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps } from "./youtube-platform.types";

// ============================================================
// Google Sign-In (offline access) → one-time auth code
// ============================================================
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the OAuth 2.0 "Web application"
// client ID from Google Cloud Console (NOT the Android/iOS client) — the
// Google Sign-In SDK always needs the *web* client id as `webClientId` to
// mint a `serverAuthCode` that a backend (our Edge Function) can exchange,
// regardless of which platform is signing in. See
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md for the full Cloud Console setup.
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
    // ↔ @react-native-google-signin/google-signin v13+ wraps the result
    // as { type: 'success', data: {...} }; earlier majors returned the
    // user object directly. Handle both shapes defensively since we
    // can't pin/verify the exact installed version in this environment
    // — check the actually-installed version's README before relying
    // on this if sign-in throws a shape-related TypeError.
    const data = (response as { data?: unknown })?.data ?? response;
    const serverAuthCode = (data as { serverAuthCode?: string })?.serverAuthCode;
    if (!serverAuthCode) {
      throw new Error("Google did not return a serverAuthCode — check offlineAccess/webClientId configuration.");
    }
    // Native offline-access auth codes use the special "postmessage"
    // redirect_uri when exchanged server-side (there is no real HTTP
    // redirect involved in the native flow).
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
// RTMP camera broadcaster
// ============================================================
// ↔ IMPORTANT — read before relying on this block: `react-native-nodemediaclient`
// (and similar RTMP-push libraries) are native modules with no official
// Expo config plugin. They typically require `npx expo prebuild` (this
// project already ships android/ios folders, so that's compatible) PLUS
// manual native project edits this sandbox cannot perform or verify
// (Android Gradle/AAR linking, iOS Podfile/framework linking, and
// confirming the *exact* component/prop/method names against whatever
// version actually installs — the API below matches that library's
// commonly published shape at the time this was written, but could not
// be checked against a live `npm install` here). Treat this file as a
// first draft to validate on a real device, not a verified integration.
// See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md, section "RTMP encoder".
type NativeCameraHandle = {
  start?: (rtmpUrl: string) => void;
  stop?: () => void;
  switchCamera?: () => void;
  setAudioMute?: (muted: boolean) => void;
};
type NativeCameraProps = {
  ref?: React.Ref<NativeCameraHandle>;
  style?: YouTubeCameraBroadcasterProps["style"];
  camera: { cameraId: number; cameraFrontMirror: boolean };
  audio: { bitrate: number; profile: number; samplerate: number };
  video: { preset: number; bitrate: number; profile: number; fps: number; videoFrontMirror: boolean };
  autopreview: boolean;
};
let NodeCameraView: ComponentType<NativeCameraProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nativeModule = require("react-native-nodemediaclient") as { NodeCameraView?: ComponentType<NativeCameraProps> };
  NodeCameraView = nativeModule.NodeCameraView ?? null;
} catch (err) {
  console.warn(
    "[YouTubeLive] react-native-nodemediaclient is not linked/installed — " +
      "camera broadcasting will not work until it is. See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md.",
    err
  );
}

export const YouTubeCameraBroadcaster = forwardRef<YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps>(
  ({ style, initialFacingMode, onConnectionFailed }, ref) => {
    const nativeRef = useRef<NativeCameraHandle | null>(null);
    const facingRef = useRef<"user" | "environment">(initialFacingMode);

    useImperativeHandle(ref, () => ({
      start: (rtmpUrl: string) => {
        try {
          nativeRef.current?.start?.(rtmpUrl);
        } catch (err) {
          onConnectionFailed?.(err instanceof Error ? err : new Error(String(err)));
        }
      },
      stop: () => {
        try {
          nativeRef.current?.stop?.();
        } catch (err) {
          console.warn("[YouTubeLive] stop() failed:", err);
        }
      },
      switchCamera: () => {
        facingRef.current = facingRef.current === "user" ? "environment" : "user";
        try {
          nativeRef.current?.switchCamera?.();
        } catch (err) {
          console.warn("[YouTubeLive] switchCamera() failed:", err);
        }
      },
      setMicMuted: (muted: boolean) => {
        try {
          // Some builds expose muteAudio()/unmuteAudio(); others take a
          // prop. Both are attempted here — confirm which one your
          // installed version actually implements.
          if (typeof nativeRef.current?.setAudioMute === "function") {
            nativeRef.current.setAudioMute(muted);
          }
        } catch (err) {
          console.warn("[YouTubeLive] setMicMuted() failed:", err);
        }
      },
    }));

    if (!NodeCameraView) {
      return <View style={style} />;
    }

    return (
      <NodeCameraView
        ref={nativeRef}
        style={style}
        camera={{ cameraId: initialFacingMode === "user" ? 1 : 0, cameraFrontMirror: true }}
        audio={{ bitrate: 32000, profile: 1, samplerate: 44100 }}
        video={{ preset: 3, bitrate: 1_000_000, profile: 2, fps: 30, videoFrontMirror: false }}
        autopreview={true}
      />
    );
  }
);
