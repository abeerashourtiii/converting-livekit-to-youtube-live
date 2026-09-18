import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";
import { AdBanner } from "./useAdBanners";

// ↔ powers the "الاعلانات" tab of the admin support center — logs every
// tap on the "مساحة إعلانية" carousel (components/menu/AdBannerCarousel.tsx),
// whether it opens an external link or a WhatsApp chat, into the real
// public.ad_contacts table from 20260815000000_support_center.sql.

export function useLogAdContact() {
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async (banner: AdBanner) => {
      if (!user) return; // guests browsing without an account: nothing to attribute the tap to
      const { error } = await supabase
        .from("ad_contacts")
        .insert({ banner_id: banner.id, banner_title: banner.title, user_id: user.id });
      if (error) throw error;
    },
  });
}

export type AdminAdContact = { id: string; bannerTitle: string; userName: string; date: string };

type AdContactRow = {
  id: string; banner_title: string; created_at: string;
  profiles: { full_name: string | null } | null;
};

export function useAdminAdContacts() {
  return useQuery({
    queryKey: ["adminAdContacts"],
    queryFn: async (): Promise<AdminAdContact[]> => {
      const { data, error } = await supabase
        .from("ad_contacts")
        .select("id, banner_title, created_at, profiles!ad_contacts_profile_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown as AdContactRow[]) ?? []).map((c) => ({
        id: c.id,
        bannerTitle: c.banner_title,
        userName: c.profiles?.full_name || "مستخدم ديارينو",
        date: c.created_at.slice(0, 10),
      }));
    },
    staleTime: 15_000,
  });
}

export function useDismissAdContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminAdContacts"] }),
  });
}
