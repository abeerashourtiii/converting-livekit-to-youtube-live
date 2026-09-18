-- supabase/migrations/20260829000000_international_phone_columns.sql
--
-- الميزة الدولية لإدخال رقم الهاتف — أعمدة جديدة في profiles لتخزين الرقم
-- بصيغة E.164 الموحّدة، بجانب عمود `phone` الحالي (لسه موجود، مش بيتشال —
-- راجع docs/PHONE_FEATURE_INTEGRATION_NOTES.md لقرار التكامل الكامل مع
-- الشاشات الحالية اللي بتستخدم `phone`).
--
-- حساسية الأعمدة الجديدة: نفس مستوى حساسية عمود `phone` الحالي بالظبط —
-- يعني برضو مستبعدة من public.profiles_public (شوف
-- 20260825000000_profile_privacy_rls.sql) وبتورث نفس RLS policy الموجودة
-- على الجدول الأساسي profiles تلقائيًا، من غير أي policy جديدة مطلوبة.

alter table public.profiles
  add column if not exists phone_e164 varchar(20) unique,
  add column if not exists phone_country_code varchar(5),
  add column if not exists phone_country_name varchar(100),
  add column if not exists phone_verified boolean not null default false;

comment on column public.profiles.phone_e164 is
  'الرقم الكامل بصيغة E.164 (مثل +201012345678) — المصدر الوحيد الموثوق لأي رابط خارجي (wa.me/tel:) بعد اكتمال دمج الميزة الدولية.';
comment on column public.profiles.phone_country_code is
  'كود الدولة الدولي بدون + (مثل 20)، محسوب من نفس القيمة المخزنة في phone_e164 — تكرار مقصود لتسريع الفلترة/العرض بدون parsing.';
comment on column public.profiles.phone_country_name is
  'اسم الدولة (عربي) وقت الحفظ — للعرض السريع فقط، وليس مصدر الحقيقة لصحة الرقم.';
comment on column public.profiles.phone_verified is
  'true فقط لو تم التحقق الفعلي (OTP أو ما شابه) — الميزة الحالية بتحفظ صحة الصيغة فقط (libphonenumber-js)، مش صحة الملكية؛ default false مقصود لحد ما يُضاف تدفق تحقق فعلي.';
