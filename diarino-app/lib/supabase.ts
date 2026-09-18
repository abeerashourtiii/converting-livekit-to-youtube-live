import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Database } from "../src/types/supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file."
  );
}

let authClient: ReturnType<typeof createClient<Database>> | null = null;
let refreshFailureHandled = false;

// ↔ إصلاح: طلبات الحفظ كانت بترجع 401/42501 (RLS) لأن تجديد الجلسة
// (refresh token) كان بيفشل بشكل متكرر ومتلاحق (رصدنا فى الـ console
// عشرات محاولات إعادة المحاولة السريعة على /auth/v1/token، لحد ما
// Supabase رجّع 429 Too Many Requests بسبب الحد الأقصى لمعدل الطلبات).
// كل كود سابق كان بيتعامل بس مع 400/401 على التجديد؛ 429 كان بيتجاهله
// تمامًا فيسيب المؤقت الداخلي لـ supabase-js يحاول يجدد تاني وتاني بسرعة
// من غير أي مهلة — عاصفة طلبات تتصاعد لحد الحظر المؤقت. دلوقتي أي 429
// على التجديد بيتم تسجيله برضه كفشل (زي 400/401 بالظبط) عشان يوقف
// المحاولات المتلاحقة فورًا بدل ما يسيبها تتصاعد.
const REFRESH_FAILURE_STATUSES = new Set([400, 401, 429]);

const fetchWithAuthRecovery: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const requestUrl = typeof input === "string"
    ? input
    : typeof Request !== "undefined" && input instanceof Request
      ? input.url
      : String(input);
  const isRefreshRequest = requestUrl.includes("/auth/v1/token?grant_type=refresh_token");

  // A rejected refresh token must not be retried forever by the auth timer.
  // Clear only the local session; the next explicit login can establish a new one.
  if (isRefreshRequest && REFRESH_FAILURE_STATUSES.has(response.status)) {
    if (!refreshFailureHandled) {
      refreshFailureHandled = true;
      void authClient?.auth.signOut({ scope: "local" });
    }
  } else if (isRefreshRequest && response.ok) {
    refreshFailureHandled = false;
  }

  return response;
};

export const supabase = (authClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithAuthRecovery },
}));