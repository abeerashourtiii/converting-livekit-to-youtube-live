import { View, Text, StyleSheet } from "react-native";
import { useAdminDB } from "../../lib/hooks/useAdminDB";
import { SimpleBarChart } from "./SimpleBarChart";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ the four hardcoded month stat cards + convChart + topWa + cityBody in
// renderAnalytics() — all four numbers below are now real aggregates
// (lib/hooks/useAdminDB.ts), and the two charts show real daily counts
// (new listings, new signups) over the last 7 days instead of a fixed
// illustrative array. There's no per-view/per-click event log in the
// schema (properties.views/wa_clicks are running counters, not
// timestamped rows), so a genuine "views per day" chart isn't derivable
// yet — these two are the closest real substitute.
export function AdminAnalytics() {
  const db = useAdminDB();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const topWa = [...db.reels].sort((a, b) => b.wa - a.wa).slice(0, 5);
  const { totalViews, totalWaClicks, listingsThisMonth, conversionRate, dailyListings, dailySignups } = db.analytics;

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.statsGrid}>
        <StatCard icon="👁️" bg="#10b981" title="إجمالي المشاهدات" value={totalViews.toLocaleString("ar-EG")} />
        <StatCard icon="📢" bg="#f59e0b" title="إعلانات هذا الشهر" value={listingsThisMonth.toLocaleString("ar-EG")} />
        <StatCard icon="💬" bg="#25d366" title="إجمالي تحويلات واتساب" value={totalWaClicks.toLocaleString("ar-EG")} />
        <StatCard icon="🎯" bg="#6366f1" title="معدل التحويل" value={conversionRate} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>إعلانات جديدة يوميًا (آخر ٧ أيام)</Text>
        <SimpleBarChart values={dailyListings} color="#6366f1" />
        <Text style={[styles.cardTitle, { marginTop: 14 }]}>مستخدمون جدد يوميًا (آخر ٧ أيام)</Text>
        <SimpleBarChart values={dailySignups} color="#25d366" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>الأكثر تحويلاً على واتساب</Text>
        {topWa.map((r, i) => (
          <View key={r.id} style={styles.waRow}>
            <View style={[styles.waRank, { backgroundColor: r.color }]}><Text style={styles.waRankText}>{i + 1}</Text></View>
            <Text style={styles.waTitle} numberOfLines={1}>{r.title}</Text>
            <Text style={styles.waCount}>{r.wa}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>تحليل الإعلانات حسب المدينة</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>المدينة</Text>
          <Text style={styles.th}>إعلانات</Text>
          <Text style={styles.th}>معدل التحويل</Text>
        </View>
        {db.cityStats.map((c) => (
          <View key={c.city} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 2, fontWeight: "900", color: themeColors.text }]}>{c.city}</Text>
            <Text style={styles.td}>{c.ads}</Text>
            <Text style={styles.td}>{c.rate}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatCard({ icon, bg, title, value, delta }: { icon: string; bg: string; title: string; value: string; delta?: string }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {!!delta && <Text style={styles.delta}>{delta}</Text>}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: { width: "47%", backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    statTitle: { fontSize: 11.5, color: themeColors.textSubtle, fontWeight: "700", marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: "900", color: themeColors.text },
    delta: { fontSize: 11, fontWeight: "800", color: "#16a34a", marginTop: 2 },
    card: { backgroundColor: themeColors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: themeColors.border },
    cardTitle: { fontSize: 13.5, fontWeight: "900", color: themeColors.text, marginBottom: 12 },
    waRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    waRank: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    waRankText: { color: "white", fontSize: 11, fontWeight: "900" },
    waTitle: { flex: 1, fontSize: 12, color: themeColors.textMuted, fontWeight: "700" },
    waCount: { fontSize: 12.5, fontWeight: "900", color: "#25d366" },
    tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    th: { flex: 1, fontSize: 10.5, color: themeColors.textSubtle, fontWeight: "800" },
    tableRow: { flexDirection: "row", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    td: { flex: 1, fontSize: 11.5, color: themeColors.textMuted },
  });
}
