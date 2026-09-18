-- supabase/migrations/20260908000000_menu_item_custom_images.sql
--
-- لوحة تحكم الأدمن (أيقونات القائمة): إمكانية استبدال أيقونة أي كارت
-- بالكامل بصورة خارجية مرفوعة (نفس آلية Cloudinary المستخدمة فى صور
-- الإعلانات/العقارات، مش رابط ملصوق يدويًا) بدل الاختيار من مجموعة
-- الأيقونات الجاهزة (icon_key) فقط، مع تحكم فى حجم الصورة جوه الكارت
-- وطريقة احتوائها (contain/cover) ومكان النص بالنسبة للصورة.

alter table public.menu_items
  add column if not exists image_url text,
  add column if not exists image_size text not null default 'medium'
    check (image_size in ('small', 'medium', 'large', 'full')),
  add column if not exists image_fit text not null default 'contain'
    check (image_fit in ('contain', 'cover')),
  add column if not exists text_layout text not null default 'below'
    check (text_layout in ('below', 'above', 'overlay', 'hidden'));

comment on column public.menu_items.image_url is
  'صورة خارجية مرفوعة على Cloudinary تحل محل icon_key بالكامل لما تكون موجودة. NULL = استخدم icon_key القديم (أيقونة جاهزة أو صورة مضمّنة فى الباندل).';
comment on column public.menu_items.image_size is
  'حجم الصورة جوه الكارت: small/medium/large لأيقونة مصغّرة فوق النص (بيتحكموا فى نسبة الحجم)، أو full لصورة تملأ الكارت كخلفية كاملة.';
comment on column public.menu_items.image_fit is
  'contain = الصورة كاملة جوه صندوقها من غير قص. cover = تملأ الصندوق وتُقص لو لزم — زي object-fit فى CSS.';
comment on column public.menu_items.text_layout is
  'مكان العنوان/الوصف بالنسبة للصورة: below (الصورة فوق والنص تحتها — الشكل الكلاسيكي)، above (النص فوق والصورة تحته — شكل كارت "ابحث عن عقار" الطويل)، overlay (الصورة خلفية كاملة والنص فوقها بظل غامق للوضوح)، hidden (الصورة بس من غير أي نص — شكل زرار "اطلع اللايف" الدائري).';

-- الحفاظ على شكل الكروت اللي كانت بتاخد معاملة "صورة كبيرة" يدويًا فى
-- app/(tabs)/menu.tsx مربوطة بـ size بس (كارت "ابحث عن عقار" الطويل
-- وزرار "اطلع اللايف" الدائري) — دلوقتي بقت معاملة عامة مربوطة بالحقول
-- الجديدة مش بـ size وحده، فلازم نظبط الصفوف الموجودة عشان الشكل الحالي
-- ما يتغيرش خالص بعد الترحيل.
update public.menu_items
set image_size = 'full', image_fit = 'cover', text_layout = 'above'
where size = 'tall';

update public.menu_items
set image_size = 'full', image_fit = 'cover', text_layout = 'hidden'
where size = 'round';
