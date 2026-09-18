import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";
import Svg, { Path } from "react-native-svg";
import { useLiveReplayById } from "../../../lib/hooks/useMyContent";
import { useLanguage } from "../../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../../lib/hooks/useThemeColors";
import { ReportModal } from "../../../components/shared/ReportModal";

export default function ReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: live, isLoading } = useLiveReplayById(id);
  const { t } = useLanguage();
  const [reportVisible, setReportVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const themeColors = useThemeColors();
  const { height } = useWindowDimensions();

  const errStyles = createStyles(themeColors);

  // 1. حالة التحميل الأولي للبيانات
  if (isLoading) {
    return (
      <View style={errStyles.center}>
        <ActivityIndicator size="large" color="#22A652" />
      </View>
    );
  }

  // 2. حالة عدم وجود التسجيل (يوتيوب أحيانًا بيحتاج دقايق قليلة بعد إنهاء
  // البث عشان يخلّص معالجة الـ VOD ويخليه صالح للتشغيل)
  if (!live || !live.youtubeVideoId || videoError) {
    return (
      <View style={errStyles.center}>
        <Text style={errStyles.errorText}>
          {videoError ? t("حدث خطأ أثناء تشغيل الفيديو") : t("التسجيل غير متاح بعد، حاول بعد قليل")}
        </Text>
        <Pressable style={errStyles.backBtn} onPress={() => router.back()}>
          <Text style={errStyles.backBtnText}>{t("رجوع")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={height}
        width={useWindowDimensions().width}
        play
        videoId={live.youtubeVideoId}
        onReady={() => setIsBuffering(false)}
        onError={() => setVideoError(true)}
      />

      {/* مؤشر تحميل الفيديو فوق المشغل */}
      {isBuffering && (
        <View style={styles.bufferOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}

      {/* شريط الأزرار متوافق مع كافة حواف الشاشات */}
      <SafeAreaView style={styles.headerOverlay} pointerEvents="box-none">
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
            <Path d="M6 6l12 12M18 6L6 18" />
          </Svg>
        </Pressable>

        <View style={styles.titleBar}>
          <Text style={styles.titleText} numberOfLines={1}>
            {t(live.title)}
          </Text>
        </View>

        <Pressable style={styles.reportBtn} onPress={() => setReportVisible(true)} hitSlop={8}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
            <Path d="M4 22V4" />
            <Path d="M4 4h13l-2 4 2 4H4" />
          </Svg>
        </Pressable>
      </SafeAreaView>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="live"
        targetId={live.id}
        targetTitle={live.title || "بث مباشر"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
    zIndex: 10,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBar: { flex: 1, marginHorizontal: 12, alignItems: "center" },
  titleText: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, backgroundColor: themeColors.background, alignItems: "center", justifyContent: "center", gap: 16 },
    errorText: { color: themeColors.text, fontSize: 14, fontWeight: "800" },
    backBtn: { backgroundColor: "#22A652", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
    backBtnText: { color: "white", fontWeight: "900" },
  });
}
