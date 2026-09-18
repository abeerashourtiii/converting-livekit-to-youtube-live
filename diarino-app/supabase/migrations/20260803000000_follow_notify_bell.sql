-- supabase/migrations/20260803000000_follow_notify_bell.sql
-- Powers the new 🔔 bell button on the seller's public profile page
-- (replacing the WhatsApp button there — WhatsApp contact is still
-- available from the property details screen). Reuses the 'follow'
-- notification category rather than adding a 5th tab to the
-- notifications dropdown: a new-listing alert from someone you follow
-- fits naturally under "الناس اللي بتتابعهم".

alter table public.follows
  add column if not exists notify boolean not null default true;

create or replace function public.handle_new_listing_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, category, text, property_id)
  select f.follower_id, new.seller_id, 'follow', 'نشر إعلانًا جديدًا: ' || coalesce(new.title, ''), new.id
  from public.follows f
  where f.followee_id = new.seller_id and f.notify = true;
  return new;
end;
$$;

create trigger properties_after_insert_notify
  after insert on public.properties
  for each row execute function public.handle_new_listing_notify();
