import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useAdminDB, deleteReel, deleteLive, deleteRequest, resolveReport } from "../../lib/hooks/useAdminDB";
import { useAdminAdContacts, useDismissAdContact } from "../../lib/hooks/useAdContacts";
import { useAdminSuggestions, useDismissSuggestion } from "../../lib/hooks/useReports";
import { useAdminSupportContacts, useDismissSupportContact } from "../../lib/hooks/useSupportMessages";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ replaces the old standalone "الإبلاغات" page (AdminReports.tsx) with
// a unified "الدعم" center, per the product requirement to split support
// into four sections: ad-space contacts, content reports (reel/live/
// request), suggestions, and "تواصل معنا" contact requests. All four
// share the same admin_has_permission('reports') gate at the DB level
// (20260815000000_support_center.sql), so one admin permission grant
// covers the whole center.
type SupportTab = "reports" | "ads" | "suggestions" | "contact";

const TABS: { key: SupportTab; label: string }[] = [
  { key: "reports", label: "البلاغات" },
  { key: "ads", label: "الإعلانات" },
  { key: "suggestions", label: "المقترحات" },
  { key: "contact", label: "تواصل معنا" },
];

export function AdminSupport() {
  const [tab, setTab] = useState<SupportTab>("reports");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tabChip, tab === t.key && styles.tabChipActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabChipText, tab === t.key && styles.tabChipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "reports" && <ReportsTab />}
      {tab === "ads" && <AdsTab />}
      {tab === "suggestions" && <SuggestionsTab />}
      {tab === "contact" && <ContactTab />}
    </View>
  );
}

// ---------------------------------------------------------------------
// البلاغات — content reports (reel/property, live, request)
// ---------------------------------------------------------------------
const TARGET_LABEL: Record<string, string> = { property: "ريل / إعلان", live: "بث مباشر", request: "طلب" };

function ReportsTab() {
  const db = useAdminDB();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  function dismiss(id: string) {
    resolveReport(id);
    showToast("✓ تم تجاهل البلاغ");
  }
  // ↔ dispatches by targetType — a report can be on a reel/listing, a
  // live, or a request, and each lives in its own table.
  async function removeContent(id: string, targetId: string, targetType: string) {
    if (targetType === "live") await deleteLive(targetId);
    else if (targetType === "request") await deleteRequest(targetId);
    else await deleteReel(targetId);
    resolveReport(id);
    showToast("🗑️ تم حذف المحتوى المُبلَّغ عنه");
  }

  if (db.reports.length === 0) {
    return <Text style={styles.empty}>لا توجد بلاغات مفتوحة</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      {db.reports.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: r.targetColor }]} />
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{r.target}</Text>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{TARGET_LABEL[r.targetType] ?? r.targetType}</Text>
              </View>
            </View>
            <Text style={styles.sub} numberOfLines={2}>السبب: {r.reason}</Text>
            <Text style={styles.sub}>المُبلِّغ: {r.reporter} · {r.count} بلاغ · {r.date}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => dismiss(r.id)}>
              <Text style={[styles.actionBtnText, { color: themeColors.textMuted }]}>تجاهل</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.isDark ? "#334155" : "#0f172a" }]} onPress={() => removeContent(r.id, r.targetId, r.targetType)}>
              <Text style={[styles.actionBtnText, { color: "white" }]}>حذف المحتوى</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------
// الإعلانات — ad-space (banner) contacts
// ---------------------------------------------------------------------
function AdsTab() {
  const { data, isLoading } = useAdminAdContacts();
  const dismiss = useDismissAdContact();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (isLoading) return <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />;
  if (!data?.length) return <Text style={styles.empty}>لا يوجد تواصل عبر المساحة الإعلانية بعد</Text>;

  return (
    <View style={{ gap: 10 }}>
      {data.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: "#312e81" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{c.bannerTitle}</Text>
            <Text style={styles.sub}>{c.userName} · {c.date}</Text>
          </View>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => dismiss.mutate(c.id)}>
            <Text style={[styles.actionBtnText, { color: themeColors.textMuted }]}>تجاهل</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------
// المقترحات
// ---------------------------------------------------------------------
function SuggestionsTab() {
  const { data, isLoading } = useAdminSuggestions();
  const dismiss = useDismissSuggestion();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (isLoading) return <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />;
  if (!data?.length) return <Text style={styles.empty}>لا توجد مقترحات بعد</Text>;

  return (
    <View style={{ gap: 10 }}>
      {data.map((s) => (
        <View key={s.id} style={styles.rowStacked}>
          <Text style={styles.suggestionText}>{s.text}</Text>
          <View style={styles.rowStackedFooter}>
            <Text style={styles.sub}>{s.userName} · {s.date}</Text>
            <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => dismiss.mutate(s.id)}>
              <Text style={[styles.actionBtnText, { color: themeColors.textMuted }]}>تجاهل</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------
// تواصل معنا
// ---------------------------------------------------------------------
function ContactTab() {
  const { data, isLoading } = useAdminSupportContacts();
  const dismiss = useDismissSupportContact();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (isLoading) return <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />;
  if (!data?.length) return <Text style={styles.empty}>لا يوجد طلبات تواصل بعد</Text>;

  return (
    <View style={{ gap: 10 }}>
      {data.map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: "#22A652" }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{c.userName}</Text>
            <Text style={styles.sub}>تواصل عبر واتساب من صفحة الإعدادات · {c.date}</Text>
          </View>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => dismiss.mutate(c.id)}>
            <Text style={[styles.actionBtnText, { color: themeColors.textMuted }]}>تجاهل</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    tabsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tabChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: themeColors.surface },
    tabChipActive: { backgroundColor: themeColors.isDark ? "#334155" : "#0f172a" },
    tabChipText: { fontSize: 12, fontWeight: "800", color: themeColors.textMuted },
    tabChipTextActive: { color: "white" },
    empty: { textAlign: "center", color: themeColors.textSubtle, fontSize: 13, padding: 30 },
    row: { flexDirection: "row", gap: 10, backgroundColor: themeColors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: themeColors.border },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
    typeBadge: { backgroundColor: themeColors.isDark ? "rgba(99,102,241,0.18)" : "#eef2ff", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
    typeBadgeText: { fontSize: 9.5, fontWeight: "900", color: "#4338ca" },
    rowStacked: { backgroundColor: themeColors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: themeColors.border, gap: 8 },
    rowStackedFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    suggestionText: { fontSize: 12.5, color: themeColors.text, lineHeight: 19 },
    thumb: { width: 44, height: 56, borderRadius: 8 },
    title: { fontSize: 12.5, fontWeight: "900", color: themeColors.text, marginBottom: 3 },
    sub: { fontSize: 11, color: themeColors.textSubtle },
    actions: { justifyContent: "center", gap: 6 },
    actionBtn: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8 },
    actionBtnText: { fontSize: 10.5, fontWeight: "800" },
  });
}
