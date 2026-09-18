-- supabase/migrations/20260814000000_menu_redesign.sql
--
-- Redesign of the "القائمة" (menu) page to match the new approved layout:
--   - "ابحث عن عقار" becomes a tall card paired with two stacked half
--     cards ("انشر عقارك" / "اطلب عقارك") — new size 'tall'.
--   - "اطلع لايف" becomes a small round button paired with the renamed
--     "وكيلك القانوني" card (was "احمي نفسك") — new size 'round'.
--   - Two brand-new cards: "الإعدادات" (app settings) and
--     "إدارة الحساب" (personal account management, replaces the account
--     tab that used to live in the bottom tab bar).
--   - A new full-width card: "لوازم السباكة والكهرباء", with an optional
--     call-to-action pill label ("اطلب الآن") — new cta_label column.

alter table public.menu_items drop constraint if exists menu_items_size_check;
alter table public.menu_items add constraint menu_items_size_check
  check (size in ('full', 'half', 'tall', 'round'));

alter table public.menu_items add column if not exists cta_label text;

-- 1. "ابحث عن عقار" → tall card, dark teal, first in the tall+half+half group.
update public.menu_items set
  color = '#0B4B54', size = 'tall', sort_order = 0
where title = 'ابحث عن عقار';

-- 2/3. The two half cards paired with it.
update public.menu_items set
  color = '#5F794A', sort_order = 1
where title = 'انشر عقارك';

update public.menu_items set
  color = '#15A6C1', sort_order = 2
where title = 'اطلب عقارك';

-- 4. "اطلع لايف" → small round button, paired with the lawyer card.
update public.menu_items set
  title = 'اطلع اللايف', color = '#C1272D', icon_key = 'live_signal',
  size = 'round', sort_order = 3
where title = 'اطلع لايف';

-- 5. "احمي نفسك" renamed to "وكيلك القانوني", cream card, same action.
update public.menu_items set
  title = 'وكيلك القانوني', subtitle = 'استشارات قانونية عقارية متخصصة',
  color = '#F6EEDB', size = 'half', sort_order = 4
where title = 'احمي نفسك';

-- 6. New: الإعدادات (settings) — routes to the new /settings screen.
insert into public.menu_items (title, subtitle, color, icon_key, size, action_type, action_value, sort_order)
select 'الإعدادات', null, '#C57C15', 'settings', 'half', 'route', '/settings', 5
where not exists (select 1 from public.menu_items where title = 'الإعدادات');

-- 7. New: إدارة الحساب (personal account) — routes to the existing
--    account screen, previously reachable only from the bottom tab bar.
insert into public.menu_items (title, subtitle, color, icon_key, size, action_type, action_value, sort_order)
select 'إدارة الحساب', null, '#EDDFC4', 'account_circle', 'half', 'route', '/(tabs)/account', 6
where not exists (select 1 from public.menu_items where title = 'إدارة الحساب');

-- 8/9. Repoo + crane truck — updated colors, kept as-is otherwise.
update public.menu_items set color = '#4B4842', sort_order = 7 where title = 'Repoo';
update public.menu_items set color = '#5B2A86', sort_order = 8 where title = 'ونش ونقل أثاث';

-- 10. New: لوازم السباكة والكهرباء — full-width, WhatsApp order request
--     with photo, with a "اطلب الآن" call-to-action pill.
insert into public.menu_items (title, subtitle, color, icon_key, size, action_type, action_value, sort_order, cta_label)
select
  'لوازم السباكة والكهرباء',
  'ارفع صورة الطلبات ومن غير تعب التوصيل',
  '#327F6D', 'plumbing_electric', 'full', 'whatsapp',
  'مرحباً، أرغب في طلب لوازم سباكة/كهرباء من تطبيق ديارينو. سأرسل صورة الطلب الآن.',
  9, 'اطلب الآن'
where not exists (select 1 from public.menu_items where title = 'لوازم السباكة والكهرباء');
