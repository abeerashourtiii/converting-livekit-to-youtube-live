import { useSyncExternalStore } from "react";

// ↔ الإعدادات الظاهرة فى القائمة المنسدلة اللي بتفتح بالضغط المطول على
// الريل (components/reel/ReelOptionsSheet.tsx) — الأربعة كلهم "إعدادات
// جلسة" بنفس النمط بالظبط: autoAdvance / musicMuted / captionsEnabled /
// captionsLanguage. مفيش أي منهم بيتخزن فى AsyncStorage عمدًا — كلهم
// موجودين بس فى الذاكرة (module-level state) زي أي متغيّر عادي: أي
// إغلاق حقيقي للتطبيق (إنهاء العملية بالكامل، مش مجرد تصغيره فى
// الخلفية) بيصفّر الـ JS context بالكامل، فالقيم دي بترجع للافتراضي من
// تلقاء نفسها فى المرة الجاية من غير أي كود إضافي — ده بالظبط المطلوب:
// التفعيل يفضل سارٍ خلال الجلسة الحالية (بين الريلات وبين الشاشات) لكن
// يتصفّر تلقائيًا عند إغلاق التطبيق فعليًا وإعادة فتحه.
//
// ↔ ملاحظة تاريخية: autoAdvance كانت قبل كده متخزّنة بشكل دائم عبر
// AsyncStorage (زي اللغة/الثيم) — اتشالت الخاصية دي عمدًا هنا (طلب
// جديد) عشان توحّد نفس نمط "إعدادات الجلسة" مع باقي التلاتة.
export type CaptionsLanguage = "ar" | "en";

interface ReelPreferencesSnapshot {
  autoAdvance: boolean;
  musicMuted: boolean;
  captionsEnabled: boolean;
  captionsLanguage: CaptionsLanguage;
}

let autoAdvance = false; // ↔ الطلب الجديد: يبدأ *غير مفعّل* افتراضيًا فى كل تشغيل جديد للتطبيق (كان true غلط) — آلية الـ session-only تحت دي أصلاً كانت بترجّعه لقيمته الافتراضية عند كل إغلاق حقيقي للتطبيق، وكل اللي محتاج تصحيح هو القيمة الافتراضية نفسها.
let musicMuted = false; // ↔ session-only — يرجع false تلقائيًا فى كل تشغيل جديد للتطبيق
let captionsEnabled = false; // ↔ session-only لنفس السبب
let captionsLanguage: CaptionsLanguage = "ar";

let snapshot: ReelPreferencesSnapshot = { autoAdvance, musicMuted, captionsEnabled, captionsLanguage };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { autoAdvance, musicMuted, captionsEnabled, captionsLanguage };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReelPreferencesSnapshot {
  return snapshot;
}

export function useReelPreferences() {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  function setAutoAdvance(next: boolean) {
    autoAdvance = next;
    emit();
  }

  function setMusicMuted(next: boolean) {
    musicMuted = next;
    emit();
  }

  function setCaptionsEnabled(next: boolean) {
    captionsEnabled = next;
    emit();
  }

  function setCaptionsLanguage(next: CaptionsLanguage) {
    captionsLanguage = next;
    emit();
  }

  return {
    ...state,
    setAutoAdvance,
    setMusicMuted,
    setCaptionsEnabled,
    setCaptionsLanguage,
  };
}
