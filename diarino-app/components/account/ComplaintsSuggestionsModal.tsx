import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, TextInput, Alert } from "react-native";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useSubmitSuggestion } from "../../lib/hooks/useReports";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = { visible: boolean; onClose: () => void };

// ↔ "الشكاوى والمقترحات" in the settings menu. Reporting a SPECIFIC ad/
// reel/live has its own dedicated report button right on that content's
// own screen (components/shared/ReportModal.tsx, on property details /
// live viewer / live replay) — a general settings screen isn't the right
// place to go hunting back down whatever you wanted to report. This is
// just the free-text suggestion box.
export function ComplaintsSuggestionsModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const submitSuggestion = useSubmitSuggestion();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!visible) return null;

  async function submit() {
    if (!text.trim()) return;
    try {
      await submitSuggestion.mutateAsync(text.trim());
      setText("");
      onClose();
      Alert.alert(t("تم الإرسال"), t("شكرًا لاقتراحك!"));
    } catch (err) {
      Alert.alert(t("حدث خطأ"), t("تعذر إرسال الاقتراح، حاول مرة أخرى."));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>{t("الشكاوى والمقترحات")}</Text>
        <Text style={styles.hint}>
          {t("لو حابب تبلّغ عن إعلان أو ريل أو بث معين، استخدم زر \"الإبلاغ\" الموجود مباشرة على نفس المحتوى. الصندوق ده للاقتراحات العامة بس.")}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={t("اكتب اقتراحك أو ملاحظتك هنا...")}
          placeholderTextColor={themeColors.textSubtle}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={[styles.submitBtn, !text.trim() && styles.submitBtnDisabled]} onPress={submit} disabled={!text.trim() || submitSuggestion.isPending}>
          <Text style={styles.submitBtnText}>{submitSuggestion.isPending ? t("جاري الإرسال...") : t("إرسال")}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: {
      position: "absolute", top: 90, left: 16, right: 16,
      backgroundColor: themeColors.card, borderRadius: 16, padding: 18,
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
      borderWidth: 1, borderColor: themeColors.border,
    },
    title: { fontSize: 14, fontWeight: "900", color: themeColors.text, textAlign: "center" },
    hint: { fontSize: 11, color: themeColors.textSubtle, textAlign: "center", marginTop: 8, lineHeight: 17 },
    input: { marginTop: 14, minHeight: 90, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, padding: 10, fontSize: 12.5, textAlignVertical: "top", color: themeColors.text },
    submitBtn: { marginTop: 14, backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
    submitBtnDisabled: { backgroundColor: themeColors.isDark ? "#3f3f46" : "#d1d5db" },
    submitBtnText: { color: "white", fontWeight: "900", fontSize: 13 },
  });
}
