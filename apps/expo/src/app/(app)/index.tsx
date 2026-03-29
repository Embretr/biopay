import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import * as Crypto from "expo-crypto";
import { usersApi, walletApi, transactionsApi, type Transaction } from "../../lib/api";
import { useAuthStore } from "../../store/auth-store";
import { authApi } from "../../lib/api";

export default function HomeScreen() {
  const { logout } = useAuthStore();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof usersApi.me>>["data"] | null>(
    null,
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [depositVisible, setDepositVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

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
    const cents = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      Alert.alert("Ugyldig beløp", "Skriv inn et gyldig beløp.");
      return;
    }

    try {
      const idempotencyKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Date.now().toString() + Math.random().toString(),
      );
      // Use first 36 chars as UUID-like key
      const key = idempotencyKey.slice(0, 8) + "-" + idempotencyKey.slice(8, 12) + "-4" + idempotencyKey.slice(13, 16) + "-" + idempotencyKey.slice(16, 20) + "-" + idempotencyKey.slice(20, 32);

      await walletApi.deposit(cents, key);
      setDepositVisible(false);
      setDepositAmount("");
      await loadData();
      Alert.alert("Innskudd vellykket", `${(cents / 100).toFixed(2)} NOK er lagt til lommeboken.`);
    } catch {
      Alert.alert("Feil", "Innskudd feilet. Prøv igjen.");
    }
  };

  const handleLogout = () => {
    Alert.alert("Logg ut", "Er du sikker på at du vil logge ut?", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Logg ut",
        style: "destructive",
        onPress: async () => {
          try {
            await authApi.logout();
          } catch {}
          await logout();
        },
      },
    ]);
  };

  const balance = profile?.wallet?.balanceCents ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5cc" />}
    >
      {/* Wallet card */}
      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>Tilgjengelig saldo</Text>
        <Text style={styles.walletBalance}>
          {(balance / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK
        </Text>
        <Text style={styles.walletName}>{profile?.name ?? "..."}</Text>

        <View style={styles.walletActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setDepositVisible(true)}
          >
            <Text style={styles.actionButtonText}>+ Sett inn</Text>
          </TouchableOpacity>
        </View>
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

      {/* Profile actions */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logg ut</Text>
      </TouchableOpacity>

      {/* Deposit modal */}
      <Modal visible={depositVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Sett inn penger</Text>
            <TextInput
              style={styles.amountInput}
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder="0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.currencyHint}>NOK</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDepositVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleDeposit}>
                <Text style={styles.confirmButtonText}>Sett inn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isCredit = transaction.type === "DEPOSIT";
  const sign = isCredit ? "+" : "-";
  const color = isCredit ? "#22c55e" : "#e2e8f0";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: transaction.merchantName ?? "Betaling",
    TRANSFER: "Overføring",
  };

  return (
    <View style={styles.txRow}>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{typeLabels[transaction.type] ?? transaction.type}</Text>
        <Text style={styles.txDate}>
          {new Date(transaction.createdAt).toLocaleDateString("nb-NO")}
        </Text>
      </View>
      <View style={styles.txAmountCol}>
        <Text style={[styles.txAmount, { color }]}>
          {sign}
          {(transaction.amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK
        </Text>
        <StatusBadge status={transaction.status} />
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: "#22c55e",
    PENDING: "#f59e0b",
    FAILED: "#ef4444",
    REFUNDED: "#64748b",
  };
  return (
    <Text style={[styles.statusBadge, { color: colors[status] ?? "#64748b" }]}>{status}</Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  walletCard: {
    backgroundColor: "#00e5cc",
    borderRadius: 20,
    padding: 24,
  },
  walletLabel: { fontSize: 13, color: "#0a0a0f", opacity: 0.7, letterSpacing: 0.5, textTransform: "uppercase" },
  walletBalance: { fontSize: 42, fontWeight: "800", color: "#0a0a0f", marginTop: 4, letterSpacing: -1 },
  walletName: { fontSize: 15, color: "#0a0a0f", opacity: 0.6, marginTop: 4 },
  walletActions: { marginTop: 20 },
  actionButton: {
    backgroundColor: "rgba(10,10,15,0.15)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  actionButtonText: { color: "#0a0a0f", fontWeight: "700", fontSize: 15 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#e2e8f0" },
  emptyText: { color: "#64748b", fontSize: 14, textAlign: "center", paddingVertical: 20 },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111118",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e1e2e",
  },
  txInfo: { flex: 1 },
  txTitle: { fontSize: 15, fontWeight: "600", color: "#e2e8f0" },
  txDate: { fontSize: 12, color: "#64748b", marginTop: 2 },
  txAmountCol: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontWeight: "700" },
  statusBadge: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#1e1e2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  logoutText: { color: "#ef4444", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#111118",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: "#1e1e2e",
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#e2e8f0" },
  amountInput: {
    fontSize: 48,
    fontWeight: "800",
    color: "#00e5cc",
    textAlign: "center",
    paddingVertical: 16,
  },
  currencyHint: { textAlign: "center", color: "#64748b", fontSize: 14 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: { color: "#e2e8f0", fontWeight: "600" },
  confirmButton: {
    flex: 1,
    backgroundColor: "#00e5cc",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  confirmButtonText: { color: "#0a0a0f", fontWeight: "700", fontSize: 16 },
});
