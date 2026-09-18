-- supabase/migrations/20260902000000_known_provinces.sql
--
-- ↔ #3 (صفحة البحث): مقابل known_regions (20260813000000) اللي بتحفظ اسم
-- منطقة/كمبوند جديد من أول مرة، مفيش حاجة مماثلة للمحافظات فى خانة
-- "المحافظة" بمودال الفلتر — لو حد كتب اسم مش فى data/locations.ts
-- PROVINCES مفيش أي طريقة يضيفه أصلًا. الجدول ده بيسجّل كل محاولة بحث
-- بمحافظة مش معروفة (search_count)، ومتاح للكل (SELECT) بس أول ما
-- يوصل 3 محاولات — وده اللي بيحقق "تكرر ذلك أكثر من ٣ مرات ستقوم بحفظها
-- ضمن قائمة الاختيارات" بالظبط، من غير ما نحتاج جدول منفصل للعدّاد.

create table if not exists public.known_provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  search_count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint known_provinces_name_length check (char_length(name) between 1 and 100)
);

alter table public.known_provinces enable row level security;

-- ↔ بيبان بس بعد وصوله لعتبة الـ 3 محاولات — قبل كده مش "خيار" حقيقي
-- لسه، ده اللي بيخلي عرض الاقتراحات نضيف تلقائيًا من غير أي منطق إضافي
-- على الفرونت إند لإخفاء المحاولات القليلة.
create policy "known provinces are readable once promoted (3+ searches)"
  on public.known_provinces for select
  to authenticated
  using (search_count >= 3);

-- كل كتابة بتعدي من الدالة الآمنة تحت بس (SECURITY DEFINER) — من غير
-- INSERT/UPDATE policy مباشرة لأي دور، فمفيش طريقة حد "يزوّر" العداد
-- مباشرة عبر REST.
create or replace function public.record_province_search_attempt(p_name text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := trim(p_name);
  v_count integer;
begin
  if v_name = '' or char_length(v_name) > 100 then
    return null;
  end if;

  insert into public.known_provinces (name, search_count)
  values (v_name, 1)
  on conflict (name) do update set search_count = known_provinces.search_count + 1
  returning search_count into v_count;

  return v_count;
end;
$$;

revoke all on function public.record_province_search_attempt(text) from public;
grant execute on function public.record_province_search_attempt(text) to authenticated;
