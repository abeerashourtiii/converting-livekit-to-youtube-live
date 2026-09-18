import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { PROVINCES } from "../../data/locations";
import { FormInput } from "./FormControls";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function ProvinceAutocomplete({
  value, onChange, error,
}: { value: string; onChange: (v: string) => void; error?: boolean }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    if (!value.trim()) return PROVINCES.slice(0, 6);
    return PROVINCES.filter((p) => p.includes(value.trim())).slice(0, 6);
  }, [value]);

  return (
    <View>
      <FormInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={t("اختر المحافظة")}
        error={error}
      />
      {focused && suggestions.length > 0 && (
        <View style={styles.list}>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              style={styles.row}
              onPressIn={() => { onChange(s); setFocused(false); }}
            >
              <Text style={styles.rowText}>{t(s)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    list: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" },
    row: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    rowText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "700" },
  });
}
