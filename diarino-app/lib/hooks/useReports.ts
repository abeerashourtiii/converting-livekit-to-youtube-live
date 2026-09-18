import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ powers the report button on property details / live viewer / live
// replay screens, plus the quick long-press report on reel/live/request
// cards in the feed, writing into the real public.reports table that's
// existed since 20260802000000_notifications_backend.sql. 'request'
// added in 20260815000000_support_center.sql alongside the admin support
// center that groups all of these under "الدعم".
export type ReportTargetType = "property" | "live" | "request";

export function useSubmitReport() {
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async (input: { targetType: ReportTargetType; targetId: string; targetTitle: string; reason: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("reports").insert({
        target_type: input.targetType,
        target_id: input.targetId,
        target_title: input.targetTitle,
        target_color: "#6b7280",
        reason: input.reason,
        reporter_id: user.id,
      });
      if (error) throw error;
    },
  });
}

// ↔ powers the "المقترحات" box in settings → "الشكاوى والمقترحات".
export function useSubmitSuggestion() {
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("suggestions").insert({ user_id: user.id, text });
      if (error) throw error;
    },
  });
}

// ---------------------------------------------------------------------
// Admin support center ("الدعم") — suggestions tab. Reports/ad-contacts/
// support-messages admin reads live in useAdminDB.ts and useAdContacts.ts/
// useSupportMessages.ts (each mirrors its own already-real hook); this is
// the one real table (20260805000000_suggestions.sql) that never had an
// admin-facing read until now.
// ---------------------------------------------------------------------
export type AdminSuggestion = { id: string; text: string; userName: string; date: string };

type SuggestionRow = {
  id: string; text: string; created_at: string;
  profiles: { full_name: string | null } | null;
};

export function useAdminSuggestions() {
  return useQuery({
    queryKey: ["adminSuggestions"],
    queryFn: async (): Promise<AdminSuggestion[]> => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("id, text, created_at, profiles!suggestions_user_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown as SuggestionRow[]) ?? []).map((s) => ({
        id: s.id,
        text: s.text,
        userName: s.profiles?.full_name || "مستخدم ديارينو",
        date: s.created_at.slice(0, 10),
      }));
    },
    staleTime: 15_000,
  });
}

export function useDismissSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminSuggestions"] }),
  });
}
