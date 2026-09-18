import { useRef, useState } from "react";
import { Animated, Easing, Modal, View, Text, Pressable, StyleSheet, Switch, PanResponder } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useReelPreferences, CaptionsLanguage } from "../../lib/hooks/useReelPreferences";
import { usePiPPreference } from "../../lib/hooks/usePiPPreference";
import { PictureInPictureModal } from "../shared/PictureInPictureModal";
import { showToast } from "../shared/Toast";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenReport: () => void;
  // ↔ صوت الخلفية بيبان بس لو الريل ده فعليًا معاه موسيقى مرفقة
  // (property.music) — زي ما اتطلب بالظبط: "فى حالة ارفاق موسيقى للريل".
  hasMusic: boolean;
};

const CAPTION_LANGS: { key: CaptionsLanguage; label: string }[] = [
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

// ↔ القايمة المنسدلة اللي بتفتح بالضغط المطول على كارت وصف الريل —
// بتحل محل الـ ActionSheet البسيط اللي كان بس فيه "الإبلاغ عن هذا
// الريل" (لسه أول عنصر هنا). الأربع تفضيلات التانية (تمرير تلقائي، كتم
// صوت الخلفية، الترجمة النصية، وعرض التطبيق فوق التطبيقات الأخرى)
// بتتخزن/تتقرا من lib/hooks/useReelPreferences.ts وlib/hooks/usePiPPreference.ts
// — نفس المخازن اللي شاشة الإعدادات نفسها بتستخدمها، فأي تغيير من هنا
// أو من هناك بينعكس فى المكانين فورًا.
export function ReelOptionsSheet({ visible, onClose, onOpenReport, hasMusic }: Props) {
  const { t } = useLanguage();
  const {
    autoAdvance, setAutoAdvance,
    musicMuted, setMusicMuted,
    captionsLanguage, setCaptionsLanguage,
  } = useReelPreferences();
  const { preference: pipPreference } = usePiPPreference();
  const [pipModalVisible, setPipModalVisible] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  // ↔ #3: إغلاق القائمة بالسحب لأسفل من مقبض السحب أو من أي فراغ فى
  // الشريط العلوي — نفس الفكرة والتقنية المستخدمة فى لوحة تفاصيل العقار
  // (components/reel/ReelCard.tsx، sheetPanResponder) بس بمقياس أبسط:
  // translateY بالبكسل مباشرة (مش قيمة 0..1 مُطبَّقة على تفاعل ثانوي)،
  // لأن القائمة دي مالهاش حالة "مصغّرة" زي لوحة التفاصيل، بس مفتوحة أو
  // مقفولة.
  const translateY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const dragStartY = useRef(0);

  function animateCloseFromDrag() {
    Animated.timing(translateY, {
      toValue: sheetHeight.current || 400, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      onClose();
    });
  }

  const dragPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 4 && gesture.dy > 0,
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => { dragStartY.current = value; });
      },
      onPanResponderMove: (_evt, gesture) => {
        if (gesture.dy <= 0) return;
        translateY.setValue(dragStartY.current + gesture.dy);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const threshold = (sheetHeight.current || 400) * 0.3;
        if (gesture.dy > threshold || gesture.vy > 0.8) {
          animateCloseFromDrag();
        } else {
          Animated.timing(translateY, {
            toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      },
    })
  ).current;

  if (!visible) return null;

  // ↔ الترجمة النصية لسه مش جاهزة للإطلاق — بدل ما نسيب المستخدم يفعّلها
  // ويلاقيها مش شغالة كويس، المفتاح بيفضل واقف على "متوقّف" دايمًا وبيظهر
  // رسالة "قريبًا سيتم تفعيل الخاصية" فورًا لأي محاولة تفعيل.
  function handleToggleCaptions(_next: boolean) {
    showToast(t("قريبًا سيتم تفعيل الخاصية"));
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
          {...dragPanResponder.panHandlers}
        >
          {/* ↔ #8: منطقة السحب بقت على القائمة كلها مش بس المقبض — القائمة
              دي مالهاش ScrollView داخلي (عدد الصفوف ثابت وقليل)، فمفيش
              تعارض مع أي سكرول داخلي؛ onMoveShouldSetPanResponder برضه بس
              بيتفعّل مع سحب فعلي (dy>4) فالسويتشات والأزرار بتفضل شغالة
              بالضغط العادي زي ما هي. */}
          <View style={styles.dragZone}>
            <View style={styles.handle} />
          </View>

          <Pressable style={styles.row} onPress={() => { onClose(); onOpenReport(); }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth={2}>
              <Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" />
            </Svg>
            <Text style={[styles.rowText, styles.rowTextDanger]}>{t("الإبلاغ عن هذا الريل")}</Text>
          </Pressable>

          <View style={styles.row}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
              <Path d="M5 12h14M13 6l6 6-6 6" />
            </Svg>
            <Text style={styles.rowText}>{t("تمرير تلقائي")}</Text>
            <Switch value={autoAdvance} onValueChange={setAutoAdvance} trackColor={{ true: "#22A652" }} />
          </View>

          {hasMusic && (
            <View style={styles.row}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
                {musicMuted ? (
                  <Path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                ) : (
                  <Path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                )}
              </Svg>
              <Text style={styles.rowText}>{t("صوت الخلفية")}</Text>
              <Switch value={!musicMuted} onValueChange={(on) => setMusicMuted(!on)} trackColor={{ true: "#22A652" }} />
            </View>
          )}

          <View style={styles.row}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
              <Rect x={3} y={5} width={18} height={14} rx={2} />
              <Path d="M7 9h2M7 13h6" />
            </Svg>
            <Text style={styles.rowText}>{t("الترجمة النصية (Captions)")}</Text>
            <Switch value={false} onValueChange={handleToggleCaptions} trackColor={{ true: "#22A652" }} />
          </View>
          {false && (
            <View style={styles.captionLangRow}>
              {CAPTION_LANGS.map((lang) => (
                <Pressable
                  key={lang.key}
                  style={[styles.captionLangChip, captionsLanguage === lang.key && styles.captionLangChipActive]}
                  onPress={() => setCaptionsLanguage(lang.key)}
                >
                  <Text style={[styles.captionLangText, captionsLanguage === lang.key && styles.captionLangTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.row} onPress={() => setPipModalVisible(true)}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
              <Rect x={3} y={3} width={18} height={14} rx={2} />
              <Rect x={12} y={11} width={7} height={5} rx={1} />
            </Svg>
            <Text style={styles.rowText}>{t("عرض التطبيق فوق التطبيقات الأخرى")}</Text>
            {pipPreference === "enabled" && <Text style={styles.rowBadge}>{t("مفعّل")}</Text>}
          </Pressable>

          <Pressable style={styles.cancelItem} onPress={onClose}>
            <Text style={styles.cancelItemText}>{t("إلغاء")}</Text>
          </Pressable>
        </Animated.View>
      </Modal>

      <PictureInPictureModal visible={pipModalVisible} onClose={() => setPipModalVisible(false)} />
    </>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
    sheet: {
      position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: themeColors.card,
      borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, paddingTop: 6,
    },
    handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: themeColors.border, alignSelf: "center" },
    dragZone: { paddingTop: 10, paddingBottom: 10 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 20 },
    rowText: { fontSize: 13.5, fontWeight: "900", color: themeColors.text, flex: 1 },
    rowTextDanger: { color: "#991B1B" },
    rowBadge: { fontSize: 11, fontWeight: "900", color: "#22A652" },
    captionLangRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 8, marginTop: -4 },
    captionLangChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: themeColors.surface },
    captionLangChipActive: { backgroundColor: "#22A652" },
    captionLangText: { fontSize: 12, fontWeight: "800", color: themeColors.textSubtle },
    captionLangTextActive: { color: "white" },
    cancelItem: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
    cancelItemText: { fontSize: 13.5, fontWeight: "900", color: themeColors.textSubtle },
  });
}
