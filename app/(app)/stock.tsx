import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Button, Copy, Empty, ErrorText, FilterLink, Row, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { apiBaseUrl, apiFetch, uploadMedia } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session-store";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { toDateKey } from "@/lib/dates";
import { queryKeys } from "@/lib/query-keys";
import { useGodownsQuery, useMaterialsQuery, useProjectsQuery, useStockQuery, useTransfersQuery } from "@/lib/queries";

type Balance = {
  id: string;
  quantity: string | number;
  material: { id: string; name: string; uom: string };
  stockLocation: { id: string; kind: string; godown: { name: string } | null; project: { id: string; name: string } | null };
  media?: { id: string; url: string }[];
};
type Transfer = {
  id: string;
  status: string;
  notes: string | null;
  fromLocation: { godown: { name: string } | null; project: { name: string } | null } | null;
  toLocation: { godown: { name: string } | null; project: { name: string } | null };
  lines: { qtySent: string | number; material: { name: string; uom: string } }[];
  media?: { url: string }[];
};
const UOMS = ["BAG", "KG", "TON", "METER", "SQ_METER", "PIECE", "LITER", "CUBIC_METER", "ROLL", "BOX"];

function place(location: { godown: { name: string } | null; project: { name: string } | null }) {
  return location.godown?.name || location.project?.name || "Location";
}

