import { Stack } from "expo-router";

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
