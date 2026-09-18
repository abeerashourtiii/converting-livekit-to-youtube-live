import { useTheme } from "./useTheme";

// ↔ #1 (إعدادات القائمة — العرض): توكينات ألوان حقيقية تتغيّر فعليًا مع
// resolvedTheme، مستخدمة فى app/settings.tsx وapp/(tabs)/menu.tsx وroot
// layout الحالية — أول شاشتين فعليًا وصول المستخدم للإعداد ده منهم
// (settings.tsx نفسها، وmenu.tsx اللي فيها كارت "الإعدادات"). باقي
// شاشات التطبيق (~60 شاشة) لسه بتستخدم ألوان فاتحة ثابتة فى الـ
// StyleSheets بتاعتها — إعادة تلوين كل شاشة منهم مرحلة تانية أكبر.
export type ThemeColors = {
  isDark: boolean;
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
};

const LIGHT: ThemeColors = {
  isDark: false,
  background: "#D6E3CF",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#f3f4f6",
  text: "#111827",
  textMuted: "#374151",
  textSubtle: "#6b7280",
};

const DARK: ThemeColors = {
  isDark: true,
  background: "#15171A",
  surface: "#1F2226",
  card: "#24272B",
  border: "#2E3237",
  text: "#F3F4F6",
  textMuted: "#D1D5DB",
  textSubtle: "#9CA3AF",
};

export function useThemeColors(): ThemeColors {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return { ...(isDark ? DARK : LIGHT), isDark };
}
