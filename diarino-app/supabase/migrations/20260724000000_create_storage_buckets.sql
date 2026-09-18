-- supabase/migrations/20260724000000_create_storage_buckets.sql
-- Two buckets referenced in code but never actually created:
--   - "chat-images": app/chat/[id].tsx uploads picked photos here before
--     sending a message (previously it just stored the local file:// URI,
--     which only the sender's own device could ever load — fixed now).
--   - "property-media": app/publish/create-listing.tsx picks video/images
--     for a listing but was ALSO only ever storing local URIs on the
--     property row — same bug, same fix, applied here too.
--
-- Both public=true (same tradeoff already made for live-recordings: a
-- public URL is simplest and these aren't highly sensitive — property
-- photos are marketing content meant to be seen widely, and chat photos
-- are ordinary property/room pictures, not anything requiring signed-URL
-- complexity). "Public" here means "readable if you have the exact URL",
-- not "listable/browsable" — LIST/INSERT/UPDATE/DELETE still go through
-- the RLS policies below.
--
-- Upload paths MUST be structured as "<uploader_user_id>/...rest" for the
-- ownership policies to work — e.g. chat images upload to
-- "<senderId>/<chatId>/<filename>", property media to "<sellerId>/<filename>".

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true), ('property-media', 'property-media', true)
on conflict (id) do nothing;

-- --- chat-images ---
create policy "chat-images: anyone authenticated can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'chat-images');

create policy "chat-images: users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat-images: users manage their own uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "chat-images: users delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- --- property-media ---
create policy "property-media: anyone authenticated can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'property-media');

create policy "property-media: users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "property-media: users manage their own uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "property-media: users delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-media' and (storage.foldername(name))[1] = auth.uid()::text);
