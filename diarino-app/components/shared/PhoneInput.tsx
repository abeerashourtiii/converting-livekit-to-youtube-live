import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CountryPickerModal } from "./CountryPickerModal";
import { Country, findCountry, flagEmoji } from "../../lib/countries";
import { formatAsYouType, getLastSelectedCountry, saveLastSelectedCountry } from "../../lib/phone";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export type PhoneInputValue = {
  countryIso2: string;
  localNumber: string; // الرقم زي ما هو مكتوب في الحقل (منسّق، بدون كود الدولة)
};

type Props = {
  value: PhoneInputValue;
  onChange: (value: PhoneInputValue) => void;
  error?: boolean;
  placeholder?: string;
};

// ↔ الميزة الدولية لإدخال رقم الهاتف — الحقل الكامل (زر اختيار الدولة +
// حقل الرقم المحلي بتنسيق تلقائي). راجع تعليقات lib/countries.ts و
// lib/phone.ts لأسباب اختيار libphonenumber-js فقط بدون مكتبات UI إضافية.
//
// ملاحظة استخدام: أول ما المكوّن ده يتركّب ولسه country.code فاضي في الـ
// value الجاية من الشاشة الأب، بيحمّل آخر دولة محفوظة (أو المكتشفة من
// الجهاز) تلقائيًا عبر getLastSelectedCountry() ويبلّغ الأب بيها عبر
// onChange — فالشاشة الأب مش محتاجة تطبّق منطق الاكتشاف بنفسها.
export function PhoneInput({ value, onChange, error, placeholder = "١٠ ١٢٣٤ ٥٦٧" }: Props) {
  const { language } = useLanguage();
  const isAr = language !== "en";
  const [pickerVisible, setPickerVisible] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  useEffect(() => {
    if (value.countryIso2) return;
    let cancelled = false;
    getLastSelectedCountry().then((iso2) => {
      if (!cancelled) onChange({ countryIso2: iso2, localNumber: value.localNumber });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.countryIso2]);

  const country = findCountry(value.countryIso2);

  function handleSelectCountry(next: Country) {
    onChange({ countryIso2: next.code, localNumber: value.localNumber });
    saveLastSelectedCountry(next.code);
    setPickerVisible(false);
  }

  function handleChangeNumber(text: string) {
    const formatted = value.countryIso2 ? formatAsYouType(text, value.countryIso2) : text;
    onChange({ countryIso2: value.countryIso2, localNumber: formatted });
  }

  return (
    <>
      <View style={[styles.wrap, error && styles.wrapError]}>
        <Pressable style={styles.countryBtn} onPress={() => setPickerVisible(true)}>
          <Text style={styles.flag}>{country ? flagEmoji(country.code) : "🌐"}</Text>
          <Text style={styles.callingCode}>+{country?.callingCode ?? "--"}</Text>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={themeColors.textSubtle} strokeWidth={2.5}>
            <Path d="M6 9l6 6 6-6" />
          </Svg>
        </Pressable>
        <View style={styles.divider} />
        <TextInput
          style={[styles.input, isAr && { textAlign: "right" }]}
          value={value.localNumber}
          onChangeText={handleChangeNumber}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textSubtle}
          keyboardType="number-pad"
          maxLength={20}
        />
      </View>

      <CountryPickerModal
        visible={pickerVisible}
        selectedCode={value.countryIso2}
        onSelect={handleSelectCountry}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border, borderRadius: 12,
    },
    wrapError: { borderColor: "#ef4444" },
    countryBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 12 },
    flag: { fontSize: 18 },
    callingCode: { fontSize: 13.5, color: themeColors.text, fontWeight: "700" },
    divider: { width: 1, alignSelf: "stretch", backgroundColor: themeColors.border, marginVertical: 8 },
    input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 13.5, color: themeColors.text },
  });
}
