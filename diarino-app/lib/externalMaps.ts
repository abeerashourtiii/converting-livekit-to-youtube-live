import { Linking, Platform } from "react-native";

// `Linking` and `Platform` are core React Native APIs with a working
// react-native-web shim, so — unlike react-native-maps/webrtc — this file
// does not need a .native/.web split; it only branches at runtime.

function buildMapUrl(lat: number, lng: number, label?: string): string {
  const encodedLabel = label ? encodeURIComponent(label) : `${lat},${lng}`;

  if (Platform.OS === "android") {
    return `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
  }
  if (Platform.OS === "ios") {
    return `maps://?q=${encodedLabel}&ll=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function buildFallbackUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Opens a coordinate in the device's native maps app (or Google Maps in the browser on web). */
export async function openInExternalMaps(lat: number, lng: number, label?: string): Promise<void> {
  const primaryUrl = buildMapUrl(lat, lng, label);
  const fallbackUrl = buildFallbackUrl(lat, lng);

  if (Platform.OS === "web") {
    await Linking.openURL(primaryUrl);
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(primaryUrl);
    await Linking.openURL(canOpen ? primaryUrl : fallbackUrl);
  } catch {
    await Linking.openURL(fallbackUrl);
  }
}

// ↔ property/[id]'s location section: some listings (mostly demo/seed
// data or ones published before geo-search existed) have no lat/lng at
// all — this opens a text-only place search instead of pointing to
// (0,0)/"Null Island", which is what passing missing coordinates into
// openInExternalMaps would otherwise do.
export async function openAddressInExternalMaps(address: string): Promise<void> {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  await Linking.openURL(url);
}
