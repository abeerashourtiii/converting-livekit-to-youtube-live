import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { regionsForProvince, allRegions } from "../../data/locations";

// ↔ region/compound autocomplete on the search page (and reused on the
// publish form's location field) — combines the static
// REGIONS_BY_PROVINCE baseline with names other users have actually
// typed and saved via useRememberRegion below.
//
// province === undefined معناها "مفيش محافظة متحددة" — بيحصل لما
// المستخدم يكتب فى خانة "المنطقة" المستقلة من غير ما يختار محافظة
// الأول، فبنجيب الاقتراحات من كل المحافظات مجتمعة بدل واحدة بس.
export function useKnownRegions(province: string | undefined) {
  return useQuery({
    queryKey: ["knownRegions", province ?? "__all__"],
    queryFn: async (): Promise<string[]> => {
      let query = supabase.from("known_regions").select("name");
      query = province ? query.eq("province", province) : query.limit(500);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r: { name: string }) => r.name);
    },
    staleTime: 60_000,
  });
}

export function useRegionSuggestions(province: string | undefined, query: string) {
  const { data: knownRegions = [] } = useKnownRegions(province);
  return useMemo(() => {
    const staticList = province ? regionsForProvince(province) : allRegions();
    const combined = Array.from(new Set([...staticList, ...knownRegions]));
    const q = query.trim();
    if (!q) return combined.slice(0, 8);
    return combined.filter((r) => r.includes(q)).slice(0, 8);
  }, [province, knownRegions, query]);
}

// ↔ "احتفظ باسم المنطقة أو الكمبوند" — called when someone searches (or
// publishes) with a region name that isn't already in the static list or
// known_regions, so it becomes a suggestion for everyone next time. لو
// مفيش محافظة متحددة (خانة "المنطقة" المستقلة)، مينفعش نحفظها هنا —
// عمود province فى الجدول إلزامي — بس ده مش مانع من قبولها للبحث الحالي
// نفسه (شوف fetchPropertiesPage)، بس مش هتترشّح لكل الناس فى المرات
// الجاية غير لو اتكتبت مرة تانية مع محافظة محددة.
export function useRememberRegion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ province, name }: { province: string | undefined; name: string }) => {
      const trimmed = name.trim();
      if (!province || !trimmed) return;
      const alreadyKnown = [...regionsForProvince(province)].includes(trimmed);
      if (alreadyKnown) return;
      const { error } = await supabase.from("known_regions").insert({ province, name: trimmed }).select().maybeSingle();
      // A duplicate (someone else already saved the exact same name) is
      // expected and fine — the unique constraint just no-ops it.
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["knownRegions", variables.province ?? "__all__"] });
    },
  });
}
