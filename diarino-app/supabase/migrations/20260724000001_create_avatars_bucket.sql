-- supabase/migrations/20260724000001_create_avatars_bucket.sql
-- Closes the same "picked but never uploaded" gap in:
--   - app/(tabs)/account.tsx's pickAvatar() (profile picture)
--   - components/account/LiveActionSheet.tsx's pickPoster() (saved-live cover)
-- Both now upload here instead of only ever holding a local file:// URI.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: anyone authenticated can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

create policy "avatars: users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: users manage their own uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: users delete their own uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
