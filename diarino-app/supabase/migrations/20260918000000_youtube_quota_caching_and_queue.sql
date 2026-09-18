-- supabase/migrations/20260918000000_youtube_quota_caching_and_queue.sql
--
-- Two quota-saving/resilience features requested on top of the YouTube
-- Live migration:
--   1. Cache each host's `liveStream` (the RTMP ingest resource) so we
--      stop calling `liveStreams.insert` on every single broadcast.
--   2. When YouTube Data API's daily quota is exhausted anyway (very
--      plausible on the default 10,000-unit/day quota — see
--      docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md §6), queue the broadcast
--      request instead of hard-failing, and retry it automatically once
--      quota is available again.

-- ============================================================
-- 1. Per-host liveStream cache
-- ============================================================
-- Why this is safe to reuse: a YouTube `liveStream` resource (the RTMP
-- ingestion address + stream key) is independent of any one
-- `liveBroadcast` event — the same stream can be `bind`-ed to a new
-- broadcast every time a host goes live again. Only `liveBroadcasts.insert`
-- (a new *event*) needs to happen per session; `liveStreams.insert` (the
-- *ingest endpoint*) does not. Skipping it saves ~50 quota units per
-- broadcast — see supabase/functions/_shared/youtubeBroadcast.ts.
alter table public.youtube_oauth_tokens
  add column if not exists cached_stream_id text,
  add column if not exists cached_stream_name text,          -- RTMP stream key
  add column if not exists cached_ingestion_address text,
  add column if not exists cached_stream_created_at timestamptz;

-- ============================================================
-- 2. Retry queue for when the daily quota is exhausted
-- ============================================================
create table if not exists public.youtube_broadcast_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  completed_broadcast_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists youtube_broadcast_queue_claim_idx
  on public.youtube_broadcast_queue (status, next_attempt_at)
  where status = 'pending';

alter table public.youtube_broadcast_queue enable row level security;
alter table public.youtube_broadcast_queue replica identity full;

-- Hosts can watch their own queued request's status (the client
-- subscribes to this via Realtime postgres_changes) — no insert/update/
-- delete policy: only youtube-create-broadcast (enqueue) and
-- youtube-process-queue (claim/complete/fail), both using the
-- service-role key, ever write to this table.
create policy "hosts can read their own queued broadcasts"
  on public.youtube_broadcast_queue for select
  to authenticated
  using (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.youtube_broadcast_queue';
  end if;
exception when duplicate_object then
  null;
end $$;

-- Atomic claim, so multiple overlapping cron runs of youtube-process-queue
-- (or a manual + scheduled run landing at the same time) never grab the
-- same row twice: `FOR UPDATE SKIP LOCKED` makes a second concurrent
-- caller skip straight past a row the first caller already has locked,
-- rather than blocking on it or double-claiming it.
create or replace function public.claim_next_youtube_queue_item()
returns public.youtube_broadcast_queue
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.youtube_broadcast_queue;
begin
  select * into v_row
  from public.youtube_broadcast_queue
  where status = 'pending' and next_attempt_at <= now()
  order by created_at
  limit 1
  for update skip locked;

  if v_row.id is null then
    return null;
  end if;

  update public.youtube_broadcast_queue
    set status = 'processing', updated_at = now()
    where id = v_row.id
    returning * into v_row;

  return v_row;
end;
$$;

-- Only youtube-process-queue (service role) calls this — it bypasses RLS
-- entirely and touches *any* user's row, so it must never be reachable
-- from a client session.
revoke all on function public.claim_next_youtube_queue_item() from public, authenticated;

-- Lets a host cancel their own still-pending request (e.g. they closed
-- the "queued" screen) instead of it silently going live later.
create or replace function public.cancel_youtube_queue_item(p_queue_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.youtube_broadcast_queue
    set status = 'failed', last_error = 'cancelled_by_user', updated_at = now()
  where id = p_queue_id and user_id = auth.uid() and status = 'pending';
end;
$$;

revoke all on function public.cancel_youtube_queue_item(uuid) from public;
grant execute on function public.cancel_youtube_queue_item(uuid) to authenticated;

create or replace function public.cleanup_old_youtube_queue_items()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.youtube_broadcast_queue
  where status in ('completed', 'failed') and updated_at < now() - interval '7 days';
$$;
