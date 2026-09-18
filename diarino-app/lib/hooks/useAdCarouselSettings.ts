import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";

export type AdCarouselSettings = { rotationMode: "auto" | "manual"; durationMs: number };

const DEFAULTS: AdCarouselSettings = { rotationMode: "auto", durationMs: 4000 };

// ↔ admin control over whether the "مساحة إعلانية" carousel advances on
// its own, or only when the person swipes it themselves — and if
// automatic, how long each banner stays up before advancing.
export function useAdCarouselSettings() {
  return useQuery({
    queryKey: ["adCarouselSettings"],
    queryFn: async (): Promise<AdCarouselSettings> => {
      const { data, error } = await supabase
        .from("ad_carousel_settings")
        .select("rotation_mode, duration_ms")
        .eq("id", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULTS;

      return {
        rotationMode: (data.rotation_mode as "auto" | "manual") ?? "auto",
        durationMs: data.duration_ms,
      };
    },
    staleTime: 30_000,
  });
}

export function useUpdateAdCarouselSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AdCarouselSettings>) => {
      const row: { rotation_mode?: string; duration_ms?: number } = {};
      if (patch.rotationMode !== undefined) row.rotation_mode = patch.rotationMode;
      if (patch.durationMs !== undefined) row.duration_ms = patch.durationMs;

      const { error } = await supabase
        .from("ad_carousel_settings")
        .update(row)
        .eq("id", true);

      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adCarouselSettings"] }),
  });
}