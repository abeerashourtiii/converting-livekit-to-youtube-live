-- supabase/migrations/20260808000000_ad_banners.sql
-- Powers full admin control over the "مساحة إعلانية" (ad space) card on
-- the menu page — previously just a static card that opened WhatsApp to
-- ask about booking space, with no actual ad ever displayed anywhere.
-- Now: real banners, each with its own run dates, that auto-rotate.

create table if not exists public.ad_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  link_url text,
  whatsapp_message text,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ad_banners_active_idx on public.ad_banners(active, start_date, end_date);

alter table public.ad_banners enable row level security;

create policy "ad banners are readable by authenticated users"
  on public.ad_banners for select
  to authenticated
  using (true);

create policy "admins can manage ad banners"
  on public.ad_banners for all
  to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'));
