-- supabase/migrations/20260813000000_known_regions.sql
-- Powers the region/compound autocomplete on the search page — the
-- static REGIONS_BY_PROVINCE list in data/locations.ts stays as the
-- baseline, but any new area/compound name someone actually types (that
-- isn't already known) gets remembered here so it's suggested to
-- everyone from then on, instead of the list only ever growing when a
-- developer edits code.

create table if not exists public.known_regions (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (province, name)
);

create index if not exists known_regions_province_idx on public.known_regions(province);

alter table public.known_regions enable row level security;

create policy "known regions are readable by authenticated users"
  on public.known_regions for select
  to authenticated
  using (true);

-- Anyone can contribute a new region name they typed — this is shared,
-- low-stakes autocomplete data (not attributed to the person, nothing
-- sensitive), same trust level as the app already gives to any
-- authenticated write.
create policy "authenticated users can add a new region name"
  on public.known_regions for insert
  to authenticated
  with check (true);
