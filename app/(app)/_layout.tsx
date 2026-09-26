import { Tabs } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "@/components/app-header";
import { IconActivity, IconHome, IconProgress, IconProjects, IconRequests, IconStock } from "@/components/icons";
import { CompanyProvider, useCompany } from "@/lib/company-context";
import { useMaterialRequestsQuery } from "@/lib/queries";
import { colors } from "@/theme";

function usePendingApprovalCount() {
  const { me, companyId } = useCompany();
  const query = useMaterialRequestsQuery<{ status: string; assignee: { id: string } | null }>(
    Boolean(companyId),
  );
  return (query.data ?? []).filter(
    (request) => request.status === "SUBMITTED" && request.assignee?.id === me?.id,
  ).length;
}

function tabIcon(Icon: typeof IconHome) {
  return ({ color }: { color: string | { toString(): string }; size: number }) => (
    <Icon color={String(color)} size={20} />
  );
}

function AppTabs() {
  const pending = usePendingApprovalCount();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <AppHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.line,
            height: 64,
          },
          tabBarLabelStyle: { fontFamily: "Mukta_600SemiBold", fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon(IconHome) }} />
        <Tabs.Screen name="projects" options={{ title: "Projects", tabBarIcon: tabIcon(IconProjects) }} />
        <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: tabIcon(IconProgress) }} />
        <Tabs.Screen name="stock" options={{ title: "Stock", tabBarIcon: tabIcon(IconStock) }} />
        <Tabs.Screen
          name="requests"
          options={{
            title: "Requests",
            tabBarIcon: tabIcon(IconRequests),
            tabBarBadge: pending > 0 ? pending : undefined,
          }}
        />
        <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: tabIcon(IconActivity) }} />
        <Tabs.Screen name="team" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

export default function AppLayout() {
  return (
    <CompanyProvider>
      <AppTabs />
    </CompanyProvider>
  );
}
