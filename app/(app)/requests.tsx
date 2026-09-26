import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Copy, Empty, ErrorText, FilterLink, Row, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";
import { useGodownsQuery, useMaterialRequestsQuery, useMaterialsQuery, useProjectsQuery, useProjectQuery } from "@/lib/queries";
import { PERMISSIONS } from "@/shared";

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "FULFILLED", "RECEIVED"];
const PURCHASE = "__purchase__";

type Line = {
  id: string;
  materialId: string;
  qtyRequested: string | number;
  material: { name: string; uom: string };
  allocations: { id: string; qtyAllocated: string | number; stockLocationId: string | null }[];
};
type RequestRow = {
  id: string;
  status: string;
  neededBy: string;
  projectId: string;
  project: { name: string };
  requester: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  lines: Line[];
  transfers?: { id: string; status: string }[];
};

export default function RequestsScreen() {
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const canRaise = permissions.includes(PERMISSIONS.PROJECTS_MANAGE);
  const canTransfer = [PERMISSIONS.TRANSFERS_APPROVE, PERMISSIONS.TRANSFERS_DISPATCH, PERMISSIONS.TRANSFERS_CREATE].some((code) => permissions.includes(code));
  const [view, setView] = useState<"requests" | "planning">("requests");
  const [statuses, setStatuses] = useState<string[]>([]);
  const requestsQuery = useMaterialRequestsQuery<RequestRow>(ready);
  const projectsQuery = useProjectsQuery(ready);
  const materialsQuery = useMaterialsQuery(ready);
  const godownsQuery = useGodownsQuery(ready);
  const planningQuery = useQuery({
    queryKey: ["planning", companyId],
    queryFn: () => apiFetch<{ needs: { material: { name: string }; remaining: string | number; project: { name: string } }[] }>("/api/v1/planning", { companyId }).then((payload) => payload.needs),
    enabled: ready && view === "planning",
  });
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const projectQuery = useProjectQuery<{ spaces: { id: string; name: string }[] }>(projectId || undefined, open);
  const assigneesQuery = useQuery({
    queryKey: ["assignees", companyId, projectId],
    queryFn: () => apiFetch<{ assignees: { id: string; name: string }[] }>(`/api/v1/material-requests/assignees?projectId=${projectId}`, { companyId }).then((payload) => payload.assignees),
    enabled: open && Boolean(projectId),
  });
  const [spaceId, setSpaceId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [approving, setApproving] = useState<RequestRow | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requests = (requestsQuery.data ?? []).filter((request) => statuses.length === 0 || statuses.includes(request.status));

  async function refresh() {
    if (!companyId) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.materialRequests(companyId) });
    await queryClient.invalidateQueries({ queryKey: ["planning", companyId] });
  }

  function resetRequest() {
    setProjectId("");
    setSpaceId("");
    setAssigneeId("");
    setNeededBy("");
    setMaterialId("");
    setQty("");
    setError(null);
  }

  function closeRequest() {
    setOpen(false);
    resetRequest();
  }

  function closeApprove() {
    setApproving(null);
    setSourceId("");
    setSupplier("");
    setNote("");
    setError(null);
  }

  async function create() {
    if (!companyId || !projectId || !assigneeId || !neededBy || !materialId || Number(qty) <= 0) {
      setError("Project, assignee, date, and a material are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/material-requests", {
        method: "POST",
        companyId,
        body: JSON.stringify({
          projectId,
          spaceId: spaceId || null,
          assigneeId,
          neededBy,
          lines: [{ materialId, qtyRequested: Number(qty) }],
        }),
      });
      closeRequest();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise request");
    } finally {
      setSaving(false);
    }
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
          lines: approving.lines.map((line) => ({
            lineId: line.id,
            qtyApproved: Number(line.qtyRequested),
            allocations: sourceId
              ? [{
                  stockLocationId: sourceId === PURCHASE ? null : sourceId,
                  supplierName: sourceId === PURCHASE ? supplier.trim() || null : null,
                  quantity: Number(line.qtyRequested),
                }]
              : [],
          })),
        }),
      });
      closeApprove();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setSaving(false);
    }
  }

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;

  const sources = [
    { value: PURCHASE, label: "Buy from provider" },
    ...godownsQuery.data?.flatMap((godown) => (godown.stockLocation ? [{ value: godown.stockLocation.id, label: godown.name }] : [])) ?? [],
  ];

  return (
    <Screen>
      <Title>Requests</Title>
      <Copy>Raise, approve, send, and receive materials.</Copy>
      <FilterLink label="Requests" active={view === "requests"} onPress={() => setView("requests")} />
      <FilterLink label="Planning" active={view === "planning"} onPress={() => setView("planning")} />
      {view === "planning"
        ? (planningQuery.data ?? []).map((need, index) => (
            <Row key={index} title={need.material.name} subtitle={need.project.name} trailing={String(need.remaining)} />
          ))
        : null}
      {view === "requests" ? (
        <>
          {canRaise ? <Button label="New request" onPress={() => { resetRequest(); setOpen(true); }} /> : null}
          {STATUSES.map((status) => (
            <FilterLink
              key={status}
              label={status}
              active={statuses.includes(status)}
              onPress={() => setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status])}
            />
          ))}
          {requests.map((request) => (
            <Row
              key={request.id}
              title={`${request.project.name} · ${request.status}`}
              subtitle={`${request.lines.map((line) => line.material.name).join(", ")} · ${request.neededBy.slice(0, 10)}`}
              onPress={() => setSelected(request)}
            />
          ))}
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Sheet open={open} title="New request" onClose={closeRequest}>
        <SelectField label="Project" value={projectId} onChange={setProjectId} options={(projectsQuery.data ?? []).map((project) => ({ value: project.id, label: project.name }))} />
        <SelectField label="Space" value={spaceId} onChange={setSpaceId} options={[{ value: "", label: "None" }, ...(projectQuery.data?.spaces ?? []).map((space) => ({ value: space.id, label: space.name }))]} />
        <SelectField label="Assignee" value={assigneeId} onChange={setAssigneeId} options={(assigneesQuery.data ?? []).map((person) => ({ value: person.id, label: person.name }))} />
        <TextField value={neededBy} onChangeText={setNeededBy} placeholder="Needed by YYYY-MM-DD" />
        <SelectField label="Material" value={materialId} onChange={setMaterialId} options={(materialsQuery.data ?? []).map((material) => ({ value: material.id, label: material.name }))} />
        <TextField value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="Quantity" />
        <Button label="Raise" pending={saving} onPress={() => void create()} />
      </Sheet>
      <Sheet open={Boolean(selected)} title="Request" onClose={() => { setSelected(null); setNote(""); setError(null); }}>
        {selected ? (
          <>
            <Copy>{`${selected.project.name} · ${selected.status}`}</Copy>
            {selected.lines.map((line) => <Copy key={line.id}>{`${line.material.name} · ${Number(line.qtyRequested)} ${line.material.uom}`}</Copy>)}
            {canTransfer && selected.status === "SUBMITTED" && selected.assignee?.id === me?.id ? (
              <Button label="Approve" onPress={() => { setApproving(selected); setSelected(null); }} />
            ) : null}
            {canTransfer && selected.status === "SUBMITTED" ? (
              <Button label="Reject" secondary onPress={() => void apiFetch(`/api/v1/material-requests/${selected.id}/reject`, { method: "POST", companyId, body: JSON.stringify({ note: note || null }) }).then(refresh)} />
            ) : null}
            {canTransfer && selected.status === "APPROVED" ? (
              <Button
                label="Send"
                onPress={() => {
                  const lines = selected.lines.flatMap((line) => line.allocations.map((allocation) => ({ materialId: line.materialId, allocationId: allocation.id, quantity: Number(allocation.qtyAllocated) })));
                  void apiFetch(`/api/v1/material-requests/${selected.id}/fulfill`, { method: "POST", companyId, body: JSON.stringify({ notes: note || null, lines }) }).then(refresh);
                }}
              />
            ) : null}
            {selected.requester.id === me?.id
              ? (selected.transfers ?? []).filter((transfer) => transfer.status !== "RECEIVED").map((transfer) => (
                  <Button key={transfer.id} label="Received" onPress={() => void apiFetch(`/api/v1/material-requests/${selected.id}/receive`, { method: "POST", companyId, body: JSON.stringify({ transferId: transfer.id }) }).then(refresh)} />
                ))
              : null}
            {selected.requester.id === me?.id ? (
              <Button label="Delete" secondary onPress={() => void apiFetch(`/api/v1/material-requests/${selected.id}`, { method: "DELETE", companyId }).then(() => { setSelected(null); return refresh(); })} />
            ) : null}
            <TextField value={note} onChangeText={setNote} placeholder="Note" />
          </>
        ) : null}
      </Sheet>
      <Sheet open={Boolean(approving)} title="Approve" onClose={closeApprove}>
        <SelectField label="Source" value={sourceId} onChange={setSourceId} options={sources} />
        {sourceId === PURCHASE ? <TextField value={supplier} onChangeText={setSupplier} placeholder="Supplier" /> : null}
        <Button label="Approve" pending={saving} onPress={() => void approve()} />
      </Sheet>
    </Screen>
  );
}
