import { View, Text, StyleSheet, FlatList } from "react-native";
import { useUserActivityLog } from "../../lib/hooks/useAuditLogs";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function AdminUserActivityLog() {
  const { data: entries = [], isLoading } = useUserActivityLog();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>سجل نشاط المستخدمين</Text>
      <Text style={styles.cardSubtitle}>تسجيلات الدخول وتغييرات الأدوار، مع الوقت والمستخدم</Text>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        scrollEnabled={false}
        ListEmptyComponent={!isLoading ? <Text style={styles.emptyText}>لا يوجد نشاط مسجّل بعد</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.type}>
                {item.activityType === "login" ? "🔑 تسجيل دخول" : "🛡️ تغيير دور"}
              </Text>
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString("ar-EG")}</Text>
            </View>
            <Text style={styles.user}>{item.userName || "مستخدم محذوف"}</Text>
            {item.activityType === "role_change" && !!item.details && (
              <Text style={styles.details}>
                {item.details.action === "granted_admin"
                  ? `مُنح صلاحية أدمن (بواسطة ${item.details.by || "—"})`
                  : `أُزيلت صلاحية الأدمن (بواسطة ${item.details.by || "—"})`}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: themeColors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13, fontWeight: "900", color: themeColors.text },
    cardSubtitle: { fontSize: 11, color: themeColors.textSubtle, marginTop: 2, marginBottom: 10 },
    emptyText: { textAlign: "center", color: themeColors.textSubtle, fontSize: 12, paddingVertical: 16 },
    row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: themeColors.border },
    rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    type: { fontSize: 12.5, fontWeight: "900", color: themeColors.text },
    time: { fontSize: 10.5, color: themeColors.textSubtle },
    user: { fontSize: 11.5, color: "#6366f1", fontWeight: "700", marginTop: 3 },
    details: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 4 },
  });
}
