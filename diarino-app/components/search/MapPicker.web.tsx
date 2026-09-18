import { useEffect, useRef, useState, type CSSProperties } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Region } from "../../src/types/geo";
import { useLanguage } from "../../lib/hooks/useLanguage";
import { loadLeaflet, LeafletMap, LeafletMarker, LeafletCircle, LeafletStatic } from "../../lib/leafletWebLoader.web";

type Point = { lat: number; lng: number };

type Props = {
  point: Point | null;
  region: Region;
  radiusKm: number;
  onRegionChange: (region: Region) => void;
  onPointChange: (point: Point) => void;
};

// ↔ was a "map not available on web" placeholder — now a real Leaflet/OSM
// map loaded from a CDN (see lib/leafletWebLoader.web.ts), giving the web
// build the same draggable-marker + radius-circle picker the native app
// has, instead of a degraded experience.
export function MapPicker({ point, region, radiusKm, onRegionChange, onPointChange }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<LeafletStatic | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const originatedFromMap = useRef(false);
  const prevPoint = useRef<Point | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const onPointChangeRef = useRef(onPointChange);
  onPointChangeRef.current = onPointChange;
  const onRegionChangeRef = useRef(onRegionChange);
  onRegionChangeRef.current = onRegionChange;

  // Mount: create the map once. Region/point at *this* moment seed the
  // initial view; everything after is handled by the sync effect below.
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
          [region.latitude, region.longitude],
          13
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (e) => {
          originatedFromMap.current = true;
          onPointChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        map.on("moveend", () => {
          const center = map.getCenter();
          const bounds = map.getBounds();
          onRegionChangeRef.current({
            latitude: center.lat,
            longitude: center.lng,
            latitudeDelta: bounds.getNorth() - bounds.getSouth(),
            longitudeDelta: bounds.getEast() - bounds.getWest(),
          });
        });

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
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // Keeps the marker + radius circle in sync with `point`/`radiusKm`,
  // creating them lazily the first time a point becomes available
  // (covers "use my current location" being pressed after mount, when no
  // marker existed yet).
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!isMapReady || !L || !map || !point) return;

    const pointChanged =
      !prevPoint.current || prevPoint.current.lat !== point.lat || prevPoint.current.lng !== point.lng;
    const recenter = pointChanged && !originatedFromMap.current;
    originatedFromMap.current = false;
    prevPoint.current = point;

    if (!markerRef.current) {
      const marker = L.marker([point.lat, point.lng], { draggable: true }).addTo(map);
      marker.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        originatedFromMap.current = true;
        onPointChangeRef.current({ lat: pos.lat, lng: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([point.lat, point.lng]);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle([point.lat, point.lng], {
        radius: radiusKm * 1000,
        color: "#22A652",
        fillColor: "#22A652",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([point.lat, point.lng]);
      circleRef.current.setRadius(radiusKm * 1000);
    }

    if (recenter) {
      map.setView([point.lat, point.lng], map.getZoom());
    }
  }, [isMapReady, point, radiusKm]);

  return (
    <View style={styles.container}>
      {/* Plain DOM div (this file only ever runs on web) so Leaflet's
          `L.map(element)` gets a real HTMLDivElement without fighting
          react-native-web's View ref typing. */}
      <div ref={containerRef} style={webMapStyle} />
      {loadError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{t("تعذر تحميل الخريطة، تحقق من اتصالك بالإنترنت")}</Text>
        </View>
      )}
    </View>
  );
}

const webMapStyle: CSSProperties = { flex: 1, width: "100%", height: "100%" };

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 320 },
  errorOverlay: {
    position: "absolute", left: 16, right: 16, top: 16, padding: 12, borderRadius: 10,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FCA5A5",
  },
  errorText: { fontSize: 12.5, color: "#B91C1C", textAlign: "center" },
});
