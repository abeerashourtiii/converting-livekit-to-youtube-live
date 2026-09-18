-- supabase/migrations/20260816000000_social_share.sql
-- "وسّع انتشار إعلانك" — lets a seller ask, at publish time, for their
-- listing to also be reposted on Diarino's own YouTube/Facebook/TikTok/
-- Instagram accounts once an admin approves it. Two pieces:
--
--   1. public.properties.share_platforms — which platforms this specific
--      listing's owner opted into (shown as checkboxes in
--      app/publish/create-listing.tsx, right above the video upload
--      field). Surfaces in the same admin reels approval screen so an
--      admin can see the request and download the video to repost it.
--   2. public.social_share_links — the four "من هنا" destination URLs
--      (Diarino's own channel/page/account on each platform), publicly
--      readable so the create-listing screen can open them, editable
--      only by admins (components/admin/AdminFeatures.tsx) once the
--      project owner supplies the real links.

alter table public.properties
  add column if not exists share_platforms text[] not null default '{}';

create table if not exists public.social_share_links (
  platform text primary key check (platform in ('youtube', 'facebook', 'tiktok', 'instagram')),
  url text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.social_share_links (platform, url) values
  ('youtube', ''), ('facebook', ''), ('tiktok', ''), ('instagram', '')
on conflict (platform) do nothing;

alter table public.social_share_links enable row level security;

create policy "anyone can read social share links"
  on public.social_share_links for select
  to authenticated
  using (true);

-- ↔ reuses the 'features' permission (components/admin/AdminFeatures.tsx
-- already gates general platform-wide settings behind it) rather than
-- adding a new AdminSection enum value just for four link fields.
create policy "admins can update social share links"
  on public.social_share_links for update
  to authenticated
  using (public.admin_has_permission('features'))
  with check (public.admin_has_permission('features'));
