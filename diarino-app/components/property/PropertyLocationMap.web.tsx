import { useEffect, useRef, useState, type CSSProperties } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { loadLeaflet, LeafletMap } from "../../lib/leafletWebLoader.web";
import { openInExternalMaps, openAddressInExternalMaps } from "../../lib/externalMaps";
import { useLanguage } from "../../lib/hooks/useLanguage";

const PREVIEW_ZOOM = 15;

type Props = {
  lat?: number;
  lng?: number;
  address: string;
};

// ↔ نفس components/property/PropertyLocationMap.native.tsx لكن بخريطة
// Leaflet محمّلة من الـ CDN مباشرة فى المتصفح، بنفس نمط
// components/search/MapPicker.web.tsx — بدون تفاعل (معاينة فقط).
export function PropertyLocationMap({ lat, lng, address }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView([lat, lng], PREVIEW_ZOOM);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.marker([lat, lng]).addTo(map);
        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(), 0);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t("الموقع على الخريطة")}</Text>

      {lat != null && lng != null ? (
        <View style={styles.mapBox}>
          <div ref={containerRef} style={webMapStyle} />
          {loadError && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{t("تعذر تحميل الخريطة")}</Text>
            </View>
          )}
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

const webMapStyle: CSSProperties = { width: "100%", height: "100%" };

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 20 },
  heading: { fontSize: 14, fontWeight: "900", color: "#111827", marginBottom: 10 },
  mapBox: { height: 150, borderRadius: 14, overflow: "hidden", backgroundColor: "#f3f4f6" },
  noMapBox: {
    height: 90, borderRadius: 14, backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#f3f4f6",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
  },
  noMapText: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  errorOverlay: { position: "absolute", left: 8, right: 8, top: 8, padding: 8, borderRadius: 8, backgroundColor: "#FEF2F2" },
  errorText: { fontSize: 11, color: "#B91C1C", textAlign: "center" },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  addressText: { flex: 1, fontSize: 12.5, color: "#4b5563" },
  openBtn: {
    marginTop: 10, alignSelf: "flex-start", backgroundColor: "#ecfdf5", borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: "#22A652",
  },
  openBtnText: { fontSize: 12, fontWeight: "800", color: "#22A652" },
});
