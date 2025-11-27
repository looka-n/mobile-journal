import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen
          name="entry/[id]"
          options={{
            animation: "fade_from_bottom",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}