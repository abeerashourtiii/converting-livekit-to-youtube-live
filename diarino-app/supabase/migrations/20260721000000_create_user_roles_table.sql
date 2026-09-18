-- supabase/migrations/20260721000000_create_user_roles_table.sql
-- ↔ the `user_roles` table checkAdmin() queried in src/routes/index.tsx.
-- Needed to gate app/admin/index.tsx to actual admins instead of anyone
-- who happens to type the URL.

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- A user can only ever read their OWN role rows — enough for the client-side
-- admin gate to check "am I an admin", nothing more.
create policy "users can read their own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies on purpose — granting admin access is a
-- manual operation (via the Supabase dashboard's table editor or a service-
-- role script), not something any client, including an admin's own client,
-- should be able to self-assign.
