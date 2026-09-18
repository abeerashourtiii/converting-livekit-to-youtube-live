import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useTheme, ThemePreference } from "../../lib/hooks/useTheme";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = { visible: boolean; onClose: () => void };

const OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: "light", label: "فاتح" },
  { key: "dark", label: "داكن" },
  { key: "system", label: "حسب إعدادات الجهاز" },
];

export function ThemeSelectorModal({ visible, onClose }: Props) {
  const { preference, setPreference } = useTheme();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>{t("العرض")}</Text>
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={styles.row}
            onPress={() => { setPreference(opt.key); onClose(); }}
          >
            <OptionIcon k={opt.key} active={preference === opt.key} />
            <Text style={[styles.rowText, preference === opt.key && styles.rowTextActive]}>{t(opt.label)}</Text>
            {preference === opt.key && (
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

function OptionIcon({ k, active }: { k: ThemePreference; active: boolean }) {
  const themeColors = useThemeColors();
  const c = active ? "#22A652" : themeColors.textSubtle;
  if (k === "light") return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Circle cx={12} cy={12} r={5} /><Path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></Svg>;
  if (k === "dark") return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></Svg>;
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2}><Path d="M4 4h16v12H4z" /><Path d="M8 20h8M12 16v4" /></Svg>;
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
