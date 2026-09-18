import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ visible, title, text, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{t("إلغاء")}</Text>
          </Pressable>
          <Pressable style={[styles.confirmBtn, danger && styles.confirmBtnDanger]} onPress={onConfirm}>
            <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    card: {
      position: "absolute", left: 24, right: 24, top: "38%",
      backgroundColor: themeColors.card, borderRadius: 18, padding: 20,
    },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text, marginBottom: 8, textAlign: "center" },
    text: { fontSize: 12.5, color: themeColors.textSubtle, lineHeight: 19, textAlign: "center", marginBottom: 18 },
    actionsRow: { flexDirection: "row", gap: 10 },
    cancelBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: themeColors.border },
    cancelBtnText: { fontSize: 13, fontWeight: "900", color: themeColors.textMuted },
    confirmBtn: { flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: "center", backgroundColor: "#22A652" },
    confirmBtnDanger: { backgroundColor: "#ef4444" },
    confirmBtnText: { fontSize: 13, fontWeight: "900", color: "white" },
  });
}
