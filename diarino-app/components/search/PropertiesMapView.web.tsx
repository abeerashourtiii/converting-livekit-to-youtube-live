import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Property, fmtPrice } from "../../lib/types";
import { cldThumbnail } from "../../lib/cloudinary";
import { LatLng } from "../../lib/geo";
import { Region } from "../../src/types/geo";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { openInExternalMaps } from "../../lib/externalMaps";
import { FLOATING_TAB_BAR_CLEARANCE } from "../../lib/uiConstants";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";
import {
  loadLeaflet,
  LeafletMap,
  LeafletCircleMarker,
  LeafletLayerGroup,
  LeafletPolygon,
  LeafletStatic,
} from "../../lib/leafletWebLoader.web";

// ↔ was a "map view not available on web" placeholder — now a real
// Leaflet/OSM map with a pin per property (see lib/leafletWebLoader.web.ts),
// matching the native WebView+Leaflet map in PropertiesMapView.native.tsx.
type Props = {
  properties: Property[];
  initialRegion: Region;
  drawMode?: boolean;
  polygonPoints?: LatLng[];
  onMapPress?: (point: LatLng) => void;
};

export function PropertiesMapView({ properties, initialRegion, drawMode, polygonPoints, onMapPress }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletStatic | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LeafletLayerGroup | null>(null);
  const polygonLayerRef = useRef<LeafletPolygon | null>(null);

  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;
  const onMapPressRef = useRef(onMapPress);
  onMapPressRef.current = onMapPress;

  const pins = useMemo(() => properties.filter((p) => p.lat != null && p.lng != null), [properties]);

  // Mount: create the map once, centered on the region available at that
  // moment. Pins/polygon are synced separately below so panning/zoom
  // survives result-list updates.
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
          [initialRegion.latitude, initialRegion.longitude],
          12
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (e) => {
          if (drawModeRef.current && onMapPressRef.current) {
            onMapPressRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
          } else {
            setSelected(null);
          }
        });

        markerLayerRef.current = L.layerGroup().addTo(map);
        leafletRef.current = L;
        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(), 0);
        setIsMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      polygonLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync pins whenever the result set changes.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!isMapReady || !L || !layer) return;

    layer.clearLayers();
    pins.forEach((p) => {
      const marker: LeafletCircleMarker = L.circleMarker([p.lat as number, p.lng as number], {
        radius: 9,
        color: "#ffffff",
        weight: 2,
        fillColor: p.purpose === "sale" ? "#22A652" : "#F4673F",
        fillOpacity: 1,
      }).addTo(layer);
      marker.on("click", () => setSelected(p));
    });
  }, [isMapReady, pins]);

  // Sync the drawn "منطقة اهتمام" polygon.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map) return;

    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
    if (polygonPoints && polygonPoints.length > 1) {
      polygonLayerRef.current = L.polygon(
        polygonPoints.map((pt) => [pt.lat, pt.lng]),
        { color: "#22A652", fillColor: "#22A652", fillOpacity: 0.18, weight: 2 }
      ).addTo(map);
    }
  }, [isMapReady, polygonPoints]);

  return (
    <View style={{ flex: 1 }}>
      <div ref={containerRef} style={webMapStyle} />

      {loadError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{t("تعذر تحميل الخريطة، تحقق من اتصالك بالإنترنت")}</Text>
        </View>
      )}

      {selected && (
        // ↔ #1: نفس إصلاح PropertiesMapView.native.tsx
        <Pressable
          style={[styles.previewCard, { bottom: insets.bottom + FLOATING_TAB_BAR_CLEARANCE + 10 }]}
          onPress={() => router.push(`/property/${selected.id}`)}
        >
          {selected.coverImage ? (
            <Image source={{ uri: cldThumbnail(selected.coverImage) }} style={styles.previewImg} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.previewImg, { backgroundColor: themeColors.surface }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle} numberOfLines={1}>{selected.shortTitle || selected.title}</Text>
            <Text style={styles.previewPrice}>{fmtPrice(selected.price)} {t("ج.م")}</Text>
            <Text style={styles.previewLocation} numberOfLines={1}>{selected.province} - {selected.location}</Text>
          </View>
          {selected.lat != null && selected.lng != null && (
            <Pressable
              style={styles.externalBtn}
              onPress={(e) => {
                e.stopPropagation();
                openInExternalMaps(selected.lat as number, selected.lng as number, selected.shortTitle || selected.title);
              }}
            >
              <Text style={styles.externalBtnText}>{t("فتح في الخرائط")}</Text>
            </Pressable>
          )}
        </Pressable>
      )}
    </View>
  );
}

const webMapStyle: CSSProperties = { flex: 1, width: "100%", height: "100%" };

function createStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    previewCard: {
      position: "absolute", left: 14, right: 14,
      flexDirection: "row", gap: 10, backgroundColor: themeColors.card, borderRadius: 14, padding: 10,
      alignItems: "center",
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    previewImg: { width: 64, height: 64, borderRadius: 10 },
    previewTitle: { fontSize: 12.5, fontWeight: "900", color: themeColors.text },
    previewPrice: { fontSize: 12, fontWeight: "800", color: "#22A652", marginTop: 2 },
    previewLocation: { fontSize: 10.5, color: themeColors.textSubtle, marginTop: 2 },
    externalBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: themeColors.isDark ? "rgba(34,166,82,0.18)" : "#ECFDF5" },
    externalBtnText: { fontSize: 10.5, fontWeight: "900", color: "#22A652" },
    errorOverlay: {
      position: "absolute", left: 16, right: 16, top: 16, padding: 12, borderRadius: 10,
      backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5",
    },
    errorText: { fontSize: 12.5, color: "#B91C1C", textAlign: "center" },
  });
}
