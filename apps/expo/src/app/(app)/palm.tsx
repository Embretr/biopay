import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { palmApi } from "../../lib/api";

type PalmEnrollment = { palmId: string; status: string; enrolledAt: string } | null;

export default function PalmScreen() {
  const [enrollment, setEnrollment] = useState<PalmEnrollment | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const loadEnrollment = useCallback(async () => {
    try {
      const res = await palmApi.get();
      setEnrollment(res.data);
    } catch (err) {
      console.error("Failed to load palm enrollment:", err);
      setEnrollment(null);
    }
  }, []);

  useEffect(() => {
    loadEnrollment();
  }, [loadEnrollment]);

  const handleEnroll = async () => {
    Alert.alert(
      "Registrer palme",
      "Du vil nå registrere håndflaten din for betaling. Hold hånden flat foran kameraet.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Start registrering",
          onPress: async () => {
            setLoading(true);
            try {
              await palmApi.enroll();
              await loadEnrollment();
              Alert.alert(
                "Palme registrert! ✓",
                "Du kan nå betale i butikker med PalmID-terminal.",
              );
            } catch {
              Alert.alert("Feil", "Kunne ikke registrere palme. Prøv igjen.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleRevoke = () => {
    Alert.alert(
      "Slett palmeregistrering",
      "Er du sikker? Du vil ikke kunne betale med palme etter dette.",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await palmApi.revoke();
              setEnrollment(null);
              Alert.alert("Slettet", "Palmeregistreringen er fjernet.");
            } catch {
              Alert.alert("Feil", "Kunne ikke slette registrering. Prøv igjen.");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  if (enrollment === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00e5cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Palm icon */}
      <View style={styles.palmIconContainer}>
        <Text style={styles.palmEmoji}>🖐️</Text>
        {enrollment && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Aktiv</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>
        {enrollment ? "Palme registrert" : "Ingen palmeregistrering"}
      </Text>
      <Text style={styles.subtitle}>
        {enrollment
          ? "Du kan betale i PalmID-terminaler ved å holde hånden over leseren."
          : "Registrer håndflaten din for å betale i butikk uten kort eller telefon."}
      </Text>

      {enrollment && (
        <View style={styles.infoCard}>
          <InfoRow label="Palm-ID" value={enrollment.palmId} mono />
          <InfoRow label="Status" value="Aktiv" valueColor="#22c55e" />
          <InfoRow
            label="Registrert"
            value={new Date(enrollment.enrolledAt).toLocaleDateString("nb-NO", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          />
        </View>
      )}

      {!enrollment && (
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Slik fungerer det</Text>
          <StepRow step="1" text="Trykk «Registrer palme» nedenfor" />
          <StepRow step="2" text="Hold hånden flat foran frontkameraet" />
          <StepRow step="3" text="BioPay registrerer din unike håndlinjer" />
          <StepRow step="4" text="Betal i butikk ved å holde hånden over terminalen" />
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, enrollment ? styles.revokeButton : styles.enrollButton]}
        onPress={enrollment ? handleRevoke : handleEnroll}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={enrollment ? "#ef4444" : "#0a0a0f"} />
        ) : (
          <Text style={[styles.buttonText, enrollment && styles.revokeButtonText]}>
            {enrollment ? "Slett palmeregistrering" : "Registrer palme"}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.gdprNote}>
        Palmebiometri behandles og lagres eksklusivt av PalmID (Redrock Biometrics) — aldri av BioPay.
        Ditt samtykke kan til enhver tid trekkes tilbake ved å slette registreringen.
      </Text>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, mono && styles.monoValue, valueColor ? { color: valueColor } : {}]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function StepRow({ step, text }: { step: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{step}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { padding: 24, alignItems: "center", gap: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  palmIconContainer: { position: "relative", alignItems: "center", marginTop: 12 },
  palmEmoji: { fontSize: 72 },
  activeBadge: {
    position: "absolute",
    bottom: -4,
    right: -8,
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: { fontSize: 11, fontWeight: "700", color: "white" },
  title: { fontSize: 22, fontWeight: "800", color: "#e2e8f0", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#64748b", textAlign: "center", lineHeight: 22 },
  infoCard: {
    width: "100%",
    backgroundColor: "#111118",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e2e",
  },
  infoLabel: { fontSize: 14, color: "#64748b" },
  infoValue: { fontSize: 14, color: "#e2e8f0", fontWeight: "500", maxWidth: "60%" },
  monoValue: { fontFamily: "monospace", fontSize: 11 },
  stepsCard: {
    width: "100%",
    backgroundColor: "#111118",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    padding: 16,
    gap: 12,
  },
  stepsTitle: { fontSize: 15, fontWeight: "700", color: "#e2e8f0", marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumber: {
    width: 24,
    height: 24,
    backgroundColor: "#00e5cc20",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontSize: 12, fontWeight: "700", color: "#00e5cc" },
  stepText: { fontSize: 14, color: "#e2e8f0", flex: 1, lineHeight: 20 },
  button: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 4,
  },
  enrollButton: { backgroundColor: "#00e5cc" },
  revokeButton: { borderWidth: 1, borderColor: "#ef444440", backgroundColor: "#ef444415" },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#0a0a0f" },
  revokeButtonText: { color: "#ef4444" },
  gdprNote: { fontSize: 12, color: "#64748b", textAlign: "center", lineHeight: 18 },
});
