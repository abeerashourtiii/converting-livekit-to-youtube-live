-- supabase/migrations/20260822000000_rls_audit_fixes.sql
-- Fixes from the RLS audit: pending/rejected properties and unpublished
-- live recordings were readable by anyone (client-side filtering only,
-- not enforced by RLS — see each policy's comment below), and the
-- chat/notification "mark read" updates allowed rewriting any column,
-- not just `read`.

-- ---------------------------------------------------------------------
-- 1. properties — only approved listings are public; the owner and
--    admins (via admin_has_permission, not a blanket "everyone") still
--    see pending/rejected ones. Previously `using (true)` with no status
--    check at all — see 20260801000000_admin_backend.sql's own comment
--    acknowledging this ("rejected listings aren't hidden from the
--    public") for how long this was known and unaddressed.
-- ---------------------------------------------------------------------
drop policy if exists "properties are readable by authenticated users" on public.properties;
create policy "approved properties are public, own listings always visible"
  on public.properties for select
  to authenticated
  using (
    moderation_status = 'approved'
    or seller_id = auth.uid()
    or public.admin_has_permission('reels')
  );

-- ---------------------------------------------------------------------
-- 2. lives — same pattern as properties: a currently-live broadcast
--    needs to stay joinable by any viewer regardless of published_public
--    (that flag only governs the *recording* afterward), and the host/
--    admins always see their own regardless of status.
-- ---------------------------------------------------------------------
drop policy if exists "lives are readable by authenticated users" on public.lives;
create policy "public lives visible to all, private recordings to host + admin"
  on public.lives for select
  to authenticated
  using (
    status = 'live'
    or published_public = true
    or host_id = auth.uid()
    or public.admin_has_permission('lives')
  );

-- ---------------------------------------------------------------------
-- 3. chat_messages — replace the "mark read" UPDATE policy (which had
--    `with check (true)`, letting a participant rewrite ANY column of
--    ANY message in their chat, not just toggle `read`) with an RPC that
--    can only ever do the one thing it's meant to.
-- ---------------------------------------------------------------------
drop policy if exists "participants can mark messages read" on public.chat_messages;

create or replace function public.mark_chat_messages_read(p_chat_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chats c
    where c.id = p_chat_id and (c.initiator_id = auth.uid() or c.partner_id = auth.uid())
  ) then
    raise exception 'not a participant in this chat';
  end if;

  update public.chat_messages
  set read = true
  where chat_id = p_chat_id and sender_id <> auth.uid();
end;
$$;

grant execute on function public.mark_chat_messages_read(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. notifications — same fix, lower priority (a person could previously
--    only ever rewrite their own notification's text, which nobody else
--    ever sees — low impact, but tightened for consistency). Matches
--    useNotifications.ts's existing "mark all unread in this tab's
--    category/categories as read" call shape exactly.
-- ---------------------------------------------------------------------
drop policy if exists "users can mark their own notifications read" on public.notifications;

create or replace function public.mark_notifications_read(p_categories text[])
returns void
language sql
security definer set search_path = public
as $$
  update public.notifications set read = true
  where recipient_id = auth.uid() and category = any(p_categories) and read = false;
$$;

grant execute on function public.mark_notifications_read(text[]) to authenticated;
