import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useRegionSuggestions, useRememberRegion } from "../../lib/hooks/useKnownRegions";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = {
  province: string | undefined;
  selected: string[];
  onChange: (next: string[]) => void;
};

// ↔ "يظهر استكمال مقترح فى نفس الخانة، واذا كتب اسم منطقة لم يكن فى
// الذاكرة احتفظ باسمها" — autocomplete suggestions while typing, and any
// genuinely new name gets remembered (lib/hooks/useKnownRegions.ts) so
// it's suggested to everyone from then on.
export function RegionAutocompleteField({ province, selected, onChange }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const suggestions = useRegionSuggestions(province, query);
  const rememberRegion = useRememberRegion();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  function addRegion(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) onChange([...selected, trimmed]);
    if (province) rememberRegion.mutate({ province, name: trimmed });
    setQuery("");
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onSubmitEditing={() => addRegion(query)}
        placeholder={t("اكتب اسم المنطقة أو الكمبوند...")}
        placeholderTextColor={themeColors.textSubtle}
        returnKeyType="done"
      />
      {focused && (suggestions.length > 0 || query.trim().length > 0) && (
        <View style={styles.list}>
          {suggestions.filter((s) => !selected.includes(s)).map((s) => (
            <Pressable key={s} style={styles.row} onPress={() => addRegion(s)}>
              <Text style={styles.rowText}>{t(s)}</Text>
            </Pressable>
          ))}
          {query.trim().length > 0 && !suggestions.includes(query.trim()) && (
            <Pressable style={styles.row} onPress={() => addRegion(query)}>
              <Text style={styles.rowTextNew}>{t("إضافة")} "{query.trim()}"</Text>
            </Pressable>
          )}
        </View>
      )}
      {selected.length > 0 && (
        <View style={styles.chipsRow}>
          {selected.map((r) => (
            <Pressable key={r} style={styles.chipActive} onPress={() => onChange(selected.filter((x) => x !== r))}>
              <Text style={styles.chipActiveText}>{t(r)} ×</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    input: { borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, color: themeColors.text },
    list: { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" },
    row: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    rowText: { fontSize: 13, color: themeColors.textMuted, fontWeight: "700" },
    rowTextNew: { fontSize: 13, color: "#22A652", fontWeight: "900" },
    chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    chipActive: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
    chipActiveText: { color: "white", fontWeight: "800", fontSize: 12.5 },
  });
}
