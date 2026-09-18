// ↔ ملحوظة تاريخية: كان هنا قبل هذا التحديث ترقيع DOMException
// واستدعاء registerGlobals() بتاع LiveKit (فى index.js بجذر المشروع).
// بعد التحويل لـ YouTube Live (بث RTMP بدل WebRTC)، الترقيعان دول مش
// لازمين خالص، وتم حذفهما من index.js — راجع
// docs/YOUTUBE_LIVE_MIGRATION_GUIDE.md.
import { useState, useCallback, useEffect, useRef } from "react";
import { Stack } from "expo-router";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { consumeIntentionalSignOut } from "../lib/hooks/useAuth";
import { getAuthSnapshot, subscribeAuthState } from "../lib/hooks/useCurrentUser";
import { applyPersistedRTLAtStartup } from "../lib/hooks/useLanguage";
import { usePushNotifications } from "../lib/hooks/usePushNotifications";
import { ErrorBoundary } from "../components/shared/ErrorBoundary";
import { ToastHost } from "../components/shared/Toast";
import { showToast } from "../components/shared/Toast";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* no-op if already hidden */
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  usePushNotifications();
  // ↔ بند 5+6 (القائمة مش بتتحمّل / لوحة الأدمن مش بتظهر إلا بعد إعادة
  // التشغيل): السبب الجذري المشترك — queries زي useActiveMenuItems/
  // useActiveAdBanners/useActiveLives (وأي query تاني مقفول بسياسة RLS
  // `to authenticated`) مش مربوطة بحالة تسجيل الدخول، فلو اتنفذت أول مرة
  // قبل ما جلسة Supabase تتحمّل بالكامل من التخزين المحلي (سباق توقيت
  // معروف عند الإقلاع البارد)، بيرجع نتيجة فاضية وبتتخزّن فى كاش
  // React Query لحد ما تقفل التطبيق تمامًا وتفتحه تاني. useIsAdmin نفسه
  // بيتحدّث صح لما اليوزر يتغيّر، لكن ده مش كفاية لو الشاشة اتحمّلت أصلاً
  // بنتيجة فاضية من طلبات تانية معتمدة على نفس الجلسة.
  // الحل: أي تغيير حقيقي فى حالة تسجيل الدخول (دخول/خروج/تبديل حساب)
  // بيعمل invalidateQueries() على كل الكاش مرة واحدة، فأي شاشة متاحة أو
  // هتتاح بعد كده بتجيب بياناتها من جديد بالجلسة الصحيحة — مفيش داعي
  // لإعادة تشغيل التطبيق تاني.
  const lastUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return subscribeAuthState(() => {
      const session = getAuthSnapshot();
      const nextUserId = session.user?.id ?? null;
      if (!session.user && lastUserIdRef.current && !consumeIntentionalSignOut()) {
        lastUserIdRef.current = null;
        queryClient.clear();
        showToast("انتهت الجلسة، سجّل دخولك مجدداً");
        router.replace("/");
        return;
      }
      if (lastUserIdRef.current === undefined) {
        // أول حدث بعد الإقلاع (استعادة الجلسة المحفوظة) — مش تغيير فعلي،
        // فمفيش داعي لإعادة تحميل كل حاجة من الصفر.
        lastUserIdRef.current = nextUserId;
        return;
      }
      if (lastUserIdRef.current !== nextUserId) {
        lastUserIdRef.current = nextUserId;
        queryClient.invalidateQueries();
      }
    });
  }, []);

  useEffect(() => {
    applyPersistedRTLAtStartup().finally(() => {
      setIsReady(true);
    });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="live" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen
                name="property/[id]"
                options={{
                  presentation: "formSheet",
                  sheetAllowedDetents: [0.86, 1],
                  sheetGrabberVisible: true,
                }}
              />
              <Stack.Screen name="property/[id]/reel" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="seller/[id]" options={{ presentation: "modal" }} />
              <Stack.Screen name="chat" options={{ presentation: "modal" }} />
              <Stack.Screen name="publish" options={{ presentation: "modal" }} />
              <Stack.Screen name="coming-soon" options={{ presentation: "modal" }} />
              <Stack.Screen name="settings" options={{ presentation: "modal" }} />
              <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
              <Stack.Screen name="admin" />
              <Stack.Screen
                name="+not-found"
                options={{ headerShown: true, title: "Not Found" }}
              />
            </Stack>
            {/* ↔ نُقل هنا (بدل ما يتكرر فى كل شاشة على حدة) عشان
                showToast() يشتغل من أي مكان فى التطبيق — زي مودال الـ
                PiP وقايمة خيارات الريل، اللي بيظهروا فى شاشات تانية غير
                settings.tsx. */}
            <ToastHost />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}