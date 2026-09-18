import { supabase } from "./supabase";
import { requestYouTubeAuthCode } from "./youtube-platform";

export type YouTubeBroadcastInfo = {
  broadcastId: string;
  videoId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string; // RTMP stream key
  rtmpUrl: string;
};

export type CreateBroadcastResult =
  | ({ queued: false } & YouTubeBroadcastInfo)
  | { queued: true; queueId: string; message: string };

// ↔ replaces the old fetchLiveKitToken() retry loop — same shape (small
// bounded retries with backoff) for genuinely transient failures (cold
// Edge Function start, a slow YouTube round trip timing out). A `queued`
// response is NOT a failure — it means the daily YouTube API quota is
// exhausted and the request was queued server-side for automatic retry
// (see supabase/functions/youtube-process-queue) — so it's returned
// immediately, without consuming a retry attempt.
export async function createYouTubeBroadcast(
  roomName: string,
  title: string,
  retries = 2,
  delay = 800
): Promise<CreateBroadcastResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await supabase.functions.invoke<CreateBroadcastResult | { error: string }>(
      "youtube-create-broadcast",
      { body: { roomName, title } }
    );

    if (!error && data && "queued" in data) {
      return data as CreateBroadcastResult;
    }

    const errorCode = (data as { error?: string } | null)?.error || error?.message;
    if (errorCode === "youtube_not_connected") {
      throw new YouTubeNotConnectedError();
    }

    if (attempt === retries) {
      throw error || new Error(errorCode || "youtube-create-broadcast returned an incomplete response");
    }
    await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
  }
  throw new Error("youtube-create-broadcast failed after retries");
}

// ↔ once a queued request's row flips to status='completed' (see
// useQueuedBroadcastStatus below), youtube-process-queue has already
// inserted the real `lives` row server-side — this just reads it back
// into the same shape createYouTubeBroadcast()'s immediate path returns,
// so the caller's "broadcast is ready" code path doesn't need to know
// which of the two ever happened.
export async function fetchBroadcastInfoForRoom(roomName: string): Promise<YouTubeBroadcastInfo> {
  const { data, error } = await supabase
    .from("lives")
    .select("youtube_broadcast_id, youtube_stream_id, youtube_video_id, youtube_ingestion_address, youtube_stream_name")
    .eq("room_name", roomName)
    .single();
  if (error) throw error;
  if (
    !data.youtube_broadcast_id ||
    !data.youtube_stream_id ||
    !data.youtube_video_id ||
    !data.youtube_ingestion_address ||
    !data.youtube_stream_name
  ) {
    throw new Error("Live room has no YouTube ingestion details yet");
  }
  return {
    broadcastId: data.youtube_broadcast_id,
    videoId: data.youtube_video_id,
    streamId: data.youtube_stream_id,
    ingestionAddress: data.youtube_ingestion_address,
    streamName: data.youtube_stream_name,
    rtmpUrl: `${data.youtube_ingestion_address}/${data.youtube_stream_name}`,
  };
}

export type QueuedBroadcastStatus = "pending" | "processing" | "completed" | "failed";

// ↔ live-updates a queued broadcast request's status (see the "قائمة
// الانتظار" screen in app/live/broadcast.tsx) via the same Realtime
// postgres_changes mechanism the chat/presence hooks use — no polling.
export function subscribeToQueuedBroadcast(
  queueId: string,
  onUpdate: (status: QueuedBroadcastStatus, lastError: string | null) => void
) {
  const channel = supabase
    .channel(`youtube_broadcast_queue:${queueId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "youtube_broadcast_queue", filter: `id=eq.${queueId}` },
      (payload) => {
        const row = payload.new as { status: QueuedBroadcastStatus; last_error: string | null };
        onUpdate(row.status, row.last_error);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function cancelQueuedBroadcast(queueId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_youtube_queue_item", { p_queue_id: queueId });
  if (error) throw error;
}

export class YouTubeNotConnectedError extends Error {
  constructor() {
    super("youtube_not_connected");
    this.name = "YouTubeNotConnectedError";
  }
}

export async function isYouTubeConnected(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_youtube_connected");
  if (error) {
    console.warn("[youtube] is_youtube_connected check failed:", error);
    return false;
  }
  return !!data;
}

// ↔ triggers the native/web Google Sign-In "offline access" prompt (see
// lib/youtube-platform.*), then hands the resulting one-time auth code to
// the youtube-oauth-connect Edge Function, which is the only place that
// ever exchanges it using the app's client secret.
export async function connectYouTubeAccount(): Promise<{ connected: true; channelId: string | null }> {
  const { authCode, redirectUri } = await requestYouTubeAuthCode();

  const { data, error } = await supabase.functions.invoke<{ connected: boolean; channelId: string | null; error?: string }>(
    "youtube-oauth-connect",
    { body: { authCode, redirectUri } }
  );

  if (error || !data?.connected) {
    throw new Error(data?.error || error?.message || "فشل ربط حساب يوتيوب");
  }
  return { connected: true, channelId: data.channelId ?? null };
}

// ↔ replaces endLiveRoom() + LiveKit's stopRecording() — see
// supabase/functions/youtube-end-broadcast for why these collapse into
// one call now (YouTube auto-records; there's no separate Egress step).
export async function endYouTubeBroadcast(roomName: string, durationSec?: number): Promise<void> {
  const { error } = await supabase.functions.invoke("youtube-end-broadcast", {
    body: { roomName, durationSec },
  });
  if (error) console.warn("Failed to end YouTube broadcast cleanly:", error);
}

// ↔ replaces sendLiveMessage() — chat is now a direct table insert.
// Rate limiting, room-is-live validation, and the chat block-list check
// all happen server-side in the `live_messages_enforce_rules` trigger
// (see the YouTube migration), so a rejected insert here IS the
// server's answer — there's no separate "relayed: false" response
// shape to check anymore, just a thrown Postgres error.
export async function sendLiveMessage(
  roomName: string,
  senderId: string,
  senderName: string,
  type: "comment" | "like",
  text?: string
): Promise<void> {
  const { error } = await supabase.from("live_messages").insert({
    room_name: roomName,
    sender_id: senderId,
    sender_name: senderName,
    message_type: type,
    text: type === "comment" ? text : null,
  });
  if (error) {
    // rate_limited / blocked_from_chat / live_not_active are expected,
    // recoverable rejections raised by the trigger — not worth
    // surfacing as a hard error to the caller beyond a console warning.
    console.warn("Failed to send live message:", error.message);
  }
}

// ↔ replaces kickParticipant(). See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md
// for why this only blocks further *chat* messages — YouTube's API has
// no way to disconnect a specific viewer from the embedded player itself.
export async function blockLiveViewer(roomName: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("block_live_viewer", { p_room_name: roomName, p_user_id: userId });
  if (error) throw error;
}

export async function unblockLiveViewer(roomName: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_live_viewer", { p_room_name: roomName, p_user_id: userId });
  if (error) throw error;
}
