import { useRef, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, PanResponder, ActivityIndicator, Alert, GestureResponderEvent, PanResponderGestureState, ViewStyle } from "react-native";
import * as Location from "expo-location";
import Svg, { Path, Circle } from "react-native-svg";
import { LocationPermissionGate } from "./LocationPermissionGate";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import { physicalSide } from "../../lib/rtl";
// ↔ IMPORTANT: no ".native" suffix here — this file itself has no
// .native/.web split, so an explicit ".native" import would force Metro
// to bundle MapPicker.native.tsx (a WebView + Leaflet page) into the WEB
// build too, exactly like the react-native-maps web-bundling break this
// setup replaced. The extensionless import lets Metro resolve
// MapPicker.native.tsx on Android/iOS and MapPicker.web.tsx on web
// automatically.
import { MapPicker } from "./MapPicker";
import { Region } from "../../src/types/geo";

export type { Region };

export type GeoPoint = { lat: number; lng: number; radiusKm: number } | null;

type Props = {
  visible: boolean;
  value: GeoPoint;
  onApply: (point: GeoPoint) => void;
  onClose: () => void;
};

const DEFAULT_REGION: Region = { latitude: 30.0444, longitude: 31.2357, latitudeDelta: 0.3, longitudeDelta: 0.3 }; // Cairo
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

// ↔ إصلاح "كرة نطاق البحث بتتحرك عكس اتجاه السحب فى العربي (أندرويد/
// آيفون/الـ APK فقط)": نفس فئة العطل بالظبط الموثّقة والمُصلَحة فى
// components/reel/ReelSeekBar.tsx — "left: pct%" الحرفية بتتقلب تلقائيًا
// لـ Yoga على الموبايل لما I18nManager.isRTL شغالة، فبيتحرك الشريط عكس
// الاتجاه المطلوب بالظبط. نفس الحل: نحسب مقدّمًا أنهي خاصية حرفية لازم
// نكتبها عشان النتيجة النهائية تفضل "شمال = الحد الأدنى دايمًا" ثابتة
// على كل المنصات، ونستخدم transform بدل marginLeft للتوسيط (مش متأثر
// بالقلب التلقائي إطلاقًا).
const TRACK_ORIGIN_SIDE = physicalSide(true);
const trackOriginStyle = TRACK_ORIGIN_SIDE === "left" ? { left: 0 } : { right: 0 };
function trackPositionStyle(pctValue: number): ViewStyle {
  return TRACK_ORIGIN_SIDE === "left" ? { left: `${pctValue * 100}%` } : { right: `${pctValue * 100}%` };
}
const CENTER_SIGN = TRACK_ORIGIN_SIDE === "left" ? -1 : 1;

export function GeoSearchModal({ visible, value, onApply, onClose }: Props) {
  const { t } = useLanguage();
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  );
  const [radiusKm, setRadiusKm] = useState(value?.radiusKm ?? 10);
  const [region, setRegion] = useState<Region>(
    value ? { ...DEFAULT_REGION, latitude: value.lat, longitude: value.lng } : DEFAULT_REGION
  );
  const [locating, setLocating] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  async function useMyCurrentLocation() {
    setLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPoint(next);
      setRegion({ latitude: next.lat, longitude: next.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 });
    } catch {
      Alert.alert(t("تعذر تحديد الموقع"), t("حاول مرة أخرى أو اختر نقطة على الخريطة يدويًا."));
    } finally {
      setLocating(false);
    }
  }

  function apply() {
    if (!point) {
      Alert.alert(t("اختر نقطة على الخريطة أو استخدم موقعك الحالي"));
      return;
    }
    onApply({ lat: point.lat, lng: point.lng, radiusKm });
    onClose();
  }

  function clear() {
    setPoint(null);
    onApply(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <LocationPermissionGate>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.text} strokeWidth={2}>
                <Path d="M18 6L6 18M6 6l12 12" />
              </Svg>
            </Pressable>
            <Text style={styles.headerTitle}>{t("البحث بالموقع")}</Text>
            <View style={{ width: 34 }} />
          </View>

          <MapPicker
            point={point}
            region={region}
            radiusKm={radiusKm}
            onRegionChange={setRegion}
            onPointChange={setPoint}
          />

          <View style={styles.panel}>
            <Pressable style={styles.locateBtn} onPress={useMyCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator color="#22A652" size="small" />
              ) : (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
                  <Path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z" />
                  <Circle cx={12} cy={10} r={3} />
                </Svg>
              )}
              <Text style={styles.locateBtnText}>{t("استخدم موقعي الحالي")}</Text>
            </Pressable>

            <View style={styles.radiusRow}>
              <Text style={styles.radiusLabel}>{t("نطاق البحث")}</Text>
              <Text style={styles.radiusValue}>{radiusKm} {t("كم")}</Text>
            </View>
            <RadiusSlider value={radiusKm} min={MIN_RADIUS} max={MAX_RADIUS} onChange={setRadiusKm} />

            <View style={styles.actionsRow}>
              <Pressable style={styles.clearBtn} onPress={clear}>
                <Text style={styles.clearBtnText}>{t("إلغاء البحث بالموقع")}</Text>
              </Pressable>
              <Pressable style={[styles.applyBtn, !point && styles.applyBtnDisabled]} onPress={apply} disabled={!point}>
                <Text style={styles.applyBtnText}>{t("تطبيق")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </LocationPermissionGate>
    </Modal>
  );
}

