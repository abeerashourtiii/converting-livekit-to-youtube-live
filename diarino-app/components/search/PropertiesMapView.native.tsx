import { useEffect, useMemo, useRef, useState } from "react";
import { GestureResponderEvent, Pressable, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Property, fmtPrice } from "../../lib/types";
import { cldThumbnail } from "../../lib/cloudinary";
import { LatLng } from "../../lib/geo";
import { Region } from "../../src/types/geo";
import { buildPropertiesMapHtml, deltaToZoom } from "../../lib/leafletHtml";
import { parseLeafletMessage } from "../../lib/mapMessages";
import { openInExternalMaps } from "../../lib/externalMaps";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { FLOATING_TAB_BAR_CLEARANCE } from "../../lib/uiConstants";
import { useThemeColors, ThemeColors } from "../../lib/hooks/useThemeColors";

// ↔ "عرض العقارات على الخريطة" (phase A) — a pin per property with lat/lng,
// tapping one shows a small preview card instead of navigating straight
// away, same "look before you leap" affordance as tapping a search result
// thumbnail. When `drawMode` is on, taps on the map itself add polygon
// points instead of doing anything with pins — see search.tsx's map/draw
// toggle for how the two modes are switched between.
//
// ↔ was react-native-maps' <MapView>+<Marker>+<Polygon> — replaced with an
// inline Leaflet/OSM page inside a WebView (lib/leafletHtml.ts) after
// react-native-maps was found to crash the Android APK on launch
// (Hermes "Super expression must either be null or a function").
type Props = {
  properties: Property[];
  initialRegion: Region;
  drawMode?: boolean;
  polygonPoints?: LatLng[];
  onMapPress?: (point: LatLng) => void;
};

export function PropertiesMapView({ properties, initialRegion, drawMode, polygonPoints, onMapPress }: Props) {
  const [selected, setSelected] = useState<Property | null>(null);
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const themeColors = useThemeColors();
  const styles = createStyles(themeColors);

  const pins = useMemo(() => properties.filter((p) => p.lat != null && p.lng != null), [properties]);

  const markerInputs = useMemo(
    () =>
      pins.map((p) => ({
        id: p.id,
        lat: p.lat as number,
        lng: p.lng as number,
        color: p.purpose === "sale" ? "#22A652" : "#F4673F",
      })),
    [pins]
  );

  const polygonForMap = useMemo(
    () => (polygonPoints && polygonPoints.length > 1 ? polygonPoints : null),
    [polygonPoints]
  );

  // Built once at mount; subsequent pin/polygon changes are pushed via
  // injectJavaScript so the WebView (and the user's current pan/zoom)
  // never reloads.
  const initialHtml = useMemo(
    () =>
      buildPropertiesMapHtml({
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
        zoom: deltaToZoom(initialRegion.longitudeDelta),
        markers: markerInputs,
        polygon: polygonForMap,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!isReady) return;
    webViewRef.current?.injectJavaScript(`window.setMarkers(${JSON.stringify(markerInputs)}); true;`);
  }, [isReady, markerInputs]);

  useEffect(() => {
    if (!isReady) return;
    webViewRef.current?.injectJavaScript(`window.setPolygon(${JSON.stringify(polygonForMap ?? [])}); true;`);
  }, [isReady, polygonForMap]);

  function handleMessage(event: WebViewMessageEvent) {
    const message = parseLeafletMessage(event.nativeEvent.data);
    if (!message) return;

    switch (message.type) {
      case "mapPress":
        if (drawMode && onMapPress) {
          onMapPress({ lat: message.lat, lng: message.lng });
        } else {
          setSelected(null);
        }
        break;
      case "markerPress": {
        const property = pins.find((p) => p.id === message.id) ?? null;
        setSelected(property);
        break;
      }
      case "mapReady":
        setIsReady(true);
        break;
      case "pointChange":
      case "regionChange":
        break;
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        style={{ flex: 1 }}
        originWhitelist={["*"]}
        source={{ html: initialHtml }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />

      {selected && (
        // ↔ #1: كانت بتتقفل على bottom:14 ثابت من غير ما تاخد بالها من
        // شريط المهام العائم (position:absolute برضه، فوق كل حاجة) —
        // فكانت البطاقة (وبالتالى زرار "فتح في الخرائط") بتتداخل معاه.
        // insets.bottom + FLOATING_TAB_BAR_CLEARANCE يوصّلها لفوق الشريط
        // بالظبط + هامش صغير إضافي.
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
              hitSlop={8}
              onPress={(e: GestureResponderEvent) => {
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
  });
}
