// @ts-nocheck
// supabase/functions/_shared/youtubeBroadcast.ts
//
// Shared by youtube-create-broadcast (the "try immediately" path) and
// youtube-process-queue (the "retry when quota comes back" path) so the
// two never drift out of sync — both must reuse the cached stream and
// detect quota errors the exact same way.
const YT_API = "https://www.googleapis.com/youtube/v3";
export const MAX_TITLE_LENGTH = 100;

export class YouTubeQuotaExceededError extends Error {
  constructor(message = "youtube_quota_exceeded") {
    super(message);
    this.name = "YouTubeQuotaExceededError";
  }
}

async function ytFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const res = await fetch(`${YT_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // ↔ Google's quota errors are HTTP 403 with a `reason` of
    // `quotaExceeded`, `dailyLimitExceeded`, or `rateLimitExceeded` in
    // the first error entry — distinct from a plain 403 permission
    // problem (which has a different reason, e.g. `forbidden`), so we
    // check the reason rather than just the status code.
    const reason = data?.error?.errors?.[0]?.reason;
    if (res.status === 403 && /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|userRateLimitExceeded/.test(reason || "")) {
      throw new YouTubeQuotaExceededError(reason);
    }
    console.error(`[youtubeBroadcast] YouTube API error on ${path}:`, data);
    throw new Error(data?.error?.message || `YouTube API request failed: ${path}`);
  }
  return data;
}

export type CreatedBroadcast = {
  broadcastId: string;
  videoId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  rtmpUrl: string;
  streamReused: boolean;
};

// Reuses `youtube_oauth_tokens.cached_stream_*` when present instead of
// calling `liveStreams.insert` (≈50 quota units saved per broadcast — see
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md §6 for the daily budget math). If
// the cached stream was deleted/invalidated on YouTube's side (host
// removed it manually from YouTube Studio, or it's simply never been
// created for this host yet), `bind` fails with a 404-ish error and we
// transparently create a fresh stream once, cache it, and retry — the
// caller never needs to know which path was taken.
async function getOrCreateStream(
  serviceClient: any,
  accessToken: string,
  userId: string,
  title: string,
  cached: { cached_stream_id: string | null; cached_ingestion_address: string | null; cached_stream_name: string | null }
): Promise<{ streamId: string; ingestionAddress: string; streamName: string; reused: boolean }> {
  if (cached.cached_stream_id && cached.cached_ingestion_address && cached.cached_stream_name) {
    return {
      streamId: cached.cached_stream_id,
      ingestionAddress: cached.cached_ingestion_address,
      streamName: cached.cached_stream_name,
      reused: true,
    };
  }

  const stream = await ytFetch("/liveStreams?part=id,snippet,cdn,status", accessToken, {
    method: "POST",
    body: JSON.stringify({
      snippet: { title },
      cdn: { frameRate: "variable", resolution: "variable", ingestionType: "rtmp" },
    }),
  });

  const ingestionInfo = stream.cdn?.ingestionInfo;
  if (!ingestionInfo?.ingestionAddress || !ingestionInfo?.streamName) {
    throw new Error("YouTube did not return an RTMP ingestion address/stream key");
  }

  await serviceClient
    .from("youtube_oauth_tokens")
    .update({
      cached_stream_id: stream.id,
      cached_ingestion_address: ingestionInfo.ingestionAddress,
      cached_stream_name: ingestionInfo.streamName,
      cached_stream_created_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { streamId: stream.id, ingestionAddress: ingestionInfo.ingestionAddress, streamName: ingestionInfo.streamName, reused: false };
}

export async function createBroadcastWithCachedStream(
  serviceClient: any,
  accessToken: string,
  userId: string,
  title: string
): Promise<CreatedBroadcast> {
  const { data: tokenRow } = await serviceClient
    .from("youtube_oauth_tokens")
    .select("cached_stream_id, cached_ingestion_address, cached_stream_name")
    .eq("user_id", userId)
    .maybeSingle();

  const broadcast = await ytFetch("/liveBroadcasts?part=id,snippet,contentDetails,status", accessToken, {
    method: "POST",
    body: JSON.stringify({
      snippet: { title, scheduledStartTime: new Date().toISOString() },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true, latencyPreference: "ultraLow" },
    }),
  });

  let streamInfo = await getOrCreateStream(serviceClient, accessToken, userId, title, tokenRow || {});

  try {
    await ytFetch(`/liveBroadcasts/bind?id=${broadcast.id}&streamId=${streamInfo.streamId}&part=id,contentDetails`, accessToken, {
      method: "POST",
    });
  } catch (err) {
    if (!streamInfo.reused) throw err; // a freshly created stream failing to bind is a real error
    // The cached stream is stale (deleted on YouTube's side) — clear the
    // cache, create a new one, and retry the bind exactly once.
    console.warn("[youtubeBroadcast] cached stream failed to bind, recreating:", err);
    await serviceClient
      .from("youtube_oauth_tokens")
      .update({ cached_stream_id: null, cached_ingestion_address: null, cached_stream_name: null, cached_stream_created_at: null })
      .eq("user_id", userId);
    streamInfo = await getOrCreateStream(serviceClient, accessToken, userId, title, {});
    await ytFetch(`/liveBroadcasts/bind?id=${broadcast.id}&streamId=${streamInfo.streamId}&part=id,contentDetails`, accessToken, {
      method: "POST",
    });
  }

  return {
    broadcastId: broadcast.id,
    videoId: broadcast.id,
    streamId: streamInfo.streamId,
    ingestionAddress: streamInfo.ingestionAddress,
    streamName: streamInfo.streamName,
    rtmpUrl: `${streamInfo.ingestionAddress}/${streamInfo.streamName}`,
    streamReused: streamInfo.reused,
  };
}

export async function deleteBroadcastBestEffort(accessToken: string, broadcastId: string) {
  try {
    await fetch(`${YT_API}/liveBroadcasts?id=${broadcastId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // best-effort only
  }
}

export async function insertLivesRow(
  serviceClient: any,
  { roomName, userId, title, created }: { roomName: string; userId: string; title: string; created: CreatedBroadcast }
) {
  return serviceClient.from("lives").insert({
    room_name: roomName,
    host_id: userId,
    title,
    status: "live",
    provider: "youtube",
    recording_status: "none",
    youtube_broadcast_id: created.broadcastId,
    youtube_stream_id: created.streamId,
    youtube_video_id: created.videoId,
    youtube_ingestion_address: created.ingestionAddress,
    youtube_stream_name: created.streamName,
  });
}

// YouTube/Google API quotas reset at midnight Pacific Time. Used to give
// a queued request a sensible `next_attempt_at` on its *first* quota
// failure (later failures fall back to exponential backoff — see
// youtube-process-queue — in case the quota was raised but is still
// tight, or the reset-time math is thrown off by DST edge cases).
export function nextPacificMidnightUtc(from = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(from);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const pacificNowAsUtc = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  );
  const msUntilMidnight = 24 * 60 * 60 * 1000 - (pacificNowAsUtc.getTime() % (24 * 60 * 60 * 1000));
  return new Date(from.getTime() + msUntilMidnight + 60_000); // +1 min safety margin
}
