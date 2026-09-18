import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { Property, fmtPrice } from "../../lib/types";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useReelControlsBottomOffset } from "../../lib/uiConstants";

// ↔ onLongPress here (not on the full-screen video Pressable in
// ReelCard, which already owns long-press for the 2x-speed hold) opens
// the quick "الإبلاغ عن هذا الريل" sheet — reporting a reel by holding
// down on its title/price card, without touching the playback gesture.
export function ReelInfoOverlay({
  property, onOpenDetails, onReport,
}: {
  property: Property; onOpenDetails: () => void; onReport?: () => void;
}) {
  const p = property;
  const { t, language } = useLanguage();
  const isAr = language !== "en";
  // ↔ #2/#3: نفس السبب زي ReelSeekBar/ReelActionRail — الكارت بقى
  // fullscreen كامل، فكارت الوصف لازم ياخد padding سفلي إضافي عشان يفضل
  // واقف فوق شريط المهام العائم وشريط الـ seek بدل ما يتغطّى بيهم.
  const bottomOffset = useReelControlsBottomOffset();
  return (
    // ↔ إصلاح "الضغط على الشاشة للإيقاف/التشغيل مش شغّال": باغ موثّق فى
    // مكتبة الـ LinearGradient نفسها (react-native-linear-gradient#370) —
    // على أندرويد، LinearGradient بيترندر كـ "سطح" رندر أصلي (native
    // surface) جوه View عادي، وpointerEvents="box-none" بيأثر بس على الـ
    // View الخارجي مش على السطح الأصلي جواه، فالسطح ده بيفضل ياخد اللمس
    // حتى لو مفروض يبقى "شفاف للمس". اللودينت هنا كان بياخد الشاشة كلها
    // (absoluteFillObject)، فكان بيبلع كل ضغطة إيقاف/تشغيل قبل ما توصل
    // للـ Pressable الشفاف تحته فى ReelCard.tsx.
    // الحل: View عادي (بيحترم box-none صح) هو اللي بياخد المكان والـ
    // layout، واللودينت جواه بقى pointerEvents="none" صراحةً (تزيين
    // بصري بس، مش هدف لمس أصلاً)، فمفيش أي طبقة تقدر تبلع اللمس تحته.
    <View style={[styles.overlay, { paddingBottom: 70 + bottomOffset }]} pointerEvents="box-none">
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {
        // ↔ إصلاح تداخل كارت الوصف مع الأيقونات الجانبية (نفس فئة الباغ
        // الموثّقة فى ReelActionRail.tsx/physicalSide، لكن من الاتجاه
        // التاني): "flex-start"/"flex-end" قيم *منطقية* بتتفهم تلقائيًا
        // حسب اتجاه اللغة — على الموبايل عن طريق Yoga (I18nManager.isRTL)،
        // وعلى الويب عن طريق CSS direction. الكود القديم كان بيقلبها هو
        // كمان يدويًا حسب isAr، فبيحصل قلب مزدوج (مرة تلقائي من React
        // Native نفسه، ومرة يدوي من عندنا) — النتيجة إن الكارت كان بيرجع
        // يقف فى *نفس* جهة الأيقونات الجانبية بدل الجهة المقابلة، بس على
        // أندرويد/آيفون/الـ APK (الويب مالوش القلب التلقائي ده، فكان شغّال
        // هناك بالصدفة). الحل: نسيبها قيمة ثابتة (مش شرط على isAr) عشان
        // كل منصة تعمل القلب الصحيح بطريقتها من غير ما نتعارض معاها.
      }
      <Pressable
        style={[styles.infoBlock, { alignSelf: "flex-start", alignItems: "flex-start" }]}
        onPress={onOpenDetails}
        onLongPress={onReport}
        delayLongPress={500}
      >
        <View style={styles.row}>
          <View style={[styles.purposeTag, { backgroundColor: p.purpose === "sale" ? "#22A652" : "#F4673F" }]}>
            <Text style={styles.purposeTagText}>{p.purpose === "sale" ? t("للبيع") : t("للإيجار")}</Text>
          </View>
          <Pressable style={styles.descBtn} onPress={onOpenDetails} hitSlop={6}>
            <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
              <Circle cx={12} cy={12} r={10} />
              <Path d="M12 16v-4M12 8h.01" />
            </Svg>
            <Text style={styles.descBtnText}>{t("التفاصيل")}</Text>
          </Pressable>
        </View>

        <Text style={[styles.title, { textAlign: isAr ? "right" : "left" }]} numberOfLines={1}>{p.shortTitle || p.title}</Text>
        <Text style={[styles.location, { textAlign: isAr ? "right" : "left" }]}>📍 {p.location}</Text>
        <Text style={[styles.price, { textAlign: isAr ? "right" : "left" }]}>
          {fmtPrice(p.price)} {t("ج.م")} {p.purpose === "rent" ? t("/ شهر") : ""}
        </Text>
        <View style={styles.specsRow}>
          {!!p.rooms && <Text style={styles.specText}>🛏 {p.rooms} {t("غرف")}</Text>}
          {!!p.baths && <Text style={styles.specText}>🛁 {p.baths} {t("حمام")}</Text>}
          <Text style={styles.specText}>📐 {p.area} {t("م²")}</Text>
          {!!p.music && <Text style={styles.specText}>🎵 {p.music}</Text>}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  infoBlock: { maxWidth: "70%" },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  purposeTag: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  purposeTagText: { color: "white", fontSize: 9, fontWeight: "900" },
  descBtn: {
    backgroundColor: "#F97316",
    borderWidth: 1,
    borderColor: "#FB923C",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  descBtnText: { color: "white", fontSize: 9, fontWeight: "900" },
  // ↔ قاعدة تثيم الوسائط (نسخة نهائية معتمدة — docs/deferred-tasks.md):
  // "أي نص مرسوم فوق تدرّج شفاف على الفيديو = ثابت أبيض + ظل" — كل نصوص
  // البلوك ده (مش العنوان بس) دلوقتي بنفس معالجة الظل الموحّدة، فى
  // الوضعين الاثنين من غير أي استثناء ومن غير أي اعتماد على useThemeColors.
  title: {
    color: "white", fontSize: 15, fontWeight: "900", marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  location: {
    color: "white", fontSize: 11, opacity: 0.9, marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  price: {
    color: "white", fontSize: 17, fontWeight: "900", marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  specsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  specText: {
    color: "white", fontSize: 10.5, fontWeight: "800", opacity: 0.95,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
});
