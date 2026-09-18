-- supabase/migrations/20260802000000_notifications_backend.sql
-- Wires lib/hooks/useNotifications.ts (previously a local, restart-losing
-- NOTIF_DATA store) to a real `notifications` table. Getting there also
-- means fixing two features that looked wired up in the UI but never
-- actually wrote anywhere:
--   - the reel "heart" (like) button — components/reel/ReelCard.tsx kept
--     likedByMe/likeCount in useState only, never touched properties.likes
--   - the seller "follow" button — both app/(tabs)/index.tsx's
--     followedSellers Set *and* app/seller/[id].tsx's own local
--     `following` state were independent and reset on every render/restart
--     (lib/hooks/useProperties.ts even has the comment
--     "followers: 0, // no followers table yet" marking this exact gap)
--
-- Notifications themselves are created by AFTER INSERT/DELETE triggers on
-- likes/favorites/follows/chat_messages — that way ANY code path that
-- creates one of those rows produces a real notification for the right
-- person, instead of the app having to remember to do it in N different
-- places.

-- ---------------------------------------------------------------------
-- 1. Real likes (mirrors public.favorites, property-only)
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists likes_user_id_idx on public.likes(user_id);
create index if not exists likes_property_id_idx on public.likes(property_id);

alter table public.likes enable row level security;

create policy "users manage their own likes"
  on public.likes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Follows
-- ---------------------------------------------------------------------
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

create index if not exists follows_follower_idx on public.follows(follower_id);
create index if not exists follows_followee_idx on public.follows(followee_id);

alter table public.follows enable row level security;

-- Follow relationships aren't private the way favorites are — a seller's
-- follower count and "is this person following that seller" both need to
-- be readable by anyone signed in.
create policy "follows are readable by authenticated users"
  on public.follows for select
  to authenticated
  using (true);

create policy "users can follow as themselves"
  on public.follows for insert
  to authenticated
  with check (follower_id = auth.uid());

create policy "users can unfollow their own follows"
  on public.follows for delete
  to authenticated
  using (follower_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid constraint notifications_actor_profile_fkey references public.profiles(id) on delete set null,
  category text not null check (category in ('like', 'save', 'follow', 'chat')),
  text text not null,
  property_id uuid references public.properties(id) on delete cascade,
  chat_id uuid references public.chats(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_id, category, created_at desc);

alter table public.notifications enable row level security;

create policy "users read their own notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "users can mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No insert policy for regular users on purpose — every row below is
-- created by a SECURITY DEFINER trigger function, never directly by a
-- client, so there's nothing to notify-spam with.

-- Pushed live so the bell badge updates without a manual refetch, same as
-- chat_messages.
alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------
-- 4. Triggers: likes -> properties.likes count + a "like" notification
-- ---------------------------------------------------------------------
create or replace function public.handle_like_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller uuid;
  ptitle text;
begin
  if tg_op = 'INSERT' then
    update public.properties set likes = likes + 1 where id = new.property_id
      returning seller_id, title into seller, ptitle;
    if seller is not null and seller <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, category, text, property_id)
      values (seller, new.user_id, 'like', 'تم الإعجاب بإعلانك: ' || coalesce(ptitle, ''), new.property_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.properties set likes = greatest(0, likes - 1) where id = old.property_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger likes_after_change
  after insert or delete on public.likes
  for each row execute function public.handle_like_change();

-- ---------------------------------------------------------------------
-- 5. Triggers: favorites (property target) -> properties.saves count +
--    a "save" notification. (favorites on a request have no owner to
--    notify, so those are skipped.)
-- ---------------------------------------------------------------------
create or replace function public.handle_favorite_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller uuid;
  ptitle text;
begin
  if tg_op = 'INSERT' then
    if new.property_id is null then return new; end if;
    update public.properties set saves = saves + 1 where id = new.property_id
      returning seller_id, title into seller, ptitle;
    if seller is not null and seller <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, category, text, property_id)
      values (seller, new.user_id, 'save', 'تم حفظ إعلانك في المفضلة: ' || coalesce(ptitle, ''), new.property_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.property_id is null then return old; end if;
    update public.properties set saves = greatest(0, saves - 1) where id = old.property_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger favorites_after_change
  after insert or delete on public.favorites
  for each row execute function public.handle_favorite_change();

-- ---------------------------------------------------------------------
-- 6. Trigger: follows -> a "follow" notification
-- ---------------------------------------------------------------------
create or replace function public.handle_follow_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, category, text)
  values (new.followee_id, new.follower_id, 'follow', 'أصبح لديك متابع جديد');
  return new;
end;
$$;

create trigger follows_after_insert
  after insert on public.follows
  for each row execute function public.handle_follow_insert();

-- ---------------------------------------------------------------------
-- 7. Trigger: chat_messages -> a "chat" notification for the other
--    participant
-- ---------------------------------------------------------------------
create or replace function public.handle_chat_message_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient uuid;
  msg_text text;
begin
  select case when c.initiator_id = new.sender_id then c.partner_id else c.initiator_id end
    into recipient
  from public.chats c where c.id = new.chat_id;

  if recipient is null then return new; end if;

  msg_text := case
    when new.text is not null and length(trim(new.text)) > 0 then new.text
    when coalesce(array_length(new.images, 1), 0) > 0 then 'أرسل لك صورة'
    else 'رسالة جديدة'
  end;

  insert into public.notifications (recipient_id, actor_id, category, text, chat_id)
  values (recipient, new.sender_id, 'chat', msg_text, new.chat_id);
  return new;
end;
$$;

create trigger chat_messages_after_insert
  after insert on public.chat_messages
  for each row execute function public.handle_chat_message_insert();
