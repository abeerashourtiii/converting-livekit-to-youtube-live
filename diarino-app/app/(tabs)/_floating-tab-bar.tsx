import { View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { RequestsIcon, MenuIcon as GridIcon, ReelsIcon, SearchSparkleIcon } from "./_tab-icons";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ إصلاح باغ #4/#5 — إعادة بناء شريط المهام العائم بالكامل:
//
// #4 (الاتجاه): قبل كده كان فيه منطق يلغي عمدًا الـ auto-mirroring
// التلقائي بتاع I18nManager (flexDirection: isRTL ? "row-reverse" : "row")
// عشان يخلي ترتيب الأيقونات ثابت مهما كانت اللغة. ده كان تنفيذ لمواصفة
// سابقة مختلفة تمامًا. المواصفة الحالية (راجع تقرير البند #4) واضحة إن
// شريط المهام لازم *ينعكس فعليًا* مع اللغة:
//   - عربي (RTL): بحث → بيت → مربعات → دفتر، بادئ من اليمين
//   - إنجليزي (LTR): بحث → بيت → مربعات → دفتر، بادئ من اليسار
// يعني نفس ترتيب الـ JSX (بحث, بيت, مربعات, دفتر) فى الحالتين، لكن
// الاتجاه البصري بينعكس تلقائيًا مع اللغة — وده بالظبط سلوك
// flexDirection:"row" العادي (من غير أي إلغاء) تحت I18nManager، فمفيش
// داعي لأي حساب يدوي: نسيبه يشتغل طبيعي زي ما الإطار مصمم أصلاً.
//
// #5 (الاتساع): الشريط بقى عنصر واحد موحّد (مش دائرة بحث منفصلة + بيل
// أضيق زي الأول) بيمتد أفقيًا بين هامشين ثابتين (EDGE_MARGIN، تقريبًا
// 1 سم) من حواف الشاشة، والأربع أيقونات موزّعة بمسافات متساوية جواه
// (space-around) — مش متمركز فى مساحة ضيقة فى النص زي قبل كده.
//
// This fully replaces the default <Tabs> tab bar via the `tabBar` prop.
// "account" is intentionally left out (its functions moved to the menu
// page's "إدارة الحساب" card) while its route file still works fine when
// reached via router.push, it's just not shown here.
//
// This one component is shared by every tab screen (index/search/menu/
// requests) via the `tabBar` prop on the <Tabs> navigator in
// app/(tabs)/_layout.tsx — so it's already a single, unified bar; there's
// no separate copy anywhere else to keep in sync.
//
// ↔ قاعدة تثيم الوسائط (Media Theming Rule — راجع docs/deferred-tasks.md):
// الشريط ده "خارج سطح الفيديو" رسميًا (chrome عام مشترك بين كل الشاشات،
// مش عنصر مرسوم مباشرة على بكسلات الفيديو) — عنده خلفية عتمة (pill) +
// ظل خاصين بيه دايمًا، فألوانه آمنة تتبع الثيم من غير خطر اختفاء فوق أي
// فيديو (عكس الأيقونات الجانبية/العلوية اللي مالهاش خلفية عتمة خاصة،
// فلازم تفضل بيضا ثابتة دايمًا — شوف ReelActionRail.tsx/ReelsHeader.tsx).
const ICON_COLOR_LIGHT = "#C9B896";
const ICON_COLOR_LIGHT_ACTIVE = "#F3E4BE";
const ICON_COLOR_DARK = "#6B6B6B";
const ICON_COLOR_DARK_ACTIVE = "#22A652";
// ↔ #5: "1 سم على الشاشات ≈ 38-40dp تقريباً" — dp (density-independent
// pixels) فى React Native أصلاً بيتحسب تلقائيًا حسب كثافة بكسلات كل
// جهاز (زي PixelRatio.get() جوّا)، فرقم dp ثابت زي ده بيفضل ~1 سم فعليًا
// على أي شاشة (5" أو 6.7")، من غير أي تحويل يدوي إضافي عبر PixelRatio.
const EDGE_MARGIN = 38;

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const iconColor = themeColors.isDark ? ICON_COLOR_LIGHT : ICON_COLOR_DARK;
  const iconColorActive = themeColors.isDark ? ICON_COLOR_LIGHT_ACTIVE : ICON_COLOR_DARK_ACTIVE;

  function go(routeName: string) {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const isFocused = state.routes[state.index].name === routeName;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  const activeName = state.routes[state.index]?.name;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 14 }]}>
      <View style={styles.bar}>
        <TabButton onPress={() => go("search")}>
          <SearchSparkleIcon color={activeName === "search" ? iconColorActive : iconColor} size={22} />
        </TabButton>
        <TabButton onPress={() => go("index")}>
          <ReelsIcon color={activeName === "index" ? iconColorActive : iconColor} size={22} />
        </TabButton>
        <TabButton onPress={() => go("menu")}>
          <GridIcon color={activeName === "menu" ? iconColorActive : iconColor} size={22} />
        </TabButton>
        <TabButton onPress={() => go("requests")}>
          <RequestsIcon color={activeName === "requests" ? iconColorActive : iconColor} size={22} />
        </TabButton>
      </View>
    </View>
  );
}

function TabButton({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.tabBtn} onPress={onPress} hitSlop={8}>
      {children}
    </Pressable>
  );
}

// ↔ منطقة لمس الأيقونة (#3) مالهاش أي لون، فمش محتاجة تتحسب فى
// createStyles(themeColors) زي باقي الأنماط اللي بتعتمد على الثيم.
const styles = StyleSheet.create({
  tabBtn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center" },
});

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    // ↔ #5: الهامش الخارجي (EDGE_MARGIN) ثابت ومتماثل من الجهتين ("left"
    // و"right" الفيزيائيين) بغض النظر عن اللغة — فمساحة الحاوية نفسها بين
    // الحافتين ثابتة فى الحالتين، والاتجاه اللي بيتغيّر مع اللغة هو ترتيب
    // الأيقونات *جوّا* الشريط (styles.bar تحت) بس.
    wrap: { position: "absolute", left: EDGE_MARGIN, right: EDGE_MARGIN },
    bar: {
      // ↔ #4: flexDirection:"row" عادي من غير أي إلغاء للـ auto-mirroring —
      // ده اللي بيخلي ترتيب الأيقونات ينعكس تلقائيًا مع I18nManager.isRTL.
      // ↔ #5: التوزيع بمسافات متساوية جوه الشريط الموحّد اللي بيمتد بين
      // الهامشين، بدل بيل ضيق فى النص + دائرة منفصلة.
      flexDirection: "row", alignItems: "center", justifyContent: "space-around",
      height: 48, borderRadius: 24, backgroundColor: themeColors.isDark ? "#26262A" : "#FFFFFF", paddingHorizontal: 8,
      shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 12,
    },
  });
}
