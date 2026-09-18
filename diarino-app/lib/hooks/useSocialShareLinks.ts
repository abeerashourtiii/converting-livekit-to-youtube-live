import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";

// ↔ the four "من هنا" destination links in the "وسّع انتشار إعلانك"
// section of app/publish/create-listing.tsx — Diarino's own YouTube/
// Facebook/TikTok/Instagram accounts, publicly readable so the publish
// screen can open them, editable only from
// components/admin/AdminFeatures.tsx once the real links are supplied
// (20260816000000_social_share.sql seeds them empty).
export type SocialPlatform = "youtube" | "facebook" | "tiktok" | "instagram";
export type SocialShareLinks = Record<SocialPlatform, string>;

const EMPTY_LINKS: SocialShareLinks = { youtube: "", facebook: "", tiktok: "", instagram: "" };

export function useSocialShareLinks() {
  return useQuery({
    queryKey: ["socialShareLinks"],
    queryFn: async (): Promise<SocialShareLinks> => {
      const { data, error } = await supabase.from("social_share_links").select("platform, url");
      if (error) throw error;
      const links = { ...EMPTY_LINKS };
      for (const row of data ?? []) links[row.platform as SocialPlatform] = row.url;
      return links;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSocialShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ platform, url }: { platform: SocialPlatform; url: string }) => {
      const { error } = await supabase
        .from("social_share_links")
        .update({ url: url.trim(), updated_at: new Date().toISOString() })
        .eq("platform", platform);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socialShareLinks"] }),
  });
}
