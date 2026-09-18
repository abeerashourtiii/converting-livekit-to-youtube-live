-- supabase/migrations/20260809000000_sponsored_reels.sql
-- Powers full admin control over featured/sponsored reel ads: promote an
-- existing listing as either the intro reel shown on entering the app, or
-- a featured ad periodically inserted while browsing, with a reach goal
-- and demographic targeting fields.
--
-- IMPORTANT, stated plainly rather than silently: age_min/age_max/gender
-- below are targeting CRITERIA the admin sets, but this app collects no
-- age or gender data anywhere on public.profiles — there is nothing to
-- match them against yet, so they're not enforced. Reach (current_reach)
-- IS real and increments on every actual impression.

create table if not exists public.sponsored_reels (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  placement text not null check (placement in ('intro', 'in_feed')),
  reach_goal integer,
  current_reach integer not null default 0,
  age_min integer,
  age_max integer,
  gender_target text check (gender_target in ('all', 'male', 'female')) default 'all',
  active boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

create index if not exists sponsored_reels_active_idx on public.sponsored_reels(active, placement, start_date, end_date);

alter table public.sponsored_reels enable row level security;

create policy "sponsored reels are readable by authenticated users"
  on public.sponsored_reels for select
  to authenticated
  using (true);

create policy "admins can manage sponsored reels"
  on public.sponsored_reels for all
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Atomic reach increment, called once per real impression from the reels
-- feed — SECURITY DEFINER so any viewer (not just admins) can bump it,
-- same pattern as increment_wa_clicks in 20260801000000_admin_backend.sql.
create or replace function public.increment_sponsored_reach(sponsored_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.sponsored_reels set current_reach = current_reach + 1 where id = sponsored_id;
$$;

revoke all on function public.increment_sponsored_reach(uuid) from public;
grant execute on function public.increment_sponsored_reach(uuid) to authenticated;
