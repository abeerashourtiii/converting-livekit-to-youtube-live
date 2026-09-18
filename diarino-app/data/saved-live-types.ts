import { Seller } from "../lib/types";

// ↔ the object pushed into savedLives[] in app-viewer.html (endBroadcast()
// / savedEntry), extended with recording tracking. As of the YouTube Live
// migration, the actual video comes from YouTube itself: every live
// broadcast is auto-archived by YouTube as a VOD on the same video id
// (youtubeVideoId) once youtube-end-broadcast transitions it to
// 'complete' — there's no separate upload/encode step on our side
// anymore. recordingStatus still starts 'recording' → 'processing' →
// 'ready', but that whole cycle now just reflects YouTube's own
// processing state; lib/hooks/useLiveRecordingStatus.ts still polls it.
export type SavedLive = {
  id: string;
  roomName: string; // ↔ correlates this local entry with its `lives` Supabase row
  title: string;
  seller: Seller;
  createdAt: number;
  durationSec: number;
  posterUrl: string | null;
  publishedPublic: boolean;
  commentsHidden: boolean;
  pinned?: boolean;
  pinnedAt?: number;
  viewerPeak: number;
  egressId?: string;
  recordingStatus: "none" | "recording" | "processing" | "ready" | "failed";
  recordingUrl: string | null;
  youtubeVideoId: string | null;
};
