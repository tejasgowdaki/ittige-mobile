import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { OnboardingForm } from "@/components/onboarding-form";
import { Button, Copy, Empty, ErrorText, FilterLink, Label, Row, Screen, Title } from "@/components/ui";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { toDateKey } from "@/lib/dates";
import {
  useProjectsQuery,
  useSettingsQuery,
  useSiteLogQuery,
  useStockMovementsQuery,
  useTransfersQuery,
  type ProjectListItem,
} from "@/lib/queries";
import { readRecentProjectIds } from "@/lib/session-store";
import {
  areaUnitSymbol,
  convertArea,
  formatAreaValue,
  PERMISSIONS,
  type AreaUnitCode,
} from "@/shared";
import { colors } from "@/theme";

type SiteLogEntry = {
  id: string;
  kind: "LABOR" | "PROGRESS" | "NOTE";
  laborCount: number | null;
  note: string | null;
  laborType: { name: string } | null;
  project: { name: string };
  submittedBy: { name: string } | null;
  lines: { completionPercent: string | number; space: { name: string }; workType: { name: string } }[];
};

type StockMovement = {
  id: string;
  type: string;
  notes: string | null;
  quantityDelta: string | number;
  material: { name: string; uom: string };
  stockLocation: { kind: string; godown: { name: string } | null; project: { name: string } | null };
};

type Transfer = {
  id: string;
  status: string;
  supplierName: string | null;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  fromLocation: { godown: { name: string } | null; project: { name: string } | null; kind: string } | null;
  toLocation: { godown: { name: string } | null; project: { name: string } | null; kind: string };
  lines: { qtySent: string | number; material: { name: string; uom: string } }[];
};

function locationName(location: { godown: { name: string } | null; project: { name: string } | null; kind: string }) {
  return location.godown?.name || location.project?.name || location.kind;
}

