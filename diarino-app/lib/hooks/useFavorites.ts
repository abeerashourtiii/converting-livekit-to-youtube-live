import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ state.favoriteProperties / state.favoriteRequests (Sets) in
// app-viewer.html — both now backed by the real `favorites` table, shared
// across devices/sessions instead of resetting on every app relaunch.

type FavoriteRow = {
  property_id?: string | null;
  request_id?: string | null;
};

type FavoriteInsert = {
  user_id: string;
  property_id?: string;
  request_id?: string;
};

async function fetchFavoriteIds(userId: string, column: "property_id" | "request_id"): Promise<Set<string>> {
  const { data, error } = await supabase.from("favorites").select(column).eq("user_id", userId).not(column, "is", null);
  if (error) throw error;
  const rows = (data ?? []) as FavoriteRow[];
  const ids = rows
    .map((r) => r[column])
    .filter((val): val is string => typeof val === "string");
  return new Set(ids);
}

function useFavoriteSet(column: "property_id" | "request_id") {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["favorites", column, user?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFavoriteIds(user!.id, column),
    enabled: !!user,
    staleTime: 15_000,
  });

  const toggle = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user) throw new Error("Not signed in");
      const current = query.data ?? new Set<string>();
      if (current.has(targetId)) {
        const { error } = await supabase.from("favorites").delete().eq("user_id", user.id).eq(column, targetId);
        if (error) throw error;
      } else {
        const payload: FavoriteInsert = { user_id: user.id };
        if (column === "property_id") payload.property_id = targetId;
        if (column === "request_id") payload.request_id = targetId;

        const { error } = await supabase.from("favorites").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { ids: query.data ?? new Set<string>(), toggle: (id: string) => toggle.mutate(id) };
}

export function useFavorites() {
  const properties = useFavoriteSet("property_id");
  const requests = useFavoriteSet("request_id");
  return {
    favoriteProperties: properties.ids,
    favoriteRequests: requests.ids,
    totalCount: properties.ids.size + requests.ids.size,
    toggleFavoriteProperty: properties.toggle,
    toggleFavoriteRequest: requests.toggle,
  };
}