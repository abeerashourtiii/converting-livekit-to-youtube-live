-- supabase/migrations/20260819000000_push_tokens.sql
-- Stores each device's Expo push token so supabase/functions/send-push
-- (triggered by a Database Webhook on INSERT into public.notifications —
-- see that function's header comment for the one-time dashboard setup)
-- knows where to deliver a real OS-level push notification, not just an
-- in-app one. A user can have several rows (multiple devices); a device
-- can only ever belong to one user at a time, which the upsert in
-- lib/hooks/usePushNotifications.ts relies on.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  device_type text, -- 'ios' | 'android'
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

create policy "users manage their own push tokens"
  on public.push_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ↔ a device can end up registering the same physical token under a
-- different account after a sign-out/sign-in (guest → real account, or
-- a shared device) — without this, a stale row from the previous user
-- would keep receiving that device's pushes. Re-registration always
-- calls this instead of a plain insert, and it runs as the now-signed-in
-- user under RLS, so it can only ever repoint tokens it's allowed to see
-- (its own) — a stale row left behind by a signed-out account on the
-- same device is cleaned up the next time that other account signs in
-- and re-registers, via the delete below.
create or replace function public.reassign_push_token(p_token text, p_device_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens where token = p_token and user_id <> auth.uid();
  insert into public.push_tokens (user_id, token, device_type, updated_at)
  values (auth.uid(), p_token, p_device_type, now())
  on conflict (user_id, token) do update set device_type = excluded.device_type, updated_at = now();
end;
$$;

grant execute on function public.reassign_push_token(text, text) to authenticated;
