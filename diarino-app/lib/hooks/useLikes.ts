import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ mirrors useFavorites.ts's useFavoriteSet exactly, backed by the real
// `likes` table from 20260802000000_notifications_backend.sql. Replaces
// components/reel/ReelCard.tsx's local `likedByMe`/`likeCount` useState,
// which never persisted anywhere and never touched properties.likes —
// the DB trigger on this table now maintains that count server-side.

async function fetchLikedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("likes").select("property_id").eq("user_id", userId);
  if (error) throw error;
  return new Set(((data ?? []) as { property_id: string }[]).map((r) => r.property_id));
}

export function useLikes() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["likes", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchLikedIds(user!.id),
    enabled: !!user,
    staleTime: 15_000,
  });

  const toggle = useMutation({
    mutationFn: async (propertyId: string) => {
      if (!user) throw new Error("Not signed in");
      const current = query.data ?? new Set<string>();
      if (current.has(propertyId)) {
        const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("property_id", propertyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ user_id: user.id, property_id: propertyId });
        if (error) throw error;
      }
    },
    // Invalidate the properties list too — the trigger changed the row's
    // `likes` count, so the reel feed's like counter needs a refetch.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });

  return {
    likedIds: query.data ?? new Set<string>(),
    toggleLike: (propertyId: string) => toggle.mutate(propertyId),
  };
}
