import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { ToastProvider } from "@/src/components/Toast";
import { FONT, colors } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ [FONT]: require("../assets/fonts/NotoNastaliqUrdu.ttf") });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add-expense" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="add-udhaar" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="add-bill" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="settings" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
            </Stack>
          </ToastProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
