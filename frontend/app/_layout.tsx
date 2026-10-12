import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, LogBox, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { ToastProvider } from "@/src/components/Toast";
import { FONTS, ThemeProvider, useTheme } from "@/src/theme";
import { LangProvider } from "@/src/i18n";
import { AuthProvider, useAuth } from "@/src/auth";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)
SplashScreen.preventAutoHideAsync().catch(() => {});

const modal = { presentation: "fullScreenModal" as const, animation: "slide_from_bottom" as const };

function Gate() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    const first = segments[0] as string | undefined;
    if (!user) {
      if (first !== "login") router.replace("/login");
    } else if (!user.household_id) {
      if (first !== "household") router.replace("/household");
    } else if (first === "login" || first === "household") {
      router.replace("/");
    }
  }, [user, segments, router]);

  if (user === undefined) {
    return (
      <View testID="auth-loading" style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="household" options={{ animation: "fade" }} />
        <Stack.Screen name="add-expense" options={modal} />
        <Stack.Screen name="add-udhaar" options={modal} />
        <Stack.Screen name="add-bill" options={modal} />
        <Stack.Screen name="settings" options={modal} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [FONTS.ur]: require("../assets/fonts/NotoNastaliqUrdu.ttf"),
    [FONTS.en]: require("../assets/fonts/Nunito.ttf"),
  });
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;

  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app.
  return (
    <ErrorBoundary>
      <LangProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <ToastProvider>
                  <Gate />
                </ToastProvider>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}
