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
import * as Crypto from "expo-crypto";
import { usersApi, walletApi, transactionsApi, type Transaction } from "../../lib/api";
import { useAuthStore } from "../../store/auth-store";
import { authApi } from "../../lib/api";

const PRIMARY = "#1f9850";

export default function HomeScreen() {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof usersApi.me>>["data"] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Deposit sheet
  const [depositVisible, setDepositVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);

  // Logout confirm sheet
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, txRes] = await Promise.all([
        usersApi.me(),
        transactionsApi.list({ limit: 5 }),
      ]);
      setProfile(profileRes.data);
      setTransactions(txRes.data.data);
    } catch (err) {
      console.error("Failed to load data:", err);
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

  const handleDeposit = async () => {
    setDepositError(null);
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      setDepositError("Skriv inn et gyldig beløp.");
      return;
    }
    setDepositLoading(true);
    try {
      const idempotencyKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Date.now().toString() + Math.random().toString(),
      );
      const key =
        idempotencyKey.slice(0, 8) + "-" +
        idempotencyKey.slice(8, 12) + "-4" +
        idempotencyKey.slice(13, 16) + "-" +
        idempotencyKey.slice(16, 20) + "-" +
        idempotencyKey.slice(20, 32);

      await walletApi.deposit(cents, key);
      setDepositVisible(false);
      setDepositAmount("");
      await loadData();
      setDepositSuccess(`${(cents / 100).toFixed(2)} NOK er lagt til lommeboken.`);
      setTimeout(() => setDepositSuccess(null), 3500);
    } catch {
      setDepositError("Innskudd feilet. Prøv igjen.");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await authApi.logout();
    } catch {}
    await logout();
    setLogoutLoading(false);
    setLogoutVisible(false);
  };

  const balance = profile?.wallet?.balanceCents ?? 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {depositSuccess && (
          <View style={styles.successBanner}>
            <View style={styles.successDot} />
            <Text style={styles.successBannerText}>{depositSuccess}</Text>
          </View>
        )}

        {/* Wallet card */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Tilgjengelig saldo</Text>
          <Text style={styles.walletBalance}>
            {(balance / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK
          </Text>
          <Text style={styles.walletName}>{profile?.name ?? "—"}</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => { setDepositAmount(""); setDepositError(null); setDepositVisible(true); }}
          >
            <Text style={styles.actionButtonText}>+ Sett inn</Text>
          </TouchableOpacity>
        </View>

        {/* Recent transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siste transaksjoner</Text>
          {transactions.length === 0 ? (
            <Text style={styles.emptyText}>Ingen transaksjoner ennå</Text>
          ) : (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => setLogoutVisible(true)}>
          <Text style={styles.logoutText}>Logg ut</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Deposit bottom sheet ── */}
      <Modal visible={depositVisible} transparent animationType="slide" onRequestClose={() => setDepositVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDepositVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sett inn penger</Text>

          <View style={styles.amountInputWrapper}>
            <TextInput
              style={styles.amountInput}
              value={depositAmount}
              onChangeText={(v) => { setDepositAmount(v); setDepositError(null); }}
              placeholder="0.00"
              placeholderTextColor="#d1d5db"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.currencyHint}>NOK</Text>
          </View>

          {depositError && (
            <View style={styles.sheetError}>
              <Text style={styles.sheetErrorText}>{depositError}</Text>
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setDepositVisible(false)}>
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, depositLoading && styles.buttonDisabled]}
              onPress={handleDeposit}
              disabled={depositLoading}
            >
              {depositLoading
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.confirmButtonText}>Sett inn</Text>
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

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === "DEPOSIT";
  const sign = isCredit ? "+" : "−";
  const amountColor = isCredit ? "#16a34a" : "#111827";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: transaction.merchantName ?? "Betaling",
    TRANSFER: "Overføring",
  };

  return (
    <View style={styles.txRow}>
      <View style={[styles.txDot, { backgroundColor: isCredit ? "#dcfce7" : "#f3f4f6" }]}>
        <View style={[styles.txDotInner, { backgroundColor: isCredit ? "#16a34a" : "#9ca3af" }]} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{typeLabels[transaction.type] ?? transaction.type}</Text>
        <Text style={styles.txDate}>
          {new Date(transaction.createdAt).toLocaleDateString("nb-NO")}
        </Text>
      </View>
      <View style={styles.txAmountCol}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {sign}{(transaction.amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK
        </Text>
        <StatusBadge status={transaction.status} />
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "#16a34a",
    PENDING: "#d97706",
    FAILED: "#dc2626",
    REFUNDED: "#6b7280",
  };
  const labels: Record<string, string> = {
    COMPLETED: "Fullført",
    PENDING: "Venter",
    FAILED: "Feilet",
    REFUNDED: "Refundert",
  };
  return (
    <Text style={[styles.statusBadge, { color: colors[status] ?? "#6b7280" }]}>
      {labels[status] ?? status}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content: { padding: 20, gap: 20, paddingBottom: 40 },

  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  successDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" },
  successBannerText: { color: "#15803d", fontSize: 14, fontWeight: "500", flex: 1 },

  walletCard: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 24,
  },
  walletLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, textTransform: "uppercase" },
  walletBalance: { fontSize: 40, fontWeight: "800", color: "#ffffff", marginTop: 4, letterSpacing: -1 },
  walletName: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  actionButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  actionButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  emptyText: { color: "#9ca3af", fontSize: 14, textAlign: "center", paddingVertical: 20 },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  txDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txDotInner: { width: 10, height: 10, borderRadius: 5 },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  txDate: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  txAmountCol: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontWeight: "700" },
  statusBadge: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  logoutButton: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },

  // Sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
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
  amountInputWrapper: { alignItems: "center" },
  amountInput: {
    fontSize: 52,
    fontWeight: "800",
    color: PRIMARY,
    textAlign: "center",
    paddingVertical: 8,
    minWidth: 160,
  },
  currencyHint: { textAlign: "center", color: "#9ca3af", fontSize: 14, marginTop: -4 },
  sheetError: {
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  sheetErrorText: { color: "#dc2626", fontSize: 13, textAlign: "center" },
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
