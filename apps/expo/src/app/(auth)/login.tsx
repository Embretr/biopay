import { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useCriiptoVerify } from "@criipto/verify-expo";
import { authApi } from "../../lib/api";
import { getRedirectUri, parseAuthDeepLink } from "../../lib/auth";
import { useAuthStore } from "../../store/auth-store";

WebBrowser.maybeCompleteAuthSession();

const PRIMARY = "#1f9850";

// Norwegian BankID at substantial assurance level
const ACR_VALUES = "urn:grn:authn:no:bankid:substantial";

// When EXPO_PUBLIC_IDURA_DOMAIN is absent the app falls back to the mock flow
// (HTML form served by the API). No Criipto calls are made in mock mode.
const IS_MOCK = !process.env.EXPO_PUBLIC_IDURA_DOMAIN;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  // Hook is always called (React rules), but only used in real mode
  const { login } = useCriiptoVerify();

  const handleBankIDLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      if (IS_MOCK) {
        // ── Mock flow ──────────────────────────────────────────────────────
        // Opens a simple HTML form served by the API, no real BankID involved.
        const redirectUri = getRedirectUri();
        const { data } = await authApi.initiate(redirectUri);
        const result = await WebBrowser.openAuthSessionAsync(data.authUrl, redirectUri);

        if (result.type === "success" && result.url) {
          const tokens = parseAuthDeepLink(result.url);
          if (tokens) {
            await setAuthenticated(tokens);
          } else {
            setError("Ugyldig svar fra innlogging. Prøv igjen.");
          }
        }
      } else {
        // ── Real Criipto / Idura Verify flow ───────────────────────────────
        // The SDK handles PKCE, browser session, and code exchange.
        // It redirects back to biopay://auth/callback, which the SDK intercepts.
        const redirectUri = getRedirectUri();
        const result = await login(ACR_VALUES, redirectUri);

        if (
          !result ||
          typeof result !== "object" ||
          !("id_token" in result) ||
          typeof result.id_token !== "string"
        ) {
          setError("Innlogging ble avbrutt. Prøv igjen.");
          return;
        }

        const { data } = await authApi.exchangeIdToken(result.id_token);
        await setAuthenticated({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      }
    } catch (err) {
      console.error("BankID login error:", err);
      setError("Kunne ikke starte BankID-innlogging. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require("../../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>BioPay</Text>
        <Text style={styles.tagline}>Betal med håndflaten din</Text>
      </View>

      <View style={styles.features}>
        <FeatureRow icon={<HandFeatureIcon />} text="Registrer hånden din én gang" />
        <FeatureRow icon={<StoreIcon />} text="Betal i butikk uten kort eller telefon" />
        <FeatureRow icon={<WalletFeatureIcon />} text="Digital lommebok med norsk BankID" />
        <FeatureRow icon={<LockFeatureIcon />} text="Sikret med BankID og biometri" />
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {IS_MOCK && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>Mock-modus — ingen ekte BankID</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bankidButton, loading && styles.buttonDisabled]}
          onPress={handleBankIDLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.bankidButtonText}>Logg inn med BankID</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          BioPay bruker BankID for sikker identifisering. Vi lagrer ikke
          fødselsnummeret ditt etter verifisering.
        </Text>
      </View>
    </View>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconBox}>{icon}</View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function HandFeatureIcon() {
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end", height: 18 }}>
      {[10, 14, 16, 14, 12].map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h, backgroundColor: PRIMARY, borderRadius: 2 }} />
      ))}
    </View>
  );
}

function StoreIcon() {
  return (
    <View style={{ width: 20, height: 18 }}>
      <View style={{ height: 7, backgroundColor: PRIMARY, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      <View style={{ flex: 1, flexDirection: "row", gap: 2, marginTop: 2 }}>
        <View style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 1 }} />
        <View style={{ width: 7, backgroundColor: PRIMARY, borderRadius: 1 }} />
      </View>
    </View>
  );
}

function WalletFeatureIcon() {
  return (
    <View style={{ width: 20, height: 15, borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 3, justifyContent: "center", alignItems: "flex-end", paddingRight: 3 }}>
      <View style={{ width: 7, height: 5, backgroundColor: PRIMARY, borderRadius: 2 }} />
    </View>
  );
}

function LockFeatureIcon() {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: 12, height: 7, borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 6, borderBottomWidth: 0, marginBottom: -1 }} />
      <View style={{ width: 18, height: 12, backgroundColor: PRIMARY, borderRadius: 3 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 6,
  },
  features: {
    flex: 1,
    gap: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIconBox: {
    width: 40,
    height: 40,
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
    lineHeight: 22,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
  },
  mockBanner: {
    backgroundColor: "#fefce8",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  mockText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "500",
  },
  footer: {
    gap: 16,
  },
  bankidButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bankidButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
  },
});
