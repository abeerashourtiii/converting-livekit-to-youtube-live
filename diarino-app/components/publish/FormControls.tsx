import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from "react-native";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function FormLabel({ text, required, optional }: { text: string; required?: boolean; optional?: boolean }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <Text style={styles.label}>
      {t(text)}
      {required && <Text style={styles.required}> *</Text>}
      {optional && <Text style={styles.optional}> {t("(اختياري)")}</Text>}
    </Text>
  );
}

export function FormError({ text, show }: { text: string; show: boolean }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  if (!show) return null;
  return <Text style={styles.error}>{t(text)}</Text>;
}

export function FormInput(props: TextInputProps & { error?: boolean }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const { error, style, placeholder, ...rest } = props;
  return (
    <TextInput
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={themeColors.textSubtle}
      placeholder={placeholder ? t(placeholder) : placeholder}
      {...rest}
    />
  );
}

export function ChipRow<T extends string>({
  options, value, onChange, labels,
}: { options: T[]; value: T | ""; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable key={opt} style={value === opt ? styles.chipActive : styles.chip} onPress={() => onChange(opt)}>
          <Text style={value === opt ? styles.chipActiveText : styles.chipText}>{t(labels?.[opt] ?? opt)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MultiChipRow({
  options, values, onToggle,
}: { options: { key: string; label: string }[]; values: Set<string>; onToggle: (key: string) => void }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable key={opt.key} style={values.has(opt.key) ? styles.chipActive : styles.chip} onPress={() => onToggle(opt.key)}>
          <Text style={values.has(opt.key) ? styles.chipActiveText : styles.chipText}>{t(opt.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function HelpBox({ title, children }: { title: string; children: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  return (
    <View style={styles.helpBox}>
      <Text style={styles.helpTitle}>{t(title)}</Text>
      <Text style={styles.helpText}>{t(children)}</Text>
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    label: { fontSize: 12.5, fontWeight: "800", color: themeColors.textMuted, marginTop: 16, marginBottom: 6 },
    required: { color: "#ef4444" },
    optional: { color: themeColors.textSubtle, fontWeight: "700", fontSize: 11 },
    error: { color: "#ef4444", fontSize: 11, marginTop: 4 },
    input: { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 13.5, color: themeColors.text },
    inputError: { borderColor: "#ef4444" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: themeColors.surface, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    chipText: { fontSize: 12, fontWeight: "800", color: themeColors.textMuted },
    chipActive: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
    chipActiveText: { fontSize: 12, fontWeight: "800", color: "white" },
    helpBox: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.15)" : "#ECFDF5", borderRadius: 12, padding: 12, marginBottom: 4 },
    helpTitle: { fontSize: 12.5, fontWeight: "900", color: themeColors.isDark ? "#6EE7B7" : "#065F46", marginBottom: 4 },
    helpText: { fontSize: 11.5, color: themeColors.isDark ? "#6EE7B7" : "#047857", lineHeight: 17 },
  });
}
