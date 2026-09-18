-- supabase/migrations/20260801000000_admin_backend.sql
-- Wires the admin dashboard (previously lib/hooks/useAdminDB.ts — a fully
-- local mock DB persisted to AsyncStorage, same as the original web admin
-- panel) to real data:
--   - reels page          -> public.properties (adds moderation + wa_clicks)
--   - lives page          -> public.lives (adds moderation)
--   - reports page        -> new public.reports table
--   - users page          -> public.profiles + new public.user_permissions
--   - features page       -> new public.feature_flags table
--   - analytics/overview  -> aggregated client-side from the tables above
--
-- Every admin-only write below is gated the same way: an inline
-- `exists (select 1 from public.user_roles where user_id = auth.uid()
-- and role = 'admin')` check, reusing the table from
-- 20260721000000_create_user_roles_table.sql rather than inventing a
-- second notion of "admin".

-- ---------------------------------------------------------------------
-- 1. Moderation + wa-click tracking on properties ("reels" in the admin UI)
-- ---------------------------------------------------------------------
alter table public.properties
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column if not exists wa_clicks integer not null default 0;

-- NOTE: moderation_status is only surfaced/managed in the admin dashboard
-- for now — the reels/search feed (lib/hooks/useProperties.ts) does not
-- yet filter on it, so "rejected" listings aren't hidden from the public
-- feed automatically. Enforcing that is a separate follow-up if wanted.

create index if not exists properties_moderation_status_idx on public.properties(moderation_status);

-- Atomic increment, callable via supabase.rpc('increment_wa_clicks', { property_id }) —
-- avoids a read-then-write race between concurrent WhatsApp taps.
-- SECURITY DEFINER on purpose: the caller (anyone viewing the listing, not
-- just the seller) has no UPDATE rights on properties otherwise, and this
-- function only ever touches the wa_clicks column, so it's safe to run
-- with elevated privileges without opening up a broader UPDATE policy
-- that could let any signed-in user rewrite someone else's listing.
create or replace function public.increment_wa_clicks(property_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.properties set wa_clicks = wa_clicks + 1 where id = property_id;
$$;

revoke all on function public.increment_wa_clicks(uuid) from public;
grant execute on function public.increment_wa_clicks(uuid) to authenticated;

-- Admins can moderate (status change) or remove ANY listing, on top of the
-- existing "sellers can update/delete their own" policies from the
-- properties migration (Postgres OR's multiple permissive policies
-- together, so this only ever adds capability, never removes the
-- seller's own).
create policy "admins can update any property"
  on public.properties for update
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "admins can delete any property"
  on public.properties for delete
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------
-- 2. Moderation on lives ("البث المسجل" in the admin UI)
-- ---------------------------------------------------------------------
alter table public.lives
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved'));

-- Lets PostgREST embed the host's profile directly in an admin lives query
-- (`.select('*, profiles(full_name)')`), same trick used for
-- properties.seller_id in the profiles migration.
alter table public.lives
  add constraint lives_host_profile_fkey
  foreign key (host_id) references public.profiles(id) on delete cascade;

create policy "admins can update any live"
  on public.lives for update
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "admins can delete any live"
  on public.lives for delete
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------
-- 3. Reports ("الإبلاغات")
-- ---------------------------------------------------------------------
-- There is no in-app "report" button anywhere yet (flagged separately —
-- this table just gives the admin reports page real infrastructure to
-- read from; it starts empty like every other real table here until a
-- report-submission entry point is added to the reel/live UI).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('property', 'live')),
  target_id uuid not null,
  target_title text not null,
  target_color text not null default '#6366f1',
  reason text not null,
  reporter_id uuid not null constraint reports_reporter_profile_fkey references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists reports_target_idx on public.reports(target_type, target_id);

alter table public.reports enable row level security;

-- Any signed-in user can file a report under their own id (nothing to
-- submit reports from yet, but the write path is real).
create policy "users can create their own reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Only admins can see/manage the report queue.
create policy "admins can read reports"
  on public.reports for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

create policy "admins can delete reports"
  on public.reports for delete
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------
-- 4. Per-user permissions ("المستخدمون" tab's toggles)
-- ---------------------------------------------------------------------
create table if not exists public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  publish_reels boolean not null default true,
  live boolean not null default true,
  paid_ads boolean not null default true,
  direct_wa boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_permissions enable row level security;

-- A user can read their own row (useful later if the app ever enforces
-- these client-side, e.g. hiding the "go live" button when live = false).
create policy "users can read their own permissions"
  on public.user_permissions for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins can read all permissions"
  on public.user_permissions for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Admins are the only ones who can create/change a permissions row (rows
-- are upserted lazily the first time an admin toggles something for a
-- user who doesn't have one yet — everyone defaults to "all on" until then).
create policy "admins can manage permissions"
  on public.user_permissions for all
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------
-- 5. Feature flags ("الميزات العامة")
-- ---------------------------------------------------------------------
create table if not exists public.feature_flags (
  key text primary key,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Readable by anyone signed in (the app itself would need to read these
-- to actually gate features client-side — not wired up yet, same
-- follow-up note as moderation_status above).
create policy "feature flags are readable by authenticated users"
  on public.feature_flags for select
  to authenticated
  using (true);

create policy "admins can manage feature flags"
  on public.feature_flags for update
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Seed the same defaults the mock DB used to generate, so the features
-- page isn't empty on a fresh install. Safe to re-run.
insert into public.feature_flags (key, name, description, enabled) values
  ('reels', 'الريلز العقارية', 'تفعيل عرض الريلز في الصفحة الرئيسية', true),
  ('live', 'البث المباشر', 'السماح للمستخدمين ببث مباشر', true),
  ('stories', 'القصص اليومية', 'ميزة القصص لمدة 24 ساعة', true),
  ('ads', 'الإعلانات المدفوعة', 'شراء ترويج للإعلانات', true),
  ('wa', 'زر واتساب المباشر', 'تواصل مباشر مع صاحب العقار', true),
  ('comments', 'التعليقات', 'السماح بالتعليق على الريلز', true),
  ('saved', 'المحفوظات', 'حفظ الإعلانات المفضلة', true),
  ('ai', 'المساعد الذكي', 'اقتراحات AI للعقارات المناسبة', false)
on conflict (key) do nothing;
