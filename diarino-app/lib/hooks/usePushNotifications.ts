import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { supabase } from "../supabase";
import { useCurrentUser } from "./useCurrentUser";

// ↔ the one piece "الإشعارات مفيش push notifications" was still missing —
// in-app notifications themselves are already real (public.notifications,
// DB-triggered, realtime — see useNotifications.ts). This is the OS-level
// layer on top: register this device's Expo push token so
// supabase/functions/send-push can actually reach it when the app is
// backgrounded or closed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const { user } = useCurrentUser();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || registeredFor.current === user.id) return;
    registeredFor.current = user.id;
    registerForPush().catch((err) => console.warn("push registration failed:", err));
  }, [user?.id]);

  // ↔ tapping a push notification while the app is backgrounded/closed —
  // routes the same way markItemRead's `action` does in useNotifications.ts.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      if (data.chatId) router.push(`/chat/${data.chatId}`);
      else if (data.propertyId) router.push(`/property/${data.propertyId}`);
      else if (data.sellerId) router.push(`/seller/${data.sellerId}`);
    });
    return () => sub.remove();
  }, []);
}

async function registerForPush() {
  // Push tokens don't work in the simulator/emulator — only a real device.
  if (!Device.isDevice) return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "الإشعارات",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: "#22A652",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  const { error } = await supabase.rpc("reassign_push_token", { p_token: token, p_device_type: Platform.OS });
  if (error) console.warn("saving push token failed:", error);
}
