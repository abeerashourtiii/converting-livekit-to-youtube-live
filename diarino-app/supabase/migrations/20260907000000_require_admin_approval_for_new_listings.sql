-- supabase/migrations/20260907000000_require_admin_approval_for_new_listings.sql
--
-- الطلب: "تأكد ان الادمن لابد ان يقوم بالموافقة على الاعلان قبل نشره" —
-- آلية إخفاء الإعلانات غير المعتمدة عن الجميع ما عدا صاحبها والأدمن
-- كانت مُفعَّلة فعليًا (20260822000000_rls_audit_fixes.sql، سياسة
-- "approved properties are public, own listings always visible")، لكن
-- properties.moderation_status كان افتراضيًا 'approved' منذ إنشاء العمود
-- (20260801000000_admin_backend.sql) — يعني كل إعلان جديد كان بيتعتمد
-- تلقائيًا لحظة النشر، فآلية الإخفاء ماكانتش بتتفعّل خالص فى الواقع.
-- التغيير هنا بسيط ومحصور: العمود نفسه، القيد، وباقي المنظومة (RLS،
-- شاشة الأدمن، useAdminDB) كلها زي ما هي من غير أي تعديل تاني.

alter table public.properties
  alter column moderation_status set default 'pending';

comment on column public.properties.moderation_status is
  'pending افتراضيًا لأي إعلان جديد — لازم الأدمن يوافق (شاشة إدارة الإعلانات) قبل ما يظهر لغير صاحبه؛ الإخفاء نفسه مُنفَّذ فى سياسة RLS "approved properties are public, own listings always visible" (20260822000000_rls_audit_fixes.sql).';
