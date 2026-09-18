import { useEffect, useSyncExternalStore } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ↔ powers "العرض: فاتح / داكن / إعدادات الجهاز" in the account settings
// menu. The choice is persisted, "device settings" genuinely tracks the
// OS's live appearance changes, and `resolvedTheme` is correct. It also
// calls Appearance.setColorScheme() (see applyColorScheme below) so
// useColorScheme() — used by React Navigation's own chrome, native
// dialogs like iOS's Alert, and any of our components that read it
// directly — genuinely reflects the user's choice app-wide, not just the
// OS's live value.
//
// lib/hooks/useThemeColors.ts is the actual light/dark color-token hook
// screens read from — it's wired into app/settings.tsx and
// app/(tabs)/menu.tsx (the two screens directly reachable from this
// setting) plus the root layout background. Re-theming the rest of the
// app's ~60 screens (most still hardcode light colors directly in their
// StyleSheets) is a larger follow-up beyond this pass.

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "diarino:theme";

interface ThemeSnapshot {
  preference: ThemePreference;
  systemScheme: "light" | "dark";
}

let preference: ThemePreference = "system";
let systemScheme: "light" | "dark" = Appearance.getColorScheme() === "dark" ? "dark" : "light";

// ↔ React Query / data audit finding: getSnapshot() must return a stable
// reference when nothing has actually changed — useSyncExternalStore
// compares snapshots with Object.is, and a getSnapshot that builds a new
// `{ preference, systemScheme }` object on every call looks "changed" on
// every single check even when the values are identical, which React
// flags as exactly the "getSnapshot should be cached" infinite-loop
// pattern. This cached object is only ever replaced (in emit(), below)
// when preference or systemScheme actually changes.
let snapshot: ThemeSnapshot = { preference, systemScheme };
const listeners = new Set<() => void>();
let hydrationStarted = false;

function emit() {
  snapshot = { preference, systemScheme };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeSnapshot {
  return snapshot;
}

Appearance.addChangeListener(({ colorScheme }) => {
  systemScheme = colorScheme === "dark" ? "dark" : "light";
  emit();
});

// ↔ #1 (إعدادات القائمة): بيخلي useColorScheme() — المستخدمة من React
// Navigation ونظام الحوارات الأصلي (Alert على iOS) وأي مكوّن تانى فى
// المشروع بيعتمد عليها مباشرة — تعكس فعليًا اختيار المستخدم (فاتح/داكن)
// بدل ما تفضل شايفة اللي جاي من نظام التشغيل بس. لما الاختيار يبقى
// "إعدادات الجهاز"، بنبعت null عشان يرجع يتبع نظام التشغيل تلقائيًا زي
// ما هو متوقع.
function applyColorScheme() {
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

export function useTheme() {
  const { preference: pref, systemScheme: sys } = useSyncExternalStore(subscribe, getSnapshot);
  const resolvedTheme: "light" | "dark" = pref === "system" ? sys : pref;

  useEffect(() => {
    if (hydrationStarted) return;
    hydrationStarted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        preference = saved;
        applyColorScheme();
        emit();
      }
    }).catch(() => {});
  }, []);

  function setPreference(next: ThemePreference) {
    preference = next;
    AsyncStorage.setItem(STORAGE_KEY, next);
    applyColorScheme();
    emit();
  }

  return { preference: pref, resolvedTheme, setPreference };
}