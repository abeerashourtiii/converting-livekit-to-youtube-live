-- supabase/migrations/20260911000000_youtube_live_streaming.sql
--
-- Migrates the live-streaming backend from LiveKit to YouTube Live
-- (YouTube Data API v3). This migration is additive/non-destructive:
-- the old LiveKit-era columns on `lives` (egress_id, recording_url, ...)
-- are left in place so historical rows/recordings already saved before
-- this migration keep working in the "My saved lives" screens. New rows
-- created by the YouTube flow populate the new `youtube_*` columns
-- instead.
--
-- ============================================================
-- 1. `lives` — YouTube broadcast identifiers
-- ============================================================
alter table public.lives
  add column if not exists provider text not null default 'youtube'
    check (provider in ('youtube', 'livekit')),
  add column if not exists youtube_broadcast_id text,
  add column if not exists youtube_stream_id text,
  add column if not exists youtube_video_id text,
  add column if not exists youtube_ingestion_address text,
  add column if not exists youtube_stream_name text; -- the RTMP "stream key"

create index if not exists lives_youtube_broadcast_id_idx on public.lives(youtube_broadcast_id);

-- ============================================================
-- 2. Per-host YouTube OAuth tokens
-- ============================================================
-- Holds the long-lived refresh_token + a cached short-lived access_token
-- for whichever Google account a host connected with `youtube.force-ssl`
-- scope. Like `live_message_rate_buckets` below, this table is only ever
-- touched by Edge Functions using the service-role key — RLS is enabled
-- with **no policies granted to `authenticated`**, so a client can never
-- read another user's (or even their own) raw tokens directly. Clients
-- only ever learn *whether* they're connected via `is_youtube_connected()`
-- below, never the token values themselves.
create table if not exists public.youtube_oauth_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  scope text,
  youtube_channel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_oauth_tokens enable row level security;
-- Deliberately zero policies for `authenticated` — see comment above.

create or replace function public.is_youtube_connected()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.youtube_oauth_tokens where user_id = auth.uid()
  );
$$;

revoke all on function public.is_youtube_connected() from public;
grant execute on function public.is_youtube_connected() to authenticated;

