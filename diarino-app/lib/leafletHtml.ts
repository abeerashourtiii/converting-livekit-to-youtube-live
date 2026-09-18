// Builds the inline HTML pages loaded into a native WebView to render
// OpenStreetMap tiles via Leaflet 1.9.4 (RULE: OSM/Leaflet only, no Google
// Maps key). This replaces react-native-maps entirely — see
// components/search/MapPicker.native.tsx and
// components/search/PropertiesMapView.native.tsx for how each page's
// window.set* functions are driven from React via injectJavaScript, and
// lib/mapMessages.ts for the messages posted back out of the page.

const LEAFLET_VERSION = "1.9.4";

function baseHtml(bodyScript: string, initialLat: number, initialLng: number, initialZoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
  <script>
    function post(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }

    var map = L.map('map', { zoomControl: true, attributionControl: true })
      .setView([${initialLat}, ${initialLng}], ${initialZoom});

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    ${bodyScript}

    setTimeout(function () {
      map.invalidateSize();
      post({ type: 'mapReady' });
    }, 0);
  </script>
</body>
</html>`;
}

/** Rough conversion from a react-native-maps-style longitudeDelta to a Leaflet zoom level. */
export function deltaToZoom(longitudeDelta: number): number {
  const safeDelta = longitudeDelta > 0 ? longitudeDelta : 0.05;
  const zoom = Math.round(Math.log2(360 / safeDelta));
  return Math.min(19, Math.max(2, zoom));
}

export type PickerMapInit = {
  latitude: number;
  longitude: number;
  zoom: number;
  point: { lat: number; lng: number } | null;
  radiusMeters: number;
};

/** Single draggable marker + radius circle, used by MapPicker.native.tsx. */
export function buildPickerMapHtml(init: PickerMapInit): string {
  const script = `
    var currentMarker = null;
    var currentCircle = null;

    function ensureMarker(lat, lng) {
      if (currentMarker) {
        currentMarker.setLatLng([lat, lng]);
      } else {
        currentMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
        currentMarker.on('dragend', function (e) {
          var pos = e.target.getLatLng();
          if (currentCircle) currentCircle.setLatLng(pos);
          post({ type: 'pointChange', lat: pos.lat, lng: pos.lng });
        });
      }
    }

    function ensureCircle(lat, lng, radiusMeters) {
      if (currentCircle) {
        currentCircle.setLatLng([lat, lng]);
        currentCircle.setRadius(radiusMeters);
      } else {
        currentCircle = L.circle([lat, lng], {
          radius: radiusMeters, color: '#22A652', fillColor: '#22A652', fillOpacity: 0.15, weight: 2
        }).addTo(map);
      }
    }

    window.setPoint = function (lat, lng, radiusMeters, recenter) {
      ensureMarker(lat, lng);
      ensureCircle(lat, lng, radiusMeters);
      if (recenter) { map.setView([lat, lng], map.getZoom()); }
    };

    map.on('click', function (e) {
      post({ type: 'mapPress', lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on('moveend', function () {
      var c = map.getCenter();
      var b = map.getBounds();
      post({
        type: 'regionChange',
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: b.getNorth() - b.getSouth(),
        longitudeDelta: b.getEast() - b.getWest(),
      });
    });

    ${init.point ? `window.setPoint(${init.point.lat}, ${init.point.lng}, ${init.radiusMeters}, false);` : ""}
  `;

  return baseHtml(script, init.latitude, init.longitude, init.zoom);
}

/** Single fixed (non-draggable) marker, read-only preview — used by
 * components/property/PropertyLocationMap.native.tsx to show a
 * property's location under its description. No click/drag handlers:
 * this is a display-only preview, not a picker. */
export function buildStaticMapHtml(lat: number, lng: number, zoom: number): string {
  const script = `
    L.marker([${lat}, ${lng}]).addTo(map);
  `;
  return baseHtml(script, lat, lng, zoom);
}

export type PropertiesMarkerInit = { id: string; lat: number; lng: number; color: string };

export type PropertiesMapInit = {
  latitude: number;
  longitude: number;
  zoom: number;
  markers: PropertiesMarkerInit[];
  polygon: { lat: number; lng: number }[] | null;
};

/** Multiple pins + optional drawn polygon, used by PropertiesMapView.native.tsx. */
export function buildPropertiesMapHtml(init: PropertiesMapInit): string {
  const markersJson = JSON.stringify(init.markers);
  const polygonJson = JSON.stringify(init.polygon ?? []);

  const script = `
    var markerLayer = L.layerGroup().addTo(map);
    var polygonLayer = null;

    function renderMarkers(markers) {
      markerLayer.clearLayers();
      markers.forEach(function (m) {
        L.circleMarker([m.lat, m.lng], {
          radius: 9, color: '#ffffff', weight: 2, fillColor: m.color, fillOpacity: 1
        })
          .addTo(markerLayer)
          .on('click', function () { post({ type: 'markerPress', id: m.id }); });
      });
    }

    function renderPolygon(points) {
      if (polygonLayer) { map.removeLayer(polygonLayer); polygonLayer = null; }
      if (points && points.length > 1) {
        polygonLayer = L.polygon(points.map(function (p) { return [p.lat, p.lng]; }), {
          color: '#22A652', fillColor: '#22A652', fillOpacity: 0.18, weight: 2
        }).addTo(map);
      }
    }

    window.setMarkers = renderMarkers;
    window.setPolygon = renderPolygon;

    map.on('click', function (e) {
      post({ type: 'mapPress', lat: e.latlng.lat, lng: e.latlng.lng });
    });

    renderMarkers(${markersJson});
    renderPolygon(${polygonJson});
  `;

  return baseHtml(script, init.latitude, init.longitude, init.zoom);
}
