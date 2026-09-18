-- supabase/migrations/20260815000000_support_center.sql
-- Builds out the admin "الدعم" (Support) center requested on top of the
-- existing reports/suggestions infrastructure. Three additions:
--
--   1. public.reports.target_type now also accepts 'request', so a
--      property request can be reported the same way a reel/live can.
--   2. public.ad_contacts — logs every time someone taps the "مساحة
--      إعلانية" banner on the menu page (the ad-space that opens a link
--      or WhatsApp chat), so admins can see which ads people actually
--      engaged with.
--   3. public.support_messages — logs every time someone taps "تواصل
--      معنا" in settings, before it opens WhatsApp — a lightweight
--      "who asked for support and when" trail for the admin support
--      inbox to show alongside reports/suggestions/ad contacts.
--
-- All three read paths are gated by the same admin_has_permission('reports')
-- check already used for public.reports and public.suggestions, so a
-- single "reports" permission grant covers the whole support center —
-- no new AdminSection enum value needed on the client.

-- ---------------------------------------------------------------------
-- 1. Reports can now target a request too
-- ---------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('property', 'live', 'request'));

-- ---------------------------------------------------------------------
-- 2. Ad banner contacts ("الاعلانات التي يتم التواصل فيها")
-- ---------------------------------------------------------------------
create table if not exists public.ad_contacts (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.ad_banners(id) on delete cascade,
  banner_title text not null,
  user_id uuid not null constraint ad_contacts_profile_fkey references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ad_contacts_banner_idx on public.ad_contacts(banner_id);
create index if not exists ad_contacts_created_at_idx on public.ad_contacts(created_at desc);

alter table public.ad_contacts enable row level security;

create policy "users can log their own ad contacts"
  on public.ad_contacts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "admins can read ad contacts"
  on public.ad_contacts for select
  to authenticated
  using (public.admin_has_permission('reports'));

create policy "admins can delete ad contacts"
  on public.ad_contacts for delete
  to authenticated
  using (public.admin_has_permission('reports'));

-- ---------------------------------------------------------------------
-- 3. "تواصل معنا" contact requests from the settings screen
-- ---------------------------------------------------------------------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null constraint support_messages_profile_fkey references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_created_at_idx on public.support_messages(created_at desc);

alter table public.support_messages enable row level security;

create policy "users can log their own support contacts"
  on public.support_messages for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "admins can read support messages"
  on public.support_messages for select
  to authenticated
  using (public.admin_has_permission('reports'));

create policy "admins can delete support messages"
  on public.support_messages for delete
  to authenticated
  using (public.admin_has_permission('reports'));

-- ---------------------------------------------------------------------
-- 4. Let admins read suggestions text alongside the submitter's name —
--    the existing "admins can read all suggestions" policy from
--    20260805000000_suggestions.sql already covers SELECT; this just
--    lets admins clear a suggestion out of the inbox once handled.
-- ---------------------------------------------------------------------
create policy "admins can delete suggestions"
  on public.suggestions for delete
  to authenticated
  using (public.admin_has_permission('reports'));

-- ---------------------------------------------------------------------
-- 5. Admins can delete a reported request ("حذف المحتوى" in the support
--    center's reports tab, for a target_type = 'request' report) — the
--    requests table only had an owner-delete policy until now.
-- ---------------------------------------------------------------------
create policy "admins can delete any request"
  on public.requests for delete
  to authenticated
  using (public.admin_has_permission('reports'));
