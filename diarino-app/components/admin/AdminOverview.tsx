import { View, Text, StyleSheet } from "react-native";
import { useAdminDB } from "../../lib/hooks/useAdminDB";
import { SimpleBarChart } from "./SimpleBarChart";
import { SimpleDonutChart } from "./SimpleDonutChart";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

const DAY_LABELS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // last 7 calendar days ending today, oldest first
const DONUT_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export function AdminOverview() {
  const db = useAdminDB();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const approvedCount = db.reels.filter((r) => r.status === "approved").length;
  const totalViews = db.reels.reduce((a, b) => a + b.views, 0);
  const totalWa = db.reels.reduce((a, b) => a + b.wa, 0);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.statsGrid}>
        <StatCard icon="🎬" bg="#6366f1" title="ريلز منشورة" value={approvedCount.toLocaleString("ar-EG")} />
        <StatCard icon="👁️" bg="#10b981" title="إجمالي المشاهدات" value={totalViews.toLocaleString("ar-EG")} />
        <StatCard icon="📢" bg="#f59e0b" title="إعلانات منشورة" value={approvedCount.toLocaleString("ar-EG")} />
        <StatCard icon="💬" bg="#25d366" title="تحويلات واتساب" value={totalWa.toLocaleString("ar-EG")} />
        <StatCard icon="🚩" bg="#ec4899" title="بلاغات مفتوحة" value={db.reports.length.toLocaleString("ar-EG")} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>إعلانات جديدة يوميًا (آخر ٧ أيام)</Text>
        <SimpleBarChart values={db.analytics.dailyListings} labels={DAY_LABELS} color="#6366f1" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>توزيع العقارات حسب النوع</Text>
        {db.analytics.typeDistribution.length > 0 ? (
          <SimpleDonutChart
            slices={db.analytics.typeDistribution.map((t, i) => ({
              label: t.label, value: t.value, color: DONUT_COLORS[i % DONUT_COLORS.length],
            }))}
          />
        ) : (
          <Text style={styles.emptyText}>لا توجد إعلانات بعد</Text>
        )}
      </View>
    </View>
  );
}

function StatCard({ icon, bg, title, value }: { icon: string; bg: string; title: string; value: string }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: { width: "47%", backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    statTitle: { fontSize: 11.5, color: themeColors.textSubtle, fontWeight: "700", marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: "900", color: themeColors.text },
    card: { backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13.5, fontWeight: "900", color: themeColors.text, marginBottom: 12 },
    emptyText: { fontSize: 12, color: themeColors.textSubtle, textAlign: "center", paddingVertical: 14 },
  });
}
