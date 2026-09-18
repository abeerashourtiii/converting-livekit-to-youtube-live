import { useMemo, useState } from "react";
import { router, Href } from "expo-router";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAdminDB, setLiveStatus, deleteLive } from "../../lib/hooks/useAdminDB";
import { StatusChip } from "./StatusChip";
import { ConfirmModal } from "../shared/ConfirmModal";
import { showToast } from "../shared/Toast";
import { LiveStatus } from "../../data/mock-admin";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

const FILTERS: { key: "all" | LiveStatus; label: string }[] = [
  { key: "all", label: "الكل" }, { key: "approved", label: "منشورة" }, { key: "pending", label: "قيد المراجعة" },
];

// ↔ recording_status لبث منتهي: "processing"/"failed" مش أخطاء بالنسبة
// للأدمن، ده وضع طبيعي (التسجيل لسه بيتجهز، أو فشل التجهيز فعلاً) —
// نص صغير بيوضّحه بدل ما الأدمن يستغرب اختفاء زرار المشاهدة.
const RECORDING_STATUS_LABEL: Record<string, string> = {
  none: "لا يوجد تسجيل",
  recording: "جاري التسجيل",
  processing: "التسجيل قيد التجهيز",
  failed: "فشل تجهيز التسجيل",
};

export function AdminLives() {
  const db = useAdminDB();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const [filter, setFilter] = useState<"all" | LiveStatus>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ↔ اللايفات المباشرة الآن (broadcastStatus === "live") فوق دايمًا —
  // أهم حاجة للأدمن يشوفها ويتصرف فيها بسرعة (مثلاً لو مخالف وهو لسه
  // بيبث فعليًا)، قبل السجلات المنتهية.
  const rows = useMemo(
    () =>
      db.lives
        .filter((l) => filter === "all" || l.status === filter)
        .sort((a, b) => (a.broadcastStatus === b.broadcastStatus ? 0 : a.broadcastStatus === "live" ? -1 : 1)),
    [db.lives, filter]
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} style={filter === f.key ? styles.chipActive : styles.chip} onPress={() => setFilter(f.key)}>
            <Text style={filter === f.key ? styles.chipActiveText : styles.chipText}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>لا يوجد بث</Text>
      ) : (
        rows.map((l) => (
          <View key={l.id} style={styles.row}>
            <View style={[styles.thumb, { backgroundColor: l.color }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{l.title}</Text>
                {l.broadcastStatus === "live" && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>مباشر الآن</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sub}>{l.host} · {l.duration} · 👁 {l.views.toLocaleString("ar-EG")}</Text>
              {/* ↔ حالة التسجيل — للايف المنتهي بس (بث لسه شغال مفيهوش
                  تسجيل جاهز أصلاً). لو "ready" بيظهر زرار المشاهدة تحت
                  بدل النص ده، عشان محدش يستنى نص وزرار مع بعض. */}
              {l.broadcastStatus === "ended" && l.recordingStatus !== "ready" && (
                <Text style={styles.recordingHint}>
                  {RECORDING_STATUS_LABEL[l.recordingStatus] ?? "لا يوجد تسجيل"}
                </Text>
              )}
              <StatusChip status={l.status} />
            </View>
            <View style={styles.actions}>
              {/* ↔ الإضافة المطلوبة: زرار حقيقي يفتح شاشة التشغيل
                  (app/live/replay/[id].tsx) — نفس الشاشة اللي المستخدم
                  العادي بيشوف بيها إعادة بثه، ومسموح للأدمن يوصلها لأي
                  بث (مش بس بتاعه) بحكم RLS على lives (admin_has_permission
                  ('lives')، شوف useAdminDB.ts). كانت الفجوة إن مفيش زرار
                  أصلاً بيوصّل الأدمن للشاشة دي من لوحة التحكم. */}
              {l.broadcastStatus === "ended" && l.recordingStatus === "ready" && l.recordingUrl && (
                <ActionBtn
                  label="مشاهدة التسجيل"
                  bg="#e0e7ff"
                  fg="#3730a3"
                  onPress={() => router.push(`/live/replay/${l.id}` as Href)}
                />
              )}
              {l.status !== "approved" && (
                <ActionBtn label="قبول" bg="#dcfce7" fg="#166534" onPress={() => { setLiveStatus(l.id, "approved"); showToast("✓ تم التحديث"); }} />
              )}
              <ActionBtn label="إخفاء" bg="#fee2e2" fg="#991b1b" onPress={() => { setLiveStatus(l.id, "pending"); showToast("✓ تم التحديث"); }} />
              <ActionBtn label={l.broadcastStatus === "live" ? "إنهاء وحذف" : "حذف"} bg={themeColors.isDark ? "#334155" : "#0f172a"} fg="white" onPress={() => setConfirmDeleteId(l.id)} />
            </View>
          </View>
        ))
      )}

      <ConfirmModal
        visible={!!confirmDeleteId}
        title="حذف البث"
        text={
          db.lives.find((l) => l.id === confirmDeleteId)?.broadcastStatus === "live"
            ? "هذا البث مباشر الآن — حذفه هينهي جلسته فورًا. متأكد؟"
            : "حذف هذا البث نهائياً؟"
        }
        confirmLabel="حذف"
        danger
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) { deleteLive(confirmDeleteId); showToast("🗑️ تم الحذف"); } setConfirmDeleteId(null); }}
      />
    </View>
  );
}

function ActionBtn({ label, bg, fg, onPress }: { label: string; bg: string; fg: string; onPress: () => void }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Pressable style={[styles.actionBtn, { backgroundColor: bg }]} onPress={onPress}>
      <Text style={[styles.actionBtnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
    chipText: { fontSize: 12, fontWeight: "700", color: themeColors.textMuted },
    chipActive: { backgroundColor: themeColors.isDark ? "#334155" : "#0f172a", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
    chipActiveText: { fontSize: 12, fontWeight: "700", color: "white" },
    empty: { textAlign: "center", color: themeColors.textSubtle, fontSize: 13, padding: 30 },
    row: { flexDirection: "row", gap: 10, backgroundColor: themeColors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: themeColors.border },
    thumb: { width: 56, height: 56, borderRadius: 10 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
    title: { fontSize: 12.5, fontWeight: "900", color: themeColors.text, flexShrink: 1 },
    liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ef4444", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "white" },
    liveBadgeText: { fontSize: 9, fontWeight: "900", color: "white" },
    sub: { fontSize: 11, color: themeColors.textSubtle, marginBottom: 6 },
    recordingHint: { fontSize: 10.5, color: themeColors.textSubtle, fontStyle: "italic", marginBottom: 6 },
    actions: { justifyContent: "center", gap: 6 },
    actionBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
    actionBtnText: { fontSize: 10.5, fontWeight: "800" },
  });
}
