import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { SavedLive } from "../../data/saved-live-types";
import { Seller } from "../types";
import { useCurrentUser } from "./useCurrentUser";

// ↔ replaces the local-only `savedLives` in-memory store. The recording
// lifecycle itself was already backed by the `lives` table (see
// 20260720000000_add_recording_columns.sql — egress_id, recording_status,
// recording_url, duration_sec, poster_url, published_public, pinned,
// pinned_at, comments_hidden, viewer_peak all live there already); this
// hook just reads/writes those columns instead of a client-only array, so
// pin/publish/comments-toggle/poster now survive app restarts and reinstalls
// like everything else in the app.

const MAX_PINNED = 3; // ↔ the "الحد الأقصى ٣" check in togglePinLive()

type LiveRow = {
  id: string;
  room_name: string;
  title: string | null;
  created_at: string;
  duration_sec: number | null;
  poster_url: string | null;
  published_public: boolean;
  pinned: boolean;
  pinned_at: string | null;
  comments_hidden: boolean;
  viewer_peak: number;
  egress_id: string | null;
  recording_status: SavedLive["recordingStatus"];
  recording_url: string | null;
  youtube_video_id: string | null;
};

type PublicLiveRow = LiveRow & {
  host_id: string;
  profiles_public: { full_name: string | null } | null;
};

type LiveUpdatePayload = {
  poster_url?: string | null;
  published_public?: boolean;
  comments_hidden?: boolean;
  pinned?: boolean;
  pinned_at?: string | null;
  viewer_peak?: number;
  recording_status?: SavedLive["recordingStatus"];
  recording_url?: string | null;
  duration_sec?: number;
  title?: string;
};

function rowToSavedLive(row: LiveRow, seller: Seller): SavedLive {
  return {
    id: row.id,
    roomName: row.room_name,
    title: row.title || "",
    seller,
    createdAt: new Date(row.created_at).getTime(),
    durationSec: row.duration_sec ?? 0,
    posterUrl: row.poster_url,
    publishedPublic: row.published_public,
    commentsHidden: row.comments_hidden,
    pinned: row.pinned,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined,
    viewerPeak: row.viewer_peak,
    egressId: row.egress_id ?? undefined,
    recordingStatus: row.recording_status,
    recordingUrl: row.recording_url,
    youtubeVideoId: row.youtube_video_id,
  };
}

async function fetchSavedLives(hostId: string, seller: Seller): Promise<SavedLive[]> {
  // "ended" only — a still-live room isn't a "saved live" yet, it's the
  // active broadcast (handled by app/live/broadcast.tsx while status='live').
  const { data, error } = await supabase
    .from("lives")
    .select("id, room_name, title, created_at, duration_sec, poster_url, published_public, pinned, pinned_at, comments_hidden, viewer_peak, egress_id, recording_status, recording_url, youtube_video_id")
    .eq("host_id", hostId)
    .eq("status", "ended")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as LiveRow[]).map((r) => rowToSavedLive(r, seller));
}

// ↔ powers the "بثوث مباشرة" section on the seller's PUBLIC profile page
// (app/seller/[id].tsx) — the actual consumer of publishedPublic that was
// missing until now: useMyContent() above only ever showed a seller their
// own saved lives (account tab), nothing displayed the ones they'd marked
// public anywhere a visitor could see them.
export function usePublicLivesForSeller(sellerId: string | undefined) {
  return useQuery({
    queryKey: ["publicLives", sellerId],
    queryFn: async (): Promise<SavedLive[]> => {
      if (!sellerId) return [];
      const { data, error } = await supabase
        .from("lives")
        .select("id, room_name, title, created_at, duration_sec, poster_url, published_public, pinned, pinned_at, comments_hidden, viewer_peak, egress_id, recording_status, recording_url, youtube_video_id, host_id, profiles_public!host_id(full_name)")
        .eq("host_id", sellerId)
        .eq("status", "ended")
        .eq("published_public", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as PublicLiveRow[]).map((r) => {
        const name = r.profiles_public?.full_name || "مستخدم ديارينو";
        return rowToSavedLive(r, {
          id: r.host_id, name, initial: name.charAt(0),
          verified: false, listings: 0, followers: 0, bio: "", phone: "",
        });
      });
    },
    enabled: !!sellerId,
    staleTime: 15_000,
  });
}

