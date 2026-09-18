import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ powers the "التواصل مع الدعم" tab of the admin support center — logs
// every tap on settings → "تواصل معنا" into the real public.support_messages
// table from 20260815000000_support_center.sql, right before WhatsApp opens.

export function useLogSupportContact() {
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("support_messages").insert({ user_id: user.id });
      if (error) throw error;
    },
  });
}

export type AdminSupportContact = { id: string; userName: string; date: string };

type SupportMessageRow = { id: string; created_at: string; profiles: { full_name: string | null } | null };

export function useAdminSupportContacts() {
  return useQuery({
    queryKey: ["adminSupportContacts"],
    queryFn: async (): Promise<AdminSupportContact[]> => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id, created_at, profiles!support_messages_profile_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown as SupportMessageRow[]) ?? []).map((c) => ({
        id: c.id,
        userName: c.profiles?.full_name || "مستخدم ديارينو",
        date: c.created_at.slice(0, 10),
      }));
    },
    staleTime: 15_000,
  });
}

export function useDismissSupportContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminSupportContacts"] }),
  });
}
