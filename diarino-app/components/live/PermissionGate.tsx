import { View, Text, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useMediaPermissions } from "../../lib/hooks/useMediaPermissions";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const { bothGranted, eitherDenied, checking, request } = useMediaPermissions();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  if (checking) return null;

  if (bothGranted) return <>{children}</>;

  return (
    <View style={styles.container}>
      {/* ↔ نفس زر الخروج (×) الموجود فى شاشة إعداد اللايف — الشاشة دي
      بتظهر قبلها مباشرة (أول ما تدوس "اطلع لايف")، فمن غيرها المستخدم
      عالق هنا من غير أي طريقة للرجوع غير زرار الموبايل نفسه. */}
      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={10}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2.5}>
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      </Pressable>

      <View style={styles.iconWrap}>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={1.8}>
          <Path d="M23 7l-7 5 7 5V7z" />
          <Path d="M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z" />
        </Svg>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={1.8}>
          <Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
          <Path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
        </Svg>
      </View>

      <Text style={styles.title}>{t("الوصول إلى الكاميرا والميكروفون")}</Text>
      <Text style={styles.subtitle}>
        {eitherDenied
          ? t("تم رفض الإذن مسبقًا. من فضلك فعّل الكاميرا والميكروفون من إعدادات الجهاز للمتابعة.")
          : t("يحتاج ديارينو إلى الكاميرا والميكروفون لبدء البث المباشر.")}
      </Text>

      {eitherDenied ? (
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

// ↔ قاعدة تثيم الوسائط: شاشة طلب إذن الكاميرا/الميكروفون دي بتظهر *قبل*
// ما الكاميرا تشتغل خالص (مفيش سطح فيديو موجود لحظتها) — "شاشة ما قبل
// البث (الإعداد/التحضير)" بالظبط، فتتبع الثيم عادي.
function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
    closeBtn: {
      position: "absolute", top: Platform.OS === "ios" ? 54 : 24, left: 20, zIndex: 10,
      width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.surface,
      borderWidth: 1, borderColor: themeColors.border, alignItems: "center", justifyContent: "center",
    },
    iconWrap: { flexDirection: "row", gap: 20, marginBottom: 8, opacity: 0.9 },
    title: { color: themeColors.text, fontSize: 17, fontWeight: "900", textAlign: "center" },
    subtitle: { color: themeColors.textSubtle, fontSize: 13, textAlign: "center", lineHeight: 20 },
    primaryBtn: {
      marginTop: 8, backgroundColor: "#22A652", paddingVertical: 12, paddingHorizontal: 28,
      borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8,
    },
    primaryBtnText: { color: "white", fontSize: 14, fontWeight: "900" },
  });
}
