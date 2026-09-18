import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors } from "../../lib/hooks/useThemeColors";

type Props = {
  title: string;
  notifBadgeCount?: number;
  onOpenNotifications: () => void;
};

// ↔ The account-menu icon (three stacked lines) used to sit here and open
// AccountDropdown on every main page. Removed per product decision: settings
// now live solely behind the dedicated "الإعدادات" card on the menu page
// (routes to /settings), so this top bar only needs the notifications icon.
//
// ↔ #1 (إعدادات القائمة — العرض الداكن): مشترك بين شاشات كتير (القائمة/
// البحث/الطلبات...)، فتلوينه هنا بتوكينات useThemeColors() بيوسّع تغطية
// الوضع الداكن الحقيقي لكل الشاشات دي مرة واحدة من غير ما نلمس كل ملف
// لوحده.
export function PageTopBar({ title, notifBadgeCount = 0, onOpenNotifications }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  return (
    <SafeAreaView edges={["top"]} style={[styles.wrap, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
      <View style={styles.bar}>
        <Text style={[styles.title, { color: themeColors.text }]}>{t(title)}</Text>
        <View style={styles.actions}>
          <Pressable style={[styles.iconBtn, { backgroundColor: themeColors.surface }]} onPress={onOpenNotifications} hitSlop={6}>
            <View>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
                <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
              </Svg>
              {notifBadgeCount > 0 && <View style={styles.badge} />}
            </View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 15, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", borderWidth: 1.5, borderColor: "white" },
});
