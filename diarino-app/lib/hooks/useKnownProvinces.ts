import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { PROVINCES } from "../../data/locations";

// ↔ #3 (صفحة البحث): يقابل useKnownRegions.ts بالظبط، بس بعتبة 3 محاولات
// بدل الحفظ من أول مرة (شوف الكومنت فى ميجريشن known_provinces). الفيو
// خلفيًا مبيرجّعش إلا الصفوف اللي وصلت 3+ محاولات، فمفيش داعي لفلترة إضافية
// هنا.
export function useKnownProvinces() {
  return useQuery({
    queryKey: ["knownProvinces"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("known_provinces").select("name");
      if (error) throw error;
      return (data ?? []).map((r: { name: string }) => r.name);
    },
    staleTime: 60_000,
  });
}

// ↔ #3 (صفحة البحث - تعديلات لاحقة): كانت بتقارن بس مع الاسم العربي
// الخام (p.includes(query))، فلو المستخدم كاتب بالإنجليزي ("Cairo") وهو
// فى وضع اللغة الإنجليزية، مفيش أي اقتراح كان بيظهر أبدًا. دلوقتي بتقارن
// كمان مع الشكل المُترجَم (نفس اللي بيتعرض فعليًا فى القائمة عبر t(p))،
// فالتعرف على الكتابة بالإنجليزية بقى شغال، من غير ما نلمس سلوك العربي
// الأصلي.
export function useProvinceSuggestions(query: string, t: (s: string) => string) {
  const { data: known = [] } = useKnownProvinces();
  return useMemo(() => {
    const combined = Array.from(new Set([...PROVINCES, ...known]));
    const q = query.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    return combined
      .filter((p) => p.includes(q) || t(p).toLowerCase().includes(qLower))
      .slice(0, 6);
  }, [known, query, t]);
}

// ↔ بتتنادى لما المستخدم يضيف محافظة "مخصصة" (مش فى PROVINCES ولا فى
// الاقتراحات) كفلتر — بتزوّد عداد المحاولات وتحدّث قائمة الاقتراحات لو
// وصلت للعتبة. المحافظات المعروفة أصلًا (PROVINCES) متتسجلش عشان مفيش
// داعي نعدّها.
export function useRecordProvinceSearchAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<number | null> => {
      const trimmed = name.trim();
      if (!trimmed || PROVINCES.includes(trimmed)) return null;
      const { data, error } = await supabase.rpc("record_province_search_attempt", { p_name: trimmed });
      if (error) throw error;
      return (data as number | null) ?? null;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knownProvinces"] }),
  });
}
