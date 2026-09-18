-- supabase/migrations/20260722000000_create_properties_table.sql
-- ↔ replaces data/mock-properties.ts + the myAds half of useMyContent.ts as
-- the real source of truth. Every screen reading "properties" (reels feed,
-- search, property details, seller profile, account "إعلاناتي") should
-- move to lib/hooks/useProperties.ts, which reads this table.

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('sale', 'rent')),
  type text not null,
  title text not null,
  short_title text,
  province text not null,
  location text not null,
  lat double precision,
  lng double precision,
  price numeric not null,
  area numeric not null,
  rooms integer not null default 0,
  baths integer not null default 0,
  reception integer not null default 0,
  floor integer,
  payment text check (payment in ('cash', 'installment')),
  negotiable boolean,
  finish_type text,
  status text check (status in ('ready', 'building')),
  delivery_date text,
  features text[] not null default '{}',
  description text not null default '',
  media jsonb not null default '[]', -- [{type:'image'|'video', url:string}]
  cover_image text,
  music text,
  pinned boolean not null default false,
  pinned_at timestamptz,
  likes integer not null default 0,
  saves integer not null default 0,
  views integer not null default 0,
  chats integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_seller_id_idx on public.properties(seller_id);
create index if not exists properties_province_idx on public.properties(province);
create index if not exists properties_created_at_idx on public.properties(created_at desc);

alter table public.properties enable row level security;

-- Anyone signed in can browse listings (reels/search/seller profile need
-- to see everyone's properties, not just their own).
create policy "properties are readable by authenticated users"
  on public.properties for select
  to authenticated
  using (true);

-- Only the seller can create a listing under their own id.
create policy "users can create their own properties"
  on public.properties for insert
  to authenticated
  with check (seller_id = auth.uid());

-- Only the seller can edit/delete their own listing — this is the same
-- 24h edit-window rule (canEditAd) that's enforced client-side; the DB
-- policy just guarantees ownership, not the time window (client already
-- hides the edit action once the window closes, and there's no harm in
-- the policy itself being time-unaware here since the UI is what gates it).
create policy "sellers can update their own properties"
  on public.properties for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "sellers can delete their own properties"
  on public.properties for delete
  to authenticated
  using (seller_id = auth.uid());

-- NOTE: no seed INSERT here — seller_id has a FK to auth.users(id), so a
-- placeholder "demo owner" row would violate that constraint (or require
-- inserting a fake auth.users row, which fights Supabase Auth's own
-- lifecycle). The 6 demo listings that used to live in
-- data/mock-properties.ts stay as static client-side data instead, merged
-- in with real query results by lib/hooks/useProperties.ts — same visual
-- effect (a fresh install still has content to browse) without a fake DB row.
