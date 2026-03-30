import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useAuthStore } from "../store/auth-store";
import { parseAuthDeepLink } from "../lib/auth";
import { registerForPushNotifications } from "../lib/notifications";

export default function RootLayout() {
  const { initialize, isAuthenticated, setAuthenticated } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

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
    <>
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
    </>
  );
}
