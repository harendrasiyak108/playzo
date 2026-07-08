import { Stack } from "expo-router";
import { colors } from "@/src/theme";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
