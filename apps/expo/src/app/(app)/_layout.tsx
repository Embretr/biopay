import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../store/auth-store";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#111118",
          borderTopColor: "#1e1e2e",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#00e5cc",
        tabBarInactiveTintColor: "#64748b",
        headerStyle: { backgroundColor: "#0a0a0f" },
        headerTintColor: "#e2e8f0",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Lommebok",
          tabBarLabel: "Lommebok",
          tabBarIcon: ({ color, size }) => <TabIcon name="wallet" color={color} size={size} />,
          headerTitle: "BioPay",
        }}
      />
      <Tabs.Screen
        name="transactions/index"
        options={{
          title: "Kvitteringer",
          tabBarLabel: "Kvitteringer",
          tabBarIcon: ({ color, size }) => <TabIcon name="list" color={color} size={size} />,
          headerTitle: "Transaksjoner",
        }}
      />
      <Tabs.Screen
        name="palm"
        options={{
          title: "Palme",
          tabBarLabel: "Palme",
          tabBarIcon: ({ color, size }) => <TabIcon name="hand" color={color} size={size} />,
          headerTitle: "Palmeregistrering",
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  // Simple emoji icons to avoid native dependencies in scaffold
  const icons: Record<string, string> = {
    wallet: "💰",
    list: "📋",
    hand: "🖐️",
  };
  return (
    <span style={{ fontSize: size, color }}>{icons[name] ?? "●"}</span>
  ) as unknown as React.ReactElement;
}
