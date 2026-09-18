-- supabase/migrations/20260905000000_profile_extended_fields.sql
-- ↔ بند 4 (قسم البروفايل فى الإعدادات / صفحة إدارة الحساب): profiles
-- كان فيها full_name بس — الحقول دي مطلوبة لشاشة "تعديل بيانات الحساب"
-- الجديدة (app/edit-profile.tsx) اللي بتفتح من شاشة الإعدادات وصفحة
-- إدارة الحساب. لا حاجة لـ RLS جديدة: سياسة "users can update their own
-- profile" (20260722000002_create_profiles_table.sql) already covers
-- update على أي عمود فى الصف بتاع اليوزر نفسه.

alter table public.profiles
  add column if not exists username text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_date date,
  add column if not exists gender text check (gender in ('male', 'female')),
  add column if not exists nationality text,
  add column if not exists residence text;

-- اسم المستخدم فريد لو اتملى (يسمح بأكتر من صف NULL فى نفس الوقت،
-- الفهرس الجزئي هنا بيتجاهل NULL تلقائيًا).
create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;
