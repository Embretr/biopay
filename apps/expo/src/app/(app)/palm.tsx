import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { palmApi } from "../../lib/api";

const PRIMARY = "#1f9850";

type PalmEnrollment = { palmId: string; status: string; enrolledAt: string } | null;

export default function PalmScreen() {
  const [enrollment, setEnrollment] = useState<PalmEnrollment | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // Sheets
  const [enrollSheetVisible, setEnrollSheetVisible] = useState(false);
  const [revokeSheetVisible, setRevokeSheetVisible] = useState(false);

  // Inline feedback
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadEnrollment = useCallback(async () => {
    try {
      const res = await palmApi.get();
      setEnrollment(res.data);
    } catch {
      setEnrollment(null);
    }
  }, []);

  useEffect(() => {
    loadEnrollment();
  }, [loadEnrollment]);

  const handleEnroll = async () => {
    setEnrollSheetVisible(false);
    setLoading(true);
    setErrorMsg(null);
    try {
      await palmApi.enroll();
      await loadEnrollment();
      setSuccessMsg("Du kan nå betale i butikker med PalmID-terminal.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      setErrorMsg("Kunne ikke registrere palme. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setRevokeSheetVisible(false);
    setLoading(true);
    setErrorMsg(null);
    try {
      await palmApi.revoke();
      setEnrollment(null);
      setSuccessMsg("Palmeregistreringen er fjernet.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg("Kunne ikke slette registrering. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  if (enrollment === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {successMsg && (
          <View style={styles.successBanner}>
            <View style={styles.successDot} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Palm icon */}
        <View style={styles.palmIconContainer}>
          <View style={styles.palmIconCircle}>
            <PalmSvgIcon color={enrollment ? PRIMARY : "#9ca3af"} />
          </View>
          {enrollment && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
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
            <InfoRow label="Status" value="Aktiv" valueColor="#16a34a" />
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
          style={[
            styles.button,
            enrollment ? styles.revokeButton : styles.enrollButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={() => enrollment ? setRevokeSheetVisible(true) : setEnrollSheetVisible(true)}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={enrollment ? "#dc2626" : "#ffffff"} />
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

      {/* ── Enroll confirm sheet ── */}
      <Modal visible={enrollSheetVisible} transparent animationType="slide" onRequestClose={() => setEnrollSheetVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setEnrollSheetVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIconCircle}>
            <PalmSvgIcon color={PRIMARY} />
          </View>
          <Text style={styles.sheetTitle}>Registrer palme</Text>
          <Text style={styles.sheetBody}>
            Du vil nå registrere håndflaten din for betaling. Hold hånden flat foran kameraet.
          </Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEnrollSheetVisible(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleEnroll}>
              <Text style={styles.confirmButtonText}>Start registrering</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Revoke confirm sheet ── */}
      <Modal visible={revokeSheetVisible} transparent animationType="slide" onRequestClose={() => setRevokeSheetVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setRevokeSheetVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[styles.sheetIconCircle, { backgroundColor: "#fef2f2" }]}>
            <View style={styles.revokeX}>
              <View style={[styles.revokeBar, { transform: [{ rotate: "45deg" }] }]} />
              <View style={[styles.revokeBar, { transform: [{ rotate: "-45deg" }], position: "absolute" }]} />
            </View>
          </View>
          <Text style={styles.sheetTitle}>Slett palmeregistrering?</Text>
          <Text style={styles.sheetBody}>
            Er du sikker? Du vil ikke kunne betale med palme etter dette.
          </Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setRevokeSheetVisible(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.destructiveButton} onPress={handleRevoke}>
              <Text style={styles.destructiveButtonText}>Slett</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function PalmSvgIcon({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end", height: 28 }}>
      {[18, 24, 28, 24, 20].map((h, i) => (
        <View key={i} style={{ width: 5, height: h, backgroundColor: color, borderRadius: 3 }} />
      ))}
    </View>
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
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content: { padding: 24, alignItems: "center", gap: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8faf9" },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  successText: { color: "#15803d", fontSize: 14, fontWeight: "500", flex: 1 },
  errorBanner: {
    width: "100%",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },

  palmIconContainer: { position: "relative", alignItems: "center", marginTop: 12 },
  palmIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e8f5ee",
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadge: {
    position: "absolute",
    bottom: -4,
    right: -12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#bbf7d0" },
  activeBadgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },

  title: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 22 },

  infoCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  infoLabel: { fontSize: 14, color: "#6b7280" },
  infoValue: { fontSize: 14, color: "#111827", fontWeight: "500", maxWidth: "60%" },
  monoValue: { fontFamily: "monospace", fontSize: 11 },

  stepsCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 12,
  },
  stepsTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNumber: {
    width: 24,
    height: 24,
    backgroundColor: "#e8f5ee",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  stepText: { fontSize: 14, color: "#374151", flex: 1, lineHeight: 20 },

  button: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 4,
  },
  enrollButton: { backgroundColor: PRIMARY },
  revokeButton: { borderWidth: 1, borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  revokeButtonText: { color: "#dc2626" },
  buttonDisabled: { opacity: 0.6 },

  gdprNote: { fontSize: 12, color: "#9ca3af", textAlign: "center", lineHeight: 18 },

  // Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    marginBottom: 4,
  },
  sheetIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e8f5ee",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  sheetBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 16 },
  confirmButton: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  confirmButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  destructiveButton: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  destructiveButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  revokeX: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  revokeBar: { width: 20, height: 2.5, backgroundColor: "#dc2626", borderRadius: 2 },
});
