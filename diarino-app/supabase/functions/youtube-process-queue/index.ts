// @ts-nocheck
// supabase/functions/youtube-process-queue/index.ts
//
// Drains `youtube_broadcast_queue`: claims one pending row at a time
// (via the atomic `claim_next_youtube_queue_item()` — see the quota
// migration — so overlapping invocations never double-process the same
// request), retries creating the broadcast, and on success inserts the
// `lives` row exactly like youtube-create-broadcast's happy path would
// have. On a repeat quota error it reschedules for next Pacific
// midnight; on any other error it backs off exponentially and gives up
// after MAX_ATTEMPTS.
//
// ⚠️ THIS FUNCTION DOES NOT RUN ITSELF. Something has to invoke it on a
// schedule — Supabase's dashboard "Scheduled Functions" (Edge Functions →
// this function → Schedule) or a `pg_cron` job calling `net.http_post`
// against its URL are both fine; wiring either up is a dashboard/SQL step
// this sandbox cannot perform for you. See
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md §3.1 for the exact steps and §8 for
// this feature's full design. Until it's
// scheduled, queued broadcasts will sit in `youtube_broadcast_queue`
// forever — they will NOT retry on their own.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { serveWithCors } from "../_shared/cors.ts";
import { getFreshYouTubeAccessToken, YouTubeNotConnectedError } from "../_shared/googleAuth.ts";
import { createBroadcastWithCachedStream, deleteBroadcastBestEffort, insertLivesRow, nextPacificMidnightUtc, YouTubeQuotaExceededError } from "../_shared/youtubeBroadcast.ts";

const MAX_ATTEMPTS = 6;
// Bounds how many queued requests one invocation drains, so a single cron
// tick can't itself burn through the entire freshly-reset daily quota
// (each attempt costs ~100-150 units — see the migration guide's quota
// math) or run long enough to hit the Edge Function timeout.
const MAX_ITEMS_PER_RUN = 10;

serveWithCors(async (req) => {
  // No user JWT here on purpose — this runs as a scheduled/service job,
  // not on behalf of any one signed-in user. Guard it with a shared
  // secret instead so it can't be triggered by an arbitrary caller.
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("YOUTUBE_QUEUE_CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  let processed = 0;
  let succeeded = 0;
  let requeued = 0;
  let failed = 0;

  for (let i = 0; i < MAX_ITEMS_PER_RUN; i++) {
    const { data: item, error: claimError } = await serviceClient.rpc("claim_next_youtube_queue_item");
    if (claimError) {
      console.error("[youtube-process-queue] claim failed:", claimError);
      break;
    }
    if (!item) break; // nothing left to process right now
    processed++;

    try {
      const { accessToken } = await getFreshYouTubeAccessToken(serviceClient, item.user_id);
      const created = await createBroadcastWithCachedStream(serviceClient, accessToken, item.user_id, item.title);

      const { error: insertError } = await insertLivesRow(serviceClient, {
        roomName: item.room_name,
        userId: item.user_id,
        title: item.title,
        created,
      });
      if (insertError) {
        deleteBroadcastBestEffort(accessToken, created.broadcastId);
        throw insertError;
      }

      await serviceClient
        .from("youtube_broadcast_queue")
        .update({ status: "completed", completed_broadcast_id: created.broadcastId, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      succeeded++;
    } catch (err) {
      const attempts = item.attempts + 1;

      if (err instanceof YouTubeQuotaExceededError) {
        // Quota's still not back — try again at the next reset rather
        // than burning through exponential-backoff attempts for a
        // condition we already know the exact recovery time for.
        await serviceClient
          .from("youtube_broadcast_queue")
          .update({
            status: "pending",
            attempts,
            last_error: "youtube_quota_exceeded",
            next_attempt_at: nextPacificMidnightUtc().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        requeued++;
        continue;
      }

      const isAuthGone = err instanceof YouTubeNotConnectedError;
      const giveUp = isAuthGone || attempts >= MAX_ATTEMPTS;
      const backoffMinutes = Math.min(2 ** attempts, 240); // capped at 4h

      await serviceClient
        .from("youtube_broadcast_queue")
        .update({
          status: giveUp ? "failed" : "pending",
          attempts,
          last_error: isAuthGone
            ? "youtube_not_connected: host's YouTube connection was revoked — they must reconnect their account"
            : err instanceof Error
              ? err.message
              : String(err),
          next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (giveUp) failed++;
      else requeued++;
      console.error(`[youtube-process-queue] item ${item.id} failed (attempt ${attempts}):`, err);
    }
  }

  return new Response(JSON.stringify({ processed, succeeded, requeued, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
