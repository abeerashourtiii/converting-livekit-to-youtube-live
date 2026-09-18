import { useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { Text, StyleSheet, Animated } from "react-native";

let message: string | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function getSnapshot() {
  return message ? `${counter}:${message}` : null;
}

// ↔ toast(msg) — call from anywhere, no provider/prop-drilling needed.
export function showToast(msg: string) {
  message = msg;
  counter += 1;
  emit();
}

export function ToastHost() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const opacity = useRef(new Animated.Value(0)).current;
  const [visibleText, setVisibleText] = useState<string | null>(null);

  useEffect(() => {
    if (!snap) return;
    setVisibleText(snap.slice(snap.indexOf(":") + 1));
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const timeout = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 2200);
    return () => clearTimeout(timeout);
  }, [snap]);

  if (!visibleText) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.text}>{visibleText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", top: 55, left: 24, right: 24, alignItems: "center",
    zIndex: 999,
  },
  text: {
    backgroundColor: "#0f172a", color: "white", fontWeight: "800", fontSize: 12.5,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, overflow: "hidden",
  },
});
