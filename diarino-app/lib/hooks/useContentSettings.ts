import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ powers 5 new rows in the settings menu: chat on/off for property
// details, chat on/off for requests, WhatsApp number visible/hidden,
// call button visible/hidden, and per-category notification toggles.
// All read/write public.profiles directly — same simple upsert pattern
// used by lib/hooks/useAccountPrivacy.ts.

export type ContentSettings = {
  chatOnProperties: boolean;
  chatOnRequests: boolean;
  showWhatsapp: boolean;
  showCallButton: boolean;
  notifyLikes: boolean;
  notifySaves: boolean;
  notifyFollows: boolean;
  notifyChat: boolean;
};

const DEFAULTS: ContentSettings = {
  chatOnProperties: true, chatOnRequests: true, showWhatsapp: true, showCallButton: true,
  notifyLikes: true, notifySaves: true, notifyFollows: true, notifyChat: true,
};

type SettingsRow = {
  chat_on_properties: boolean; chat_on_requests: boolean; show_whatsapp: boolean; show_call_button: boolean;
  notify_likes: boolean; notify_saves: boolean; notify_follows: boolean; notify_chat: boolean;
};

function rowToSettings(row: SettingsRow | null): ContentSettings {
  if (!row) return DEFAULTS;
  return {
    chatOnProperties: row.chat_on_properties,
    chatOnRequests: row.chat_on_requests,
    showWhatsapp: row.show_whatsapp,
    showCallButton: row.show_call_button,
    notifyLikes: row.notify_likes,
    notifySaves: row.notify_saves,
    notifyFollows: row.notify_follows,
    notifyChat: row.notify_chat,
  };
}

export function useContentSettings() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const queryKey = ["contentSettings", user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ContentSettings> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("chat_on_properties, chat_on_requests, show_whatsapp, show_call_button, notify_likes, notify_saves, notify_follows, notify_chat")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return rowToSettings(data as SettingsRow | null);
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ key, value }: { key: keyof ContentSettings; value: boolean }) => {
      if (!user) return;

      const payload: { id: string } & Partial<SettingsRow> = { id: user.id };

      if (key === "chatOnProperties") payload.chat_on_properties = value;
      if (key === "chatOnRequests") payload.chat_on_requests = value;
      if (key === "showWhatsapp") payload.show_whatsapp = value;
      if (key === "showCallButton") payload.show_call_button = value;
      if (key === "notifyLikes") payload.notify_likes = value;
      if (key === "notifySaves") payload.notify_saves = value;
      if (key === "notifyFollows") payload.notify_follows = value;
      if (key === "notifyChat") payload.notify_chat = value;

      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onMutate: async ({ key, value }) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<ContentSettings>(queryKey);
      qc.setQueryData<ContentSettings>(queryKey, { ...(previous ?? DEFAULTS), [key]: value });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    settings: query.data ?? DEFAULTS,
    toggleSetting: (key: keyof ContentSettings) => {
      const current = qc.getQueryData<ContentSettings>(queryKey) ?? query.data ?? DEFAULTS;
      toggle.mutate({ key, value: !current[key] });
    },
  };
}

// ↔ the seller-facing check on app/property/[id].tsx — is THIS seller's
// chat/WhatsApp/call visible, regardless of who's viewing.
// ↔ app/(tabs)/requests.tsx — checking one setting per request card would
// mean one query per card; this batches all the unique requester ids in
// the current filtered list into a single query instead.
//
// Both of the hooks below read someone ELSE's settings — a buyer needs
// to know whether a seller/requester has chat/WhatsApp/call visible
// before rendering those buttons, regardless of that seller's own
// is_public account-privacy setting (that flag gates their profile PAGE,
// not whether their public listings are contactable at all). These
// visibility *preferences* live on `profiles` but aren't themselves
// sensitive the way phone/bio are, so profiles_public carries them too —
// see 20260825000000_profile_privacy_rls.sql. profiles_public doesn't
// carry the notify_* columns (another user's own notification
// preferences are never relevant to a stranger), so those four always
// fall back to DEFAULTS here regardless of the row found.
type VisibleSettingsRow = {
  chat_on_properties: boolean; chat_on_requests: boolean; show_whatsapp: boolean; show_call_button: boolean;
};

function rowToVisibleSettings(row: VisibleSettingsRow | null): ContentSettings {
  if (!row) return DEFAULTS;
  return {
    ...DEFAULTS,
    chatOnProperties: row.chat_on_properties,
    chatOnRequests: row.chat_on_requests,
    showWhatsapp: row.show_whatsapp,
    showCallButton: row.show_call_button,
  };
}

export function useChatOnRequestsMap(requesterIds: string[]) {
  const uniqueIds = Array.from(new Set(requesterIds)).sort();
  return useQuery({
    queryKey: ["chatOnRequestsMap", uniqueIds],
    queryFn: async (): Promise<Map<string, boolean>> => {
      if (uniqueIds.length === 0) return new Map();
      const { data, error } = await supabase.from("profiles_public").select("id, chat_on_requests").in("id", uniqueIds);
      if (error) throw error;
      return new Map(((data ?? []) as { id: string; chat_on_requests: boolean }[]).map((r) => [r.id, r.chat_on_requests]));
    },
    enabled: uniqueIds.length > 0,
    staleTime: 30_000,
  });
}

export function useSellerContentSettings(sellerId: string | undefined) {
  return useQuery({
    queryKey: ["sellerContentSettings", sellerId],
    queryFn: async (): Promise<ContentSettings> => {
      const { data, error } = await supabase
        .from("profiles_public")
        .select("chat_on_properties, chat_on_requests, show_whatsapp, show_call_button")
        .eq("id", sellerId!)
        .maybeSingle();
      if (error) throw error;
      return rowToVisibleSettings(data as VisibleSettingsRow | null);
    },
    enabled: !!sellerId,
    staleTime: 30_000,
  });
}