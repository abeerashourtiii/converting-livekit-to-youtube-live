import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SearchFilters } from "./SearchFilterModal";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ "نبّهني" — saves the search screen's *current* filter criteria
// (province/type/max price) as a standing public.saved_search_alerts row,
// plus an optional finish-type text field the search filters don't track.
// Kept as its own small modal rather than extending SearchFilterModal —
// this only ever needs a one-line summary + one extra field, not the
// full filter-editing UI.
type Props = {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onSave: (finishType: string) => Promise<void>;
};

export function SaveAlertModal({ visible, onClose, filters, onSave }: Props) {
  const { t } = useLanguage();
  const [finishType, setFinishType] = useState("");
  const [saving, setSaving] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!visible) return null;

  const summary = [
    filters.provinces.length ? filters.provinces.join("، ") : t("أي محافظة"),
    filters.type !== "all" ? t(filters.type) : t("أي نوع"),
    Number.isFinite(filters.priceMax) ? `${t("حتى")} ${filters.priceMax.toLocaleString("en-US")} ${t("ج.م")}` : t("بدون حد سعر"),
  ].join(" · ");

  async function save() {
    setSaving(true);
    try {
      await onSave(finishType.trim());
      showToast(t("🔔 هنبعتلك إشعار لما عقار مطابق يتاح"));
      setFinishType("");
      onClose();
    } catch {
      showToast(t("تعذر حفظ التنبيه، حاول مرة أخرى"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>{t("نبّهني لما يتاح عقار مطابق")}</Text>
        <Text style={styles.summary}>{summary}</Text>

        <Text style={styles.label}>{t("فئة التشطيب (اختياري)")}</Text>
        <TextInput
          style={styles.input}
          value={finishType}
          onChangeText={setFinishType}
          placeholder={t("بدون تشطيب / نص تشطيب / لوكس / سوبر لوكس")}
          placeholderTextColor={themeColors.textSubtle}
        />

        <View style={styles.actions}>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>{t("إلغاء")}</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? t("جاري الحفظ...") : t("احفظ التنبيه")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
    card: {
      position: "absolute", left: 20, right: 20, top: "30%",
      backgroundColor: themeColors.card, borderRadius: 16, padding: 18,
    },
    title: { fontSize: 14.5, fontWeight: "900", color: themeColors.text, textAlign: "center" },
    summary: { fontSize: 12, color: themeColors.textSubtle, textAlign: "center", marginTop: 8, lineHeight: 18 },
    label: { fontSize: 11.5, fontWeight: "800", color: themeColors.textMuted, marginTop: 16, marginBottom: 6 },
    input: { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: themeColors.text },
    actions: { flexDirection: "row", gap: 10, marginTop: 18 },
    cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: themeColors.surface },
    cancelBtnText: { fontSize: 12.5, fontWeight: "800", color: themeColors.textMuted },
    saveBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: "#22A652" },
    saveBtnText: { fontSize: 12.5, fontWeight: "900", color: "white" },
  });
}
