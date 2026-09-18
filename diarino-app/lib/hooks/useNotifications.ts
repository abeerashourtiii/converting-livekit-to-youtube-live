import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { NotifCategory, NotifItem } from "../../data/mock-notifications";
import { useCurrentUser } from "./useCurrentUser";

// ↔ replaces the local-only NOTIF_DATA store with the real
// `notifications` table from 20260802000000_notifications_backend.sql —
// rows there are created entirely by DB triggers on likes/favorites/
// follows/chat_messages, so this hook only ever reads + marks-read.

export type NotifFilter = "all" | "read" | "unread";

const CATS: NotifCategory[] = ["like", "save", "follow", "chat", "alert"];

function relativeTimeAr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${days} يوم`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

type DbCategory = "like" | "save" | "follow" | "chat" | "new_match" | "price_drop";
// ↔ 'new_match' and 'price_drop' (20260820000000_smart_alerts.sql) are
// two distinct triggers/DB categories but share one UI tab ("التنبيهات")
// instead of getting a 5th and 6th tab each — dbCatToUiCat below is the
// only place that mapping happens.
function dbCatToUiCat(c: DbCategory): NotifCategory {
  return c === "new_match" || c === "price_drop" ? "alert" : c;
}

type NotifRow = {
  id: string;
  category: DbCategory;
  text: string;
  read: boolean;
  created_at: string;
  property_id: string | null;
  chat_id: string | null;
  actor: { id: string; full_name: string | null } | null;
  // the property this notification points to — only fetched to know its
  // seller (for the `reel` action's sellerId), the property's own row
  // already carries seller_id.
  properties: { seller_id: string } | null;
};

async function fetchNotifications(userId: string): Promise<Record<NotifCategory, NotifItem[]>> {
  const { data, error } = await supabase
    .from("notifications")
    // ↔ profiles_public, not profiles — the actor (who liked/followed/
    // saved) can be any user regardless of their own privacy setting;
    // this only ever renders their name in the notification text. See
    // 20260825000000_profile_privacy_rls.sql.
    .select("id, category, text, read, created_at, property_id, chat_id, actor:profiles_public!actor_id(id, full_name), properties(seller_id)")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const grouped: Record<NotifCategory, NotifItem[]> = { like: [], save: [], follow: [], chat: [], alert: [] };
  const rows = (data ?? []) as NotifRow[];

  for (const r of rows) {
    const name = r.actor?.full_name || "ديارينو";
    const item: NotifItem = {
      id: r.id,
      name,
      initial: name.charAt(0),
      text: r.text,
      time: relativeTimeAr(r.created_at),
      read: r.read,
      action:
        r.category === "chat" && r.chat_id
          ? { type: "chat", id: r.chat_id }
          : (r.category === "like" || r.category === "save") && r.property_id
          ? { type: "reel", sellerId: r.properties?.seller_id ?? "", propertyId: r.property_id }
          : r.category === "follow" && r.actor?.id
          ? { type: "seller", id: r.actor.id }
          : (r.category === "new_match" || r.category === "price_drop") && r.property_id
          ? { type: "property", id: r.property_id }
          : undefined,
    };
    grouped[dbCatToUiCat(r.category)].push(item);
  }
  return grouped;
}

export function useNotifications() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["notifications", user?.id], [user?.id]);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!user?.id) {
        return Promise.resolve({ like: [], save: [], follow: [], chat: [], alert: [] });
      }
      return fetchNotifications(user.id);
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    // ↔ Supabase's client keeps realtime channels in an internal registry
    // keyed by topic name. removeChannel() unsubscribes over the socket
    // *asynchronously* and only drops the registry entry once that
    // completes — so in React 18 dev/StrictMode (which deliberately does
    // mount → cleanup → mount again) and in any fast remount in
    // production (e.g. navigating away and back quickly), the next
    // mount's `supabase.channel(sameName)` can be handed the still-
    // registered previous channel — which is already subscribed —
    // before its teardown finished. Calling `.on()` on that channel then
    // throws exactly "cannot add postgres_changes callbacks ... after
    // subscribe()". A unique topic per effect run sidesteps the race
    // entirely; the `filter` below (not the channel name) is what scopes
    // this subscription to the current user's rows.
    const channelName = `notifications:${user.id}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc, queryKey]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async ({ category }: { userId: string; category: NotifCategory }) => {
      const dbCategories: DbCategory[] = category === "alert" ? ["new_match", "price_drop"] : [category];
      const { error } = await supabase.rpc("mark_notifications_read", { p_categories: dbCategories });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // ---- local UI-only state (which tab/filter is showing) ----
  const uiState = useNotifUiState();

  const data = query.data ?? { like: [], save: [], follow: [], chat: [], alert: [] };
  const badges: Record<NotifCategory, number> = {
    like: data.like.filter((n) => !n.read).length,
    save: data.save.filter((n) => !n.read).length,
    follow: data.follow.filter((n) => !n.read).length,
    chat: data.chat.filter((n) => !n.read).length,
    alert: data.alert.filter((n) => !n.read).length,
  };
  const totalUnread = CATS.reduce((sum, c) => sum + badges[c], 0);
  const list = data[uiState.activeCat] || [];
  
  const visibleItems = list.filter((n) => {
    if (uiState.filter === "unread") return !n.read;
    if (uiState.filter === "read") return n.read;
    return true;
  });

  function markItemRead(_cat: NotifCategory, index: number) {
    const item = visibleItems[index];
    if (!item || item.read || !item.id) return;
    markReadMutation.mutate(item.id);
  }

  function markAllRead() {
    if (!user?.id) return;
    markAllReadMutation.mutate({ userId: user.id, category: uiState.activeCat });
  }

  return {
    activeCat: uiState.activeCat,
    setActiveCat: uiState.setActiveCat,
    filter: uiState.filter,
    setFilter: uiState.setFilter,
    badges,
    totalUnread,
    visibleItems,
    markItemRead,
    markAllRead,
  };
}

// ---------------------------------------------------------------------
// Module-level UI state storage with explicit interface definition
// ---------------------------------------------------------------------
interface NotifUiSnapshot {
  activeCat: NotifCategory;
  filter: NotifFilter;
}

let activeCat: NotifCategory = "like";
let filter: NotifFilter = "all";
let uiSnapshot: NotifUiSnapshot = { activeCat, filter };
const uiListeners = new Set<() => void>();

function emitUi() {
  uiSnapshot = { activeCat, filter };
  uiListeners.forEach((l) => l());
}

function subscribeUi(listener: () => void) {
  uiListeners.add(listener);
  return () => {
    uiListeners.delete(listener);
  };
}

function getUiSnapshot(): NotifUiSnapshot {
  return uiSnapshot;
}

function useNotifUiState() {
  const snap = useSyncExternalStore(subscribeUi, getUiSnapshot);
  return {
    activeCat: snap.activeCat,
    filter: snap.filter,
    setActiveCat: (cat: NotifCategory) => {
      activeCat = cat;
      emitUi();
    },
    setFilter: (f: NotifFilter) => {
      filter = f;
      emitUi();
    },
  };
}