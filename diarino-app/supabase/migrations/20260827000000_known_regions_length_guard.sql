-- supabase/migrations/20260827000000_known_regions_length_guard.sql
--
-- Full-table RLS audit (Aug 2026) follow-up — the only real finding
-- beyond what 20260822000000_rls_audit_fixes.sql had already caught.
-- known_regions' INSERT policy is `with check (true)`: deliberately open
-- to any authenticated user (see that migration's own comment — this is
-- shared, unattributed autocomplete data, same trust level the app
-- already gives any authenticated write). That's still the right call;
-- what was missing is a floor under it — nothing stopped a spammy client
-- from inserting arbitrarily long strings, which for a public-autocomplete
-- table means both unbounded row bloat and junk suggestions showing up
-- for every user searching. A length cap doesn't change who can write,
-- only how much garbage a single row can hold.

alter table public.known_regions
  add constraint known_regions_name_length check (char_length(name) between 1 and 100),
  add constraint known_regions_province_length check (char_length(province) between 1 and 100);

-- Same finding, same fix, found during the components/ audit: reports.reason
-- has no length cap either (target_title/target_color also have no cap, but
-- those come from the reported content itself, not free-typed user input —
-- reason is the one field a person types by hand, same shape of risk as
-- known_regions.name above). ReportModal.tsx now also caps the custom-reason
-- TextInput at maxLength={300}; this is the server-side backstop.
alter table public.reports
  add constraint reports_reason_length check (char_length(reason) between 1 and 500);
