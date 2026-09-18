// Message shapes posted from the Leaflet page running inside the native
// WebView (see lib/leafletHtml.ts) back to React Native via
// `window.ReactNativeWebView.postMessage(JSON.stringify(...))`.
// Kept as a discriminated union + a safe parser so the native map
// components never need to reach for `any` when reading WebView events.

export type MapPressMessage = { type: "mapPress"; lat: number; lng: number };
export type PointChangeMessage = { type: "pointChange"; lat: number; lng: number };
export type RegionChangeMessage = {
  type: "regionChange";
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
export type MarkerPressMessage = { type: "markerPress"; id: string };
export type MapReadyMessage = { type: "mapReady" };

export type LeafletBridgeMessage =
  | MapPressMessage
  | PointChangeMessage
  | RegionChangeMessage
  | MarkerPressMessage
  | MapReadyMessage;

function isLeafletBridgeMessage(value: unknown): value is LeafletBridgeMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return (
    type === "mapPress" ||
    type === "pointChange" ||
    type === "regionChange" ||
    type === "markerPress" ||
    type === "mapReady"
  );
}

export function parseLeafletMessage(raw: string): LeafletBridgeMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    return isLeafletBridgeMessage(data) ? data : null;
  } catch {
    return null;
  }
}
