-- supabase/migrations/20260820000000_smart_alerts.sql
-- "إشعارات ذكية مخصصة" — two new notification categories on top of the
-- existing real notifications pipeline (20260802000000_notifications_backend.sql)
-- and its push layer (20260815.../send-push edge function, unchanged —
-- it already fires on ANY new row in public.notifications regardless of
-- category, so no changes needed there beyond a title for the new
-- categories, done client + edge-function side separately):
--
--   1. 'new_match' — a saved search alert (public.saved_search_alerts,
--      new table) matched a freshly published listing. Same
--      insert-then-fan-out-to-matching-rows shape as
--      handle_new_listing_notify() in 20260803000000_follow_notify_bell.sql,
--      just matching against saved criteria instead of the follows table.
--   2. 'price_drop' — a listing already in someone's favorites got
--      cheaper. Fans out to public.favorites rows for that property.

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('like', 'save', 'follow', 'chat', 'new_match', 'price_drop'));

-- ---------------------------------------------------------------------
-- 1. Saved search alerts
-- ---------------------------------------------------------------------
create table if not exists public.saved_search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  province text, -- null = any province
  type text, -- null = any property type
  price_max numeric, -- null = no cap
  finish_type text, -- null = any finish
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ↔ the new-listing trigger below filters on exactly these four columns
-- for every active alert on every new property — this composite index is
-- what keeps that from becoming a full-table scan as alerts grow.
create index if not exists saved_search_alerts_match_idx
  on public.saved_search_alerts(active, province, type, price_max, finish_type);
create index if not exists saved_search_alerts_user_idx on public.saved_search_alerts(user_id);

alter table public.saved_search_alerts enable row level security;

create policy "users manage their own saved alerts"
  on public.saved_search_alerts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. New-listing match → 'new_match' notification
-- ---------------------------------------------------------------------
create or replace function public.handle_new_listing_match()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, category, text, property_id)
  select a.user_id, new.seller_id, 'new_match',
         'عقار جديد يطابق تنبيهك: ' || coalesce(new.title, ''), new.id
  from public.saved_search_alerts a
  where a.active = true
    and a.user_id <> new.seller_id -- don't notify someone about their own listing
    and (a.province is null or a.province = new.province)
    and (a.type is null or a.type = new.type)
    and (a.price_max is null or new.price <= a.price_max)
    and (a.finish_type is null or a.finish_type = new.finish_type);
  return new;
end;
$$;

create trigger properties_after_insert_match_alerts
  after insert on public.properties
  for each row execute function public.handle_new_listing_match();

-- ---------------------------------------------------------------------
-- 3. Price drop on a favorited listing → 'price_drop' notification
-- ---------------------------------------------------------------------
create or replace function public.handle_price_drop()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.price < old.price then
    insert into public.notifications (recipient_id, actor_id, category, text, property_id)
    select f.user_id, new.seller_id, 'price_drop',
           'انخفض سعر عقار محفوظ لديك: ' || coalesce(new.title, ''), new.id
    from public.favorites f
    where f.property_id = new.id and f.user_id <> new.seller_id;
  end if;
  return new;
end;
$$;

create trigger properties_after_update_price_drop
  after update of price on public.properties
  for each row execute function public.handle_price_drop();