function RadiusSlider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);
  const trackRef = useRef<View>(null);
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);
  const pct = (value - min) / (max - min);

  function pctFromPageX(pageX: number): number {
    if (!trackWidth.current) return 0;
    const x = pageX - trackPageX.current;
    return Math.max(0, Math.min(1, x / trackWidth.current));
  }

  function handleFromEvent(e: GestureResponderEvent, gesture?: PanResponderGestureState) {
    const pageX = gesture?.moveX || e.nativeEvent.pageX;
    const p = pctFromPageX(pageX);
    onChange(Math.round(min + p * (max - min)));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gesture) => handleFromEvent(e, gesture),
      onPanResponderMove: (e, gesture) => handleFromEvent(e, gesture),
    })
  ).current;

  return (
    <View
      ref={trackRef}
      style={styles.sliderTrack}
      onLayout={(e) => {
        trackWidth.current = e.nativeEvent.layout.width;
        trackRef.current?.measureInWindow((x) => { trackPageX.current = x; });
      }}
      {...panResponder.panHandlers}
    >
      <View style={styles.sliderBase} />
      <View style={[styles.sliderFill, trackOriginStyle, { width: `${pct * 100}%` }]} />
      <View style={[styles.sliderThumb, trackPositionStyle(pct)]} />
    </View>
  );
}

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: themeColors.border },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: themeColors.surface, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 14, fontWeight: "900", color: themeColors.text },
    panel: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: themeColors.border, gap: 10 },
    locateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5", borderRadius: 12, paddingVertical: 12 },
    locateBtnText: { color: "#22A652", fontWeight: "900", fontSize: 13 },
    radiusRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    radiusLabel: { fontSize: 12.5, fontWeight: "800", color: themeColors.textMuted },
    radiusValue: { fontSize: 12.5, fontWeight: "900", color: "#22A652" },
    sliderTrack: { height: 30, justifyContent: "center" },
    sliderBase: { position: "absolute", left: 0, right: 0, height: 5, borderRadius: 3, backgroundColor: themeColors.border },
    sliderFill: { position: "absolute", height: 5, borderRadius: 3, backgroundColor: "#22A652" },
    sliderThumb: {
      position: "absolute", top: "50%", marginTop: -9,
      transform: [{ translateX: 9 * CENTER_SIGN }],
      width: 18, height: 18, borderRadius: 9, backgroundColor: "#22A652", borderWidth: 2, borderColor: themeColors.card,
    },
    actionsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
    clearBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: themeColors.border },
    clearBtnText: { fontSize: 12.5, fontWeight: "900", color: themeColors.textMuted },
    applyBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: "center", backgroundColor: "#22A652" },
    applyBtnDisabled: { backgroundColor: themeColors.isDark ? "#2E5B41" : "#a7d9bb" },
    applyBtnText: { fontSize: 12.5, fontWeight: "900", color: "white" },
  });
}