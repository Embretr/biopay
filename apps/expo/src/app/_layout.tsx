import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { CriiptoVerifyProvider } from "@criipto/verify-expo";
import { useAuthStore } from "../store/auth-store";
import { parseAuthDeepLink } from "../lib/auth";
import { registerForPushNotifications } from "../lib/notifications";

// Populated from .env when running against real Idura Verify.
// Harmless placeholder values are used in mock mode (login never calls Criipto).
const IDURA_DOMAIN = process.env.EXPO_PUBLIC_IDURA_DOMAIN ?? "mock.idura.eu";
const IDURA_CLIENT_ID = process.env.EXPO_PUBLIC_IDURA_CLIENT_ID ?? "mock-client";

export default function RootLayout() {
  const { initialize, isAuthenticated, setAuthenticated } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle deep links (mock mode BankID callback + general deep link support)
  useEffect(() => {
    const subscription = Linking.addEventListener("url", async ({ url }) => {
      if (url.startsWith("biopay://auth/callback")) {
        const tokens = parseAuthDeepLink(url);
        if (tokens) await setAuthenticated(tokens);
      }
    });

    Linking.getInitialURL().then(async (url) => {
      if (url?.startsWith("biopay://auth/callback")) {
        const tokens = parseAuthDeepLink(url);
        if (tokens) await setAuthenticated(tokens);
      }
    });

    return () => subscription.remove();
  }, [setAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().catch(console.warn);
    }
  }, [isAuthenticated]);

  return (
    <CriiptoVerifyProvider domain={IDURA_DOMAIN} clientID={IDURA_CLIENT_ID}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#111827",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </CriiptoVerifyProvider>
  );
}
