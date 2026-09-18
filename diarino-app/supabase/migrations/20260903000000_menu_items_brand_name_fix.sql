-- supabase/migrations/20260903000000_menu_items_brand_name_fix.sql
--
-- ↔ تحسين الكلمات (صفحة القائمة): نصوص رسائل واتساب لأربع كروت فى
-- public.menu_items (اللي جاية من 20260812000000_menu_items_and_ad_rotation.sql
-- و20260814000000_menu_redesign.sql) كانت لسه فيها اسم التطبيق القديم
-- "ديار توك" بدل الاسم الصحيح "ديارينو" — بقايا من قبل تسمية التطبيق.
-- تعديل الـ seed نفسه فى الملفين القديمين مش هيغيّر صفوف موجودة بالفعل
-- فى قاعدة بيانات شغالة (INSERT ... on conflict do nothing وUPDATE مربوطة
-- بالعنوان القديم)، فده تصحيح فعلي للبيانات الموجودة دلوقتي.
update public.menu_items
set action_value = replace(action_value, 'ديار توك', 'ديارينو')
where action_type = 'whatsapp'
  and action_value like '%ديار توك%';
