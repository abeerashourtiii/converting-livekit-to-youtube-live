import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, TextInput, Alert, Animated } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useSubmitReport, ReportTargetType } from "../../lib/hooks/useReports";
import { showToast } from "./Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { useDragToClose } from "../../lib/hooks/useDragToClose";

type Props = {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
  // ↔ the long-press "الإبلاغ عن المحتوى" flow from a reel/live/request
  // card in a feed — reason only, no link attached or required, per the
  // product requirement that distinguishes it from the full report flow
  // reachable from the content's own detail screen (which always attaches
  // its link and requires a copy of it).
  quickMode?: boolean;
};

// ↔ #2 (سبب إبلاغ جديد): "انتهاك حقوق النشر والطبع" — reports.reason
// عمود نص حر (text not null, من غير enum/CHECK constraint، شوف
// 20260801000000_admin_backend.sql) فمفيش أي migration مطلوبة عشان القيمة
// الجديدة دي تتخزن — بتتبعت وتتحفظ زي أي سبب تاني بالظبط، وبتظهر صح فى
// لوحة الأدمن (AdminSupport.tsx بيعرض r.reason كنص عادي من غير أي تحويل).
const REASONS = [
  "محتوى مخالف", "معلومات مضللة أو غير صحيحة", "محاولة احتيال", "محتوى غير لائق",
  "انتهاك حقوق النشر والطبع", "سبب آخر",
];

function linkFor(targetType: ReportTargetType, targetId: string): string {
  if (targetType === "property") return `https://diarino.app/property/${targetId}`;
  if (targetType === "request") return `https://diarino.app/requests?id=${targetId}`;
  return `https://diarino.app/live/replay/${targetId}`;
}

// ↔ the report entry point that was missing everywhere until now — the
// public.reports table + admin support center existed since
// 20260802000000_notifications_backend.sql / 20260815000000_support_center.sql,
// but nothing could actually create a row in it. In full mode the
// content's link is mandatory and gets copied into the submitted reason
// alongside the person's own text; in quickMode (long-press) it's skipped
// entirely — reason only, nothing else attached.
export function ReportModal({ visible, onClose, targetType, targetId, targetTitle, quickMode = false }: Props) {
  const { t } = useLanguage();
  const [reason, setReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [copied, setCopied] = useState(false);
  const submitReport = useSubmitReport();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { translateY, backdropOpacity, panHandlers } = useDragToClose(onClose);
  if (!visible) return null;

  const link = linkFor(targetType, targetId);

  const finalReason = reason === "سبب آخر" ? customReason.trim() : reason;

  async function copyLink() {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    showToast(t("✓ تم نسخ الرابط"));
  }

  async function submit() {
    if (!finalReason) return;
    // ↔ "مع ارسال نسخ لينك الشيء الذى يتم الابلاغ عنه اجباري" — the
    // reports table has no dedicated link column, so in full mode the
    // link rides along inside the submitted reason text itself, making
    // it something that's actually sent to the admin, not just shown.
    const submittedReason = quickMode ? finalReason : `${finalReason}\n\nرابط المحتوى: ${link}`;
    try {
      await submitReport.mutateAsync({ targetType, targetId, targetTitle, reason: submittedReason });
      onClose();
      setReason(null);
      setCustomReason("");
      setCopied(false);
      Alert.alert(t("تم الإرسال"), t("شكرًا، تم استلام بلاغك وسيتم مراجعته."));
    } catch (err) {
      Alert.alert(t("حدث خطأ"), t("تعذر إرسال البلاغ، حاول مرة أخرى."));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]} {...panHandlers}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t("الإبلاغ عن هذا المحتوى")}</Text>

        <View style={{ gap: 8, marginTop: 12 }}>
          {REASONS.map((r) => (
            <Pressable key={r} style={[styles.reasonRow, reason === r && styles.reasonRowActive]} onPress={() => setReason(r)}>
              <View style={[styles.radio, reason === r && styles.radioActive]} />
              {/* ↔ #2: أيقونة © مميّزة بجانب سبب "انتهاك حقوق النشر والطبع"
                  تحديدًا، عشان يتضح بصريًا وسط باقي الأسباب. */}
              {r === "انتهاك حقوق النشر والطبع" && <Text style={styles.copyrightIcon}>©️</Text>}
              <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{t(r)}</Text>
            </Pressable>
          ))}
        </View>

        {reason === "سبب آخر" && (
          <TextInput
            style={styles.input}
            placeholder={t("اكتب السبب باختصار")}
            placeholderTextColor={themeColors.textSubtle}
            value={customReason}
            onChangeText={setCustomReason}
            multiline
            maxLength={300}
          />
        )}

        {!quickMode && (
          <Pressable style={[styles.linkNote, copied && styles.linkNoteCopied]} onPress={copyLink}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={copied ? "#22A652" : themeColors.textSubtle} strokeWidth={2}>
              <Path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1" /><Path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1" />
            </Svg>
            <Text style={[styles.linkNoteText, copied && styles.linkNoteTextCopied]} numberOfLines={1}>{link}</Text>
            <Text style={[styles.copyHint, copied && styles.linkNoteTextCopied]}>{copied ? t("تم النسخ") : t("نسخ")}</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.submitBtn, (!finalReason || (!quickMode && !copied)) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!finalReason || (!quickMode && !copied) || submitReport.isPending}
        >
          <Text style={styles.submitBtnText}>{submitReport.isPending ? t("جاري الإرسال...") : t("إرسال البلاغ")}</Text>
        </Pressable>
        {!quickMode && !copied && (
          <Text style={styles.copyRequiredHint}>{t("انسخ رابط المحتوى أولًا لإرسال البلاغ")}</Text>
        )}
      </Animated.View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: themeColors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center", marginBottom: 14 },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text, textAlign: "center" },
    reasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: themeColors.surface },
    reasonRowActive: { backgroundColor: themeColors.isDark ? "rgba(153,27,27,0.25)" : "#FEF2F2" },
    radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: themeColors.border },
    radioActive: { borderColor: "#991B1B", backgroundColor: "#991B1B" },
    reasonText: { fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted },
    reasonTextActive: { color: "#991B1B", fontWeight: "900" },
    copyrightIcon: { fontSize: 13, marginRight: -2 },
    input: { marginTop: 10, minHeight: 60, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, padding: 10, fontSize: 12.5, textAlignVertical: "top", color: themeColors.text },
    linkNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, backgroundColor: themeColors.surface, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: themeColors.border },
    linkNoteCopied: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ecfdf5", borderColor: "#22A652" },
    linkNoteText: { flex: 1, fontSize: 10.5, color: themeColors.textSubtle },
    linkNoteTextCopied: { color: "#22A652" },
    copyHint: { fontSize: 10.5, fontWeight: "900", color: themeColors.textSubtle },
    copyRequiredHint: { textAlign: "center", fontSize: 10.5, color: themeColors.textSubtle, marginTop: 6 },
    submitBtn: { marginTop: 16, backgroundColor: "#991B1B", borderRadius: 999, paddingVertical: 13, alignItems: "center" },
    submitBtnDisabled: { backgroundColor: themeColors.isDark ? "#3f3f46" : "#d1d5db" },
    submitBtnText: { color: "white", fontWeight: "900", fontSize: 13 },
  });
}
