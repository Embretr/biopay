import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { usersApi, walletApi, type UserSearchResult } from "../../lib/api";

const PRIMARY = "#1f9850";

type Step = "search" | "amount";

export default function SendScreen() {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);

  const [recipient, setRecipient] = useState<UserSearchResult | null>(null);
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = useCallback((text: string) => {
    setQuery(text);
    setNoResults(false);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await usersApi.search(text.trim());
        setResults(data);
        setNoResults(data.length === 0);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const selectRecipient = (user: UserSearchResult) => {
    setRecipient(user);
    setAmount("");
    setSendError(null);
    setStep("amount");
  };

  const handleSend = async () => {
    if (!recipient) return;
    setSendError(null);
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) {
      setSendError("Skriv inn et gyldig beløp.");
      return;
    }
    setSending(true);
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Date.now().toString() + recipient.id + Math.random().toString(),
      );
      const key =
        hash.slice(0, 8) + "-" + hash.slice(8, 12) + "-4" +
        hash.slice(13, 16) + "-" + hash.slice(16, 20) + "-" + hash.slice(20, 32);

      // Transfer uses recipient email — look it up via the masked display but we stored id
      // The transfer endpoint takes email; search returns maskedEmail, so we need to use
      // a different approach: pass recipientId. But current transfer endpoint uses email.
      // For now pass the maskedEmail field won't work — we'll add a recipientId transfer variant.
      // Use walletApi.transferById which we'll add, or adapt: store full email client-side.
      // Since we can't get the real email from search, we add a transfer-by-id endpoint.
      await walletApi.transferById(recipient.id, cents, key);
      router.back();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 402) setSendError("Ikke nok penger på kontoen.");
      else if (status === 404) setSendError("Mottaker ikke funnet.");
      else setSendError("Sending feilet. Prøv igjen.");
    } finally {
      setSending(false);
    }
  };

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {step === "search" ? (
        <View style={styles.container}>
          {/* Search input */}
          <View style={styles.searchBar}>
            <View style={styles.searchIcon}>
              <View style={styles.searchCircle} />
              <View style={styles.searchHandle} />
            </View>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={onQueryChange}
              placeholder="Søk etter navn..."
              placeholderTextColor="#9ca3af"
              autoFocus
              returnKeyType="search"
            />
            {searching && <ActivityIndicator color={PRIMARY} size="small" />}
          </View>

          {/* Results */}
          {query.trim().length < 2 ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>Skriv minst 2 bokstaver for å søke</Text>
            </View>
          ) : noResults && !searching ? (
            <View style={styles.hint}>
              <Text style={styles.hintText}>Ingen brukere funnet for «{query}»</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => selectRecipient(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(item.name)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.maskedEmail}</Text>
                  </View>
                  <View style={styles.chevron}>
                    <View style={styles.chevronTop} />
                    <View style={styles.chevronBottom} />
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      ) : (
        <View style={styles.container}>
          {/* Recipient header */}
          <TouchableOpacity style={styles.recipientRow} onPress={() => setStep("search")}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(recipient!.name)}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{recipient!.name}</Text>
              <Text style={styles.userEmail}>{recipient!.maskedEmail}</Text>
            </View>
            <Text style={styles.changeText}>Bytt</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Amount */}
          <View style={styles.amountSection}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(v) => { setAmount(v); setSendError(null); }}
              placeholder="0"
              placeholderTextColor="#d1d5db"
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.currency}>NOK</Text>
          </View>

          {sendError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.sendButtonText}>Send til {recipient!.name.split(" ")[0]}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8faf9" },
  container: { flex: 1 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
  },
  searchIcon: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#9ca3af",
    position: "absolute",
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 5,
    height: 2,
    backgroundColor: "#9ca3af",
    borderRadius: 1,
    position: "absolute",
    bottom: 0,
    right: 0,
    transform: [{ rotate: "45deg" }],
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 12,
  },

  hint: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  hintText: { fontSize: 15, color: "#9ca3af", textAlign: "center" },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  separator: { height: 8 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  userEmail: { fontSize: 13, color: "#9ca3af" },
  chevron: { width: 8, height: 14, justifyContent: "center" },
  chevronTop: {
    width: 8,
    height: 2,
    backgroundColor: "#d1d5db",
    borderRadius: 1,
    transform: [{ rotate: "45deg" }, { translateY: 2 }],
  },
  chevronBottom: {
    width: 8,
    height: 2,
    backgroundColor: "#d1d5db",
    borderRadius: 1,
    transform: [{ rotate: "-45deg" }, { translateY: -2 }],
  },

  // Amount step
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  changeText: { fontSize: 14, fontWeight: "600", color: PRIMARY },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginTop: 20 },
  amountSection: { alignItems: "center", paddingTop: 40, gap: 6 },
  amountInput: {
    fontSize: 64,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    minWidth: 120,
    letterSpacing: -2,
  },
  currency: { fontSize: 18, fontWeight: "600", color: "#9ca3af" },
  errorBox: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: { color: "#dc2626", fontSize: 13, textAlign: "center" },
  sendButton: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 24,
    marginTop: 32,
    alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
});
