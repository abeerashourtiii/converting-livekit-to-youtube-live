import { memo, useCallback } from "react";
import { router } from "expo-router";
import { View, Text, Pressable, FlatList, StyleSheet, Switch, Alert } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSavedSearchAlerts, SavedSearchAlert } from "../lib/hooks/useSavedSearchAlerts";
import { useLanguage } from "../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../lib/hooks/useThemeColors";

function summaryFor(a: SavedSearchAlert, t: (s: string) => string): string {
  const parts = [
    a.province || t("أي محافظة"),
    a.type || t("أي نوع"),
    a.priceMax ? `${t("حتى")} ${a.priceMax.toLocaleString("en-US")} ${t("ج.م")}` : null,
    a.finishType,
  ].filter(Boolean);
  return parts.join(" · ");
}

// ↔ perf audit fix #2 (applied here per audit follow-up) — extracted +
// memoized row, id/item-parameterized callbacks, same pattern as
// app/(tabs)/index.tsx's ReelCard.
type SavedAlertRowProps = {
  item: SavedSearchAlert;
  onToggleActive: (alertId: string, active: boolean) => void;
  onRemove: (alert: SavedSearchAlert) => void;
};

const SavedAlertRow = memo(function SavedAlertRow({ item, onToggleActive, onRemove }: SavedAlertRowProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summary}>{summaryFor(item, t)}</Text>
      </View>
      <Switch
        value={item.active}
        onValueChange={(v) => onToggleActive(item.id, v)}
        trackColor={{ true: "#22A652" }}
      />
      <Pressable style={styles.deleteBtn} onPress={() => onRemove(item)} hitSlop={6}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2}>
          <Path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
        </Svg>
      </Pressable>
    </View>
  );
});

// ↔ "تنبيهاتي المحفوظة" — manage the standing alerts created from the
// search screen's "نبّهني" button (SaveAlertModal.tsx). Reached from
// settings.tsx.
export default function SavedAlertsScreen() {
  const { alerts, isLoading, toggleActive, removeAlert } = useSavedSearchAlerts();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const confirmRemove = useCallback(
    (alert: SavedSearchAlert) => {
      Alert.alert(t("حذف التنبيه"), t("هل تريد حذف هذا التنبيه؟"), [
        { text: t("إلغاء"), style: "cancel" },
        { text: t("حذف"), style: "destructive", onPress: () => removeAlert(alert.id) },
      ]);
    },
    [t, removeAlert]
  );

  const handleToggleActive = useCallback((alertId: string, active: boolean) => toggleActive(alertId, active), [toggleActive]);

  const renderItem = useCallback(
    ({ item }: { item: SavedSearchAlert }) => (
      <SavedAlertRow item={item} onToggleActive={handleToggleActive} onRemove={confirmRemove} />
    ),
    [handleToggleActive, confirmRemove]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>{t("تنبيهاتي المحفوظة")}</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>{t("لسه معملتش أي تنبيه — احفظ بحث من شاشة البحث بزرار 🔔")}</Text>
          )
        }
        renderItem={renderItem}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: themeColors.border,
    },
    iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    empty: { textAlign: "center", color: themeColors.textSubtle, marginTop: 40, fontSize: 12.5, lineHeight: 20, paddingHorizontal: 20 },
    row: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: themeColors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: themeColors.border,
    },
    summary: { fontSize: 12, fontWeight: "700", color: themeColors.text, lineHeight: 18 },
    deleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: themeColors.isDark ? "rgba(239,68,68,0.15)" : "#fef2f2", alignItems: "center", justifyContent: "center" },
  });
}
