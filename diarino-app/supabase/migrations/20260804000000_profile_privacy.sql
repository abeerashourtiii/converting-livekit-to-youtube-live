-- supabase/migrations/20260804000000_profile_privacy.sql
-- Powers the "الحساب عام/خاص" toggle in the account settings menu — when
-- off, the seller's public profile page (app/seller/[id].tsx) shows a
-- "private account" notice to everyone except the account's own owner,
-- instead of the listings/lives grid.

alter table public.profiles
  add column if not exists is_public boolean not null default true;

-- Already covered by the existing "profiles are readable by authenticated
-- users" policy — is_public is just a flag the CLIENT checks before
-- rendering another user's profile page, same pattern as
-- moderation_status on properties. Enforcing it at the RLS level too
-- would also hide the row from things like the chat/seller-name lookups
-- that every screen already depends on, so it's intentionally
-- client-gated rather than row-hidden.
