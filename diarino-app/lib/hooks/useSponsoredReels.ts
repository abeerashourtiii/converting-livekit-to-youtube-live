import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";

export type SponsoredReel = {
  id: string;
  propertyId: string;
  placement: "intro" | "in_feed";
  reachGoal: number | null;
  currentReach: number;
  ageMin: number | null;
  ageMax: number | null;
  genderTarget: "all" | "male" | "female";
  active: boolean;
  startDate: string;
  endDate: string | null;
};

type Row = {
  id: string; property_id: string; placement: "intro" | "in_feed"; reach_goal: number | null; current_reach: number;
  age_min: number | null; age_max: number | null; gender_target: "all" | "male" | "female";
  active: boolean; start_date: string; end_date: string | null;
};

function rowToSponsored(r: Row): SponsoredReel {
  return {
    id: r.id, propertyId: r.property_id, placement: r.placement, reachGoal: r.reach_goal, currentReach: r.current_reach,
    ageMin: r.age_min, ageMax: r.age_max, genderTarget: r.gender_target, active: r.active,
    startDate: r.start_date, endDate: r.end_date,
  };
}

// ↔ the reels feed's intro reel + periodic featured insertion.
export function useActiveSponsoredReels() {
  return useQuery({
    queryKey: ["sponsoredReels", "active"],
    queryFn: async (): Promise<SponsoredReel[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("sponsored_reels")
        .select("id, property_id, placement, reach_goal, current_reach, age_min, age_max, gender_target, active, start_date, end_date, created_at")
        .eq("active", true)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`);
      if (error) throw error;
      return ((data ?? []) as Row[]).map(rowToSponsored);
    },
    staleTime: 60_000,
  });
}

export function useIncrementSponsoredReach() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("increment_sponsored_reach", { sponsored_id: id });
      if (error) throw error;
    },
  });
}

// ↔ the admin "الريلز المميزة" tab.
export function useAllSponsoredReels() {
  return useQuery({
    queryKey: ["sponsoredReels", "all"],
    queryFn: async (): Promise<SponsoredReel[]> => {
      const { data, error } = await supabase.from("sponsored_reels")
        .select("id, property_id, placement, reach_goal, current_reach, age_min, age_max, gender_target, active, start_date, end_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Row[]).map(rowToSponsored);
    },
    staleTime: 15_000,
  });
}

export function useSponsoredReelMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sponsoredReels"] });

  const create = useMutation({
    mutationFn: async (input: {
      propertyId: string; placement: "intro" | "in_feed"; reachGoal?: number;
      ageMin?: number; ageMax?: number; genderTarget?: "all" | "male" | "female"; endDate?: string;
    }) => {
      const { error } = await supabase.from("sponsored_reels").insert({
        property_id: input.propertyId, placement: input.placement, reach_goal: input.reachGoal ?? null,
        age_min: input.ageMin ?? null, age_max: input.ageMax ?? null,
        gender_target: input.genderTarget ?? "all", end_date: input.endDate ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("sponsored_reels").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sponsored_reels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, toggleActive, remove };
}
