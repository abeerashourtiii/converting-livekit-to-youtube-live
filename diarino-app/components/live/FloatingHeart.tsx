import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";

// ↔ shared between app/live/broadcast.tsx and app/live/[id].tsx — spawns a
// floating heart each time `burstId` changes (i.e. each time
// lib/hooks/useYouTubeLive.ts's useLiveChat() sees a "like" tap from
// anyone in the room, local or remote).
export function FloatingHeartLayer({ burstId }: { burstId: number }) {
  const [hearts, setHearts] = useState<number[]>([]);
  const prevBurstId = useRef(burstId);

  useEffect(() => {
    if (burstId === prevBurstId.current) return;
    prevBurstId.current = burstId;
    setHearts((prev) => [...prev, burstId]);
    const timeout = setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h !== burstId));
    }, 1400);
    return () => clearTimeout(timeout);
  }, [burstId]);

  return (
    <>
      {hearts.map((h) => (
        <FloatingHeart key={h} />
      ))}
    </>
  );
}

function FloatingHeart() {
  const progress = useRef(new Animated.Value(0)).current;
  const leftDrift = useRef(Math.random() * 40 - 20).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: true }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -160] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.Text
      style={[styles.heart, { transform: [{ translateY }, { translateX: leftDrift }], opacity }]}
    >
      ❤️
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  heart: { position: "absolute", bottom: 160, right: 24, fontSize: 26 },
});
