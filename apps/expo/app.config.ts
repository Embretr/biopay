import { readFileSync } from "fs";
import { resolve } from "path";
import { ExpoConfig, ConfigContext } from "expo/config";

// Expo's Metro only auto-reads .env from apps/expo/, not the monorepo root.
// We parse the root .env here so every EXPO_PUBLIC_* var reaches the bundler.
try {
  const raw = readFileSync(resolve(__dirname, "../../.env"), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // No root .env present — env vars must come from the shell
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "BioPay",
  slug: "biopay",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "no.biopay.app",
    infoPlist: {
      NSFaceIDUsageDescription: "BioPay bruker Face ID for sikker innlogging.",
      NSCameraUsageDescription: "BioPay bruker kameraet for å registrere håndflaten din.",
      "ITSAppUsesNonExemptEncryption": false
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1f9850",
    },
    package: "no.biopay.app",
    permissions: ["USE_FINGERPRINT", "USE_BIOMETRIC", "CAMERA"],
  },
  web: {
    bundler: "metro",
  },
  scheme: "biopay",
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      {
        cameraPermission:
          "BioPay bruker kameraet for å registrere håndflaten din.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#1f9850",
        sounds: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001",
    "eas": {
        "projectId": "eb9120de-7102-463d-865e-11979e3c9172"
      }
  },
});
