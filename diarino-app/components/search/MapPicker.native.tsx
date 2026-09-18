import { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Region } from "../../src/types/geo";
import { buildPickerMapHtml, deltaToZoom } from "../../lib/leafletHtml";
import { parseLeafletMessage } from "../../lib/mapMessages";

type Point = { lat: number; lng: number };

type Props = {
  point: Point | null;
  region: Region;
  radiusKm: number;
  onRegionChange: (region: Region) => void;
  onPointChange: (point: Point) => void;
};

// ↔ was react-native-maps' <MapView>+<Marker>+<Circle> — replaced with an
// inline Leaflet/OSM page inside a WebView (see lib/leafletHtml.ts) after
// react-native-maps was found to crash the Android APK on launch
// (Hermes "Super expression must either be null or a function").
export function MapPicker({ point, region, radiusKm, onRegionChange, onPointChange }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const originatedFromMap = useRef(false);
  const prevPoint = useRef<Point | null>(null);

  // Built once — the map is only ever initialized at mount. Later point,
  // radius, and region updates are pushed in imperatively via
  // injectJavaScript below so the WebView never reloads (which would
  // reset the user's pan/zoom).
  const initialHtml = useMemo(
    () =>
      buildPickerMapHtml({
        latitude: region.latitude,
        longitude: region.longitude,
        zoom: deltaToZoom(region.longitudeDelta),
        point,
        radiusMeters: radiusKm * 1000,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!isReady || !point) return;
    const pointChanged =
      !prevPoint.current || prevPoint.current.lat !== point.lat || prevPoint.current.lng !== point.lng;
    // Only force the map to re-center when the point changed for a reason
    // *other* than the user directly dragging/tapping on the map itself —
    // otherwise every drag-end would yank the view back to center.
    const recenter = pointChanged && !originatedFromMap.current;
    originatedFromMap.current = false;
    prevPoint.current = point;
    webViewRef.current?.injectJavaScript(
      `window.setPoint(${point.lat}, ${point.lng}, ${radiusKm * 1000}, ${recenter}); true;`
    );
  }, [isReady, point, radiusKm]);

  function handleMessage(event: WebViewMessageEvent) {
    const message = parseLeafletMessage(event.nativeEvent.data);
    if (!message) return;

    switch (message.type) {
      case "mapPress":
        originatedFromMap.current = true;
        onPointChange({ lat: message.lat, lng: message.lng });
        break;
      case "pointChange":
        originatedFromMap.current = true;
        onPointChange({ lat: message.lat, lng: message.lng });
        break;
      case "regionChange":
        onRegionChange({
          latitude: message.latitude,
          longitude: message.longitude,
          latitudeDelta: message.latitudeDelta,
          longitudeDelta: message.longitudeDelta,
        });
        break;
      case "mapReady":
        setIsReady(true);
        break;
      case "markerPress":
        break;
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.webview}
        originWhitelist={["*"]}
        source={{ html: initialHtml }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
});
