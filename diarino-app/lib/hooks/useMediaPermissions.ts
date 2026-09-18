import { useCallback, useEffect, useState } from "react";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";

// ↔ the getUserMedia availability/permission check around line ~4870-4907
// in app-viewer.html (checks navigator.mediaDevices, shows an Arabic error
// if unavailable). Native equivalent: request expo-camera + expo-av mic
// permissions explicitly, up front, with a clear retry path — rather than
// letting react-native-webrtc's internal getUserMedia call surface a raw
// OS prompt with no context the first time someone taps "go live".

export type PermissionStatus = "unknown" | "granted" | "denied";

export function useMediaPermissions() {
  const [camera, setCamera] = useState<PermissionStatus>("unknown");
  const [mic, setMic] = useState<PermissionStatus>("unknown");
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const camPerm = await Camera.getCameraPermissionsAsync();
    const micPerm = await Audio.getPermissionsAsync();
    setCamera(camPerm.granted ? "granted" : camPerm.canAskAgain ? "unknown" : "denied");
    setMic(micPerm.granted ? "granted" : micPerm.canAskAgain ? "unknown" : "denied");
    setChecking(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    const camPerm = await Camera.requestCameraPermissionsAsync();
    const micPerm = await Audio.requestPermissionsAsync();
    setCamera(camPerm.granted ? "granted" : camPerm.canAskAgain ? "unknown" : "denied");
    setMic(micPerm.granted ? "granted" : micPerm.canAskAgain ? "unknown" : "denied");
    return camPerm.granted && micPerm.granted;
  }, []);

  return {
    camera,
    mic,
    checking,
    bothGranted: camera === "granted" && mic === "granted",
    eitherDenied: camera === "denied" || mic === "denied",
    request,
    refresh,
  };
}
