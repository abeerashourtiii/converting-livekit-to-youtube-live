import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { queryClient } from "../queryClient";
import { resetAdminDB } from "./useAdminDB";
import { clearCompareSelection } from "./useCompareSelection";
import { getAuthSnapshot } from "./useCurrentUser";

const SKIP_KEY = "diarino:skip_auth";

let callbackSessionPromise: Promise<{ error: string | null }> | null = null;
let callbackUrl: string | null = null;
let intentionalSignOut = false;

export function consumeIntentionalSignOut(): boolean {
  const value = intentionalSignOut;
  intentionalSignOut = false;
  return value;
}

WebBrowser.maybeCompleteAuthSession();

export function translateOAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("popup") && m.includes("closed")) return "تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.";
  if (m.includes("popup") && m.includes("block")) return "المتصفح منع النافذة المنبثقة. فعّل النوافذ لهذا الموقع وحاول مجدداً.";
  if (m.includes("unsupported provider") || m.includes("provider is not enabled"))
    return "مزوّد Google غير مفعّل في الخلفية. راجع إعدادات OAuth.";
  if (m.includes("redirect") && (m.includes("uri") || m.includes("mismatch")))
    return "عنوان إعادة التوجيه غير مطابق للمُسجَّل في Google Cloud.";
  if (m.includes("invalid_client") || m.includes("client_id"))
    return "بيانات اعتماد Google غير صحيحة (Client ID/Secret). حدّثها من صفحة الإعدادات.";
  if (m.includes("access_denied") || m.includes("denied")) return "تم رفض الإذن من قِبل المستخدم أو من قِبل Google.";
  if (m.includes("network") || m.includes("fetch")) return "تعذر الاتصال بالخادم. تحقق من الإنترنت.";
  if (m.includes("timeout") || m.includes("timed out")) return "انتهت مهلة الاتصال. حاول مرة أخرى.";
  if (m.includes("expired")) return "انقضت صلاحية الجلسة/الرمز. أعد المحاولة.";
  return raw || "تعذر تسجيل الدخول. حاول مرة أخرى.";
}

export async function completeOAuthCallback(rawUrl: string): Promise<{ error: string | null }> {
  console.log("[Auth] completeOAuthCallback called with URL:", rawUrl);
  if (callbackUrl === rawUrl && callbackSessionPromise) return callbackSessionPromise;
  callbackUrl = rawUrl;
  callbackSessionPromise = completeOAuthCallbackOnce(rawUrl);
  return callbackSessionPromise;
}

async function completeOAuthCallbackOnce(rawUrl: string): Promise<{ error: string | null }> {
  try {
    const url = new URL(rawUrl);
    const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
    const accessToken = url.searchParams.get("access_token") || hashParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token") || hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      console.log("[Auth] Found tokens in URL. Setting session in Supabase...");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.error("[Auth] Supabase setSession Error:", error.message);
        return { error: translateOAuthError(error.message) };
      }
      console.log("[Auth] Session set successfully via tokens.");
      return { error: null };
    }

    const code = url.searchParams.get("code");
    if (code) {
      console.log("[Auth] Found auth code in URL. Exchanging code for session...");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[Auth] Supabase exchangeCodeForSession Error:", error.message);
        return { error: translateOAuthError(error.message) };
      }
      console.log("[Auth] Code exchanged successfully.");
      return { error: null };
    }

    const errorDescription = url.searchParams.get("error_description") || hashParams.get("error_description");
    if (errorDescription) {
      console.error("[Auth] OAuth Callback Error Description:", errorDescription);
    } else {
      console.error("[Auth] OAuth Callback failed: No tokens, code, or error description found in URL.");
    }
    return { error: translateOAuthError(errorDescription || "") };
  } catch (e: any) {
    console.error("[Auth] Exception during completeOAuthCallbackOnce:", e?.message || e);
    return { error: translateOAuthError(e?.message || "") };
  }
}

export function getOAuthRedirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth-callback`;
  }
  return Linking.createURL("auth-callback");
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const isWeb = Platform.OS === "web";
  const redirectUri = getOAuthRedirectUri();

  console.log(`[Auth] Starting Google Sign-In. Platform: ${Platform.OS}, RedirectURI: ${redirectUri}`);

  try {
    // 1. التعامل مع بيئة الويب (Web)
    if (isWeb && typeof window !== "undefined") {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        console.error("[Auth Web] Supabase OAuth Error:", error.message);
        return { error: translateOAuthError(error.message) };
      }
      if (data?.url) {
        console.log("[Auth Web] Redirecting window to:", data.url);
        window.location.href = data.url;
      }
      return { error: null };
    }

    // 2. التعامل مع تطبيقات الموبايل والـ APK (Android / iOS)
    console.log("[Auth Native] Requesting OAuth URL from Supabase...");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error || !data?.url) {
      console.error("[Auth Native] Supabase OAuth Request Failed:", error?.message || "No URL returned");
      return { error: translateOAuthError(error?.message || "") };
    }

    console.log("[Auth Native] Opening WebBrowser session with URL:", data.url);
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri, {
      showInRecents: true,
    });

    console.log("[Auth Native] WebBrowser session completed with result type:", result.type);

    let finalUrl: string | null = null;

    if (result.type === "success" && result.url) {
      finalUrl = result.url;
    } else if (result.type === "cancel") {
      console.log("[Auth Native] User cancelled or browser closed.");
      return { error: null };
    } else {
      // الاستفادة من Deep Link المباشر في حال إغلاق المتصفح أو تأخر الاستجابة
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.includes("auth-callback")) {
        finalUrl = initialUrl;
      }
    }

    if (!finalUrl) {
      console.error("[Auth Native] Browser session failed or returned empty URL.");
      return { error: "تعذر تسجيل الدخول. حاول مرة أخرى." };
    }

    console.log("[Auth Native] Browser returned URL successfully. Completing OAuth callback...");
    const callbackResult = await completeOAuthCallback(finalUrl);
    if (callbackResult.error) {
      console.error("[Auth Native] Callback processing error:", callbackResult.error);
      return callbackResult;
    }

    const uid = getAuthSnapshot().user?.id;
    if (uid) {
      console.log("[Auth Native] User logged in. UID:", uid);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      supabase.from("user_activity_log").insert({
        user_id: uid, user_name: profile?.full_name ?? null, activity_type: "login",
      }).then(({ error: logErr }) => {
        if (logErr) console.warn("[Auth] Failed to log login activity:", logErr);
      });
    }

    console.log("[Auth Native] Google Sign-In finished successfully.");
    return { error: null };
  } catch (err: any) {
    console.error("[Auth] Unhandled exception in signInWithGoogle:", err?.message || err);
    return { error: translateOAuthError(err?.message || "") };
  }
}

export async function signInAsGuest(): Promise<{ error: string | null }> {
  console.log("[Auth] Starting Guest Sign-In...");
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("[Auth] Guest Sign-In Error:", error.message);
    return { error: translateOAuthError(error.message) };
  }
  console.log("[Auth] Guest Sign-In Successful.");
  return { error: null };
}

export async function signOut(): Promise<void> {
  console.log("[Auth] Signing out...");
  intentionalSignOut = true;
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
  }
  await AsyncStorage.removeItem(SKIP_KEY).catch(() => {});
  queryClient.clear();
  resetAdminDB();
  clearCompareSelection();
  console.log("[Auth] Sign-Out Completed.");
}