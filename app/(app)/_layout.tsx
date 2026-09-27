import { Tabs } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { IconActivity, IconHome, IconProgress, IconProjects, IconRequests, IconStock } from "@/components/icons";
import { CompanyProvider, useCompany } from "@/lib/company-context";
import { actionableCounts } from "@/lib/request-actions";
import { useMaterialRequestsQuery } from "@/lib/queries";
import { PERMISSIONS } from "@/shared";
import { colors } from "@/theme";

const TRANSFER_CODES = [
  PERMISSIONS.TRANSFERS_CREATE,
  PERMISSIONS.TRANSFERS_APPROVE,
  PERMISSIONS.TRANSFERS_DISPATCH,
  PERMISSIONS.TRANSFERS_RECEIVE,
];

type ActionRequest = {
  status: string;
  requestedBy: { id: string };
  lines: {
    materialId: string;
    allocations: { id: string; stockLocationId: string | null; qtyAllocated: string | number }[];
  }[];
  transfers: {
    status: string;
    fromLocationId: string | null;
    lines: { materialId: string; qtySent: string | number; requestAllocationId: string | null }[];
  }[];
};

function useRequestsMenuCount() {
  const { me, companyId } = useCompany();
  const requestsQuery = useMaterialRequestsQuery<ActionRequest>(Boolean(companyId));
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const canTransfer = TRANSFER_CODES.some((code) => permissions.includes(code));
  const actionable = actionableCounts(requestsQuery.data ?? [], me?.id ?? "", canTransfer);
  return actionable.pending;
}

const MENU = [
  { name: "index", title: "Home", Icon: IconHome },
  { name: "projects", title: "Projects", Icon: IconProjects },
  { name: "progress", title: "Progress", Icon: IconProgress },
  { name: "stock", title: "Stock", Icon: IconStock },
  { name: "requests", title: "Requests", Icon: IconRequests },
  { name: "activity", title: "Activity", Icon: IconActivity },
] as const;

function MenuIcon({
  name,
  Icon,
  color,
  focused,
  count,
}: {
  name: string;
  Icon: typeof IconHome;
  color: string;
  focused: boolean;
  count: number;
}) {
  if (name !== "requests") return <Icon color={color} size={18} />;
  return (
    <View style={styles.tabIcon}>
      <Icon color={color} size={18} />
      {count > 0 ? (
        <View style={[styles.badge, focused ? styles.badgeActive : styles.badgeIdle]}>
          <Text style={[styles.badgeText, focused ? styles.badgeTextActive : styles.badgeTextIdle]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function MenuBar({
  state,
  navigation,
  insets,
  pending,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  insets: { bottom: number };
  pending: number;
}) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {MENU.map((item) => {
        const route = state.routes.find((entry) => entry.name === item.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === item.name;
        const color = focused ? colors.accentInk : colors.muted;
        return (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.title}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(item.name);
            }}
            style={styles.tabHit}
          >
            <View style={[styles.tabPill, focused && styles.tabPillActive]}>
              <MenuIcon name={item.name} Icon={item.Icon} color={color} focused={focused} count={pending} />
              <Text
                style={[styles.tabLabel, (item.name === "requests" || item.name === "activity") && styles.tabLabelTight, { color }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function AppTabs() {
  const pending = useRequestsMenuCount();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <AppHeader />
      <Tabs
        tabBar={(props) => <MenuBar {...props} pending={pending} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="projects" options={{ title: "Projects" }} />
        <Tabs.Screen name="progress" options={{ title: "Progress" }} />
        <Tabs.Screen name="stock" options={{ title: "Stock" }} />
        <Tabs.Screen name="requests" options={{ title: "Requests" }} />
        <Tabs.Screen name="activity" options={{ title: "Activity" }} />
        <Tabs.Screen name="team" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 2,
    paddingTop: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(247,237,231,0.94)",
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tabHit: { flex: 1 },
  tabPill: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  tabPillActive: { backgroundColor: colors.accent },
  tabLabel: { fontFamily: "Mukta_600SemiBold", fontSize: 11 },
  tabLabelTight: { fontSize: 10 },
  tabIcon: { width: 24, height: 20, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -7,
    right: -12,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: { backgroundColor: colors.accentInk },
  badgeIdle: { backgroundColor: colors.accent },
  badgeText: {
    fontFamily: "Mukta_700Bold",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    transform: [{ translateY: Platform.OS === "ios" ? 2 : 1 }],
  },
  badgeTextActive: { color: colors.accent },
  badgeTextIdle: { color: colors.accentInk },
});

export default function AppLayout() {
  return (
    <CompanyProvider>
      <AppTabs />
    </CompanyProvider>
  );
}
