-- supabase/migrations/<timestamp>_create_lives_table.sql
-- Run: supabase db push   (or paste into the SQL editor if not using CLI migrations)

create table if not exists public.lives (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,       -- ↔ the LiveKit room name (same value passed to livekit-token)
  host_id uuid not null references auth.users(id) on delete cascade,
  title text,                            -- optional: broadcast title (5-word max, validated client-side)
  status text not null default 'live' check (status in ('live', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists lives_host_id_idx on public.lives(host_id);
create index if not exists lives_room_name_idx on public.lives(room_name);

alter table public.lives enable row level security;

-- Anyone signed in can look up a room to check who hosts it (needed by the
-- livekit-token function, which queries this table using the caller's own
-- JWT-scoped client — not a service-role client).
create policy "lives are readable by authenticated users"
  on public.lives for select
  to authenticated
  using (true);

-- Only the caller can create a room where THEY are the host — this is the
-- actual guard: nobody can insert a row claiming host_id = someone else.
create policy "users can create their own live room"
  on public.lives for insert
  to authenticated
  with check (host_id = auth.uid());

-- Only the host can update their own room (e.g. marking it ended).
create policy "hosts can update their own live room"
  on public.lives for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy "hosts can delete their own live room"
  on public.lives for delete
  to authenticated
  using (host_id = auth.uid());