-- ============================================================
-- 3. Live chat (comments + likes) — replaces LiveKit data channels
-- ============================================================
-- Previously comments/likes were relayed over a LiveKit data channel via
-- the `livekit-send-message` Edge Function (RoomServiceClient.sendData).
-- YouTube Data API's own Live Chat has a very restrictive daily quota
-- (per the product plan: "الاعتماد على Supabase Realtime للدردشة
-- التفاعلية وليس يوتيوب شات"), so chat now lives entirely in Postgres and
-- is delivered to clients via Supabase Realtime `postgres_changes` on
-- this table. Rate limiting moves from "Edge Function checks, then
-- relays" to "a BEFORE INSERT trigger checks, then the INSERT itself IS
-- the relay" — a client can never bypass the check because it's the same
-- statement that would deliver the message.
create table if not exists public.live_messages (
  id bigint generated always as identity primary key,
  room_name text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  message_type text not null check (message_type in ('comment', 'like')),
  text text,
  created_at timestamptz not null default now()
);

create index if not exists live_messages_room_created_idx
  on public.live_messages(room_name, created_at desc);

alter table public.live_messages enable row level security;
-- Full replica identity so Realtime can reliably diff/filter rows.
alter table public.live_messages replica identity full;

create policy "authenticated can read live chat"
  on public.live_messages for select
  to authenticated
  using (true);

create policy "authenticated can send as themselves"
  on public.live_messages for insert
  to authenticated
  with check (sender_id = auth.uid());

-- Reuse the same atomic per-second bucket table/function LiveKit's chat
-- used (see 20260826000000_live_message_rate_limit.sql) — the storage
-- and algorithm are transport-agnostic, only the caller changes.
create or replace function public.enforce_live_message_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_limit int;
  v_allowed boolean;
  v_live_status text;
begin
  if new.sender_id is distinct from auth.uid() then
    raise exception 'sender_id must match the authenticated caller';
  end if;

  if exists (
    select 1 from public.live_blocked_viewers b
    where b.room_name = new.room_name and b.user_id = new.sender_id
  ) then
    raise exception 'blocked_from_chat';
  end if;

  select status into v_live_status from public.lives where room_name = new.room_name;
  if v_live_status is distinct from 'live' then
    raise exception 'live_not_active';
  end if;

  if new.message_type = 'comment' then
    new.text := left(trim(coalesce(new.text, '')), 200);
    if new.text = '' then
      raise exception 'text is required for comments';
    end if;
    v_limit := 3;
  else
    new.text := null;
    v_limit := 5;
  end if;

  select public.bump_live_message_rate(new.sender_id, new.room_name, new.message_type, v_limit)
    into v_allowed;
  if not v_allowed then
    raise exception 'rate_limited';
  end if;

  return new;
end;
$$;

-- NOTE: this trigger is created further down, after live_blocked_viewers
-- exists (the function above references it), to keep dependency order
-- valid on a fresh database.

-- `bump_live_message_rate` already exists from the LiveKit-era migration
-- and was deliberately un-grantable to `authenticated` (only the old
-- Edge Function, via service role, could call it). Now that the trigger
-- above runs as `security definer` and calls it internally, we do NOT
-- need to grant it to `authenticated` directly — the trigger function
-- owns that call. No grant change needed here.

-- ============================================================
-- 4. Chat moderation — "remove viewer" equivalent
-- ============================================================
-- YouTube Live has no API to disconnect a specific viewer from watching
-- the embedded player (unlike LiveKit's kickParticipant, which dropped
-- their WebRTC connection outright). The closest honest equivalent is
-- blocking a viewer from posting in *our own* chat — it does not remove
-- them from the video itself. See docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md.
create table if not exists public.live_blocked_viewers (
  room_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_by uuid not null references auth.users(id) on delete cascade,
  blocked_at timestamptz not null default now(),
  primary key (room_name, user_id)
);

alter table public.live_blocked_viewers enable row level security;
alter table public.live_blocked_viewers replica identity full;

create policy "authenticated can read block list"
  on public.live_blocked_viewers for select
  to authenticated
  using (true);
-- No direct insert/update/delete policy — only the security-definer
-- functions below (which check host ownership themselves) can write.

create trigger live_messages_enforce_rules
  before insert on public.live_messages
  for each row execute function public.enforce_live_message_rules();

create or replace function public.block_live_viewer(p_room_name text, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.lives where room_name = p_room_name and host_id = auth.uid()
  ) then
    raise exception 'only the host can block a viewer from this room';
  end if;

  insert into public.live_blocked_viewers (room_name, user_id, blocked_by)
  values (p_room_name, p_user_id, auth.uid())
  on conflict (room_name, user_id) do nothing;
end;
$$;

create or replace function public.unblock_live_viewer(p_room_name text, p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.lives where room_name = p_room_name and host_id = auth.uid()
  ) then
    raise exception 'only the host can unblock a viewer in this room';
  end if;

  delete from public.live_blocked_viewers
  where room_name = p_room_name and user_id = p_user_id;
end;
$$;

revoke all on function public.block_live_viewer(text, uuid) from public;
revoke all on function public.unblock_live_viewer(text, uuid) from public;
grant execute on function public.block_live_viewer(text, uuid) to authenticated;
grant execute on function public.unblock_live_viewer(text, uuid) to authenticated;

-- ============================================================
-- 5. Realtime + housekeeping
-- ============================================================
-- Adds both tables to the `supabase_realtime` publication so clients can
-- subscribe via postgres_changes. If this publication doesn't exist yet
-- on a given project (e.g. Realtime was never enabled), run this section
-- manually from the Supabase dashboard — see the migration guide.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.live_messages';
    execute 'alter publication supabase_realtime add table public.live_blocked_viewers';
  end if;
exception when duplicate_object then
  null; -- already added
end $$;

create or replace function public.cleanup_old_live_messages()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.live_messages where created_at < now() - interval '24 hours';
$$;
