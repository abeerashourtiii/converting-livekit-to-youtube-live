import { useRef, useState } from "react";
import {
  Modal, View, Text, Pressable, FlatList, StyleSheet, Animated, PanResponder, useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { NotifCategory, NotifItem } from "../../data/mock-notifications";
import { NotifFilter } from "../../lib/hooks/useNotifications";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ #notifDropdown — small anchored card by default, `.expanded` (near-
// fullscreen, inset:10px) on the expand toggle, swipe-up on the bottom
// handle to close (dy < -60 in the original) — reproduced with PanResponder.

const CATS: { key: NotifCategory; label: string; icon: (color: string) => React.ReactNode }[] = [
  { key: "like", label: "إعجاب", icon: (c) => <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></Svg> },
  { key: "save", label: "حفظ", icon: (c) => <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></Svg> },
  { key: "follow", label: "متابعة", icon: (c) => <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" /></Svg> },
  { key: "chat", label: "الشات", icon: (c) => <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg> },
  // ↔ "إشعارات ذكية مخصصة" — groups both 'new_match' and 'price_drop'
  // (20260820000000_smart_alerts.sql) under one tab instead of two,
  // since both are fundamentally "something in the market matched your
  // interest" rather than social activity on your own content like the
  // four tabs above.
  { key: "alert", label: "تنبيهات", icon: (c) => <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></Svg> },
];

const FILTERS: { key: NotifFilter; label: string }[] = [
  { key: "all", label: "الكل" }, { key: "read", label: "مقروء" }, { key: "unread", label: "غير مقروء" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  activeCat: NotifCategory;
  onSwitchCat: (c: NotifCategory) => void;
  filter: NotifFilter;
  onSetFilter: (f: NotifFilter) => void;
  badges: Record<NotifCategory, number>;
  items: NotifItem[];
  onMarkAllRead: () => void;
  onItemPress: (index: number) => void;
};

export function NotificationsDropdown({
  visible, onClose, activeCat, onSwitchCat, filter, onSetFilter, badges, items, onMarkAllRead, onItemPress,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { width: windowWidth } = useWindowDimensions();
  // ↔ السبب الحقيقي إن الجرس مكانش بيفتح حاجة ظاهرة على أندرويد/آيفون
  // (شغّال على الويب بس): Modal الأصلية بتاعت React Native عندها مشكلة
  // موثّقة (شوف مثلاً facebook/react-native#35804 وfacebook/react-native
  // #49256) إن أبعاد المحتوى جواها ممكن تتحسب غلط فى أول رندر، خصوصًا مع
  // statusBarTranslucent + أبعاد بالنسبة المئوية (maxWidth: "88%") بدل
  // رقم ثابت. النتيجة: كارت الإشعارات بيتحسب بعرض شبه صفري (الخط الأبيض
  // الرفيع اللي ظهر فى لقطة الشاشة). Modal بتاعة الويب فى react-native-
  // web عبارة عن <div> عادي full-screen، مالهاش نفس مشكلة القياس دي،
  // فده سبب اشتغالها صح على الويب بس. الحل: شيل statusBarTranslucent
  // (خاص بأندرويد وهو المتسبب الرئيسي فى البلاغات المشابهة)، واحسب عرض
  // الكارت برقم فعلي من useWindowDimensions() بدل نسبة مئوية بتتوقف على
  // حجم حاوية Modal نفسها.
  const cardWidth = Math.min(320, windowWidth - 32);
  const dragY = useRef(new Animated.Value(0)).current;
  // ↔ #8: تتبّع موضع سكرول قائمة الإشعارات نفسها، عشان السحب لأسفل جوه
  // المحتوى يقفل بس لما تكون فى الأعلى تمامًا (زي باقي الـ Sheets) —
  // قبل كده كان الإغلاق بالسحب مقصور على مقبض السحب السفلي بس.
  const listScrollYRef = useRef(0);
  const handleListScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    listScrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        listScrollYRef.current <= 0 && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) return; // only allow dragging up, like the original
        dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -60) {
          onClose();
        }
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[
          expanded ? styles.cardExpanded : [styles.card, { width: cardWidth }],
          { transform: [{ translateY: dragY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <Pressable style={styles.dragBtn} onPress={() => setExpanded((v) => !v)} hitSlop={6}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textMuted} strokeWidth={2}>
              {expanded ? (
                <Path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              ) : (
                <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </Svg>
          </Pressable>
          <Text style={styles.headerTitle}>{t("الإشعارات")}</Text>
          <Pressable style={styles.dragBtn} onPress={onClose} hitSlop={6}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textMuted} strokeWidth={2}><Path d="M18 6L6 18M6 6l12 12" /></Svg>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {CATS.map((c) => {
            const active = c.key === activeCat;
            const count = badges[c.key];
            return (
              <Pressable key={c.key} style={[styles.tab, active && styles.tabActive]} onPress={() => onSwitchCat(c.key)}>
                {c.icon(active ? "#22A652" : themeColors.textSubtle)}
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t(c.label)}</Text>
                {count > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{count}</Text></View>}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <Pressable key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]} onPress={() => onSetFilter(f.key)}>
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{t(f.label)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.markAllBtn} onPress={onMarkAllRead}>
            <Text style={styles.markAllBtnText}>{t("تحديد الكل")}</Text>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(_, i) => `${activeCat}-${i}`}
          style={{ flex: expanded ? 1 : undefined, maxHeight: expanded ? undefined : 320 }}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={<Text style={styles.empty}>{t("لا توجد إشعارات")}</Text>}
          renderItem={({ item, index }) => (
            <Pressable style={styles.item} onPress={() => onItemPress(index)}>
              {!item.read && <View style={styles.unreadDot} />}
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.initial}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemText}>
                  <Text style={{ fontWeight: "900" }}>{item.name}</Text> — {item.text}
                </Text>
                <Text style={styles.itemTime}>{item.time}</Text>
              </View>
            </Pressable>
          )}
        />

        <View style={styles.dragHandleWrap} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: {
      position: "absolute", top: 90, left: 16,
      backgroundColor: themeColors.card, borderRadius: 14,
      shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
      borderWidth: 1, borderColor: themeColors.border, overflow: "hidden",
    },
    cardExpanded: {
      position: "absolute", top: 10, left: 10, right: 10, bottom: 10,
      backgroundColor: themeColors.card, borderRadius: 18, overflow: "hidden",
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    headerTitle: { fontSize: 12, fontWeight: "900", color: themeColors.textMuted },
    dragBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: themeColors.border },
    tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 10 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: "#22A652" },
    tabLabel: { fontSize: 10, fontWeight: "800", color: themeColors.textSubtle },
    tabLabelActive: { color: "#22A652" },
    tabBadge: { position: "absolute", top: 4, right: "28%", backgroundColor: "#ef4444", borderRadius: 999, minWidth: 15, paddingHorizontal: 3, alignItems: "center" },
    tabBadgeText: { color: "white", fontSize: 9, fontWeight: "900" },
    toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, gap: 8 },
    filters: { flexDirection: "row", gap: 6 },
    filterChip: { backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
    filterChipActive: { backgroundColor: "#22A652" },
    filterChipText: { fontSize: 10.5, fontWeight: "800", color: themeColors.textMuted },
    filterChipTextActive: { color: "white" },
    markAllBtn: { paddingVertical: 5, paddingHorizontal: 8 },
    markAllBtnText: { fontSize: 10.5, fontWeight: "800", color: "#22A652" },
    item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#22A652" },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#22A652", alignItems: "center", justifyContent: "center" },
    avatarText: { color: "white", fontWeight: "900", fontSize: 13 },
    itemText: { fontSize: 12, color: themeColors.textMuted, lineHeight: 17 },
    itemTime: { fontSize: 10, color: themeColors.textSubtle, marginTop: 2 },
    empty: { textAlign: "center", color: themeColors.textSubtle, fontSize: 12, padding: 24 },
    dragHandleWrap: { alignItems: "center", paddingVertical: 8 },
    dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: themeColors.border },
  });
}
