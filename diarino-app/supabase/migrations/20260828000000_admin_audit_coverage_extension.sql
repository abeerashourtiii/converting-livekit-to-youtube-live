-- supabase/migrations/20260828000000_admin_audit_coverage_extension.sql
--
-- Extends admin_audit_log coverage to the five admin-write tables the
-- components/ audit flagged as gap: an admin could toggle a feature
-- flag, add/edit/delete/reorder a menu item, change the ad-carousel
-- rotation settings, or dismiss a suggestion/support message, and none
-- of it left a trace — same class of action as the reel/live
-- moderation and ad-banner/sponsored-reel writes that
-- 20260810000000_admin_audit_and_permission_enforcement.sql already
-- covers, just missed in that pass.
--
-- Same log_admin_change() trigger function as that migration, reused
-- unchanged, for the three tables here with a normal uuid `id` primary
-- key (menu_items, suggestions, support_messages) — same
-- insert-gets-logged-as-"_update" labeling quirk that function already
-- has (it doesn't branch on tg_op = 'INSERT' specifically, only
-- 'DELETE' vs. everything else), preserved here for consistency rather
-- than changing that function's long-established behavior as a
-- side-effect of this migration.

-- ---------------------------------------------------------------------
-- 1. menu_items, suggestions, support_messages — real uuid `id` PKs,
--    log_admin_change() works as-is.
-- ---------------------------------------------------------------------

create trigger audit_menu_item_insert
  after insert on public.menu_items
  for each row execute function public.log_admin_change('menu_item');

create trigger audit_menu_item_update
  after update on public.menu_items
  for each row execute function public.log_admin_change('menu_item');

create trigger audit_menu_item_delete
  after delete on public.menu_items
  for each row execute function public.log_admin_change('menu_item');

-- Only the delete is an admin action here — the insert into
-- `suggestions` is the ORIGINAL USER submitting feedback
-- (useSubmitSuggestion() in lib/hooks/useReports.ts), not something an
-- admin did, so it doesn't belong in an *admin* audit log. Deleting one
-- (useDismissSuggestion()) is admin-only per its RLS policy
-- ("admins can delete suggestions", admin_has_permission('reports')) —
-- that's the actual admin-driven event worth recording.
create trigger audit_suggestion_delete
  after delete on public.suggestions
  for each row execute function public.log_admin_change('suggestion');

-- Same reasoning as suggestions above: insert is the user opening a
-- support request, delete (admin-only per "admins can delete support
-- messages") is the admin dismissing/resolving it.
create trigger audit_support_message_delete
  after delete on public.support_messages
  for each row execute function public.log_admin_change('support_message');

-- ---------------------------------------------------------------------
-- 2. feature_flags (PK is `key text`, no `id` column at all) and
--    ad_carousel_settings (PK is `id boolean`, a singleton row — not a
--    uuid) — log_admin_change() can't be reused unchanged for either:
--    it references old.id/new.id directly (fails outright on
--    feature_flags, which has no such column) and inserts that value
--    into admin_audit_log.target_id, which is typed `uuid` (a boolean
--    would fail there too). Rather than change target_id's type or add
--    a second key column to admin_audit_log for two tables, this
--    variant just leaves target_id null for these — nothing is actually
--    lost, since before/after already capture the real key
--    (`key` / `id`) inside the JSONB either way; it's only not broken
--    out as its own indexed column the way a uuid target_id is for
--    every other audited table.
-- ---------------------------------------------------------------------
create or replace function public.log_admin_change_no_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor_name text;
  act text;
begin
  select full_name into actor_name from public.profiles where id = auth.uid();

  if tg_op = 'DELETE' then
    act := tg_argv[0] || '_delete';
    insert into public.admin_audit_log (actor_id, actor_name, action, target_table, target_id, before, after)
    values (auth.uid(), actor_name, act, tg_table_name, null, to_jsonb(old), null);
    return old;
  else
    act := tg_argv[0] || '_update';
    insert into public.admin_audit_log (actor_id, actor_name, action, target_table, target_id, before, after)
    values (auth.uid(), actor_name, act, tg_table_name, null, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;

-- toggleFeature() (lib/hooks/useAdminDB.ts) only ever updates `enabled`
-- — flags are seeded once in 20260801000000_admin_backend.sql and never
-- inserted/deleted by an admin afterward, so update is the only
-- meaningful event here.
create trigger audit_feature_flag_update
  after update on public.feature_flags
  for each row
  when (old.enabled is distinct from new.enabled)
  execute function public.log_admin_change_no_id('feature_flag');

-- Singleton row (constraint ad_carousel_settings_singleton, id always
-- true) seeded once in its own migration — same reasoning, update only.
create trigger audit_ad_carousel_settings_update
  after update on public.ad_carousel_settings
  for each row execute function public.log_admin_change_no_id('ad_carousel_settings');
