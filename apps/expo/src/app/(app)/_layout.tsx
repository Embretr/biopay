import { View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../store/auth-store";

const PRIMARY = "#1f9850";
const INACTIVE = "#9ca3af";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#111827",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Lommebok",
          tabBarLabel: "Lommebok",
          tabBarIcon: ({ color }) => <WalletIcon color={color} />,
          headerTitle: "BioPay",
        }}
      />
      <Tabs.Screen
        name="transactions/index"
        options={{
          title: "Kvitteringer",
          tabBarLabel: "Kvitteringer",
          tabBarIcon: ({ color }) => <ListIcon color={color} />,
          headerTitle: "Transaksjoner",
        }}
      />
      <Tabs.Screen
        name="palm"
        options={{
          title: "Palme",
          tabBarLabel: "Palme",
          tabBarIcon: ({ color }) => <PalmIcon color={color} />,
          headerTitle: "Palmeregistrering",
        }}
      />
    </Tabs>
  );
}

function WalletIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 17, borderWidth: 1.5, borderColor: color, borderRadius: 3, justifyContent: "center", alignItems: "flex-end", paddingRight: 3 }}>
      <View style={{ width: 8, height: 6, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function ListIcon({ color }: { color: string }) {
  return (
    <View style={{ gap: 3.5, justifyContent: "center" }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 20, height: 1.5, backgroundColor: color, borderRadius: 1 }} />
      ))}
    </View>
  );
}

function PalmIcon({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end", height: 20 }}>
      {[14, 18, 20, 18, 16].map((h, i) => (
        <View key={i} style={{ width: 3, height: h, backgroundColor: color, borderRadius: 2 }} />
      ))}
    </View>
  );
}
