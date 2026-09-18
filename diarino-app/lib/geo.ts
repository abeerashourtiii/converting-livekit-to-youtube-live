// ↔ haversine() in app-viewer.html — identical formula/output (km).
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type LatLng = { lat: number; lng: number };

// ↔ bounding box of a drawn "منطقة اهتمام" polygon — sent to the
// properties_in_bounds RPC (20260821000000_geo_search.sql) as a cheap,
// indexed rectangular pre-filter before the exact polygon test below runs
// on the (already small) result.
export function boundingBox(points: LatLng[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
}

// ↔ standard ray-casting point-in-polygon test — exact check applied
// client-side to the bounding-box-filtered candidates from
// properties_in_bounds, since a polygon shape itself isn't something a
// plain rectangular/circular index query can test directly without
// PostGIS. `polygon` is the list of points the person tapped out on the
// map, in order.
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersects = yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
