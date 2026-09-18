import { Stack } from "expo-router";

export default function LiveLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "fullScreenModal" }}>
      <Stack.Screen name="broadcast" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="replay/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}