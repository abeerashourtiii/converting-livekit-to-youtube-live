-- supabase/migrations/20260810000000_admin_audit_and_permission_enforcement.sql

-- ---------------------------------------------------------------------
-- 0. Shared permission-check helper
-- ---------------------------------------------------------------------
-- Every "admins can update/delete any X" policy added in earlier
-- migrations only checked role = 'admin' — NOT whether that specific
-- admin was actually granted the relevant section (full_access or
-- permissions @> section). A limited admin granted only e.g. "lives"
-- could previously still call supabase.from('properties').update(...)
-- directly and have it succeed, bypassing the UI-level restriction
-- entirely. This closes that gap: every admin-only write policy below
-- now goes through this function instead of a bare role check.
create or replace function public.admin_has_permission(section text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
      and (is_super_admin = true or full_access = true or section = any(permissions))
  );
$$;

-- ---------------------------------------------------------------------
-- 1. Tighten existing admin policies to check the specific section
-- ---------------------------------------------------------------------
drop policy if exists "admins can update any property" on public.properties;
create policy "admins can update any property"
  on public.properties for update
  to authenticated
  using (public.admin_has_permission('reels'))
  with check (public.admin_has_permission('reels'));

drop policy if exists "admins can delete any property" on public.properties;
create policy "admins can delete any property"
  on public.properties for delete
  to authenticated
  using (public.admin_has_permission('reels'));

drop policy if exists "admins can update any live" on public.lives;
create policy "admins can update any live"
  on public.lives for update
  to authenticated
  using (public.admin_has_permission('lives'))
  with check (public.admin_has_permission('lives'));

drop policy if exists "admins can delete any live" on public.lives;
create policy "admins can delete any live"
  on public.lives for delete
  to authenticated
  using (public.admin_has_permission('lives'));

drop policy if exists "admins can manage ad banners" on public.ad_banners;
create policy "admins can manage ad banners"
  on public.ad_banners for all
  to authenticated
  using (public.admin_has_permission('ads'))
  with check (public.admin_has_permission('ads'));

drop policy if exists "admins can manage sponsored reels" on public.sponsored_reels;
create policy "admins can manage sponsored reels"
  on public.sponsored_reels for all
  to authenticated
  using (public.admin_has_permission('sponsoredReels'))
  with check (public.admin_has_permission('sponsoredReels'));

-- Reports/features/user_permissions already used bare role='admin' checks
-- too — 'reports'/'features'/'users' sections cover those the same way.
drop policy if exists "admins can read reports" on public.reports;
create policy "admins can read reports"
  on public.reports for select
  to authenticated
  using (public.admin_has_permission('reports'));

drop policy if exists "admins can delete reports" on public.reports;
create policy "admins can delete reports"
  on public.reports for delete
  to authenticated
  using (public.admin_has_permission('reports'));

drop policy if exists "admins can read all permissions" on public.user_permissions;
create policy "admins can read all permissions"
  on public.user_permissions for select
  to authenticated
  using (public.admin_has_permission('users'));

drop policy if exists "admins can manage permissions" on public.user_permissions;
create policy "admins can manage permissions"
  on public.user_permissions for all
  to authenticated
  using (public.admin_has_permission('users'))
  with check (public.admin_has_permission('users'));

drop policy if exists "admins can manage feature flags" on public.feature_flags;
create policy "admins can manage feature flags"
  on public.feature_flags for update
  to authenticated
  using (public.admin_has_permission('features'))
  with check (public.admin_has_permission('features'));

-- ---------------------------------------------------------------------
-- 2. Admin action audit log — every reel/live/ad-banner/sponsored-reel
--    change made through the admin dashboard, with who, when, and the
--    before/after values.
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  action text not null,
  target_table text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "admins can read the audit log"
  on public.admin_audit_log for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- No insert/update/delete policy for clients on purpose — only the
-- SECURITY DEFINER trigger functions below ever write to this table, so
-- the log itself can't be edited or cleared from the app.

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor_name text;
  act text;
