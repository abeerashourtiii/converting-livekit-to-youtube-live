import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useLocationPermission } from "../../lib/hooks/useLocationPermission";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function LocationPermissionGate({ children }: { children: React.ReactNode }) {
  const { granted, denied, checking, request } = useLocationPermission();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (checking) return null;
  if (granted) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={1.6}>
        <Path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
        <Circle cx={12} cy={10} r={3} />
      </Svg>

      <Text style={styles.title}>{t("الوصول إلى الموقع")}</Text>
      <Text style={styles.subtitle}>
        {denied
          ? t("تم رفض الإذن مسبقًا. من فضلك فعّل خدمة الموقع لهذا التطبيق من إعدادات الجهاز للمتابعة.")
          : t("يحتاج ديارينو للوصول لموقعك لعرض العقارات القريبة منك ضمن نطاق تختاره.")}
      </Text>

      {denied ? (
        <Pressable style={styles.primaryBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.primaryBtnText}>{t("فتح الإعدادات")}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.primaryBtn} onPress={request}>
          <Text style={styles.primaryBtnText}>{t("السماح بالوصول")}</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    title: { fontSize: 15, fontWeight: "900", color: themeColors.text, textAlign: "center" },
    subtitle: { fontSize: 12.5, color: themeColors.textSubtle, textAlign: "center", lineHeight: 19 },
    primaryBtn: { marginTop: 6, backgroundColor: "#22A652", paddingVertical: 11, paddingHorizontal: 24, borderRadius: 999 },
    primaryBtnText: { color: "white", fontSize: 13, fontWeight: "900" },
  });
}
