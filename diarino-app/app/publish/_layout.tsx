import { Stack } from "expo-router";

export default function PublishLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: "modal" }}>
      <Stack.Screen name="create-listing" />
      <Stack.Screen name="create-request" />
    </Stack>
  );
}
