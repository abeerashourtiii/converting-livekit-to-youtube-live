import { useMutation } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { CloudinaryUploadResult } from "../cloudinary";

export type MediaContext = "property" | "avatar" | "chat" | "live_poster" | "other";

// ↔ writes one row per Cloudinary upload into public.media
// (20260818000000_cloudinary_media.sql). This is a ledger, not the
// display path — callers still save result.url wherever they always
// have (properties.media, profiles.avatar_url, etc.) regardless of
// whether this succeeds, so a logging hiccup never blocks an upload the
// person is waiting on.
export function useLogMedia() {
  return useMutation({
    mutationFn: async (params: {
      ownerId: string; type: "image" | "video"; context: MediaContext; contextId?: string | null;
      result: CloudinaryUploadResult;
    }) => {
      const { ownerId, type, context, contextId, result } = params;
      const { error } = await supabase.from("media").insert({
        owner_id: ownerId, type, context, context_id: contextId ?? null,
        url: result.url, public_id: result.publicId, thumbnail_url: result.thumbnailUrl,
        width: result.width, height: result.height, duration: result.duration,
        format: result.format, bytes: result.bytes,
      });
      if (error) console.warn("media log failed:", error);
    },
  });
}
