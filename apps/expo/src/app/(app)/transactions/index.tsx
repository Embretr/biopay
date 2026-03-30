import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { transactionsApi, type Transaction } from "../../../lib/api";

const PRIMARY = "#1f9850";

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
        <ActivityIndicator color={PRIMARY} />
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
          <View style={styles.emptyIcon}>
            <ListEmptyIcon />
          </View>
          <Text style={styles.emptyText}>Ingen transaksjoner</Text>
          <Text style={styles.emptySubtext}>Dine betalinger og innskudd vil vises her.</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />
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
  const sign = isCredit ? "+" : "−";
  const amountColor = isCredit ? "#16a34a" : "#111827";

  const typeLabels: Record<string, string> = {
    DEPOSIT: "Innskudd",
    WITHDRAWAL: "Uttak",
    PAYMENT: transaction.merchantName ?? "Betaling i butikk",
    TRANSFER: "Overføring",
  };

  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: isCredit ? "#dcfce7" : "#f3f4f6" }]}>
        <TypeIcon type={transaction.type} isCredit={isCredit} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{typeLabels[transaction.type] ?? transaction.type}</Text>
        <Text style={styles.date}>
          {new Date(transaction.createdAt).toLocaleDateString("nb-NO", {
            day: "2-digit",
            month: "short",
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

function TypeIcon({ type, isCredit }: { type: string; isCredit: boolean }) {
  const color = isCredit ? "#16a34a" : "#6b7280";
  if (type === "DEPOSIT" || type === "WITHDRAWAL") {
    // Arrow up/down
    const isUp = type === "DEPOSIT";
    return (
      <View style={{ alignItems: "center", gap: 2 }}>
        <View style={{ width: 2, height: 12, backgroundColor: color, borderRadius: 1 }} />
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7,
          borderLeftColor: "transparent", borderRightColor: "transparent",
          borderBottomColor: color,
          transform: [{ rotate: isUp ? "0deg" : "180deg" }],
        }} />
      </View>
    );
  }
  if (type === "PAYMENT") {
    // Card icon
    return (
      <View style={{ width: 18, height: 13, borderWidth: 1.5, borderColor: color, borderRadius: 2, overflow: "hidden" }}>
        <View style={{ height: 4, backgroundColor: color }} />
      </View>
    );
  }
  // Transfer: two arrows
  return (
    <View style={{ gap: 3 }}>
      <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 16, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    COMPLETED: { color: "#16a34a", label: "Fullført" },
    PENDING: { color: "#d97706", label: "Venter" },
    FAILED: { color: "#dc2626", label: "Feilet" },
    REFUNDED: { color: "#6b7280", label: "Refundert" },
  };
  const conf = configs[status] ?? { color: "#6b7280", label: status };
  return <Text style={[styles.statusText, { color: conf.color }]}>{conf.label}</Text>;
}

function ListEmptyIcon() {
  return (
    <View style={{ gap: 4 }}>
      {[1, 0.6, 0.4].map((opacity, i) => (
        <View key={i} style={{ width: 40, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, opacity }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#374151", marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
  separator: { height: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", color: "#111827" },
  date: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  amountCol: { alignItems: "flex-end" },
  amount: { fontSize: 15, fontWeight: "700" },
  statusText: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
