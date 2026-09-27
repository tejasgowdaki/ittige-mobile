import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateField } from "@/components/date-field";
import { IconClose, IconTrash } from "@/components/icons";
import {
  Badge,
  Button,
  CheckBox,
  Copy,
  Empty,
  ErrorText,
  Field,
  IconButton,
  Screen,
  SelectField,
  Sheet,
  TextField,
  Title,
} from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { formatDisplayDate, toDateKey } from "@/lib/dates";
import { actionableCounts, sentFromSource } from "@/lib/request-actions";
import { queryKeys } from "@/lib/query-keys";
import {
  useGodownsQuery,
  useMaterialRequestsQuery,
  useMaterialsQuery,
  useProjectQuery,
  useProjectsQuery,
  useStockQuery,
} from "@/lib/queries";
import { formatFloorLabel, PERMISSIONS } from "@/shared";
import { colors } from "@/theme";

type LocationRef = {
  id: string;
  kind: string;
  godown: { name: string } | null;
  project: { name: string; code: string } | null;
};
type Allocation = {
  id: string;
  stockLocationId: string | null;
  supplierName: string | null;
  qtyAllocated: string | number;
  stockLocation: LocationRef | null;
};
type RequestLine = {
  id: string;
  materialId: string;
  qtyRequested: string | number;
  qtyApproved: string | number | null;
  qtyFulfilled: string | number;
  material: { id: string; name: string; uom: string };
  allocations: Allocation[];
};
type TransferRow = {
  id: string;
  status: string;
  notes: string | null;
  supplierName: string | null;
  receivedAt: string | null;
  fromLocationId: string | null;
  fromLocation: LocationRef | null;
  lines: { materialId: string; qtySent: string | number; requestAllocationId: string | null }[];
};
type RequestRow = {
  id: string;
  status: string;
  neededBy: string;
  project: { id: string; name: string; code: string; stockLocation: { id: string } | null };
  space: { id: string; name: string; floor: number } | null;
  requestedBy: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  rejectionNote: string | null;
  lines: RequestLine[];
  transfers: TransferRow[];
};
type PlanningNeed = {
  requestId: string;
  neededBy: string;
  qtyRemaining: number;
  project: { name: string; code: string };
  space: { name: string; floor: number } | null;
  material: { name: string; uom: string };
  sources: {
    purchase: boolean;
    supplierName: string | null;
    stockLocation: LocationRef | null;
    qtyRemaining: number;
  }[];
};
type StockBalance = {
  quantity: string | number;
  material: { id: string; uom: string };
  stockLocation: { id: string };
};
type DraftLine = { materialId: string; qty: string };
type DraftAllocation = { stockLocationId: string; supplierName: string; quantity: string };
type DraftApproval = { lineId: string; qtyApproved: string; allocations: DraftAllocation[] };

const STATUS_OPTIONS = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "PARTIALLY_FULFILLED", label: "Partial" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "REJECTED", label: "Rejected" },
];
const DEFAULT_STATUSES = ["SUBMITTED", "APPROVED", "PARTIALLY_FULFILLED"];
const TRANSFER_CODES = [
  PERMISSIONS.TRANSFERS_CREATE,
  PERMISSIONS.TRANSFERS_APPROVE,
  PERMISSIONS.TRANSFERS_DISPATCH,
  PERMISSIONS.TRANSFERS_RECEIVE,
];
const PURCHASE = "purchase";

