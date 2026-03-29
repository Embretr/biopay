import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { transactionsApi } from "../../../lib/api";

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
        <ActivityIndicator color="#00e5cc" />
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
  const sign = isCredit ? "+" : "-";
  const amountColor = isCredit ? "#22c55e" : "#e2e8f0";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: "Betaling i butikk",
    TRANSFER: "Overføring",
  };

  const statusLabels: Record<string, string> = {
    COMPLETED: "Fullført",
    PENDING: "Venter",
    FAILED: "Feilet",
    REFUNDED: "Refundert",
  };

  const statusColors: Record<string, string> = {
    COMPLETED: "#22c55e",
    PENDING: "#f59e0b",
    FAILED: "#ef4444",
    REFUNDED: "#64748b",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Amount hero */}
      <View style={styles.amountCard}>
        <Text style={styles.amountLabel}>Beløp</Text>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}
          {(transaction.amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} {transaction.currency}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColors[transaction.status] ?? "#64748b"}20`, borderColor: `${statusColors[transaction.status] ?? "#64748b"}40` }]}>
          <Text style={[styles.statusText, { color: statusColors[transaction.status] ?? "#64748b" }]}>
            {statusLabels[transaction.status] ?? transaction.status}
          </Text>
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
        <DetailRow
          label="Transaksjons-ID"
          value={transaction.id}
          mono
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.monoValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#64748b", fontSize: 15 },
  amountCard: {
    backgroundColor: "#111118",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1e1e2e",
    gap: 8,
  },
  amountLabel: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  amount: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  statusText: { fontSize: 13, fontWeight: "600" },
  detailCard: {
    backgroundColor: "#111118",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e2e",
  },
  detailLabel: { fontSize: 14, color: "#64748b", flex: 1 },
  detailValue: { fontSize: 14, color: "#e2e8f0", flex: 2, textAlign: "right", fontWeight: "500" },
  monoValue: { fontFamily: "monospace", fontSize: 11 },
});
