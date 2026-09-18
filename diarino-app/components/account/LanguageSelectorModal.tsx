import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useLanguage, Language } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = { visible: boolean; onClose: () => void };

// ↔ #7: قايمة اختيار لغة صريحة (العربية / English) بدل زرار تبديل واحد —
// المستخدم شايف الاختيارين التنين ويقدر يختار يفضل على لغته الحالية أو
// يغيّرها، مع علامة صح واضحة بجوار اللغة المستخدمة حاليًا.
const OPTIONS: { key: Language; label: string }[] = [
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

export function LanguageSelectorModal({ visible, onClose }: Props) {
  const { language, changeLanguage, t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>{t("اللغة")}</Text>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={styles.row}
            onPress={() => { changeLanguage(opt.key); onClose(); }}
          >
            <Text style={[styles.rowText, language === opt.key && styles.rowTextActive]}>{opt.label}</Text>
            {language === opt.key && (
              <View style={styles.checkIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2.5}>
                  <Path d="M20 6L9 17l-5-5" />
                </Svg>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    card: {
      position: "absolute", top: 90, left: 16, minWidth: 240,
      backgroundColor: themeColors.card, borderRadius: 14, paddingVertical: 8,
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
      borderWidth: 1, borderColor: themeColors.border,
    },
    title: { fontSize: 12, fontWeight: "900", color: themeColors.textSubtle, paddingHorizontal: 14, paddingVertical: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
    rowText: { fontSize: 13, fontWeight: "700", color: themeColors.textMuted },
    rowTextActive: { color: "#22A652", fontWeight: "900" },
    checkIcon: { marginLeft: "auto" },
  });
}
