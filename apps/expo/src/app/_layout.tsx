import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useAuthStore } from "../store/auth-store";
import { parseAuthDeepLink } from "../lib/auth";
import { registerForPushNotifications } from "../lib/notifications";
import { authApi } from "../lib/api";

export default function RootLayout() {
  const { initialize, isAuthenticated, setAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle deep link from BankID callback
  useEffect(() => {
    const subscription = Linking.addEventListener("url", async ({ url }) => {
      if (url.startsWith("biopay://auth/callback")) {
        const tokens = parseAuthDeepLink(url);
        if (tokens) {
          await setAuthenticated(tokens);
        }
      }
    });

    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then(async (url) => {
      if (url?.startsWith("biopay://auth/callback")) {
        const tokens = parseAuthDeepLink(url);
        if (tokens) {
          await setAuthenticated(tokens);
        }
      }
    });

    return () => subscription.remove();
  }, [setAuthenticated]);

  // Register push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().catch(console.warn);
    }
  }, [isAuthenticated]);

  return (
    <>
      <StatusBar style="light" backgroundColor="#0a0a0f" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0f" },
          headerTintColor: "#e2e8f0",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: "#0a0a0f" },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
