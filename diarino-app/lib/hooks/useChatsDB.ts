import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { ChatMessage } from "../../data/mock-chats";

// ↔ replaces data/mock-chats.ts + lib/hooks/useChats.ts's local
// useSyncExternalStore store. Real persistence + Realtime instead of an
// in-memory array that reset on every app relaunch.

type ProfileRow = { id: string; full_name: string | null };
type ChatRow = {
  id: string; property_id: string | null; request_id: string | null;
  initiator_id: string; partner_id: string; created_at: string;
  initiator: ProfileRow | null; partner: ProfileRow | null;
};
type MessageRow = {
  id: string; chat_id: string; sender_id: string; text: string; images: string[] | null;
  whatsapp: string | null; read: boolean; created_at: string;
};

export type ChatSummary = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerInitial: string;
  propertyId: string | null;
  requestId: string | null;
  lastMessage: string;
  unread: number;
};

async function fetchChatList(userId: string): Promise<ChatSummary[]> {
  const { data: chats, error } = await supabase
    .from("chats")
    .select("*, initiator:profiles!chats_initiator_profile_fkey(id,full_name), partner:profiles!chats_partner_profile_fkey(id,full_name)")
    .or(`initiator_id.eq.${userId},partner_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (chats || []) as unknown as ChatRow[];
  if (rows.length === 0) return [];

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("chat_id, text, sender_id, read, created_at")
    .in("chat_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });

  return rows.map((r) => {
    const isInitiator = r.initiator_id === userId;
    const partnerProfile = isInitiator ? r.partner : r.initiator;
    const chatMessages = (messages || []).filter((m) => m.chat_id === r.id);
    const last = chatMessages[chatMessages.length - 1];
    const unread = chatMessages.filter((m) => !m.read && m.sender_id !== userId).length;
    const partnerName = partnerProfile?.full_name || "مستخدم ديارينو";

    return {
      id: r.id,
      partnerId: isInitiator ? r.partner_id : r.initiator_id,
      partnerName,
      partnerInitial: partnerName.charAt(0),
      propertyId: r.property_id,
      requestId: r.request_id,
      lastMessage: last?.text || "",
      unread,
    };
  });
}

export function useChatList(userId: string | undefined) {
  return useQuery({
    queryKey: ["chats", userId],
    queryFn: () => fetchChatList(userId!),
    enabled: !!userId,
    staleTime: 5_000,
  });
}

// Returns messages tagged from/them relative to the current user, plus a
// live subscription so new messages (sent by either side) show up without
// a manual refetch.
export function useChatMessages(chatId: string | undefined, currentUserId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["chat_messages", chatId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages")
        .select("id, chat_id, sender_id, text, images, whatsapp, read, created_at")
        .eq("chat_id", chatId!).order("created_at", { ascending: true });
      if (error) throw error;
      return (data as MessageRow[]).map((m) => ({
        from: (m.sender_id === currentUserId ? "me" : "them") as "me" | "them",
        text: m.text,
        time: new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
        images: m.images || undefined,
        whatsapp: m.whatsapp || undefined,
      })) as ChatMessage[];
    },
    enabled: !!chatId && !!currentUserId,
  });

  useEffect(() => {
    if (!chatId) return;
    // ↔ same fix as useNotifications.ts: a unique topic per effect run
    // avoids reusing a channel that a previous mount's removeChannel()
    // hasn't finished tearing down yet, which otherwise throws "cannot
    // add postgres_changes callbacks ... after subscribe()" on React's
    // dev/StrictMode double-mount or any fast remount.
    const channelName = `chat:${chatId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat_messages", chatId] });
        qc.invalidateQueries({ queryKey: ["chats", currentUserId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, currentUserId, qc]);

  return query;
}

// ↔ openOrCreateChat() — finds an existing chat for this property (by the
// current user as initiator), or creates one.
export async function openOrCreateChat(currentUserId: string, sellerId: string, propertyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("chats").select("id").eq("initiator_id", currentUserId).eq("property_id", propertyId).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("chats")
    .insert({ initiator_id: currentUserId, partner_id: sellerId, property_id: propertyId })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

// ↔ getOrCreateRequestChat() / submitOffer()'s inline chat creation.
export async function openOrCreateRequestChat(currentUserId: string, requesterId: string, requestId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("chats").select("id").eq("initiator_id", currentUserId).eq("request_id", requestId).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("chats")
    .insert({ initiator_id: currentUserId, partner_id: requesterId, request_id: requestId })
    .select("id").single();
  if (error) throw error;
  return data.id;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, senderId, text, images, whatsapp }: { chatId: string; senderId: string; text: string; images?: string[]; whatsapp?: string }) => {
      const { error } = await supabase.from("chat_messages").insert({
        chat_id: chatId, sender_id: senderId, text, images: images || [], whatsapp: whatsapp || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["chat_messages", vars.chatId] });
      qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    // ↔ RLS audit fix — was a direct .update({read:true}), which the old
    // policy's `with check (true)` let widen into rewriting any column of
    // any message in the chat. mark_chat_messages_read (20260822000000_
    // rls_audit_fixes.sql) can only ever do the one thing this needs.
    mutationFn: async ({ chatId, currentUserId }: { chatId: string; currentUserId: string }) => {
      const { error } = await supabase.rpc("mark_chat_messages_read", { p_chat_id: chatId });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["chats", vars.currentUserId] }),
  });
}
