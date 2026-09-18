-- supabase/migrations/20260910000000_menu_item_typography_and_layout.sql
--
-- لوحة تحكم الأدمن (أيقونات القائمة) — طلبات إضافية:
-- 1) وضع الصورة بجانب النص (يمين أو يسار)، مش بس فوق/تحت/خلفية.
-- 2) تحكم فى شكل الخط: الحجم، Bold، واللون.
-- 3) تحكم فى مكان النص جوه الكارت على محورين: رأسي (أعلى/منتصف/أسفل)
--    وأفقي (يمين/منتصف/شمال).

-- (1) قيمة جديدة لـ text_layout: 'beside' — الصورة بجانب النص فى صف
-- واحد (مش فوقه/تحته زي 'below'/'above')، + عمود جديد image_side بيحدد
-- الصورة على يمين النص ولا شماله لما يكون text_layout = 'beside'.
-- الـ check constraint القديم كان بيتقفل وقت إنشاء العمود بدون اسم
-- صريح، فبيتسمى تلقائيًا بنفس اسم العمود + _check.
alter table public.menu_items drop constraint if exists menu_items_text_layout_check;
alter table public.menu_items add constraint menu_items_text_layout_check
  check (text_layout in ('below', 'above', 'overlay', 'hidden', 'beside'));

alter table public.menu_items
  add column if not exists image_side text not null default 'right'
    check (image_side in ('left', 'right'));

comment on column public.menu_items.image_side is
  'لما يكون text_layout = ''beside'' بس: الصورة/الأيقونة على يمين النص ولا شماله فعليًا (فيزيائي، ثابت فى كل اللغات — مش بينعكس مع RTL).';

-- (2) شكل الخط: null = استخدم اللون/الحجم الافتراضي التلقائي (نفس
-- السلوك القديم بالظبط قبل الميزة دي — تباين تلقائي مع لون الكارت،
-- وحجم/سمك ثابتين فى app/(tabs)/menu.tsx). قيمة غير NULL = تخصيص صريح
-- من الأدمن.
alter table public.menu_items
  add column if not exists font_size integer,
  add column if not exists font_bold boolean not null default true,
  add column if not exists font_color text;

comment on column public.menu_items.font_size is
  'حجم خط العنوان بالـ pt. NULL = الحجم الافتراضي حسب حجم الكارت (زي ما كان دايمًا).';
comment on column public.menu_items.font_bold is
  'true (الافتراضي — نفس شكل كل الكروت القديمة) = خط عريض جدًا (900). false = وزن أخف (700) لمن يريد عنوانًا أقل ثقلاً بصريًا.';
comment on column public.menu_items.font_color is
  'كود Hex للون خط العنوان والوصف. NULL = تباين تلقائي حسب لون خلفية الكارت (نفس السلوك القديم).';

-- (3) مكان صندوق النص جوه الكارت على محورين مستقلين — بيتفعّلوا بس فى
-- التخطيطات اللي صندوق النص فيها له مساحة حرة يتحرك فيها (overlay
-- وbeside)؛ فى below/above التخطيط نفسه بيحدد الترتيب الرأسي أصلًا
-- فمحورين دول مالهومش تأثير هناك (شوف الشرح الكامل فى menu.tsx).
alter table public.menu_items
  add column if not exists text_valign text not null default 'middle'
    check (text_valign in ('top', 'middle', 'bottom')),
  add column if not exists text_halign text not null default 'center'
    check (text_halign in ('right', 'center', 'left'));

comment on column public.menu_items.text_valign is
  'محاذاة صندوق النص رأسيًا جوه الكارت (أعلى/منتصف/أسفل) — فعّالة فى overlay وbeside بس.';
comment on column public.menu_items.text_halign is
  'محاذاة صندوق النص أفقيًا جوه الكارت (يمين/منتصف/شمال) — فعّالة فى overlay وbeside بس.';
