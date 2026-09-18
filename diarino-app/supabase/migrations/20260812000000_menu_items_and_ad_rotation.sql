-- supabase/migrations/20260812000000_menu_items_and_ad_rotation.sql

-- ---------------------------------------------------------------------
-- 1. Menu page icon cards — full admin control (color, title/subtitle,
--    size, icon, order, add/delete) instead of the hardcoded JSX that
--    was in app/(tabs)/menu.tsx before.
-- ---------------------------------------------------------------------
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  color text not null default '#22A652',
  icon_key text not null default 'star',
  size text not null default 'half' check (size in ('full', 'half')),
  action_type text not null check (action_type in ('whatsapp', 'route', 'url')),
  action_value text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists menu_items_active_idx on public.menu_items(active, sort_order);

alter table public.menu_items enable row level security;

create policy "menu items are readable by authenticated users"
  on public.menu_items for select
  to authenticated
  using (true);

create policy "admins can manage menu items"
  on public.menu_items for all
  to authenticated
  using (public.admin_has_permission('menuItems'))
  with check (public.admin_has_permission('menuItems'));

-- Seed with the exact cards that used to be hardcoded, so the menu page
-- looks identical right after this migration runs — nothing changes
-- visually until an admin actually edits something.
insert into public.menu_items (title, subtitle, color, icon_key, size, action_type, action_value, sort_order) values
  ('ابحث عن عقار', 'اشترِ واستأجر بسهولة', '#1e293b', 'search_building', 'full', 'route', '/(tabs)/search', 0),
  ('انشر عقارك', 'بدون أي رسوم', '#22A652', 'plus', 'half', 'route', '/publish/create-listing', 1),
  ('اطلب عقارك', 'والعروض توصلك', '#0ea5e9', 'chat', 'half', 'route', '/publish/create-request', 2),
  ('احمي نفسك', 'خدمات قانونية متخصصة للعقارات', '#722F37', 'scale', 'half', 'whatsapp', 'مرحباً، أرغب في الاستفسار عن خدمة الاستشارات القانونية للعقارات (احمي نفسك) من تطبيق ديارينو', 3),
  ('اطلع لايف', 'ابدأ بث مباشر الآن', '#ef4444', 'camera', 'half', 'route', '/live/broadcast', 4),
  ('Repoo', 'تشطيبات وديكور', '#334155', 'building', 'half', 'whatsapp', 'مرحباً، أرغب في الاستفسار عن خدمات التشطيب والديكور (Repoo) من تطبيق ديارينو', 5),
  ('ونش ونقل أثاث', 'عرض سعر فوري', '#7c2d12', 'crane_truck', 'half', 'whatsapp', 'مرحباً، أرغب في طلب خدمة ونش ونقل الأثاث من تطبيق ديارينو', 6)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Ad-banner rotation behavior — one carousel-wide setting (all
--    banners in the carousel rotate together, so this isn't per-banner):
--    whether it advances automatically after N seconds, or only when the
--    person swipes it themselves.
-- ---------------------------------------------------------------------
create table if not exists public.ad_carousel_settings (
  id boolean primary key default true,
  rotation_mode text not null default 'auto' check (rotation_mode in ('auto', 'manual')),
  duration_ms integer not null default 4000,
  constraint ad_carousel_settings_singleton check (id = true)
);

insert into public.ad_carousel_settings (id, rotation_mode, duration_ms) values (true, 'auto', 4000)
on conflict (id) do nothing;

alter table public.ad_carousel_settings enable row level security;

create policy "ad carousel settings are readable by authenticated users"
  on public.ad_carousel_settings for select
  to authenticated
  using (true);

create policy "admins can update ad carousel settings"
  on public.ad_carousel_settings for update
  to authenticated
  using (public.admin_has_permission('ads'))
  with check (public.admin_has_permission('ads'));
