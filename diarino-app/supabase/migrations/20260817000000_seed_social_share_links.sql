-- supabase/migrations/20260817000000_seed_social_share_links.sql
-- Fills in the four "من هنا" destination links in "وسّع انتشار إعلانك"
-- (components/publish/SocialShareSection.tsx) with Diarino's real
-- YouTube/Facebook/TikTok/Instagram URLs, supplied by the project owner.
-- Uses upsert rather than assuming 20260816000000_social_share.sql's
-- empty seed is still in place, so this is safe to run whether that
-- migration already applied or not.
insert into public.social_share_links (platform, url, updated_at) values
  ('youtube', 'http://www.youtube.com/@Diarino-e4v', now()),
  ('facebook', 'https://www.facebook.com/share/1EzcpqY4pF/', now()),
  ('tiktok', 'https://www.tiktok.com/@diarino48?_r=1&_t=ZS-98fAvDkXKPo', now()),
  ('instagram', 'https://www.instagram.com/diarino.official?igsh=Zmc1cWl0eW9zcnJ6', now())
on conflict (platform) do update set url = excluded.url, updated_at = excluded.updated_at;