begin
  select full_name into actor_name from public.profiles where id = auth.uid();

  if tg_op = 'DELETE' then
    act := tg_argv[0] || '_delete';
    insert into public.admin_audit_log (actor_id, actor_name, action, target_table, target_id, before, after)
    values (auth.uid(), actor_name, act, tg_table_name, old.id, to_jsonb(old), null);
    return old;
  else
    act := tg_argv[0] || '_update';
    insert into public.admin_audit_log (actor_id, actor_name, action, target_table, target_id, before, after)
    values (auth.uid(), actor_name, act, tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;

-- Only fires for admin-driven changes — moderation_status is exactly the
-- field an admin (not the seller) changes on properties/lives, so that's
-- the update trigger's condition; deletes are logged unconditionally
-- since a seller deleting their own listing isn't an "admin operation" to
-- audit, but distinguishing the two here would need a session flag the
-- client doesn't set — logging every delete is the safe-by-default choice.
create trigger audit_property_moderation
  after update of moderation_status on public.properties
  for each row
  when (old.moderation_status is distinct from new.moderation_status)
  execute function public.log_admin_change('reel');

create trigger audit_property_delete
  after delete on public.properties
  for each row execute function public.log_admin_change('reel');

create trigger audit_live_moderation
  after update of moderation_status on public.lives
  for each row
  when (old.moderation_status is distinct from new.moderation_status)
  execute function public.log_admin_change('live');

create trigger audit_live_delete
  after delete on public.lives
  for each row execute function public.log_admin_change('live');

create trigger audit_ad_banner_insert
  after insert on public.ad_banners
  for each row execute function public.log_admin_change('ad_banner');

create trigger audit_ad_banner_update
  after update on public.ad_banners
  for each row execute function public.log_admin_change('ad_banner');

create trigger audit_ad_banner_delete
  after delete on public.ad_banners
  for each row execute function public.log_admin_change('ad_banner');

create trigger audit_sponsored_reel_insert
  after insert on public.sponsored_reels
  for each row execute function public.log_admin_change('sponsored_reel');

create trigger audit_sponsored_reel_update
  after update on public.sponsored_reels
  for each row execute function public.log_admin_change('sponsored_reel');

create trigger audit_sponsored_reel_delete
  after delete on public.sponsored_reels
  for each row execute function public.log_admin_change('sponsored_reel');

-- ---------------------------------------------------------------------
-- 3. User activity log — logins (logged by the client on sign-in,
--    see lib/hooks/useAuth.ts) and role changes (logged automatically by
--    a trigger on user_roles, so it can't be missed/skipped client-side).
-- ---------------------------------------------------------------------
create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  activity_type text not null check (activity_type in ('login', 'role_change')),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_log_created_idx on public.user_activity_log(created_at desc);

alter table public.user_activity_log enable row level security;

create policy "admins can read the user activity log"
  on public.user_activity_log for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));

-- Logins are inserted by the signed-in user themselves (client-side, on
-- the SIGNED_IN auth event) — narrowly scoped to their own id and this
-- one activity_type so it can't be used to forge other kinds of entries.
create policy "users can log their own login"
  on public.user_activity_log for insert
  to authenticated
  with check (user_id = auth.uid() and activity_type = 'login');

create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_name text;
  actor_name text;
begin
  select full_name into target_name from public.profiles where id = coalesce(new.user_id, old.user_id);
  select full_name into actor_name from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.user_activity_log (user_id, user_name, activity_type, details)
    values (new.user_id, target_name, 'role_change',
      jsonb_build_object('action', 'granted_admin', 'by', actor_name, 'full_access', new.full_access, 'permissions', new.permissions));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.user_activity_log (user_id, user_name, activity_type, details)
    values (old.user_id, target_name, 'role_change',
      jsonb_build_object('action', 'revoked_admin', 'by', actor_name));
    return old;
  end if;
  return null;
end;
$$;

create trigger log_user_role_change
  after insert or delete on public.user_roles
  for each row execute function public.log_role_change();
