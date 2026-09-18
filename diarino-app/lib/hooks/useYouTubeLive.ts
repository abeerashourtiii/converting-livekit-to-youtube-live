import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { sendLiveMessage, blockLiveViewer as blockLiveViewerApi, unblockLiveViewer as unblockLiveViewerApi } from "../youtube";
import { LiveComment } from "../../components/live/LiveCommentsOverlay";

// ↔ replaces useLiveByRoomName from the LiveKit-era hooks file — same
// shape, plus the YouTube video id every screen now needs to embed the
// player.
type LiveByRoomName = {
  id: string;
  hostId: string;
  title: string | null;
  hostName: string | null;
  youtubeVideoId: string | null;
  status: string;
};

export function useLiveByRoomName(roomName: string) {
  return useQuery({
    queryKey: ["liveByRoomName", roomName],
    queryFn: async (): Promise<LiveByRoomName> => {
      const { data, error } = await supabase
        .from("lives")
        .select("id, host_id, title, status, youtube_video_id, profiles_public!host_id(full_name)")
        .eq("room_name", roomName)
        .single();
      if (error) throw error;
      const row = data as unknown as {
        id: string;
        host_id: string;
        title: string | null;
        status: string;
        youtube_video_id: string | null;
        profiles_public: { full_name: string | null } | null;
      };
      return {
        id: row.id,
        hostId: row.host_id,
        title: row.title,
        status: row.status,
        youtubeVideoId: row.youtube_video_id,
        hostName: row.profiles_public?.full_name ?? null,
      };
    },
    enabled: !!roomName,
    staleTime: 10_000,
  });
}

// ============================================================
// Chat (comments + likes)
// ============================================================
// ↔ replaces useLiveComments + useLiveLikes. Delivery moves from a
// LiveKit data channel to Supabase Realtime `postgres_changes` on the
// `live_messages` table (see the YouTube migration) — same client-side
// UX (instant local echo + a small rolling rate cap to save a round
// trip for the common "mashing send" case), but the real enforcement is
// now a database trigger rather than an Edge Function relay.
const COMMENTS_PER_SECOND = 3;
const LIKES_PER_SECOND = 5;
const INITIAL_COMMENTS_LIMIT = 30;

export function useLiveChat(roomName: string, currentUserId: string | undefined, displayName: string) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [burstId, setBurstId] = useState(0);
  const commentSendTimestamps = useRef<number[]>([]);
  const likeSendTimestamps = useRef<number[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!roomName) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("live_messages")
        .select("id, sender_id, sender_name, message_type, text, created_at")
        .eq("room_name", roomName)
        .eq("message_type", "comment")
        .order("created_at", { ascending: false })
        .limit(INITIAL_COMMENTS_LIMIT);
      if (cancelled || !data) return;
      const initial = [...data].reverse().map((row) => {
        seenIds.current.add(String(row.id));
        return { id: String(row.id), name: row.sender_name, text: row.text ?? "" };
      });
      setComments(initial);
    })();

    const channel = supabase
      .channel(`live_messages:${roomName}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_messages", filter: `room_name=eq.${roomName}` },
        (payload) => {
          const row = payload.new as {
            id: number;
            sender_id: string;
            sender_name: string;
            message_type: "comment" | "like";
            text: string | null;
          };
          const rowId = String(row.id);
          if (seenIds.current.has(rowId)) return; // already shown via local echo
          seenIds.current.add(rowId);

          if (row.message_type === "like") {
            setBurstId((n) => n + 1);
          } else {
            setComments((prev) => [...prev, { id: rowId, name: row.sender_name, text: row.text ?? "" }]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomName]);

  const sendComment = useCallback(
    (text: string) => {
      if (!roomName || !currentUserId || !text.trim()) return;
      const now = Date.now();
      commentSendTimestamps.current = commentSendTimestamps.current.filter((t) => now - t < 1000);
      if (commentSendTimestamps.current.length >= COMMENTS_PER_SECOND) return;
      commentSendTimestamps.current.push(now);

      const localId = `${now}-local`;
      seenIds.current.add(localId);
      setComments((prev) => [...prev, { id: localId, name: displayName, text }]);
      sendLiveMessage(roomName, currentUserId, displayName, "comment", text).catch((err) =>
        console.warn("Failed to send live comment:", err)
      );
    },
    [roomName, currentUserId, displayName]
  );

  const sendLike = useCallback(() => {
    if (!roomName || !currentUserId) return;
    const now = Date.now();
    likeSendTimestamps.current = likeSendTimestamps.current.filter((t) => now - t < 1000);
    if (likeSendTimestamps.current.length >= LIKES_PER_SECOND) return;
    likeSendTimestamps.current.push(now);

    setBurstId((n) => n + 1);
    sendLiveMessage(roomName, currentUserId, displayName, "like").catch((err) =>
      console.warn("Failed to send live like:", err)
    );
  }, [roomName, currentUserId, displayName]);

  return { comments, burstId, sendComment, sendLike };
}

// ============================================================
// Viewer presence — replaces LiveKit's useParticipants()
// ============================================================
// YouTube's API exposes no per-viewer list for an embedded player
// (only an approximate, delayed `concurrentViewers` count via
// videos.list — not real identities). Supabase Realtime Presence fills
// that gap directly: every open live screen tracks itself on a shared
// channel, giving a live, per-identity viewer list — arguably a better
// fit here than LiveKit's participants ever was, since it also works
// for the *host's* own viewer list UI without needing WebRTC at all.
export type LiveViewer = { id: string; name: string };

export function useLiveViewerPresence(roomName: string, selfId: string | undefined, selfName: string, isHost: boolean) {
  const [viewers, setViewers] = useState<LiveViewer[]>([]);
  const [amIBlocked, setAmIBlocked] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomName || !selfId) return;

    const channel = supabase.channel(`live_presence:${roomName}`, {
      config: { presence: { key: selfId } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" } as never, () => {
      const state = channel.presenceState() as Record<string, Array<{ name?: string }>>;
      const list: LiveViewer[] = Object.entries(state).map(([id, metas]) => ({
        id,
        name: metas[0]?.name || "زائر",
      }));
      setViewers(list);
    });

    // ↔ the host-initiated "you've been blocked from chat" push — see
    // lib/youtube.ts blockLiveViewer(). This is a best-effort *instant*
    // notice on top of the real, persistent server-side enforcement
    // (the live_messages_enforce_rules trigger) — a viewer who isn't
    // subscribed at the moment they're blocked simply finds out the
    // next time they try to send a message instead.
    channel.on("broadcast", { event: "blocked" }, (payload) => {
      if ((payload.payload as { userId?: string })?.userId === selfId) setAmIBlocked(true);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && !isHost) {
        await channel.track({ name: selfName });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomName, selfId, selfName, isHost]);

  const blockViewer = useCallback(
    async (userId: string) => {
      await blockLiveViewerApi(roomName, userId);
      channelRef.current?.send({ type: "broadcast", event: "blocked", payload: { userId } });
    },
    [roomName]
  );

  const unblockViewer = useCallback(
    async (userId: string) => {
      await unblockLiveViewerApi(roomName, userId);
    },
    [roomName]
  );

  return { viewers, amIBlocked, blockViewer, unblockViewer };
}
