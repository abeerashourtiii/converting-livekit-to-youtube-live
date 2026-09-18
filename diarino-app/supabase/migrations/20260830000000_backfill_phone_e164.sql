-- supabase/migrations/20260830000000_backfill_phone_e164.sql
--
-- الميزة الدولية لإدخال رقم الهاتف — ترحيل بيانات الأرقام الموجودة فعليًا.
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ ⚠️  قبل تشغيل هذا الملف على بيئة الإنتاج: خد نسخة احتياطية أولًا      │
-- └─────────────────────────────────────────────────────────────────────┘
-- عبر Supabase CLI:
--   supabase db dump --db-url "<production-connection-string>" -f backup_before_phone_migration.sql
-- أو من Supabase Dashboard: Database → Backups → Create a new backup،
-- أو على الأقل نسخة من الجدول نفسه قبل التشغيل:
--   create table public.profiles_backup_pre_phone_migration as table public.profiles;
-- (السطر ده أسرع وأبسط لو مش عايز تعمل dump كامل لقاعدة البيانات، ومربوط
-- بخطة الـ rollback تحت مباشرة.)
--
-- ما بيعمله الملف:
-- لكل صف في profiles فيه phone بصيغة مصرية محلية صحيحة (^01[0125]\d{8}$،
-- بعد إزالة أي مسافات/شرطات — نفس regex isValidEgyptPhone القديمة بالظبط)،
-- بيحوّله لصيغة E.164 (+20 بدل الـ 0 الأولى) ويملى phone_country_code
-- وphone_country_name المقابلين. عمود phone الأصلي **مايتلمسش خالص** —
-- يفضل زي ما هو للأرشيف/rollback، مفيش أي بيانات بتتفقد أو تتمسح.
--
-- أرقام مايتحولوش (وليه):
--   • phone فاضي أو NULL أصلًا           → phone_e164 يفضل NULL، طبيعي.
--   • phone مش بصيغة مصرية صحيحة          → phone_e164 يفضل NULL، والرقم
--     الأصلي فاضل في العمود القديم `phone` بدون أي تغيير — البائع هيتطلب
--     منه يدخل رقمه تاني بس لما يعدّل أي إعلان (create-listing.tsx الجديد).
--   • الرقم المحوَّل هيتصادم مع unique constraint (رقمين مختلفين طلعوا
--     بنفس القيمة بعد التحويل — نادر لكن ممكن يحصل مع بيانات تجريبية/وهمية
--     مكررة) → بس أول صف (الأقدم created_at) هو اللي بيتحول، الباقي يفضل
--     NULL بدل ما الـ migration كله يفشل. عدد الصفوف دي بيتسجل في NOTICE
--     تقدر تشوفه في لوج التشغيل.

do $$
declare
  migrated_count integer;
  skipped_duplicate_count integer;
begin
  -- ↔ ترتيب بالـ created_at (الأقدم أولًا) عشان لو فيه تكرار، أقدم حساب
  -- حقيقي هو اللي ياخد الرقم، مش أي صف عشوائي.
  with candidates as (
    select
      id,
      '+20' || substring(regexp_replace(phone, '[\s-]', '', 'g') from 2) as candidate_e164,
      row_number() over (
        partition by '+20' || substring(regexp_replace(phone, '[\s-]', '', 'g') from 2)
        order by created_at asc
      ) as rn
    from public.profiles
    where phone is not null
      and regexp_replace(phone, '[\s-]', '', 'g') ~ '^01[0125]\d{8}$'
  )
  update public.profiles p
  set
    phone_e164 = c.candidate_e164,
    phone_country_code = '20',
    phone_country_name = 'مصر'
  from candidates c
  where p.id = c.id and c.rn = 1;

  get diagnostics migrated_count = row_count;

  select count(*) into skipped_duplicate_count
  from (
    select
      '+20' || substring(regexp_replace(phone, '[\s-]', '', 'g') from 2) as candidate_e164,
      row_number() over (
        partition by '+20' || substring(regexp_replace(phone, '[\s-]', '', 'g') from 2)
        order by created_at asc
      ) as rn
    from public.profiles
    where phone is not null
      and regexp_replace(phone, '[\s-]', '', 'g') ~ '^01[0125]\d{8}$'
  ) x
  where x.rn > 1;

  raise notice 'phone backfill: % رقم اتحول لـ E.164 بنجاح، % رقم اتسابوا (تكرار بعد التحويل، بيانات غير صالحة، أو فاضية)',
    migrated_count, skipped_duplicate_count;
end $$;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ خطة الـ Rollback السريع (لو حصلت مشكلة بعد التشغيل)                  │
-- └─────────────────────────────────────────────────────────────────────┘
-- الترحيل ده بالكامل additive-only على أعمدة مضافة حديثًا (مفيش أي عمود
-- قديم اتلمس أو اتمسح)، فالـ rollback بسيط جدًا — أي واحد من دول كافي:
--
-- خيار أ) تصفير الأعمدة الجديدة فقط (الأسرع، يسيب الأعمدة موجودة فاضية):
--   update public.profiles set phone_e164 = null, phone_country_code = null, phone_country_name = null;
--
-- خيار ب) الرجوع الكامل من النسخة الاحتياطية (لو الجدول كله فيه تغييرات
-- تانية مش متوقعة):
--   truncate public.profiles;
--   insert into public.profiles select * from public.profiles_backup_pre_phone_migration;
--   drop table public.profiles_backup_pre_phone_migration;
--
-- خيار ج) حذف الأعمدة الجديدة نهائيًا (لو قرار الرجوع عن الميزة بالكامل):
--   alter table public.profiles
--     drop column if exists phone_e164,
--     drop column if exists phone_country_code,
--     drop column if exists phone_country_name,
--     drop column if exists phone_verified;
