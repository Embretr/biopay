import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { usersApi, authApi, bankAccountsApi, type UserProfile, type BankAccount } from "../../lib/api";
import { useAuthStore } from "../../store/auth-store";

const PRIMARY = "#1f9850";

export default function SettingsScreen() {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Logout sheet
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Add bank account sheet
  const [addBankVisible, setAddBankVisible] = useState(false);
  const [bankIban, setBankIban] = useState("");
  const [bankOwner, setBankOwner] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  // Remove confirm sheet
  const [removeTarget, setRemoveTarget] = useState<BankAccount | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, bankRes] = await Promise.all([
        usersApi.me(),
        bankAccountsApi.list(),
      ]);
      setProfile(profileRes.data);
      setBankAccounts(bankRes.data);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try { await authApi.logout(); } catch {}
    await logout();
    setLogoutLoading(false);
    setLogoutVisible(false);
  };

  const handleAddBank = async () => {
    setBankError(null);
    const iban = bankIban.trim().replace(/\s/g, "");
    if (iban.length < 10) {
      setBankError("Skriv inn et gyldig IBAN-nummer (minst 10 tegn).");
      return;
    }
    if (!bankOwner.trim()) {
      setBankError("Skriv inn kontohaverens navn.");
      return;
    }
    if (!bankName.trim()) {
      setBankError("Skriv inn bankens navn.");
      return;
    }
    setBankLoading(true);
    try {
      await bankAccountsApi.add(iban, bankOwner.trim(), bankName.trim());
      setAddBankVisible(false);
      setBankIban("");
      setBankOwner("");
      setBankName("");
      await loadData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) setBankError("Denne bankkontoen er allerede tilknyttet.");
      else setBankError("Kunne ikke legge til bankkonto. Prøv igjen.");
    } finally {
      setBankLoading(false);
    }
  };

  const handleRemoveBank = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      await bankAccountsApi.remove(removeTarget.id);
      setRemoveTarget(null);
      await loadData();
    } catch {
      setRemoveTarget(null);
    } finally {
      setRemoveLoading(false);
    }
  };

  const kycLabel: Record<string, string> = { VERIFIED: "Verifisert", PENDING: "Venter", FAILED: "Mislyktes" };
  const kycColor: Record<string, string> = { VERIFIED: "#16a34a", PENDING: "#d97706", FAILED: "#dc2626" };

  const formatIban = (iban: string) =>
    iban.replace(/(.{4})/g, "$1 ").trim();

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>
              {profile?.name
                ? profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                : "?"}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile?.name ?? "—"}</Text>
          {profile?.kycStatus && (
            <View style={[styles.kycBadge, { borderColor: kycColor[profile.kycStatus] ?? "#9ca3af" }]}>
              <View style={[styles.kycDot, { backgroundColor: kycColor[profile.kycStatus] ?? "#9ca3af" }]} />
              <Text style={[styles.kycLabel, { color: kycColor[profile.kycStatus] ?? "#9ca3af" }]}>
                BankID {kycLabel[profile.kycStatus] ?? profile.kycStatus}
              </Text>
            </View>
          )}
        </View>

        {/* Profile info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kontoinformasjon</Text>
          <InfoRow label="Fullt navn" value={profile?.name ?? null} />
          <InfoRow label="E-post" value={profile?.email ?? null} />
          <InfoRow label="Telefon" value={profile?.phoneNumber ?? "—"} />
          <InfoRow
            label="Medlem siden"
            value={
              profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("nb-NO", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : null
            }
            last
          />
        </View>

        {/* Wallet info */}
        {profile?.wallet && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lommebok</Text>
            <InfoRow
              label="Saldo"
              value={`${(profile.wallet.balanceCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} ${profile.wallet.currency}`}
            />
            <InfoRow label="Valuta" value={profile.wallet.currency} last />
          </View>
        )}

        {/* Bank accounts */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Bankkontoer</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => { setBankIban(""); setBankOwner(profile?.name ?? ""); setBankName(""); setBankError(null); setAddBankVisible(true); }}
            >
              <View style={styles.addButtonIcon}>
                <View style={styles.plusH} />
                <View style={styles.plusV} />
              </View>
              <Text style={styles.addButtonText}>Legg til</Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <View style={styles.emptyBankRow}>
              <View style={styles.bankIconBox}>
                <View style={styles.bankIconTop} />
                <View style={styles.bankIconBottom} />
              </View>
              <Text style={styles.emptyBankText}>Ingen bankkonto tilknyttet</Text>
            </View>
          ) : (
            bankAccounts.map((account, i) => (
              <View key={account.id} style={[styles.bankRow, i === bankAccounts.length - 1 && styles.bankRowLast]}>
                <View style={styles.bankIconBox}>
                  <View style={styles.bankIconTop} />
                  <View style={styles.bankIconBottom} />
                </View>
                <View style={styles.bankInfo}>
                  <Text style={styles.bankOwner}>{account.ownerName}</Text>
                  <Text style={styles.bankIban}>{formatIban(account.iban)}</Text>
                  <Text style={styles.bankNameText}>{account.bankName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => setRemoveTarget(account)}
                >
                  <View style={[styles.removeBar, { transform: [{ rotate: "45deg" }] }]} />
                  <View style={[styles.removeBar, { transform: [{ rotate: "-45deg" }], position: "absolute" }]} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => setLogoutVisible(true)}>
          <View style={styles.logoutIcon}>
            <View style={styles.logoutDoor} />
            <View style={styles.logoutArrow} />
          </View>
          <Text style={styles.logoutText}>Logg ut</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>BioPay v1.0.0</Text>
      </ScrollView>

      {/* ── Add bank account sheet ── */}
      <Modal visible={addBankVisible} transparent animationType="slide" onRequestClose={() => setAddBankVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAddBankVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Legg til bankkonto</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>IBAN</Text>
            <TextInput
              style={styles.input}
              value={bankIban}
              onChangeText={(v) => { setBankIban(v); setBankError(null); }}
              placeholder="NO93 1234 5678 901"
              placeholderTextColor="#d1d5db"
              autoCapitalize="characters"
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Kontohaver</Text>
            <TextInput
              style={styles.input}
              value={bankOwner}
              onChangeText={(v) => { setBankOwner(v); setBankError(null); }}
              placeholder="Ola Nordmann"
              placeholderTextColor="#d1d5db"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bank</Text>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={(v) => { setBankName(v); setBankError(null); }}
              placeholder="DNB, Sbanken, Nordea..."
              placeholderTextColor="#d1d5db"
            />
          </View>

          {bankError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{bankError}</Text>
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setAddBankVisible(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, bankLoading && styles.buttonDisabled]}
              onPress={handleAddBank}
              disabled={bankLoading}
            >
              {bankLoading
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.confirmButtonText}>Tilknytt</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Remove bank account sheet ── */}
      <Modal visible={!!removeTarget} transparent animationType="slide" onRequestClose={() => setRemoveTarget(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setRemoveTarget(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Fjern bankkonto?</Text>
          {removeTarget && (
            <View style={styles.removePreview}>
              <Text style={styles.removePreviewName}>{removeTarget.ownerName}</Text>
              <Text style={styles.removePreviewIban}>{formatIban(removeTarget.iban)}</Text>
              <Text style={styles.removePreviewBank}>{removeTarget.bankName}</Text>
            </View>
          )}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setRemoveTarget(null)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.destructiveButton, removeLoading && styles.buttonDisabled]}
              onPress={handleRemoveBank}
              disabled={removeLoading}
            >
              {removeLoading
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.destructiveButtonText}>Fjern</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Logout confirm sheet ── */}
      <Modal visible={logoutVisible} transparent animationType="slide" onRequestClose={() => setLogoutVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setLogoutVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.confirmIconCircle}>
            <View style={styles.confirmIconDoor} />
          </View>
          <Text style={styles.sheetTitle}>Logg ut?</Text>
          <Text style={styles.sheetSubtitle}>Du må logge inn på nytt med BankID for å bruke BioPay.</Text>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setLogoutVisible(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.destructiveButton, logoutLoading && styles.buttonDisabled]}
              onPress={handleLogout}
              disabled={logoutLoading}
            >
              {logoutLoading
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.destructiveButtonText}>Logg ut</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function InfoRow({ label, value, last }: { label: string; value?: string | null | undefined; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content: { padding: 20, gap: 16, paddingBottom: 48 },

  avatarSection: { alignItems: "center", paddingVertical: 12, gap: 10 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontSize: 28, fontWeight: "700", color: "#ffffff" },
  displayName: { fontSize: 22, fontWeight: "700", color: "#111827" },
  kycBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  kycDot: { width: 7, height: 7, borderRadius: 4 },
  kycLabel: { fontSize: 13, fontWeight: "600" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#e8f5ee",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  addButtonIcon: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  plusH: { width: 12, height: 1.5, backgroundColor: PRIMARY, borderRadius: 1, position: "absolute" },
  plusV: { width: 1.5, height: 12, backgroundColor: PRIMARY, borderRadius: 1, position: "absolute" },
  addButtonText: { fontSize: 13, fontWeight: "600", color: PRIMARY },

  emptyBankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  bankRowLast: { borderBottomWidth: 0 },
  bankIconBox: {
    width: 36,
    height: 36,
    backgroundColor: "#e8f5ee",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bankIconTop: {
    width: 18,
    height: 5,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  bankIconBottom: {
    width: 18,
    height: 9,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 2,
  },
  bankInfo: { flex: 1, gap: 1 },
  bankOwner: { fontSize: 14, fontWeight: "600", color: "#111827" },
  bankIban: { fontSize: 12, color: "#6b7280", fontFamily: "monospace" },
  bankNameText: { fontSize: 12, color: "#9ca3af" },
  emptyBankText: { fontSize: 14, color: "#9ca3af" },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBar: { width: 12, height: 1.5, backgroundColor: "#dc2626", borderRadius: 1 },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 15, color: "#6b7280" },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1, textAlign: "right" },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
  },
  logoutIcon: { width: 24, height: 20, justifyContent: "center", alignItems: "center" },
  logoutDoor: {
    width: 14,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#dc2626",
    borderRadius: 2,
    borderRightWidth: 0,
    position: "absolute",
    left: 0,
  },
  logoutArrow: {
    width: 12,
    height: 2,
    backgroundColor: "#dc2626",
    position: "absolute",
    right: 0,
  },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#dc2626" },

  versionText: { textAlign: "center", fontSize: 12, color: "#d1d5db" },

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
  sheetTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  sheetSubtitle: { fontSize: 14, color: "#6b7280", lineHeight: 20 },

  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center" },

  removePreview: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    gap: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  removePreviewName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  removePreviewIban: { fontSize: 13, color: "#6b7280", fontFamily: "monospace" },
  removePreviewBank: { fontSize: 12, color: "#9ca3af" },

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
  buttonDisabled: { opacity: 0.6 },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fef2f2",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmIconDoor: {
    width: 20,
    height: 22,
    borderWidth: 2,
    borderColor: "#dc2626",
    borderRadius: 3,
    borderRightWidth: 0,
  },
});
