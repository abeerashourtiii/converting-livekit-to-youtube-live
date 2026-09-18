import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";

export type AdBanner = {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  whatsappMessage: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  sortOrder: number;
};

type BannerRow = {
  id: string; title: string; image_url: string | null; link_url: string | null; whatsapp_message: string | null;
  start_date: string; end_date: string | null; active: boolean; sort_order: number;
};

function rowToBanner(r: BannerRow): AdBanner {
  return {
    id: r.id, title: r.title, imageUrl: r.image_url, linkUrl: r.link_url, whatsappMessage: r.whatsapp_message,
    startDate: r.start_date, endDate: r.end_date, active: r.active, sortOrder: r.sort_order,
  };
}

// ↔ the menu page's rotating carousel — only banners that are active AND
// within their run dates (a duration set by the admin, per the request).
export function useActiveAdBanners() {
  return useQuery({
    queryKey: ["adBanners", "active"],
    queryFn: async (): Promise<AdBanner[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("ad_banners")
        .select("id, title, image_url, link_url, whatsapp_message, start_date, end_date, active, sort_order, created_at")
        .eq("active", true)
        .lte("start_date", today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as BannerRow[]).map(rowToBanner);
    },
    staleTime: 60_000,
  });
}

// ↔ the admin ad-space management tab — every banner, active or not,
// expired or not, so the admin can see/manage everything they've created.
export function useAllAdBanners() {
  return useQuery({
    queryKey: ["adBanners", "all"],
    queryFn: async (): Promise<AdBanner[]> => {
      const { data, error } = await supabase.from("ad_banners")
        .select("id, title, image_url, link_url, whatsapp_message, start_date, end_date, active, sort_order, created_at")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as BannerRow[]).map(rowToBanner);
    },
    staleTime: 15_000,
  });
}

export function useAdBannerMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["adBanners"] });

  const create = useMutation({
    mutationFn: async (input: { title: string; imageUrl?: string; linkUrl?: string; whatsappMessage?: string; startDate: string; endDate?: string; sortOrder?: number }) => {
      const { error } = await supabase.from("ad_banners").insert({
        title: input.title, image_url: input.imageUrl ?? null, link_url: input.linkUrl ?? null,
        whatsapp_message: input.whatsappMessage ?? null, start_date: input.startDate, end_date: input.endDate ?? null,
        sort_order: input.sortOrder ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("ad_banners").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, toggleActive, remove };
}