function titleCaseToken(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function transferFromLabel(transfer: Transfer) {
  if (!transfer.fromLocation) {
    return transfer.supplierName ? `Buy · ${transfer.supplierName}` : "Buy from provider";
  }
  return locationName(transfer.fromLocation);
}

function kindLabel(kind: SiteLogEntry["kind"]) {
  if (kind === "LABOR") return "Labor";
  if (kind === "NOTE") return "Note";
  return "Progress";
}

function entrySummary(entry: SiteLogEntry) {
  if (entry.kind === "LABOR") return `${entry.laborCount ?? 0} ${entry.laborType?.name ?? "workers"}`;
  if (entry.kind === "NOTE") return entry.note?.trim() || "Note";
  if (entry.lines.length === 1) {
    const line = entry.lines[0]!;
    return `${line.space.name} · ${line.workType.name} · ${Number(line.completionPercent)}%`;
  }
  return `${entry.lines.length} work lines`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const today = toDateKey(new Date());
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [feed, setFeed] = useState<"progress" | "stock" | "transfers">("progress");
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const canReadStock = permissions.includes(PERMISSIONS.STOCK_READ);

  const projectsQuery = useProjectsQuery(ready);
  const settingsQuery = useSettingsQuery<{ defaultAreaUnit: AreaUnitCode }>(ready);
  const progressQuery = useSiteLogQuery<SiteLogEntry>({ from: today, to: today }, ready);
  const movementsQuery = useStockMovementsQuery<StockMovement>({ from: today, to: today }, ready && canReadStock);
  const transfersQuery = useTransfersQuery<Transfer>(ready && canReadStock);

  useEffect(() => {
    if (!companyId) return;
    void readRecentProjectIds(companyId).then(setRecentIds);
  }, [companyId, projectsQuery.dataUpdatedAt]);

  const projects = projectsQuery.data ?? [];
  const defaultUnit = settingsQuery.data?.defaultAreaUnit ?? "SQ_FT";
  const activeCount = projects.filter((project) => project.status === "ACTIVE").length;
  const completedCount = projects.filter((project) => project.status === "COMPLETED").length;
  const totalArea = projects.reduce((sum, project) => {
    return sum + convertArea(Number(project.totalArea ?? 0), project.areaUnit ?? defaultUnit, defaultUnit);
  }, 0);
  const recentProjects = useMemo(() => {
    const byId = new Map(projects.map((project) => [project.id, project]));
    const fromRecent = recentIds
      .map((id) => byId.get(id))
      .filter((project): project is ProjectListItem => Boolean(project));
    return (fromRecent.length > 0 ? fromRecent : projects).slice(0, 3);
  }, [projects, recentIds]);
  const progressEntries = progressQuery.data ?? [];
  const balanceChanges = (movementsQuery.data ?? []).filter(
    (movement) => movement.type !== "TRANSFER_IN" && movement.type !== "TRANSFER_OUT",
  );
  const todayTransfers = (transfersQuery.data ?? []).filter(
    (transfer) =>
      toDateKey(transfer.createdAt) === today ||
      (transfer.dispatchedAt && toDateKey(transfer.dispatchedAt) === today) ||
      (transfer.receivedAt && toDateKey(transfer.receivedAt) === today),
  );

  if (gate.loading || (ready && projectsQuery.isPending && !projectsQuery.data)) {
    return <Screen><Empty>Loading…</Empty></Screen>;
  }
  if (gate.needsOnboarding) {
    return (
      <Screen>
        <Title>Set up your company</Title>
        <Copy>Create the workspace that will hold clients, projects, godowns, and stock.</Copy>
        <OnboardingForm />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Today</Title>
      <Copy>Projects, progress, and stock in one place.</Copy>
      {projectsQuery.error ? (
        <ErrorText>{projectsQuery.error instanceof Error ? projectsQuery.error.message : "Could not load projects"}</ErrorText>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 28, marginTop: 28, marginBottom: 8 }}>
        <Metric value={String(activeCount)} label="Active projects" />
        {completedCount > 0 ? <Metric value={String(completedCount)} label="Completed projects" /> : null}
        <Metric value={formatAreaValue(totalArea)} unit={areaUnitSymbol(defaultUnit)} label="Area built" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28 }}>
        <Label>Recent projects</Label>
        <FilterLink label="View all" muted trailing onPress={() => router.push("/projects")} />
      </View>
      {recentProjects.length === 0 ? (
        <>
          <Empty>No projects yet.</Empty>
          <Button label="Add a project" onPress={() => router.push("/projects")} />
        </>
      ) : (
        recentProjects.map((project) => (
          <Row
            key={project.id}
            title={project.name}
            subtitle={project.client.name}
            onPress={() => router.push(`/projects/${project.id}`)}
          />
        ))
      )}
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 28 }}>
        <FilterLink label="Progress" count={progressEntries.length} active={feed === "progress"} onPress={() => setFeed("progress")} />
        {canReadStock ? (
          <>
            <FilterLink label="Stock" count={balanceChanges.length} active={feed === "stock"} onPress={() => setFeed("stock")} />
            <FilterLink label="Transfers" count={todayTransfers.length} active={feed === "transfers"} onPress={() => setFeed("transfers")} />
          </>
        ) : null}
        <FilterLink
          label="View all"
          muted
          trailing
          onPress={() => router.push(feed === "progress" ? "/progress" : "/stock")}
        />
      </View>
      {feed === "progress" && progressQuery.isPending ? <Empty>Loading…</Empty> : null}
      {feed === "progress" && !progressQuery.isPending
        ? progressEntries.slice(0, 8).map((entry) => (
            <Row
              key={entry.id}
              title={entrySummary(entry)}
              subtitle={`${entry.project.name} · ${kindLabel(entry.kind)}${entry.submittedBy?.name ? ` · ${entry.submittedBy.name}` : ""}`}
              onPress={() => router.push("/progress")}
            />
          ))
        : null}
      {feed === "progress" && !progressQuery.isPending && progressEntries.length === 0 ? <Empty>No progress logged today.</Empty> : null}
      {feed === "stock" && movementsQuery.isPending ? <Empty>Loading…</Empty> : null}
      {feed === "stock" && !movementsQuery.isPending
        ? balanceChanges.slice(0, 8).map((movement) => {
            const qty = Number(movement.quantityDelta);
            return (
              <Row
                key={movement.id}
                title={`${movement.material.name} · ${qty > 0 ? "+" : ""}${qty} ${movement.material.uom}`}
                subtitle={`${titleCaseToken(movement.type)}${movement.notes ? ` · ${movement.notes}` : ""} · ${locationName(movement.stockLocation)}`}
                onPress={() => router.push("/stock")}
              />
            );
          })
        : null}
      {feed === "stock" && !movementsQuery.isPending && balanceChanges.length === 0 ? <Empty>No stock changes today.</Empty> : null}
      {feed === "transfers" && transfersQuery.isPending ? <Empty>Loading…</Empty> : null}
      {feed === "transfers" && !transfersQuery.isPending
        ? todayTransfers.slice(0, 8).map((transfer) => (
            <Row
              key={transfer.id}
              title={`${transferFromLabel(transfer)} → ${locationName(transfer.toLocation)}`}
              subtitle={`${titleCaseToken(transfer.status)}${
                transfer.lines.length > 0
                  ? ` · ${transfer.lines.map((line) => `${line.material.name} ${line.qtySent} ${line.material.uom}`).join(", ")}`
                  : ""
              }`}
              onPress={() => router.push("/stock")}
            />
          ))
        : null}
      {feed === "transfers" && !transfersQuery.isPending && todayTransfers.length === 0 ? <Empty>No transfers today.</Empty> : null}
    </Screen>
  );
}

function Metric({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View>
      <Text style={{ fontFamily: "Mukta_700Bold", fontSize: 38, color: colors.ink }}>
        {value}
        {unit ? <Text style={{ fontFamily: "Mukta_600SemiBold", fontSize: 15, color: colors.muted }}> {unit}</Text> : null}
      </Text>
      <Text style={{ fontFamily: "Mukta_400Regular", color: colors.muted }}>{label}</Text>
    </View>
  );
}