export default function StockScreen() {
  const { companyId } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const [tab, setTab] = useState<"balances" | "transfers" | "godowns">("balances");
  const stockQuery = useStockQuery<Balance>(ready);
  const transfersQuery = useTransfersQuery<Transfer>(ready);
  const godownsQuery = useGodownsQuery(ready);
  const materialsQuery = useMaterialsQuery(ready);
  const projectsQuery = useProjectsQuery(ready);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [godownOpen, setGodownOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [removeBalance, setRemoveBalance] = useState<Balance | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [godownName, setGodownName] = useState("");
  const [editingGodown, setEditingGodown] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<{ id: string; name: string; uom: string } | null>(null);
  const [receiptGodownId, setReceiptGodownId] = useState("");
  const [receiptMaterialId, setReceiptMaterialId] = useState("");
  const [newMaterial, setNewMaterial] = useState("");
  const [uom, setUom] = useState("BAG");
  const [qty, setQty] = useState("10");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transferMaterialId, setTransferMaterialId] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [removeQty, setRemoveQty] = useState("");
  const [removeReason, setRemoveReason] = useState("USED");
  const [removeProjectId, setRemoveProjectId] = useState("");

  const godowns = godownsQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const locations = [
    ...godowns.flatMap((godown) => (godown.stockLocation ? [{ value: godown.stockLocation.id, label: `Godown · ${godown.name}` }] : [])),
    ...projects.flatMap((project) => (project.stockLocation ? [{ value: project.stockLocation.id, label: `Project · ${project.name}` }] : [])),
  ];

  function resetEntryFields() {
    setReceiptGodownId("");
    setReceiptMaterialId("");
    setNewMaterial("");
    setUom("BAG");
    setQty("10");
    setDate(toDateKey(new Date()));
    setFromLocationId("");
    setToLocationId("");
    setTransferMaterialId("");
    setTransferNotes("");
    setPhotos([]);
    setGodownName("");
    setEditingGodown(null);
    setEditingMaterial(null);
    setRemoveQty("");
    setRemoveReason("USED");
    setRemoveProjectId("");
    setError(null);
  }

  async function refreshStock() {
    if (!companyId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.stock(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.godowns(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.materials(companyId) }),
    ]);
  }

  async function saveGodown() {
    if (!companyId || !godownName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingGodown) {
        await apiFetch(`/api/v1/godowns/${editingGodown}`, { method: "PATCH", companyId, body: JSON.stringify({ name: godownName.trim() }) });
      } else {
        await apiFetch("/api/v1/godowns", { method: "POST", companyId, body: JSON.stringify({ name: godownName.trim() }) });
      }
      setGodownOpen(false);
      resetEntryFields();
      await refreshStock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save godown");
    } finally {
      setSaving(false);
    }
  }

  async function receive() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      let materialId = receiptMaterialId;
      if (!materialId) {
        const material = await apiFetch<{ id: string }>("/api/v1/materials", {
          method: "POST",
          companyId,
          body: JSON.stringify({ name: newMaterial.trim(), uom }),
        });
        materialId = material.id;
      }
      const godown = godowns.find((item) => item.id === receiptGodownId);
      if (!godown?.stockLocation) throw new Error("Select a godown");
      await apiFetch("/api/v1/receipts", {
        method: "POST",
        companyId,
        body: JSON.stringify({ stockLocationId: godown.stockLocation.id, occurredOn: date, lines: [{ materialId, quantity: Number(qty) }] }),
      });
      setReceiveOpen(false);
      resetEntryFields();
      await refreshStock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not receive stock");
    } finally {
      setSaving(false);
    }
  }

  async function transfer() {
    if (!companyId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>("/api/v1/transfers", {
        method: "POST",
        companyId,
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          notes: transferNotes.trim() || null,
          occurredOn: date,
          lines: [{ materialId: transferMaterialId, qtySent: Number(qty) }],
        }),
      });
      for (const photo of photos) await uploadMedia({ companyId, ownerType: "TRANSFER", ownerId: created.id, ...photo });
      setTransferOpen(false);
      resetEntryFields();
      await refreshStock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create transfer");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!companyId || !removeBalance) return;
    setSaving(true);
    setError(null);
    try {
      const quantity = Number(removeQty);
      if (removeReason === "USED") {
        const usage = await apiFetch<{ id: string }>("/api/v1/usages", {
          method: "POST",
          companyId,
          body: JSON.stringify({
            projectId: removeProjectId,
            stockLocationId: removeBalance.stockLocation.id,
            usedOn: date,
            lines: [{ materialId: removeBalance.material.id, quantity }],
          }),
        });
        for (const photo of photos) await uploadMedia({ companyId, ownerType: "MATERIAL_USAGE", ownerId: usage.id, ...photo });
      } else {
        const discard = await apiFetch<{ id: string }>("/api/v1/discards", {
          method: "POST",
          companyId,
          body: JSON.stringify({
            stockLocationId: removeBalance.stockLocation.id,
            reason: removeReason,
            occurredOn: date,
            lines: [{ materialId: removeBalance.material.id, quantity }],
          }),
        });
        for (const photo of photos) await uploadMedia({ companyId, ownerType: "DISCARD", ownerId: discard.id, ...photo });
      }
      setRemoveBalance(null);
      resetEntryFields();
      await refreshStock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove stock");
    } finally {
      setSaving(false);
    }
  }

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;

  const token = getSessionToken();

  return (
    <Screen>
      <Title>Stock</Title>
      <Copy>Balances, receipts, and project transfers.</Copy>
      <FilterLink label="Balances" active={tab === "balances"} onPress={() => setTab("balances")} />
      <FilterLink label="Transfers" active={tab === "transfers"} onPress={() => setTab("transfers")} />
      <FilterLink label="Godowns" active={tab === "godowns"} onPress={() => setTab("godowns")} />
      {tab === "balances" ? (
        <>
          <Button label="Receive" onPress={() => setReceiveOpen(true)} />
          <Button label="Transfer" secondary onPress={() => setTransferOpen(true)} />
          {(stockQuery.data ?? []).map((balance) => (
            <Row
              key={balance.id}
              title={`${balance.material.name} · ${Number(balance.quantity)} ${balance.material.uom}`}
              subtitle={place(balance.stockLocation)}
              trailing="Remove"
              onPress={() => setRemoveBalance(balance)}
            />
          ))}
          {(materialsQuery.data ?? []).map((material) => (
            <Row key={material.id} title={material.name} subtitle={material.uom} trailing="Edit" onPress={() => { setEditingMaterial(material); setMaterialOpen(true); }} />
          ))}
        </>
      ) : null}
      {tab === "transfers"
        ? (transfersQuery.data ?? []).map((transfer) => (
            <Row
              key={transfer.id}
              title={`${transfer.fromLocation ? place(transfer.fromLocation) : "Buy"} → ${place(transfer.toLocation)}`}
              subtitle={`${transfer.status} · ${transfer.lines.map((line) => `${line.material.name} ${Number(line.qtySent)}`).join(", ")}`}
              onPress={() => setViewer(transfer.media?.[0]?.url ?? null)}
            />
          ))
        : null}
      {tab === "godowns" ? (
        <>
          <Button label="New godown" onPress={() => { setEditingGodown(null); setGodownName(""); setGodownOpen(true); }} />
          {godowns.map((godown) => (
            <Row
              key={godown.id}
              title={godown.name}
              trailing="Edit"
              onPress={() => { setEditingGodown(godown.id); setGodownName(godown.name); setGodownOpen(true); }}
            />
          ))}
        </>
      ) : null}
      <ErrorText>{error}</ErrorText>
      <Sheet open={receiveOpen} title="Receive" onClose={() => { setReceiveOpen(false); resetEntryFields(); }}>
        <SelectField label="Godown" value={receiptGodownId} onChange={setReceiptGodownId} options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))} />
        <SelectField label="Material" value={receiptMaterialId} onChange={setReceiptMaterialId} options={[{ value: "", label: "New material" }, ...materials.map((material) => ({ value: material.id, label: material.name }))]} />
        {!receiptMaterialId ? <TextField value={newMaterial} onChangeText={setNewMaterial} placeholder="Material name" /> : null}
        <SelectField label="UOM" value={uom} onChange={setUom} options={UOMS.map((value) => ({ value, label: value }))} />
        <TextField value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        <TextField value={date} onChangeText={setDate} />
        <Button label="Receive" pending={saving} onPress={() => void receive()} />
      </Sheet>
      <Sheet open={transferOpen} title="Transfer" onClose={() => { setTransferOpen(false); resetEntryFields(); }}>
        <SelectField label="From" value={fromLocationId} onChange={setFromLocationId} options={locations} />
        <SelectField label="To" value={toLocationId} onChange={setToLocationId} options={locations} />
        <SelectField label="Material" value={transferMaterialId} onChange={setTransferMaterialId} options={materials.map((material) => ({ value: material.id, label: material.name }))} />
        <TextField value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        <TextField value={transferNotes} onChangeText={setTransferNotes} placeholder="Notes" />
        <PhotoPicker photos={photos} onChange={setPhotos} />
        <Button label="Transfer" pending={saving} onPress={() => void transfer()} />
      </Sheet>
      <Sheet open={godownOpen} title="Godown" onClose={() => { setGodownOpen(false); resetEntryFields(); }}>
        <TextField value={godownName} onChangeText={setGodownName} placeholder="Name" />
        <Button label="Save" pending={saving} onPress={() => void saveGodown()} />
        {editingGodown ? (
          <Button
            label="Delete"
            secondary
            onPress={() => {
              if (!companyId || !editingGodown) return;
              void apiFetch(`/api/v1/godowns/${editingGodown}`, { method: "DELETE", companyId }).then(() => refreshStock());
              setGodownOpen(false);
              resetEntryFields();
            }}
          />
        ) : null}
      </Sheet>
      <Sheet open={materialOpen} title="Material" onClose={() => { setMaterialOpen(false); resetEntryFields(); }}>
        <TextField value={editingMaterial?.name ?? ""} onChangeText={(name) => setEditingMaterial((current) => current && { ...current, name })} />
        <SelectField label="UOM" value={editingMaterial?.uom ?? "BAG"} onChange={(next) => setEditingMaterial((current) => current && { ...current, uom: next })} options={UOMS.map((value) => ({ value, label: value }))} />
        <Button
          label="Save"
          pending={saving}
          onPress={() => {
            if (!companyId || !editingMaterial) return;
            void apiFetch(`/api/v1/materials/${editingMaterial.id}`, {
              method: "PATCH",
              companyId,
              body: JSON.stringify({ name: editingMaterial.name, uom: editingMaterial.uom }),
            }).then(() => refreshStock());
            setMaterialOpen(false);
            resetEntryFields();
          }}
        />
        <Button
          label="Delete"
          secondary
          onPress={() => {
            if (!companyId || !editingMaterial) return;
            void apiFetch(`/api/v1/materials/${editingMaterial.id}`, { method: "DELETE", companyId }).then(() => refreshStock());
            setMaterialOpen(false);
            resetEntryFields();
          }}
        />
      </Sheet>
      <Sheet open={Boolean(removeBalance)} title="Remove stock" onClose={() => { setRemoveBalance(null); resetEntryFields(); }}>
        <SelectField label="Reason" value={removeReason} onChange={setRemoveReason} options={["USED", "DAMAGED", "EXPIRED", "THEFT", "WASTAGE", "OTHER"].map((value) => ({ value, label: value }))} />
        {removeReason === "USED" ? (
          <SelectField label="Project" value={removeProjectId} onChange={setRemoveProjectId} options={projects.map((project) => ({ value: project.id, label: project.name }))} />
        ) : null}
        <TextField value={removeQty} onChangeText={setRemoveQty} keyboardType="decimal-pad" placeholder="Quantity" />
        <PhotoPicker photos={photos} onChange={setPhotos} />
        <Button label="Remove" pending={saving} onPress={() => void remove()} />
      </Sheet>
      <Sheet open={Boolean(viewer)} title="Photo" onClose={() => setViewer(null)}>
        {viewer ? (
          <Image
            source={{ uri: viewer.startsWith("http") ? viewer : `${apiBaseUrl()}${viewer}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
            style={{ width: "100%", height: 280 }}
            contentFit="contain"
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
