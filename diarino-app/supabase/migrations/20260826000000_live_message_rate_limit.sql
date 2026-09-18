-- supabase/migrations/20260826000000_live_message_rate_limit.sql
--
-- Server-side enforcement for live comment/like rate limits — the actual
-- follow-up to the client-side-only throttle shipped earlier in
-- lib/hooks/useLiveKitRoom.ts. That throttle only ever protected a client
-- from its own bugs; a modified client could ignore it entirely and
-- publish straight onto the LiveKit data channel, since every
-- participant's token granted canPublishData: true. Real enforcement
-- needs the check to happen somewhere a modified client can't skip —
-- which for LiveKit means moving off the raw peer-to-peer data channel
-- entirely: comments/likes now go through the new
-- supabase/functions/livekit-send-message Edge Function (service role),
-- which increments the bucket below atomically and only relays the
-- message via LiveKit's RoomServiceClient.sendData() if the caller is
-- still under the cap. livekit-token/index.ts now issues canPublishData:
-- false to everyone, so publishing directly is no longer possible at all
-- — this table/function pair is the only path left, and it's servers-eye
-- view all the way through.
--
-- Fixed 1-second buckets rather than a sliding window: simpler, race-free
-- via a single atomic UPSERT (see bump_live_message_rate below), and
-- "3 comments in any given second" vs. "3 in any rolling second" isn't a
-- meaningful difference for an abuse guard like this one.

create table if not exists public.live_message_rate_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  message_type text not null check (message_type in ('comment', 'like')),
  bucket_second bigint not null, -- floor(extract(epoch from now()))
  count int not null default 0,
  primary key (user_id, room_name, message_type, bucket_second)
);

alter table public.live_message_rate_buckets enable row level security;

-- No policies granted to `authenticated` on purpose — this table is only
-- ever touched by livekit-send-message using the service-role key, which
-- bypasses RLS entirely. A client has no legitimate reason to read or
-- write it directly, and if it somehow tried to, RLS with zero policies
-- means the request is simply denied (RLS defaults to deny-all with no
-- matching policy).

-- ↔ atomic "try to consume one slot" — a single UPSERT with a WHERE guard
-- on the conflicting row is race-free under concurrent calls for the same
-- (user, room, type, second): Postgres serializes the conflicting update,
-- so two simultaneous requests can never both read count=2 and both think
-- they're the 3rd message under a limit of 3. Returns true if the message
-- should be relayed, false if the caller is already at/over p_limit for
-- this second.
create or replace function public.bump_live_message_rate(
  p_user_id uuid, p_room_name text, p_message_type text, p_limit int
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_bucket bigint := floor(extract(epoch from now()));
  v_count int;
begin
  insert into public.live_message_rate_buckets (user_id, room_name, message_type, bucket_second, count)
  values (p_user_id, p_room_name, p_message_type, v_bucket, 1)
  on conflict (user_id, room_name, message_type, bucket_second)
  do update set count = live_message_rate_buckets.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.bump_live_message_rate(uuid, text, text, int) from public;
-- Deliberately NOT granted to `authenticated` — only the Edge Function
-- (service role, which bypasses grants same as it bypasses RLS) calls
-- this. A client calling it directly would gain nothing (it only ever
-- returns true/false, never touches LiveKit), but there's no reason to
-- expose it either.

-- ↔ housekeeping — old buckets are tiny (one row per user/room/type/second
-- while a broadcast is active) but there's no natural cascade to clean
-- them up once a live ends, unlike most other per-live data. A daily
-- cleanup is enough; nothing here is read after the second it was
-- written for.
create or replace function public.cleanup_old_rate_buckets()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.live_message_rate_buckets
  where bucket_second < floor(extract(epoch from now())) - 3600;
$$;
