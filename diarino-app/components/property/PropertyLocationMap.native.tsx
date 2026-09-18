import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import Svg, { Path, Circle } from "react-native-svg";
import { buildStaticMapHtml } from "../../lib/leafletHtml";
import { openInExternalMaps, openAddressInExternalMaps } from "../../lib/externalMaps";
import { useLanguage } from "../../lib/hooks/useLanguage";

const PREVIEW_ZOOM = 15;

type Props = {
  lat?: number;
  lng?: number;
  address: string;
};

// ↔ #2 (تفاصيل العقار): قسم "الموقع على الخريطة" أسفل الوصف — نفس قاعدة
// المشروع "OSM/Leaflet فقط، من غير مفتاح Google" المتبعة فى
// lib/leafletHtml.ts، بمعاينة خريطة صغيرة للقراءة فقط + زر يفتح خرائط
// الجهاز (Google Maps / Apple Maps) عبر lib/externalMaps.ts.
export function PropertyLocationMap({ lat, lng, address }: Props) {
  const { t } = useLanguage();
  const html = useMemo(() => (lat != null && lng != null ? buildStaticMapHtml(lat, lng, PREVIEW_ZOOM) : ""), [lat, lng]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t("الموقع على الخريطة")}</Text>

      {lat != null && lng != null ? (
        <View style={styles.mapBox}>
          <WebView
            source={{ html }}
            style={styles.map}
            scrollEnabled={false}
            // ↔ معاينة فقط — منع التفاعل الداخلي (تكبير/سحب) عشان مايبوظش
            // سكرول صفحة التفاصيل اللي الخريطة داخلها.
            pointerEvents="none"
            javaScriptEnabled
          />
        </View>
      ) : (
        <View style={styles.noMapBox}>
          <Text style={styles.noMapText}>{t("لا يتوفر تحديد دقيق لموقع هذا العقار على الخريطة")}</Text>
        </View>
      )}

      <View style={styles.addressRow}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22A652" strokeWidth={2}>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
          <Circle cx={12} cy={10} r={3} />
        </Svg>
        <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
      </View>

      <Pressable
        style={styles.openBtn}
        onPress={() => (lat != null && lng != null ? openInExternalMaps(lat, lng, address) : openAddressInExternalMaps(address))}
      >
        <Text style={styles.openBtnText}>{t("فتح الموقع فى الخرائط")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: "900", color: "#111827", marginBottom: 10 },
  mapBox: { height: 150, borderRadius: 14, overflow: "hidden", backgroundColor: "#f3f4f6" },
  map: { flex: 1 },
  noMapBox: {
    height: 90, borderRadius: 14, backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#f3f4f6",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
  },
  noMapText: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  addressText: { flex: 1, fontSize: 12.5, color: "#4b5563" },
  openBtn: {
    marginTop: 10, alignSelf: "flex-start", backgroundColor: "#ecfdf5", borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: "#22A652",
  },
  openBtnText: { fontSize: 12, fontWeight: "800", color: "#22A652" },
});
