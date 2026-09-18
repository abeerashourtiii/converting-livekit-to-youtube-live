import { useMemo, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { COUNTRIES, COMMON_COUNTRY_CODES, Country, flagEmoji } from "../../lib/countries";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = {
  visible: boolean;
  selectedCode: string;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

type ListRow = { type: "header"; label: string } | { type: "country"; country: Country };

// ↔ الميزة الدولية لإدخال رقم الهاتف — شاشة اختيار الدولة. مكوّن مخصص
// بسيط بدل react-native-country-picker-modal (راجع تعليق lib/countries.ts
// لسبب القرار)، بنفس تصميم باقي الـ modals المشتركة بالتطبيق
// (components/shared/ConfirmModal.tsx وغيره).
export function CountryPickerModal({ visible, selectedCode, onSelect, onClose }: Props) {
  const { t, language } = useLanguage();
  const isAr = language !== "en";
  const [query, setQuery] = useState("");
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const rows = useMemo<ListRow[]>(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      const filtered = COUNTRIES.filter(
        (c) =>
          c.nameAr.includes(q) ||
          c.nameEn.toLowerCase().includes(q) ||
          c.callingCode.includes(q.replace(/^\+/, ""))
      );
      return filtered.map((country) => ({ type: "country", country }));
    }
    const common = COMMON_COUNTRY_CODES.map((code) => COUNTRIES.find((c) => c.code === code)).filter(
      (c): c is Country => !!c
    );
    const rest = COUNTRIES.filter((c) => !COMMON_COUNTRY_CODES.includes(c.code));
    return [
      { type: "header", label: t("الدول الشائعة") },
      ...common.map((country): ListRow => ({ type: "country", country })),
      { type: "header", label: t("كل الدول") },
      ...rest.map((country): ListRow => ({ type: "country", country })),
    ];
  }, [query, t]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </Pressable>
          <Text style={styles.title}>{t("اختر الدولة")}</Text>
          <View style={{ width: 34 }} />
        </View>

        <View style={styles.searchBox}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.textSubtle} strokeWidth={2.2}>
            <Path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
          </Svg>
          <TextInput
            style={[styles.searchInput, isAr && { textAlign: "right" }]}
            placeholder={t("ابحث عن دولة...")}
            placeholderTextColor={themeColors.textSubtle}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={rows}
          keyExtractor={(row, i) => (row.type === "header" ? `h-${row.label}-${i}` : row.country.code)}
          renderItem={({ item }) =>
            item.type === "header" ? (
              <Text style={styles.sectionHeader}>{item.label}</Text>
            ) : (
              <Pressable
                style={[styles.row, item.country.code === selectedCode && styles.rowSelected]}
                onPress={() => onSelect(item.country)}
              >
                <Text style={styles.flag}>{flagEmoji(item.country.code)}</Text>
                <Text style={styles.countryName} numberOfLines={1}>
                  {isAr ? item.country.nameAr : item.country.nameEn}
                </Text>
                <Text style={styles.callingCode}>+{item.country.callingCode}</Text>
              </Pressable>
            )
          }
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
        />
      </View>
    </Modal>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, paddingTop: 54 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.surface },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8,
      backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 13.5, color: themeColors.text },
    sectionHeader: { fontSize: 11.5, fontWeight: "800", color: themeColors.textSubtle, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
    rowSelected: { backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#f0fdf4" },
    flag: { fontSize: 22 },
    countryName: { flex: 1, fontSize: 13.5, color: themeColors.text, fontWeight: "600" },
    callingCode: { fontSize: 13, color: themeColors.textSubtle, fontWeight: "700" },
  });
}