// ↔ powers app/live/replay/[id].tsx. useMyContent()'s savedLives is scoped
// to the CURRENT user's own lives (host_id = auth.uid()) — fine for the
// account tab, but the replay screen is also reachable from a seller's
// PUBLIC profile page (usePublicLivesForSeller above) where the viewer
// isn't the host, so looking it up in "my" saved lives would always come
// up empty for them. RLS on `lives` already allows any signed-in user to
// read any row, so this fetches directly by id instead.
export function useLiveReplayById(id: string | undefined) {
  return useQuery({
    queryKey: ["liveReplay", id],
    queryFn: async (): Promise<SavedLive> => {
      if (!id) throw new Error("Live ID is required");
      const { data, error } = await supabase
        .from("lives")
        .select("id, room_name, title, created_at, duration_sec, poster_url, published_public, pinned, pinned_at, comments_hidden, viewer_peak, egress_id, recording_status, recording_url, youtube_video_id, host_id, profiles_public!host_id(full_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const row = data as PublicLiveRow;
      const name = row.profiles_public?.full_name || "مستخدم ديارينو";
      return rowToSavedLive(row, {
        id: row.host_id, name, initial: name.charAt(0),
        verified: false, listings: 0, followers: 0, bio: "", phone: "",
      });
    },
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useMyContent() {
  const { user, displayName } = useCurrentUser();
  const qc = useQueryClient();

  const seller: Seller = useMemo(
    () => ({
      id: user?.id ?? "",
      name: displayName,
      initial: (displayName || "د").charAt(0),
      verified: false,
      listings: 0,
      followers: 0,
      bio: "",
      phone: "",
    }),
    [user?.id, displayName]
  );

  const query = useQuery({
    queryKey: ["savedLives", user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      return fetchSavedLives(user.id, seller);
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["savedLives", user?.id] });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: LiveUpdatePayload }) => {
      const { error } = await supabase.from("lives").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const savedLives = query.data ?? [];

  function updateSavedLive(id: string, patch: Partial<SavedLive>) {
    const row: LiveUpdatePayload = {};
    if (patch.posterUrl !== undefined) row.poster_url = patch.posterUrl;
    if (patch.publishedPublic !== undefined) row.published_public = patch.publishedPublic;
    if (patch.commentsHidden !== undefined) row.comments_hidden = patch.commentsHidden;
    if (patch.pinned !== undefined) row.pinned = patch.pinned;
    if (patch.pinnedAt !== undefined) row.pinned_at = patch.pinnedAt ? new Date(patch.pinnedAt).toISOString() : null;
    if (patch.viewerPeak !== undefined) row.viewer_peak = patch.viewerPeak;
    if (patch.recordingStatus !== undefined) row.recording_status = patch.recordingStatus;
    if (patch.recordingUrl !== undefined) row.recording_url = patch.recordingUrl;
    if (patch.durationSec !== undefined) row.duration_sec = patch.durationSec;
    if (patch.title !== undefined) row.title = patch.title;
    patchMutation.mutate({ id, patch: row });
  }

  function removeSavedLive(id: string) {
    deleteMutation.mutate(id);
  }

  // ↔ togglePinLive()
  function togglePinLive(id: string): "pinned" | "unpinned" | "limit" {
    const l = savedLives.find((x) => x.id === id);
    if (!l) return "unpinned";
    if (l.pinned) {
      updateSavedLive(id, { pinned: false });
      return "unpinned";
    }
    if (savedLives.filter((x) => x.pinned).length >= MAX_PINNED) return "limit";
    updateSavedLive(id, { pinned: true, pinnedAt: Date.now() });
    return "pinned";
  }

  // ↔ publishSavedLive()/unpublishSavedLive()
  function toggleSavedLivePublic(id: string) {
    const l = savedLives.find((x) => x.id === id);
    if (!l) return;
    updateSavedLive(id, { publishedPublic: !l.publishedPublic });
  }

  // ↔ _applyToggleSavedLiveComments()
  function toggleSavedLiveComments(id: string) {
    const l = savedLives.find((x) => x.id === id);
    if (!l) return;
    updateSavedLive(id, { commentsHidden: !l.commentsHidden });
  }

  return {
    savedLives,
    isLoading: query.isLoading,
    error: query.error,
    updateSavedLive,
    removeSavedLive,
    togglePinLive,
    toggleSavedLivePublic,
    toggleSavedLiveComments,
  };
}

// ↔ endBroadcast()'s savedEntry push — the `lives` row for this room was
// already created by createLiveRoom() at broadcast start and already has
// duration_sec/recording_status set server-side by stopRecording() /
// the livekit-webhook. All that's left client-side once the stream ends is
// the viewer count reached during the broadcast (only known client-side,
// LiveKit doesn't report this back through Egress/webhook).
export function useFinalizeSavedLive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomName, viewerPeak }: { roomName: string; viewerPeak: number }) => {
      const { error } = await supabase.from("lives").update({ viewer_peak: viewerPeak }).eq("room_name", roomName);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savedLives"] }),
  });
}