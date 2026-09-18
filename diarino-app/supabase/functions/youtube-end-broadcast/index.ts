// @ts-nocheck
// supabase/functions/youtube-end-broadcast/index.ts
//
// Replaces `endLiveRoom()` + LiveKit's `stopRecording()`. YouTube
// auto-records every live broadcast as a VOD on the same video id — there
// is no separate "start/stop Egress" step to manage, so this only needs
// to transition the broadcast to `complete` and flip the `lives` row.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithCors } from "../_shared/cors.ts";
import { getFreshYouTubeAccessToken, YouTubeNotConnectedError } from "../_shared/googleAuth.ts";

const YT_API = "https://www.googleapis.com/youtube/v3";

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

  let body: { roomName?: string; durationSec?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const roomName = body.roomName;
  if (!roomName) {
    return new Response(JSON.stringify({ error: "roomName is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: live, error: liveError } = await serviceClient
    .from("lives")
    .select("host_id, youtube_broadcast_id, status")
    .eq("room_name", roomName)
    .maybeSingle();

  if (liveError) {
    return new Response(JSON.stringify({ error: "Failed to look up room" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!live || live.host_id !== user.id) {
    return new Response(JSON.stringify({ error: "Not the host of this room" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Always flip the DB row first — ending the live experience for
  // viewers/host in our own app must not be blocked by a slow or failing
  // YouTube API call. See the equivalent "disconnect first, cleanup
  // after" reasoning in app/live/broadcast.tsx's endLive().
  const { error: updateError } = await serviceClient
    .from("lives")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      recording_status: "processing", // YouTube needs a short while to finish processing the VOD
      duration_sec: body.durationSec ?? null,
    })
    .eq("room_name", roomName);

  if (updateError) {
    console.error("[youtube-end-broadcast] failed to update lives row:", updateError);
  }

  if (live.status === "ended") {
    // Already ended (e.g. double-tap, or the auto-stop safety net in
    // youtube-create-broadcast already completed it on YouTube's side).
    return new Response(JSON.stringify({ ok: true, alreadyEnded: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!live.youtube_broadcast_id) {
    // Nothing to transition on YouTube's side (e.g. a legacy LiveKit row).
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const { accessToken } = await getFreshYouTubeAccessToken(serviceClient, user.id);
    const res = await fetch(
      `${YT_API}/liveBroadcasts/transition?broadcastStatus=complete&id=${live.youtube_broadcast_id}&part=id,status`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      // A broadcast that never actually started receiving RTMP data
      // (host closed the app before the encoder connected) can't be
      // "completed" — YouTube requires it to have been live first. This
      // is expected sometimes and not worth failing the request for;
      // the `lives` row is already marked ended above either way.
      console.warn("[youtube-end-broadcast] transition to complete failed (non-fatal):", errBody);
    }
    await serviceClient.from("lives").update({ recording_status: "ready" }).eq("room_name", roomName);
  } catch (err) {
    if (!(err instanceof YouTubeNotConnectedError)) {
      console.error("[youtube-end-broadcast] transition error:", err);
    }
    // Non-fatal — the room is already marked ended for our own app;
    // worst case the YouTube event lingers and auto-completes itself.
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
