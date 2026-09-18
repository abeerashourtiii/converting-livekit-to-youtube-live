import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ↔ "عرض التطبيق فوق التطبيقات الأخرى" (زي يوتيوب) — تظهر فى مكانين:
// app/settings.tsx وقايمة خيارات الريل (ReelOptionsSheet.tsx)، وكلاهما
// لازم يعكسوا نفس التفضيل المُخزَّن، فده مخزن واحد مشترك زي useTheme/
// useLanguage بدل useState منفصل فى كل شاشة.
//
// ⚠️ ملاحظة مهمة (مفيش أي خداع هنا): التخزين ده بس بيسجّل *موافقة/رفض
// المستخدم* على تفعيل الخاصية — التشغيل الفعلي لـ Picture-in-Picture على
// أندرويد/iOS محتاج طبقة native إضافية (مكتبة الفيديو المستخدمة دلوقتي
// expo-av مالهاش دعم PiP؛ ده متاح فى expo-video الأحدث أو موديول native
// مخصص) مش موجودة فى المشروع لسه. فالتفضيل ده جاهز فورًا لما التكامل
// الـ native يتضاف، وده مكتوب صراحة فى ملخص التسليم كمان.
export type PiPPreference = "unset" | "enabled" | "declined";

const STORAGE_KEY = "diarino:pipPreference";

let preference: PiPPreference = "unset";
let snapshot: { preference: PiPPreference } = { preference };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { preference };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (saved === "enabled" || saved === "declined") {
    preference = saved;
    emit();
  }
});

export function usePiPPreference() {
  const { preference: pref } = useSyncExternalStore(subscribe, getSnapshot);

  function setPreference(next: PiPPreference) {
    preference = next;
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    emit();
  }

  return { preference: pref, setPreference };
}
