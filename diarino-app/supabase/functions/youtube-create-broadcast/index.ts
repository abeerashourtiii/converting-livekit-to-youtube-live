// @ts-nocheck
// supabase/functions/youtube-create-broadcast/index.ts
//
// Replaces both `createLiveRoom()` (Supabase insert) and the LiveKit
// `livekit-token` function. Given a room name + title, this creates an
// *unlisted* liveBroadcast + reuses (or creates) the host's liveStream,
// binds them, and inserts the `lives` row — see
// supabase/functions/_shared/youtubeBroadcast.ts for the actual YouTube
// API calls and the stream-caching logic.
//
// If YouTube's daily quota is exhausted, this does NOT fail the request:
// it enqueues it in `youtube_broadcast_queue` and returns 202 with a
// message for the host, and youtube-process-queue retries it
// automatically once quota is available again. See
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md §8.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithCors } from "../_shared/cors.ts";
import { getFreshYouTubeAccessToken, YouTubeNotConnectedError } from "../_shared/googleAuth.ts";
import {
  createBroadcastWithCachedStream,
  deleteBroadcastBestEffort,
  insertLivesRow,
  nextPacificMidnightUtc,
  MAX_TITLE_LENGTH,
  YouTubeQuotaExceededError,
} from "../_shared/youtubeBroadcast.ts";

serveWithCors(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const user = userData.user;
  if (user.is_anonymous) {
    return new Response(JSON.stringify({ error: "يجب تسجيل الدخول بحساب Google لبدء بث مباشر" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { roomName?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const roomName = body.roomName;
  const title = (body.title || "بث مباشر").slice(0, MAX_TITLE_LENGTH);
  if (!roomName) {
    return new Response(JSON.stringify({ error: "roomName is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  let accessToken: string;
  try {
    ({ accessToken } = await getFreshYouTubeAccessToken(serviceClient, user.id));
  } catch (err) {
    if (err instanceof YouTubeNotConnectedError) {
      return new Response(JSON.stringify({ error: "youtube_not_connected" }), {
        status: 428,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[youtube-create-broadcast] token refresh failed:", err);
    return new Response(JSON.stringify({ error: "Failed to authenticate with YouTube" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let created;
  try {
    created = await createBroadcastWithCachedStream(serviceClient, accessToken, user.id, title);
  } catch (err) {
    if (err instanceof YouTubeQuotaExceededError) {
      const { data: queueRow, error: queueError } = await serviceClient
        .from("youtube_broadcast_queue")
        .insert({
          user_id: user.id,
          room_name: roomName,
          title,
          next_attempt_at: nextPacificMidnightUtc().toISOString(),
        })
        .select("id")
        .single();

      if (queueError) {
        console.error("[youtube-create-broadcast] failed to enqueue after quota error:", queueError);
        return new Response(JSON.stringify({ error: "youtube_quota_exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          queued: true,
          queueId: queueRow.id,
          message:
            "انتهت حصة يوتيوب اليومية المتاحة للتطبيق. تم تسجيل طلب بثك وسيبدأ تلقائيًا فور توفر الحصة (عادة مع بداية اليوم التالي بتوقيت المحيط الهادي).",
        }),
        { status: 202, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("[youtube-create-broadcast] failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Failed to create YouTube broadcast" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const { error: insertError } = await insertLivesRow(serviceClient, { roomName, userId: user.id, title, created });
  if (insertError) {
    console.error("[youtube-create-broadcast] failed to save lives row:", insertError);
    deleteBroadcastBestEffort(accessToken, created.broadcastId);
    return new Response(JSON.stringify({ error: "Failed to save the live room" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      queued: false,
      broadcastId: created.broadcastId,
      videoId: created.videoId,
      streamId: created.streamId,
      ingestionAddress: created.ingestionAddress,
      streamName: created.streamName,
      rtmpUrl: created.rtmpUrl,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
