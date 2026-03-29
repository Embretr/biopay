import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { transactionsApi, type Transaction } from "../../../lib/api";

export default function TransactionsScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadTransactions = useCallback(async (p: number = 1, append = false) => {
    try {
      const res = await transactionsApi.list({ page: p, limit: 20 });
      const { data, totalPages: tp } = res.data;
      setTransactions((prev) => (append ? [...prev, ...data] : data));
      setTotalPages(tp);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadTransactions(1);
  };

  const loadMore = () => {
    if (page < totalPages) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadTransactions(nextPage, true);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Laster...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={transactions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TransactionItem
          transaction={item}
          onPress={() => router.push(`/(app)/transactions/${item.id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ingen transaksjoner</Text>
          <Text style={styles.emptySubtext}>
            Dine betalinger og innskudd vil vises her.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5cc" />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
    />
  );
}

function TransactionItem({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress: () => void;
}) {
  const isCredit = transaction.type === "DEPOSIT";
  const sign = isCredit ? "+" : "-";
  const amountColor = isCredit ? "#22c55e" : "#e2e8f0";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: transaction.merchantName ?? "Betaling i butikk",
    TRANSFER: "Overføring",
  };

  const typeIcons: Record<string, string> = {
    DEPOSIT: "💳",
    WITHDRAWAL: "🏦",
    PAYMENT: "🛒",
    TRANSFER: "↔️",
  };

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{typeIcons[transaction.type] ?? "💰"}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{typeLabels[transaction.type] ?? transaction.type}</Text>
        <Text style={styles.date}>
          {new Date(transaction.createdAt).toLocaleDateString("nb-NO", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}{(transaction.amountCents / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })} NOK
        </Text>
        <StatusBadge status={transaction.status} />
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: "#22c55e", label: "Fullført" },
    PENDING: { color: "#f59e0b", label: "Venter" },
    FAILED: { color: "#ef4444", label: "Feilet" },
    REFUNDED: { color: "#64748b", label: "Refundert" },
  };
  const conf = configs[status] ?? { color: "#64748b", label: status };
  return <Text style={[styles.statusText, { color: conf.color }]}>{conf.label}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0f" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { color: "#64748b", fontSize: 14 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#e2e8f0", marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: "#64748b", textAlign: "center" },
  separator: { height: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111118",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#1e1e2e",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#e2e8f0" },
  date: { fontSize: 12, color: "#64748b", marginTop: 2 },
  amountCol: { alignItems: "flex-end" },
  amount: { fontSize: 15, fontWeight: "700" },
  statusText: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
