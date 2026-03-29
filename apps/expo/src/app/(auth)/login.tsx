import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { authApi } from "../../lib/api";
import { getRedirectUri } from "../../lib/auth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleBankIDLogin = async () => {
    setLoading(true);
    try {
      const redirectUri = getRedirectUri();
      const { data } = await authApi.initiate(redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(data.authUrl, "biopay://auth/callback");

      if (result.type === "cancel") {
        // User dismissed — no error
      } else if (result.type === "success") {
        // Deep link handler in _layout.tsx will process the callback
      }
    } catch (err) {
      Alert.alert(
        "Innlogging feilet",
        "Kunne ikke starte BankID-innlogging. Prøv igjen.",
        [{ text: "OK" }],
      );
      console.error("BankID login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>B</Text>
        </View>
        <Text style={styles.appName}>BioPay</Text>
        <Text style={styles.tagline}>Betal med håndflaten din</Text>
      </View>

      <View style={styles.features}>
        <FeatureRow icon="👋" text="Registrer hånden din én gang" />
        <FeatureRow icon="🏪" text="Betal i butikk uten kort eller telefon" />
        <FeatureRow icon="💰" text="Digital lommebok med norsk bankID" />
        <FeatureRow icon="🔒" text="Sikret med BankID og biometri" />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bankidButton, loading && styles.buttonDisabled]}
          onPress={handleBankIDLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#0a0a0f" />
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

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoBox: {
    width: 72,
    height: 72,
    backgroundColor: "#00e5cc",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#0a0a0f",
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#e2e8f0",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 16,
    color: "#64748b",
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
  featureIcon: {
    fontSize: 28,
    width: 40,
    textAlign: "center",
  },
  featureText: {
    fontSize: 16,
    color: "#e2e8f0",
    flex: 1,
    lineHeight: 22,
  },
  footer: {
    gap: 16,
  },
  bankidButton: {
    backgroundColor: "#00e5cc",
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
    color: "#0a0a0f",
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
