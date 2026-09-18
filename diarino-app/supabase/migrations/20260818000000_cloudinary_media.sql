-- supabase/migrations/20260818000000_cloudinary_media.sql
-- Media now uploads straight from the device to Cloudinary (lib/cloudinary.ts)
-- instead of Supabase Storage. This table is the record of every upload —
-- the actual display URL still lives wherever it always has
-- (properties.media jsonb, profiles.avatar_url, chat_messages.images,
-- lives.poster_url) so nothing that reads those breaks; this is the
-- normalized ledger the request asked for, with the full Cloudinary
-- metadata (dimensions, video duration, auto-generated thumbnail, format,
-- size) that a jsonb blob wasn't tracking before.

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  url text not null,
  public_id text not null,
  thumbnail_url text,
  width int,
  height int,
  duration numeric, -- seconds; null for images
  format text,
  bytes bigint,
  -- ↔ which feature this upload came from, so an admin (or a future
  -- cleanup job) can tell a property video from a chat photo from an
  -- avatar without joining out to four different tables.
  context text not null default 'other' check (context in ('property', 'avatar', 'chat', 'live_poster', 'other')),
  context_id uuid, -- e.g. the property/chat/live id, when known at upload time
  created_at timestamptz not null default now()
);

create index if not exists media_owner_idx on public.media(owner_id);
create index if not exists media_context_idx on public.media(context, context_id);

alter table public.media enable row level security;

create policy "users can log their own uploads"
  on public.media for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "users can read their own uploads"
  on public.media for select
  to authenticated
  using (owner_id = auth.uid());

-- ↔ reuses the 'features' permission, same as the social-share-links
-- settings — a general platform-oversight permission rather than a new
-- AdminSection enum value just for this table.
create policy "admins can read all media"
  on public.media for select
  to authenticated
  using (public.admin_has_permission('features'));

create policy "admins can delete media"
  on public.media for delete
  to authenticated
  using (public.admin_has_permission('features'));
