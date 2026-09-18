-- supabase/migrations/20260807000000_super_admin_system.sql
-- Replaces the "grant admin manually via the Supabase dashboard" model
-- (see 20260721000000_create_user_roles_table.sql's own comment) with a
-- real in-app system:
--   - the very first person to ever sign up becomes an undeletable super
--     admin automatically
--   - the super admin can grant other users admin access, either full or
--     limited to specific admin sections (reels/lives/reports/users/
--     features)
--   - nobody — not even another admin — can delete or demote the super
--     admin account

alter table public.user_roles
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists full_access boolean not null default true,
  add column if not exists permissions text[] not null default '{}';

-- Lets PostgREST embed the admin's profile (full_name) directly from a
-- user_roles query, same dual-FK trick used for properties.seller_id and
-- lives.host_id — user_roles.user_id already references auth.users(id);
-- this adds a second FK to profiles(id) without removing that one.
alter table public.user_roles
  add constraint user_roles_user_id_profile_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

-- Only ever one super admin, decided once at signup time, so this can't
-- be forged by inserting a second admin row with is_super_admin = true.
create unique index if not exists user_roles_one_super_admin
  on public.user_roles ((is_super_admin)) where is_super_admin = true;

-- ---------------------------------------------------------------------
-- First-ever signup becomes super admin
-- ---------------------------------------------------------------------
create or replace function public.handle_first_user_super_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role, is_super_admin, full_access, permissions)
    values (new.id, 'admin', true, true, '{}');
  end if;
  return new;
end;
$$;

-- Fires on the same table/timing as handle_new_user() (profiles migration)
-- — a separate trigger on auth.users, not chained into that function, so
-- neither one depends on editing the other.
create trigger on_auth_user_created_super_admin
  after insert on auth.users
  for each row execute function public.handle_first_user_super_admin();

-- ---------------------------------------------------------------------
-- Nobody can delete or demote the super admin, enforced at the trigger
-- level (not just RLS) so it holds even against a service-role script.
-- ---------------------------------------------------------------------
create or replace function public.protect_super_admin()
returns trigger
language plpgsql
as $$
begin
  if old.is_super_admin then
    raise exception 'The super admin account cannot be removed or demoted.';
  end if;
  return old;
end;
$$;

create trigger protect_super_admin_delete
  before delete on public.user_roles
  for each row execute function public.protect_super_admin();

create or replace function public.protect_super_admin_update()
returns trigger
language plpgsql
as $$
begin
  if old.is_super_admin and not new.is_super_admin then
    raise exception 'The super admin account cannot be demoted.';
  end if;
  return new;
end;
$$;

create trigger protect_super_admin_update_trigger
  before update on public.user_roles
  for each row execute function public.protect_super_admin_update();

-- ---------------------------------------------------------------------
-- Only the super admin can grant/revoke admin access or change
-- permissions for OTHER users. (The super admin's own row is inserted
-- only by the trigger above, never by a client.)
-- ---------------------------------------------------------------------
create policy "super admin can grant admin access"
  on public.user_roles for insert
  to authenticated
  with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.is_super_admin = true)
  );

create policy "super admin can update admin permissions"
  on public.user_roles for update
  to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.is_super_admin = true))
  with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.is_super_admin = true));

create policy "super admin can revoke admin access"
  on public.user_roles for delete
  to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.is_super_admin = true));

-- Lets the admin users list page show who's an admin and with what
-- permissions, not just "am I one".
create policy "admins can read all admin role rows"
  on public.user_roles for select
  to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));
