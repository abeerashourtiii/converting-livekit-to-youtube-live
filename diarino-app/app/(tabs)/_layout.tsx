import { Tabs } from "expo-router";
import { View } from "react-native";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { FloatingTabBar } from "./_floating-tab-bar";
import { CompareBar } from "../../components/shared/CompareBar";

// Bottom nav is now a fully custom floating bar (see ./_floating-tab-bar)
// instead of the default full-width <Tabs> bar — a dark pill holding
// طلبات/قائمة/رئيسية plus a separate raised circular زر للبحث, both
// floating above the screen content instead of docking to the bottom.
//
// "account" is still a real screen (reachable via router.push from the
// menu page's "إدارة الحساب" card) but it no longer gets its own button
// in the bottom bar, so it's marked href: null to keep it out of any
// default tab-bar affordances while staying fully navigable.
export default function TabsLayout() {
  const { t } = useLanguage();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: t("الرئيسية") }} />
        <Tabs.Screen name="search" options={{ title: t("البحث") }} />
        <Tabs.Screen name="menu" options={{ title: t("القائمة") }} />
        <Tabs.Screen name="requests" options={{ title: t("الطلبات") }} />
        <Tabs.Screen name="account" options={{ title: t("الحساب"), href: null }} />
      </Tabs>
      {/* ↔ floats above the tab bar on every tab — see CompareBar.tsx */}
      <CompareBar />
    </View>
  );
}
