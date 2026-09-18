-- supabase/migrations/20260805000000_suggestions.sql
-- Powers the "المقترحات" box in the settings menu's "الشكاوى والمقترحات"
-- screen. Reporting specific content (ad/reel/live) reuses the existing
-- public.reports table from 20260802000000_notifications_backend.sql —
-- this is only for free-text general feedback, unrelated to a specific
-- piece of content.

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.suggestions enable row level security;

create policy "users can submit their own suggestions"
  on public.suggestions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can read their own suggestions"
  on public.suggestions for select
  to authenticated
  using (user_id = auth.uid());

create policy "admins can read all suggestions"
  on public.suggestions for select
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
