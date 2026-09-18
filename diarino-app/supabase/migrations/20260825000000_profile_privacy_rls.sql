-- supabase/migrations/20260825000000_profile_privacy_rls.sql
--
-- Makes profiles.is_public an ENFORCED database boundary instead of a
-- client-side-only check. 20260804000000_profile_privacy.sql's own note
-- explicitly deferred this ("enforcing at the RLS level too would also
-- hide the row from things like chat/seller-name lookups that every
-- screen already depends on, so it's intentionally client-gated") — this
-- migration is that deferred work, done properly with a two-tier model
-- instead of a blanket row-hide, specifically so it does NOT break those
-- lookups.
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ Tier 1 — public.profiles (the real table, every column incl. phone) │
-- └─────────────────────────────────────────────────────────────────────┘
-- Readable only by:
--   • the row's own owner (id = auth.uid())
--   • anyone, if is_public = true
--   • a chat partner, regardless of is_public — you already have an open
--     conversation with them; hiding their name/phone mid-chat would
--     break the chat UI for no privacy benefit, since they can just tell
--     you their number over chat anyway
--   • staff (public.is_admin()) — moderation/support tooling needs to
--     resolve real names regardless of a user's own privacy setting
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ Tier 2 — public.profiles_public (view: no phone, no bio, no PII)    │
-- └─────────────────────────────────────────────────────────────────────┘
-- id, full_name, avatar_url, verified, is_public, plus the handful of
-- contact-visibility *preference* booleans (show_whatsapp etc. — these
-- are toggles about what a stranger may see, not sensitive data
-- themselves, and general browsing genuinely needs them to decide
-- whether to render a call/WhatsApp button at all). Unconditionally
-- readable by any authenticated user — this is the "who posted this
-- public listing / who's this live host / who liked this" identity,
-- which was never the sensitive part. It intentionally bypasses the
-- policy above: the view is owned by the migration role, and Postgres
-- views run with the owner's privileges by default, so it reads the
-- underlying table's rows regardless of the SELECT policy on
-- public.profiles. That's the whole mechanism — and it's safe *because*
-- the view's column list is hard-coded to exclude phone/bio, not because
-- of who's asking.
--
-- Call sites: any query that previously did `profiles!fkey(*)` or
-- `profiles!fkey(full_name, ...)` purely for display in a context with no
-- real relationship to that user (a property card, a live-host chip, a
-- notification actor, a follower list) now embeds `profiles_public!fkey`
-- instead. Contexts with an actual relationship — your own profile, or a
-- chat you're a participant in — keep reading `profiles` directly, since
-- the policy above already covers those for free.

-- ---------------------------------------------------------------------
-- 0. Staff-wide read helper. admin_has_permission() (added in
-- 20260810000000) checks a *specific* section grant, which is right for
-- writes but too narrow here — reading a display name for e.g. the
-- suggestions/support/reports admin tabs shouldn't require that whichever
-- admin is looking also happens to hold that exact section's permission.
-- Any row in user_roles with role='admin' is staff; that's enough to
-- read (not write) full profile data.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 1. profiles_public — the safe, unconditional view.
-- ---------------------------------------------------------------------
create or replace view public.profiles_public as
  select
    id, full_name, avatar_url, verified, is_public,
    chat_on_properties, chat_on_requests, show_whatsapp, show_call_button
  from public.profiles;

grant select on public.profiles_public to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tighten profiles' own SELECT policy.
-- ---------------------------------------------------------------------
drop policy if exists "profiles are readable by authenticated users" on public.profiles;

create policy "profiles readable by self, public accounts, chat partner, or staff"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or is_public = true
    or public.is_admin()
    or exists (
      select 1 from public.chats c
      where (c.initiator_id = auth.uid() and c.partner_id = profiles.id)
         or (c.partner_id = auth.uid() and c.initiator_id = profiles.id)
    )
  );

-- ---------------------------------------------------------------------
-- 3. Anonymous accounts can no longer start a broadcast (server-side).
-- ---------------------------------------------------------------------
-- Companion to the client-side gate in app/(tabs)/menu.tsx and
-- app/live/broadcast.tsx (hides/blocks the "بث مباشر" entry point for
-- Supabase anonymous-auth "guest" sessions) — this is the part of that
-- guard a modified client can't route around. Supabase's anonymous sign-in
-- sets `is_anonymous: true` as a JWT claim specifically so RLS can key off
-- it; `coalesce(...)::boolean, false)` treats a missing/older-shaped
-- claim as "not anonymous" rather than failing the check open OR closed
-- by accident.
--
-- This alone is sufficient to close the whole path end-to-end: the
-- livekit-token Edge Function only grants `canPublish` when
-- `lives.host_id = auth.uid()` for an existing `lives` row (see
-- supabase/functions/livekit-token/index.ts) — if an anonymous user can
-- never get a `lives` row created in the first place, they can never
-- become a room's host_id, so there's no separate Edge Function check to
-- duplicate here.
drop policy if exists "users can create their own live room" on public.lives;

create policy "users can create their own live room"
  on public.lives for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
