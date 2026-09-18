-- supabase/migrations/20260806000000_user_content_settings.sql
-- Powers 5 new rows in the settings menu:
--   - chat on/off for property details (per seller)
--   - chat on/off for requests (per requester)
--   - WhatsApp number visible/hidden on property details (per seller)
--   - call button visible/hidden on property details (per seller)
--   - per-category notification toggles (like/save/follow/chat)
-- All live on public.profiles since they're account-level preferences,
-- not per-listing ones.

alter table public.profiles
  add column if not exists chat_on_properties boolean not null default true,
  add column if not exists chat_on_requests boolean not null default true,
  add column if not exists show_whatsapp boolean not null default true,
  add column if not exists show_call_button boolean not null default true,
  add column if not exists notify_likes boolean not null default true,
  add column if not exists notify_saves boolean not null default true,
  add column if not exists notify_follows boolean not null default true,
  add column if not exists notify_chat boolean not null default true;

-- ---------------------------------------------------------------------
-- Re-point the existing notification triggers to respect the recipient's
-- own per-category preference — CREATE OR REPLACE keeps the same trigger
-- bindings from 20260802000000_notifications_backend.sql, just adds a
-- check against the row's own notify_* column before inserting.
-- ---------------------------------------------------------------------

create or replace function public.handle_like_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller uuid;
  ptitle text;
  seller_wants_it boolean;
begin
  if tg_op = 'INSERT' then
    update public.properties set likes = likes + 1 where id = new.property_id
      returning seller_id, title into seller, ptitle;
    if seller is not null and seller <> new.user_id then
      select notify_likes into seller_wants_it from public.profiles where id = seller;
      if coalesce(seller_wants_it, true) then
        insert into public.notifications (recipient_id, actor_id, category, text, property_id)
        values (seller, new.user_id, 'like', 'تم الإعجاب بإعلانك: ' || coalesce(ptitle, ''), new.property_id);
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.properties set likes = greatest(0, likes - 1) where id = old.property_id;
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.handle_favorite_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  seller uuid;
  ptitle text;
  seller_wants_it boolean;
begin
  if tg_op = 'INSERT' then
    if new.property_id is null then return new; end if;
    update public.properties set saves = saves + 1 where id = new.property_id
      returning seller_id, title into seller, ptitle;
    if seller is not null and seller <> new.user_id then
      select notify_saves into seller_wants_it from public.profiles where id = seller;
      if coalesce(seller_wants_it, true) then
        insert into public.notifications (recipient_id, actor_id, category, text, property_id)
        values (seller, new.user_id, 'save', 'تم حفظ إعلانك في المفضلة: ' || coalesce(ptitle, ''), new.property_id);
      end if;
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

create or replace function public.handle_follow_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  followee_wants_it boolean;
begin
  select notify_follows into followee_wants_it from public.profiles where id = new.followee_id;
  if coalesce(followee_wants_it, true) then
    insert into public.notifications (recipient_id, actor_id, category, text)
    values (new.followee_id, new.follower_id, 'follow', 'أصبح لديك متابع جديد');
  end if;
  return new;
end;
$$;

create or replace function public.handle_chat_message_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient uuid;
  msg_text text;
  recipient_wants_it boolean;
begin
  select case when c.initiator_id = new.sender_id then c.partner_id else c.initiator_id end
    into recipient
  from public.chats c where c.id = new.chat_id;

  if recipient is null then return new; end if;

  select notify_chat into recipient_wants_it from public.profiles where id = recipient;
  if not coalesce(recipient_wants_it, true) then return new; end if;

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

-- ↔ handle_new_listing_notify() from 20260803000000_follow_notify_bell.sql
-- also gates on the FOLLOWER's own notify_follows preference now (it
-- already had its own per-follow `notify` flag — this adds the account-
-- wide kill switch on top of that per-person one).
create or replace function public.handle_new_listing_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, category, text, property_id)
  select f.follower_id, new.seller_id, 'follow', 'نشر إعلانًا جديدًا: ' || coalesce(new.title, ''), new.id
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.followee_id = new.seller_id and f.notify = true and coalesce(p.notify_follows, true) = true;
  return new;
end;
$$;
