import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";

// ↔ useMyCurrentLocation()'s implicit browser permission prompt in
// app-viewer.html (navigator.geolocation.getCurrentPosition just triggers
// the browser's native prompt with no explanatory UI). Native gets the
// same explicit, explained gate pattern already used for camera/mic in
// components/live/PermissionGate.tsx — better UX than a bare OS dialog.

export type PermissionStatus = "unknown" | "granted" | "denied";

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>("unknown");
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const perm = await Location.getForegroundPermissionsAsync();
    setStatus(perm.granted ? "granted" : perm.canAskAgain ? "unknown" : "denied");
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    setStatus(perm.granted ? "granted" : perm.canAskAgain ? "unknown" : "denied");
    return perm.granted;
  }, []);

  return { status, checking, granted: status === "granted", denied: status === "denied", request, refresh };
}
