import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { usePropertyDetail } from "../../lib/hooks/useProperties";
import { getReelMode } from "../../lib/types";
import { ReelBackground } from "../../components/reel/ReelBackground";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { ReportModal } from "../../components/shared/ReportModal";
import { PropertyDetailsContent } from "../../components/property/PropertyDetailsContent";
import { PropertyCtaBar } from "../../components/property/PropertyCtaBar";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ #screen-details in app-viewer.html. Kept the "fixed CTA bar outside the
// scroll container" fix from the web version — it's a separate sibling View
// here, not something that can accidentally end up inside the ScrollView.
export default function PropertyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: property, isLoading: propertyLoading } = usePropertyDetail(id);
  const [reportVisible, setReportVisible] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  // ↔ BUG FIX (الشاشة البيضاء): كانت شاشة "لسه بتحمّل" مجرد View فاضية
  // بخلفية بيضاء، من غير أي مؤشر تحميل — فكان بيبان للمستخدم إن الصفحة
  // "بيضاء وسايبة" حتى لو البيانات هتوصل خلال جزء من الثانية. دلوقتي
  // بيظهر مؤشر تحميل واضح، وده منفصل عن حالة "العقار مش موجود فعلًا"
  // تحت — عشان ميحصلش وميض لرسالة "هذا العقار لم يعد متاحًا" لحظة ما
  // الشاشة تفتح لأول مرة قبل ما تجيله البيانات.
  if (propertyLoading) {
    return (
      <View style={styles.notFound}>
        <ActivityIndicator size="large" color="#22A652" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>{t("هذا العقار لم يعد متاحًا")}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  const mode = getReelMode(property);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          {mode === "none" ? (
            <ReelBackground index={0} type={property.type} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
          )}
          <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent"]} style={styles.coverTopFade} />
          <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
              <Path d="M6 6l12 12M18 6L6 18" />
            </Svg>
          </Pressable>
          <Pressable style={styles.reportBtn} onPress={() => setReportVisible(true)} hitSlop={8}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" />
            </Svg>
          </Pressable>
        </View>

        <PropertyDetailsContent property={property} />
      </ScrollView>

      {/* ↔ the fixed CTA bar fix — lives outside the ScrollView on purpose */}
      <PropertyCtaBar property={property} />

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="property"
        targetId={property.id}
        targetTitle={property.title}
      />
    </View>
  );
}

// ↔ الوضع الداكن (البند أ-٢ فى خطة الإطلاق): كل الأجزاء اللي مش خلفية
// الغلاف السودة الثابتة (اللي أصلاً بتناسب الوضعين) بقت بتاخد ألوانها من
// useThemeColors() — الجزء الوحيد الثابت هو `cover`/الأزرار العائمة
// فوقه، لأنها فوق صورة/فيديو دايمًا محتاجة تباين واضح بغض النظر عن الثيم.
function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: themeColors.background },
    notFoundText: { fontSize: 14, fontWeight: "800", color: themeColors.textMuted },
    backBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    backBtnText: { color: "white", fontWeight: "900" },
    cover: { height: 280, backgroundColor: "#111" },
    coverTopFade: { position: "absolute", top: 0, left: 0, right: 0, height: 80 },
    closeBtn: { position: "absolute", top: 50, left: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
    reportBtn: { position: "absolute", top: 50, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  });
}
