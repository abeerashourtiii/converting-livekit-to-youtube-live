-- supabase/migrations/20260722000001_create_favorites_table.sql
-- ↔ replaces lib/hooks/useFavorites.ts's local-only Set-based store.
-- One row per (user, target) — either property_id or request_id is set,
-- never both, enforced by the check constraint.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  request_id uuid, -- no FK yet: real `requests` table is a follow-up migration, same as chats
  created_at timestamptz not null default now(),
  constraint favorites_exactly_one_target check (
    (property_id is not null and request_id is null) or
    (property_id is null and request_id is not null)
  ),
  unique (user_id, property_id),
  unique (user_id, request_id)
);

create index if not exists favorites_user_id_idx on public.favorites(user_id);

alter table public.favorites enable row level security;

-- Users only ever see/manage their own favorites — nobody else's favorite
-- list is anyone else's business, unlike properties/lives which are public.
create policy "users manage their own favorites"
  on public.favorites for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
