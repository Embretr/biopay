import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { transactionsApi } from "../../../lib/api";

const PRIMARY = "#1f9850";

type FullTransaction = Awaited<ReturnType<typeof transactionsApi.get>>["data"];

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<FullTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    transactionsApi
      .get(id)
      .then((res) => setTransaction(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Transaksjon ikke funnet</Text>
      </View>
    );
  }

  const isCredit = transaction.type === "DEPOSIT";
  const sign = isCredit ? "+" : "−";
  const amountColor = isCredit ? "#16a34a" : "#111827";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: "Betaling i butikk",
    TRANSFER: "Overføring",
  };

  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    COMPLETED: { color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0", label: "Fullført" },
    PENDING: { color: "#d97706", bg: "#fef3c7", border: "#fde68a", label: "Venter" },
    FAILED: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Feilet" },
    REFUNDED: { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", label: "Refundert" },
  };

  const sConf = statusConfig[transaction.status] ?? { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", label: transaction.status };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Amount hero */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Beløp</Text>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}{(transaction.amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} {transaction.currency}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: sConf.bg, borderColor: sConf.border }]}>
          <View style={[styles.statusDot, { backgroundColor: sConf.color }]} />
          <Text style={[styles.statusText, { color: sConf.color }]}>{sConf.label}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailCard}>
        <DetailRow label="Type" value={typeLabels[transaction.type] ?? transaction.type} />
        {transaction.merchantName && (
          <DetailRow label="Butikk" value={transaction.merchantName} />
        )}
        {transaction.terminalId && (
          <DetailRow label="Terminal" value={transaction.terminalId} />
        )}
        <DetailRow
          label="Dato"
          value={new Date(transaction.createdAt).toLocaleString("nb-NO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <DetailRow label="Transaksjons-ID" value={transaction.id} mono last />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.monoValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8faf9" },
  errorText: { color: "#9ca3af", fontSize: 15 },

  amountCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  amountLabel: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  amount: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13, fontWeight: "600" },

  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 14, color: "#6b7280", flex: 1 },
  detailValue: { fontSize: 14, color: "#111827", flex: 2, textAlign: "right", fontWeight: "500" },
  monoValue: { fontFamily: "monospace", fontSize: 11, color: "#6b7280" },
});
