import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ "نبّهني" — powers public.saved_search_alerts
// (20260820000000_smart_alerts.sql). Reading a person's own SearchFilters
// (components/search/SearchFilterModal.tsx) state into one of these is
// done by the caller (app/(tabs)/search.tsx); this hook just persists it.

export type SavedSearchAlert = {
  id: string;
  province: string | null;
  type: string | null;
  priceMax: number | null;
  finishType: string | null;
  active: boolean;
  createdAt: string;
};

type AlertRow = {
  id: string; province: string | null; type: string | null; price_max: number | null;
  finish_type: string | null; active: boolean; created_at: string;
};

function rowToAlert(r: AlertRow): SavedSearchAlert {
  return { id: r.id, province: r.province, type: r.type, priceMax: r.price_max, finishType: r.finish_type, active: r.active, createdAt: r.created_at };
}

export function useSavedSearchAlerts() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["savedSearchAlerts", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SavedSearchAlert[]> => {
      const { data, error } = await supabase.from("saved_search_alerts")
        .select("id, province, type, price_max, finish_type, active, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as AlertRow[]).map(rowToAlert);
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  const create = useMutation({
    mutationFn: async (params: { province?: string | null; type?: string | null; priceMax?: number | null; finishType?: string | null }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("saved_search_alerts").insert({
        user_id: user.id,
        province: params.province || null,
        type: params.type && params.type !== "all" ? params.type : null,
        price_max: params.priceMax && Number.isFinite(params.priceMax) ? params.priceMax : null,
        finish_type: params.finishType || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("saved_search_alerts").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_search_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    createAlert: create.mutateAsync,
    isCreating: create.isPending,
    toggleActive: (id: string, active: boolean) => toggleActive.mutate({ id, active }),
    removeAlert: (id: string) => remove.mutate(id),
  };
}
