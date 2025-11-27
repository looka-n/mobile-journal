import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="entry/[id]"
        options={{
          animation: "fade_from_bottom",
        }}
      />
    </Stack>
  );
}