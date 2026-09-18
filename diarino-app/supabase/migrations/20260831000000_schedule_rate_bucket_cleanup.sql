-- supabase/migrations/20260831000000_schedule_rate_bucket_cleanup.sql
--
-- آخر بند متبقي من "Server-side Rate Limiting" (راجع docs/deferred-tasks.md
-- و20260826000000_live_message_rate_limit.sql) — جدولة cleanup_old_rate_buckets()
-- تلقائيًا بدل ما تفضل دالة موجودة ومحدش بيشغّلها.

-- ↔ على مشاريع Supabase المُستضافة، pg_cron متاحة كإضافة عادية (مش محتاجة
-- إعادة تشغيل السيرفر أو تعديل shared_preload_libraries زي Postgres عادي —
-- دي بالفعل جزء من صورة Supabase الافتراضية). لو التفعيل عبر السطر ده فشل
-- لأي سبب (صلاحيات نادرة على بعض الخطط)، البديل: Supabase Dashboard →
-- Database → Extensions → فعّل "pg_cron" يدويًا، وبعدين شغّل باقي الملف ده
-- بس (ابتداءً من cron.schedule تحت) من SQL Editor.
create extension if not exists pg_cron with schema extensions;

-- ↔ الجدول (20260826000000) عنده primary key بترتيب
-- (user_id, room_name, message_type, bucket_second) — يعني bucket_second
-- لوحدها مش أول عمود في أي index موجود، فأي DELETE فلترته بس على
-- bucket_second كانت هتعمل sequential scan على الجدول كله كل ساعة. index
-- منفصل هنا يخلي التنظيف الدوري سريع ومحدود بعدد الصفوف القديمة فعليًا،
-- مش بعدد صفوف الجدول كله.
create index if not exists idx_live_message_rate_buckets_bucket_second
  on public.live_message_rate_buckets (bucket_second);

-- ↔ ليه ده آمن على الصفوف النشطة تحديدًا:
-- rate limiting بيقرأ/يكتب بس على bucket الثانية الحالية (v_bucket في
-- bump_live_message_rate)، والتنظيف بيمسح بس اللي أقدم من ساعة كاملة
-- (WHERE bucket_second < now - 3600 في تعريف الدالة الأصلي) — يعني
-- مفيش أي تداخل ممكن يحصل بين الصفوف اللي التنظيف بيمسحها والصفوف اللي
-- فحص الـ rate limit شغال عليها في نفس اللحظة، حتى تحت أعلى حمل. الـ
-- DELETE بياخد row-level locks بس على الصفوف القديمة اللي بيمسحها فعليًا
-- (سلوك MVCC عادي في Postgres)، ومستحيل يتعارض مع UPSERT شغال على صف
-- الثانية الحالية لأنه صف مختلف تمامًا.
select cron.schedule(
  'cleanup-rate-buckets',
  '0 * * * *', -- كل ساعة عند الدقيقة 0
  $$select public.cleanup_old_rate_buckets()$$
);

-- ↔ ملاحظة idempotency: cron.schedule() بتحدّث الـ job الموجود لو نفس
-- الاسم ('cleanup-rate-buckets') موجود بالفعل بدل ما تعمل نسخة تانية —
-- فتشغيل الملف ده أكتر من مرة (مثلًا على بيئات مختلفة) آمن ومايكررش الـ job.
