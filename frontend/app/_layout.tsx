import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0F0F11" }}>
      <SafeAreaProvider>
        <AuthProvider>
          <InnerApp />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function InnerApp() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // allow access to login/register when not authenticated
  const first = segments[0] || "";

  useEffect(() => {
    if (!loading && !user) {
      if (first !== "login" && first !== "register") {
        router.replace("/login");
      }
    }
  }, [loading, user, first]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F11" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F0F11" } }} />
    </>
  );
}
