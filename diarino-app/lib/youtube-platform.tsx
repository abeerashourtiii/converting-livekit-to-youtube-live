// lib/youtube-platform.tsx
//
// Metro resolves "./youtube-platform" to youtube-platform.native.tsx on
// iOS/Android and youtube-platform.web.tsx on web automatically — this
// extensionless file only exists because `tsc` (unlike Metro) does NOT
// do that platform resolution on its own, so it needs *a* real module
// here to type-check imports of "./youtube-platform" against. It is not
// bundled at runtime; see the identical pattern this project already
// used for lib/livekit-platform.tsx before this migration.
import { forwardRef } from "react";
import { View } from "react-native";
import type {
  YouTubeAuthCodeResult,
  YouTubeCameraBroadcasterProps,
  YouTubeCameraBroadcasterRef,
} from "./youtube-platform.types";

export type {
  YouTubeAuthCodeResult,
  YouTubeCameraBroadcasterProps,
  YouTubeCameraBroadcasterRef,
} from "./youtube-platform.types";

// Obtains a Google "offline access" one-time authorization code with
// scope `https://www.googleapis.com/auth/youtube.force-ssl`, to be
// exchanged server-side (see supabase/functions/youtube-oauth-connect).
export async function requestYouTubeAuthCode(): Promise<YouTubeAuthCodeResult> {
  throw new Error("requestYouTubeAuthCode: platform module not resolved");
}

// The camera-preview + RTMP-encoder surface used on the host's "live"
// screen. Only meaningfully implemented on native (see
// youtube-platform.native.tsx) — the web version renders a static
// placeholder because browsers cannot push RTMP directly (see
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md).
export const YouTubeCameraBroadcaster = forwardRef<YouTubeCameraBroadcasterRef, YouTubeCameraBroadcasterProps>(
  ({ style }, _ref) => <View style={style} />
);
