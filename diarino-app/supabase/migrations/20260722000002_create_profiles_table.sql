-- supabase/migrations/20260722000002_create_profiles_table.sql
-- Real user-facing seller info (name/phone/bio/avatar) — the mock data had
-- this embedded directly in each property object, but real properties need
-- it to come from the actual signed-in user, not copied onto every listing.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  bio text,
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row the moment someone signs up, seeded from
-- whatever Google (or any other provider) handed back in user_metadata —
-- same full_name Claude was already reading via user_metadata.full_name
-- elsewhere in the app (useCurrentUser.ts).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Second FK on properties.seller_id → profiles(id) (in addition to the one
-- already pointing at auth.users(id) from the properties migration) so
-- PostgREST can embed profile data directly in a properties query:
--   supabase.from('properties').select('*, profiles(*)')
-- Safe to add: profiles.id is always a subset of auth.users.id (1:1 via the
-- trigger above), so any valid seller_id already satisfies both FKs.
alter table public.properties
  add constraint properties_seller_profile_fkey
  foreign key (seller_id) references public.profiles(id) on delete cascade;