function qty(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function wholeDigits(value: string) {
  return (value.split(/[.,]/)[0] ?? "").replace(/\D/g, "");
}

function purchaseLabel(supplierName: string | null | undefined) {
  return supplierName ? `Buy · ${supplierName}` : "Buy from provider";
}

function locationName(location: LocationRef | null | undefined) {
  if (location?.godown) return `Godown · ${location.godown.name}`;
  if (location?.project) return `Project · ${location.project.name}`;
  return "Source";
}

function sourceLabel(source: { stockLocation?: LocationRef | null; supplierName?: string | null }) {
  return source.stockLocation ? locationName(source.stockLocation) : purchaseLabel(source.supplierName);
}

function spaceLabel(space: { name: string; floor: number } | null) {
  if (!space) return null;
  return `${formatFloorLabel(Number(space.floor))} · ${space.name}`;
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export default function RequestsScreen() {
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const canRaise = permissions.includes(PERMISSIONS.PROJECTS_MANAGE);
  const canTransfer = TRANSFER_CODES.some((code) => permissions.includes(code));
  const myId = me?.id ?? "";

  const [view, setView] = useState<"requests" | "planning">("requests");
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [fulfillNote, setFulfillNote] = useState("");
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([{ materialId: "", qty: "" }]);
  const [approving, setApproving] = useState<RequestRow | null>(null);
  const [approvalLines, setApprovalLines] = useState<DraftApproval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const projectsQuery = useProjectsQuery(ready);
  const materialsQuery = useMaterialsQuery(ready);
  const godownsQuery = useGodownsQuery(ready);
  const stockQuery = useStockQuery<StockBalance>(ready && canTransfer);
  const requestsQuery = useMaterialRequestsQuery<RequestRow>(ready);
  const projectQuery = useProjectQuery<{ spaces: { id: string; name: string; floor: number }[] }>(
    projectId || undefined,
    open && Boolean(projectId),
  );
  const assigneesQuery = useQuery({
    queryKey: ["request-assignees", companyId, projectId],
    queryFn: () =>
      apiFetch<{ assignees: { id: string; name: string }[] }>(
        `/api/v1/material-requests/assignees?projectId=${projectId}`,
        { companyId },
      ),
    enabled: Boolean(companyId && projectId && open),
  });
  const planningQuery = useQuery({
    queryKey: ["planning", companyId],
    queryFn: () =>
      apiFetch<{ needs: PlanningNeed[] }>("/api/v1/planning", { companyId }).then((payload) => payload.needs),
    enabled: ready,
  });

  const projects = projectsQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const godowns = godownsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const actionable = actionableCounts(requests, myId, canTransfer);
  const visible = requests.filter((request) => statuses.length === 0 || statuses.includes(request.status));
  const selectedStatuses = STATUS_OPTIONS.filter((option) => statuses.includes(option.value));
  const statusFilterLabel =
    selectedStatuses.length === 0
      ? "Select status"
      : selectedStatuses.length <= 3
        ? selectedStatuses.map((option) => option.label).join(" · ")
        : `${selectedStatuses.length} statuses`;
  const selected = requests.find((request) => request.id === selectedId) ?? null;

  const planningGroups = new Map<string, Map<string, PlanningNeed[]>>();
  for (const need of planningQuery.data ?? []) {
    const dateKey = toDateKey(need.neededBy);
    const bySource = planningGroups.get(dateKey) ?? new Map<string, PlanningNeed[]>();
    const openSources = need.sources.filter((source) => source.qtyRemaining > 0.0000001);
    const buckets =
      openSources.length > 0
        ? openSources
        : [{ purchase: false, supplierName: null, stockLocation: null, qtyRemaining: need.qtyRemaining }];
    for (const source of buckets) {
      const name = source.stockLocation
        ? locationName(source.stockLocation)
        : source.purchase
          ? purchaseLabel(source.supplierName)
          : "Waiting to be received";
      const rows = bySource.get(name) ?? [];
      rows.push(need);
      bySource.set(name, rows);
    }
    planningGroups.set(dateKey, bySource);
  }

  function closeForm() {
    setOpen(false);
    setError(null);
    setProjectId("");
    setSpaceId("");
    setAssigneeId("");
    setNeededBy("");
    setDraftLines([{ materialId: "", qty: "" }]);
  }

  function closeDetail() {
    setSelectedId(null);
    setConfirmDelete(false);
    setConfirmReject(false);
    setRejectNote("");
    setFulfillNote("");
    setError(null);
  }

  async function refresh() {
    if (!companyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.materialRequests(companyId) }),
      queryClient.invalidateQueries({ queryKey: ["planning", companyId] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stock(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers(companyId) }),
    ]);
  }

  async function create() {
    if (!companyId) return;
    const lines = draftLines
      .filter((line) => line.materialId && /^\d+$/.test(line.qty) && Number(line.qty) > 0)
      .map((line) => ({ materialId: line.materialId, qtyRequested: Number(line.qty) }));
    if (!projectId || !assigneeId || !neededBy || lines.length === 0) {
      setError("Project, assignee, date, and at least one material are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/material-requests", {
        method: "POST",
        companyId,
        body: JSON.stringify({ projectId, spaceId: spaceId || null, assigneeId, neededBy, lines }),
      });
      closeForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise request");
    } finally {
      setSaving(false);
    }
  }

  function openApprove(request: RequestRow) {
    setError(null);
    setApproving(request);
    setApprovalLines(
      request.lines.map((line) => ({
        lineId: line.id,
        qtyApproved: String(Math.round(qty(line.qtyRequested))),
        allocations: [
          { stockLocationId: "", supplierName: "", quantity: String(Math.round(qty(line.qtyRequested))) },
        ],
      })),
    );
  }

  function sourceOptions(requestProjectId: string) {
    return [
      { value: PURCHASE, label: "Buy from provider" },
      ...godowns.flatMap((godown) =>
        godown.stockLocation ? [{ value: godown.stockLocation.id, label: `Godown · ${godown.name}` }] : [],
      ),
      ...projects.flatMap((project) =>
        project.id !== requestProjectId && project.stockLocation
          ? [{ value: project.stockLocation.id, label: `Project · ${project.name}` }]
          : [],
      ),
    ];
  }

  function availableAt(locationId: string, materialId: string) {
    const match = (stockQuery.data ?? []).find(
      (balance) => balance.stockLocation.id === locationId && balance.material.id === materialId,
    );
    return qty(match?.quantity);
  }

  async function approve() {
    if (!companyId || !approving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/material-requests/${approving.id}/approve`, {
        method: "POST",
        companyId,
        body: JSON.stringify({
          lines: approvalLines.map((line) => ({
            lineId: line.lineId,
            qtyApproved: Number(line.qtyApproved) || 0,
            allocations:
              (Number(line.qtyApproved) || 0) > 0
                ? line.allocations
                    .filter((item) => item.stockLocationId && Number(item.quantity) > 0)
                    .map((item) => ({
                      stockLocationId: item.stockLocationId === PURCHASE ? null : item.stockLocationId,
                      supplierName: item.stockLocationId === PURCHASE ? item.supplierName.trim() || null : null,
                      quantity: Number(item.quantity),
                    }))
                : [],
          })),
        }),
      });
      setApproving(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setSaving(false);
    }
  }

  async function reject(requestId: string) {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/material-requests/${requestId}/reject`, {
        method: "POST",
        companyId,
        body: JSON.stringify({ note: rejectNote.trim() || null }),
      });
      setConfirmReject(false);
      setRejectNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject");
    } finally {
      setSaving(false);
    }
  }

  async function remove(requestId: string) {
    if (!companyId) return;
    setSaving(true);
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/material-requests/${requestId}`, { method: "DELETE", companyId });
      closeDetail();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setSaving(false);
      setDeleting(false);
    }
  }

  async function fulfill(request: RequestRow) {
    if (!companyId) return;
    const lines = request.lines.flatMap((line) =>
      line.allocations.flatMap((allocation) => {
        const quantity = qty(allocation.qtyAllocated) - sentFromSource(request, line.materialId, allocation);
        return quantity > 0.0000001 ? [{ materialId: line.materialId, allocationId: allocation.id, quantity }] : [];
      }),
    );
    if (lines.length === 0) {
      setError("Nothing left to send");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/material-requests/${request.id}/fulfill`, {
        method: "POST",
        companyId,
        body: JSON.stringify({ notes: fulfillNote.trim() || null, lines }),
      });
      setFulfillNote("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send stock");
    } finally {
      setSaving(false);
    }
  }

  async function receive(requestId: string, transferId: string) {
    if (!companyId) return;
    setSaving(true);
    setReceivingId(transferId);
    setError(null);
    try {
      await apiFetch(`/api/v1/material-requests/${requestId}/receive`, {
        method: "POST",
        companyId,
        body: JSON.stringify({ transferId }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark received");
    } finally {
      setSaving(false);
      setReceivingId(null);
    }
  }

  if (gate.loading || (ready && requestsQuery.isPending && !requestsQuery.data)) {
    return <Screen><Empty>Loading…</Empty></Screen>;
  }

  const sheetOpen = Boolean(open || selected || approving);
  const loadError = requestsQuery.error instanceof Error ? requestsQuery.error.message : null;
  const sheetError = sheetOpen ? error : null;
  const pageError = loadError || (!sheetOpen ? error : null);
  const canAct =
    selected && selected.status === "SUBMITTED" && canTransfer && selected.requestedBy.id !== myId;
  const canDelete =
    selected &&
    selected.requestedBy.id === myId &&
    !selected.transfers.some((transfer) =>
      ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(transfer.status),
    );
  const canSend =
    selected &&
    (selected.status === "APPROVED" || selected.status === "PARTIALLY_FULFILLED") &&
    canTransfer &&
    selected.lines.some((line) =>
      line.allocations.some(
        (allocation) => qty(allocation.qtyAllocated) - sentFromSource(selected, line.materialId, allocation) > 0.0000001,
      ),
    );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Title>Requests</Title>
          <Copy>Raise material needs, approve sources, and confirm what arrived.</Copy>
        </View>
        {canRaise ? (
          <IconButton
            label="New request"
            onPress={() => {
              setError(null);
              setOpen(true);
            }}
          />
        ) : null}
      </View>

      <View style={styles.filterRow}>
        <TextLink
          label="Requests"
          count={actionable.requests > 0 ? actionable.requests : undefined}
          active={view === "requests"}
          onPress={() => setView("requests")}
        />
        <TextLink
          label="Planning"
          count={actionable.planning > 0 ? actionable.planning : undefined}
          active={view === "planning"}
          onPress={() => setView("planning")}
        />
      </View>

      {view === "requests" ? (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Status</Text>
          <TextLink label={statusFilterLabel} active={statuses.length > 0} onPress={() => setStatusOpen(true)} />
          {statuses.length > 0 ? (
            <Pressable accessibilityLabel="Clear status filter" onPress={() => setStatuses([])} style={styles.clearHit}>
              <IconClose size={12} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ErrorText>{pageError}</ErrorText>

      {view === "planning" ? (
        <View style={styles.section}>
          {planningQuery.isPending ? <Empty>Loading…</Empty> : null}
          {!planningQuery.isPending && planningGroups.size === 0 ? <Empty>Nothing left to move.</Empty> : null}
          {[...planningGroups.entries()].map(([dateKey, sources]) => (
            <View key={dateKey} style={styles.dayBlock}>
              <Text style={styles.sectionLabel}>{formatDisplayDate(dateKey)}</Text>
              {[...sources.entries()].map(([source, needs]) => (
                <View key={source}>
                  <Text style={styles.sourceTitle}>{source}</Text>
                  {needs.map((need) => {
                    const sourceQty =
                      need.sources.find((item) => {
                        const name = item.stockLocation
                          ? locationName(item.stockLocation)
                          : item.purchase
                            ? purchaseLabel(item.supplierName)
                            : "Waiting to be received";
                        return name === source;
                      })?.qtyRemaining ?? need.qtyRemaining;
                    return (
                      <View key={`${need.requestId}-${need.material.name}-${source}`} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{need.material.name}</Text>
                          <Text style={styles.rowSub}>
                            {sourceQty} {need.material.uom} · {need.project.name}
                            {spaceLabel(need.space) ? ` · ${spaceLabel(need.space)}` : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {view === "requests" ? (
        <View style={styles.section}>
          {visible.length === 0 ? (
            <Empty>{requests.length === 0 ? "No requests yet." : "No requests in these statuses."}</Empty>
          ) : null}
          {visible.map((request) => {
            const mine = request.status === "SUBMITTED" && request.assignee?.id === myId;
            return (
              <Pressable
                key={request.id}
                style={styles.row}
                onPress={() => {
                  setError(null);
                  setConfirmDelete(false);
                  setConfirmReject(false);
                  setRejectNote("");
                  setSelectedId(request.id);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {request.project.name}
                    {request.space ? ` · ${spaceLabel(request.space)}` : ""}
                  </Text>
                  <Text style={styles.rowSub}>
                    <Text style={mine ? styles.flag : undefined}>
                      {mine ? "Needs your approval" : statusLabel(request.status)}
                    </Text>
                    {` · ${formatDisplayDate(toDateKey(request.neededBy))} · ${request.lines
                      .map((line) => `${qty(line.qtyRequested)} ${line.material.uom} ${line.material.name}`)
                      .join(", ")}`}
                  </Text>
                </View>
                {mine ? <Badge>Approve</Badge> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Sheet open={statusOpen} title="Select status" onClose={() => setStatusOpen(false)}>
        {STATUS_OPTIONS.map((option) => {
          const active = statuses.includes(option.value);
          return (
            <Pressable
              key={option.value}
              style={styles.pick}
              onPress={() =>
                setStatuses((current) =>
                  current.includes(option.value)
                    ? current.filter((item) => item !== option.value)
                    : [...current, option.value],
                )
              }
            >
              <CheckBox checked={active} />
              <Text style={[styles.rowTitle, active && styles.flag]}>{option.label}</Text>
            </Pressable>
          );
        })}
        {statuses.length > 0 ? <TextLink label="Clear" muted onPress={() => setStatuses([])} /> : null}
      </Sheet>

      <Sheet open={open} title="New request" onClose={closeForm}>
        <SelectField
          label="Project"
          quiet
          value={projectId}
          placeholder="Select project"
          onChange={(next) => {
            setProjectId(next);
            setSpaceId("");
            setAssigneeId("");
          }}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
        />
        <SelectField
          label="Space"
          quiet
          value={spaceId}
          placeholder="Optional"
          onChange={setSpaceId}
          options={(projectQuery.data?.spaces ?? []).map((space) => ({
            value: space.id,
            label: spaceLabel(space) ?? space.name,
          }))}
        />
        <SelectField
          label="Assignee"
          quiet
          value={assigneeId}
          placeholder={projectId ? "Select assignee" : "Select project first"}
          onChange={setAssigneeId}
          options={(assigneesQuery.data?.assignees ?? [])
            .filter((person) => person.id !== myId)
            .map((person) => ({ value: person.id, label: person.name }))}
        />
        <DateField label="Needed by" value={neededBy} onChange={setNeededBy} />
        {draftLines.map((line, index) => (
          <View key={index}>
            <View style={styles.fieldHead}>
              <Text style={styles.quietLabel}>Material</Text>
              {draftLines.length > 1 ? (
                <TextLink
                  label="Remove"
                  muted
                  onPress={() =>
                    setDraftLines((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                />
              ) : null}
            </View>
            <SelectField
              quiet
              value={line.materialId}
              placeholder="Select material"
              onChange={(next) =>
                setDraftLines((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, materialId: next } : item)),
                )
              }
              options={materials.map((material) => ({ value: material.id, label: material.name }))}
            />
            <Field label="Quantity" quiet>
              <TextField
                value={line.qty}
                onChangeText={(value) =>
                  setDraftLines((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, qty: wholeDigits(value) } : item,
                    ),
                  )
                }
                keyboardType="number-pad"
              />
            </Field>
          </View>
        ))}
        <TextLink
          label="Add material"
          onPress={() => setDraftLines((current) => [...current, { materialId: "", qty: "" }])}
        />
        <ErrorText>{sheetError}</ErrorText>
        <Button label="Raise request" pending={saving} onPress={() => void create()} />
      </Sheet>

      <Sheet open={Boolean(selected) && !approving} title={selected?.project.name ?? "Request"} onClose={closeDetail}>
        {selected ? (
          <>
            <Text style={styles.sectionLabel}>{statusLabel(selected.status)}</Text>
            <Copy>
              {`Needed ${formatDisplayDate(toDateKey(selected.neededBy))}${
                selected.space ? ` · ${spaceLabel(selected.space)}` : ""
              }${selected.assignee ? ` · Assigned to ${selected.assignee.name}` : ""} · Raised by ${selected.requestedBy.name}`}
            </Copy>
            {selected.status === "REJECTED" && selected.rejectionNote ? <Copy>{selected.rejectionNote}</Copy> : null}
            {selected.lines.map((line) => (
              <View key={line.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{line.material.name}</Text>
                  <Text style={styles.rowSub}>
                    {`Asked ${qty(line.qtyRequested)} ${line.material.uom}`}
                    {line.qtyApproved != null
                      ? ` · Approved ${qty(line.qtyApproved)} · Received ${qty(line.qtyFulfilled)}`
                      : ""}
                    {line.allocations.length > 0
                      ? ` · ${line.allocations
                          .map((allocation) => `${qty(allocation.qtyAllocated)} from ${sourceLabel(allocation)}`)
                          .join(", ")}`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}

            {canAct ? (
              confirmReject ? (
                <>
                  <Field label="Note (optional)" quiet>
                    <TextField value={rejectNote} onChangeText={setRejectNote} multiline maxLength={500} />
                  </Field>
                  <Button label="Reject" pending={saving} pendingLabel="Rejecting…" onPress={() => void reject(selected.id)} />
                  <Button
                    label="Cancel"
                    secondary
                    disabled={saving}
                    onPress={() => {
                      setConfirmReject(false);
                      setRejectNote("");
                    }}
                  />
                </>
              ) : (
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <Button label="Approve" onPress={() => openApprove(selected)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Reject"
                      secondary
                      disabled={saving}
                      onPress={() => {
                        setError(null);
                        setConfirmReject(true);
                      }}
                    />
                  </View>
                </View>
              )
            ) : null}

            {canDelete ? (
              confirmDelete ? (
                <>
                  <Copy>Delete this request? This cannot be undone.</Copy>
                  <Button
                    label="Delete"
                    pending={deleting}
                    pendingLabel="Deleting…"
                    icon={<IconTrash size={16} color={colors.accentInk} />}
                    onPress={() => void remove(selected.id)}
                  />
                  <Button label="Cancel" secondary disabled={saving} onPress={() => setConfirmDelete(false)} />
                </>
              ) : (
                <Button
                  label="Delete"
                  secondary
                  onPress={() => {
                    setError(null);
                    setConfirmDelete(true);
                  }}
                />
              )
            ) : null}

            {canSend ? (
              <>
                <Field label="Note (optional)" quiet>
                  <TextField value={fulfillNote} onChangeText={setFulfillNote} multiline />
                </Field>
                {selected.lines.flatMap((line) =>
                  line.allocations.map((allocation) => {
                    const left = qty(allocation.qtyAllocated) - sentFromSource(selected, line.materialId, allocation);
                    if (left <= 0.0000001) return null;
                    return (
                      <View key={allocation.id} style={styles.row}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>
                            {left} {line.material.uom} {line.material.name}
                          </Text>
                          <Text style={styles.rowSub}>{sourceLabel(allocation)}</Text>
                        </View>
                      </View>
                    );
                  }),
                )}
                <Button label="Send" pending={saving} pendingLabel="Sending…" onPress={() => void fulfill(selected)} />
              </>
            ) : null}

            {selected.transfers.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Transfers</Text>
                {selected.transfers.map((transfer) => (
                  <View key={transfer.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {transfer.fromLocation ? locationName(transfer.fromLocation) : purchaseLabel(transfer.supplierName)}
                      </Text>
                      <Text style={styles.rowSub}>
                        {transfer.status === "RECEIVED" ? "Received" : "Sent"}
                        {transfer.status === "RECEIVED" && transfer.receivedAt
                          ? ` ${formatDisplayDate(toDateKey(transfer.receivedAt))}`
                          : ""}
                        {transfer.notes ? ` · ${transfer.notes}` : ""}
                        {" · "}
                        {transfer.lines
                          .map((line) => {
                            const material = selected.lines.find((item) => item.materialId === line.materialId)?.material;
                            return `${qty(line.qtySent)} ${material?.uom ?? ""} ${material?.name ?? ""}`.trim();
                          })
                          .join(", ")}
                      </Text>
                    </View>
                    {transfer.status === "DISPATCHED" && selected.requestedBy.id === myId ? (
                      <Button
                        label="Received"
                        pending={receivingId === transfer.id}
                        pendingLabel="Receiving…"
                        disabled={saving}
                        onPress={() => void receive(selected.id, transfer.id)}
                      />
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
            <ErrorText>{sheetError}</ErrorText>
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(approving)}
        title="Approve request"
        onClose={() => {
          setApproving(null);
          setError(null);
        }}
      >
        {approving
          ? approvalLines.map((draft, index) => {
              const line = approving.lines.find((item) => item.id === draft.lineId);
              if (!line) return null;
              const allocated = draft.allocations.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
              return (
                <View key={draft.lineId} style={styles.dayBlock}>
                  <Text style={styles.sectionLabel}>{line.material.name}</Text>
                  <Field label={`Approve up to ${qty(line.qtyRequested)} ${line.material.uom}`} quiet>
                    <TextField
                      value={draft.qtyApproved}
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        setApprovalLines((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, qtyApproved: wholeDigits(value) } : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  {draft.allocations.map((allocation, allocationIndex) => {
                    const buying = allocation.stockLocationId === PURCHASE;
                    return (
                      <View key={allocationIndex}>
                        <SelectField
                          label="Source"
                          quiet
                          value={allocation.stockLocationId}
                          placeholder="Godown, project, or provider"
                          onChange={(next) =>
                            setApprovalLines((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      allocations: item.allocations.map((entry, entryIndex) =>
                                        entryIndex === allocationIndex
                                          ? {
                                              ...entry,
                                              stockLocationId: next,
                                              supplierName: next === PURCHASE ? entry.supplierName : "",
                                            }
                                          : entry,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                          options={sourceOptions(approving.project.id)}
                        />
                        {buying ? (
                          <Field label="Provider (optional)" quiet>
                            <TextField
                              value={allocation.supplierName}
                              maxLength={160}
                              onChangeText={(value) =>
                                setApprovalLines((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          allocations: item.allocations.map((entry, entryIndex) =>
                                            entryIndex === allocationIndex ? { ...entry, supplierName: value } : entry,
                                          ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </Field>
                        ) : null}
                        <Field
                          label={`Allocate${!buying && allocation.stockLocationId ? ` · ${availableAt(allocation.stockLocationId, line.materialId)} ${line.material.uom} available` : ""}`}
                          quiet
                        >
                          <TextField
                            value={allocation.quantity}
                            keyboardType="number-pad"
                            onChangeText={(value) =>
                              setApprovalLines((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        allocations: item.allocations.map((entry, entryIndex) =>
                                          entryIndex === allocationIndex ? { ...entry, quantity: wholeDigits(value) } : entry,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </Field>
                      </View>
                    );
                  })}
                  <TextLink
                    label="Add source"
                    onPress={() =>
                      setApprovalLines((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                allocations: [...item.allocations, { stockLocationId: "", supplierName: "", quantity: "" }],
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <Copy>{`Allocated ${allocated} ${line.material.uom}`}</Copy>
                </View>
              );
            })
          : null}
        <ErrorText>{sheetError}</ErrorText>
        <Button label="Approve" pending={saving} onPress={() => void approve()} />
      </Sheet>
    </Screen>
  );
}

function TextLink({
  label,
  count,
  active,
  muted,
  onPress,
}: {
  label: string;
  count?: number;
  active?: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkHit}>
      <Text style={[styles.link, active && styles.linkActive, muted && styles.linkMuted]}>{label}</Text>
      {count ? <Text style={[styles.linkCount, active && styles.linkActive]}>{count}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 16, marginTop: 10 },
  clearHit: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  filterLabel: { fontFamily: "Mukta_500Medium", fontSize: 15, color: colors.muted, marginRight: 8 },
  linkHit: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, marginRight: 12 },
  linkCount: { fontFamily: "Mukta_600SemiBold", fontSize: 15, color: colors.muted },
  link: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  linkActive: { color: colors.accent },
  linkMuted: { color: colors.muted, fontFamily: "Mukta_500Medium" },
  section: { marginTop: 28 },
  sectionLabel: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
  },
  dayBlock: { marginTop: 16 },
  sourceTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink, marginTop: 8, marginBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  flag: { color: colors.accent, fontFamily: "Mukta_600SemiBold" },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  actions: { flexDirection: "row", gap: 10 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quietLabel: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted },
});
