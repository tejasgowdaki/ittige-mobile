import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { DateField } from "@/components/date-field";
import { IconInbox, IconMinus, IconPencil, IconPlus, IconTrash, IconTruck } from "@/components/icons";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import {
  Badge,
  Button,
  Copy,
  Empty,
  ErrorText,
  Field,
  FilterLink,
  IconButton,
  Screen,
  SelectField,
  Sheet,
  TextField,
  Title,
} from "@/components/ui";
import { apiBaseUrl, apiFetch, uploadMedia } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session-store";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { toDateKey } from "@/lib/dates";
import { queryKeys } from "@/lib/query-keys";
import { useGodownsQuery, useMaterialsQuery, useProjectsQuery, useStockQuery, useTransfersQuery } from "@/lib/queries";
import { colors } from "@/theme";

type Balance = {
  id: string;
  quantity: string | number;
  material: { id: string; name: string; uom: string };
  stockLocation: { id: string; kind: string; godownId: string | null; projectId: string | null };
  media?: { id: string; url: string }[];
};
type LocationRef = {
  godown: { name: string } | null;
  project: { name: string } | null;
  kind?: string;
};
type Transfer = {
  id: string;
  status: string;
  notes: string | null;
  supplierName: string | null;
  fromLocation: LocationRef | null;
  toLocation: LocationRef;
  lines: { qtySent: string | number; material: { name: string; uom: string } }[];
  media?: { id: string; url: string }[];
};
type MediaTarget = {
  ownerType: "TRANSFER";
  ownerId: string;
  title: string;
  media: { id: string; url: string }[];
};
type BalanceGroup = {
  materialId: string;
  name: string;
  uom: string;
  total: number;
  lines: Balance[];
};

const UOMS = ["BAG", "KG", "TON", "METER", "PIECE", "LITER"];
const REMOVE_REASONS = [
  { value: "USED", label: "Used on project" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "EXPIRED", label: "Expired" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "THEFT", label: "Theft" },
  { value: "OTHER", label: "Other" },
];
const TABS = [
  ["balances", "Balances"],
  ["transfers", "Transfers"],
  ["godowns", "Godowns"],
] as const;

function photoSource(url: string, token: string | null) {
  return {
    uri: url.startsWith("http") ? url : `${apiBaseUrl()}${url}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

function MediaStrip({
  items,
  token,
  large,
}: {
  items?: { id?: string; url: string }[];
  token: string | null;
  large?: boolean;
}) {
  if (!items || items.length === 0) return null;
  const size = large ? 96 : 56;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {items.map((item) => (
        <Image
          key={item.id ?? item.url}
          source={photoSource(item.url, token)}
          style={{ width: size, height: size, borderRadius: 8 }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

function locationLabel(location: LocationRef | null, supplierName?: string | null) {
  if (!location) return supplierName ? `Buy · ${supplierName}` : "Buy from provider";
  if (location.godown) return `Godown · ${location.godown.name}`;
  if (location.project) return `Project · ${location.project.name}`;
  return location.kind || "Location";
}

export default function StockScreen() {
  const { companyId } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("balances");
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
  const [locationsMaterialId, setLocationsMaterialId] = useState<string | null>(null);
  const [godownToDelete, setGodownToDelete] = useState<{ id: string; name: string } | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<{ id: string; name: string } | null>(null);
  const [mediaTarget, setMediaTarget] = useState<MediaTarget | null>(null);
  const [mediaPhotos, setMediaPhotos] = useState<PickedPhoto[]>([]);
  const [godownName, setGodownName] = useState("");
  const [editingGodown, setEditingGodown] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<{ id: string; name: string; uom: string } | null>(null);
  const [receiptGodownId, setReceiptGodownId] = useState("");
  const [receiptMaterialId, setReceiptMaterialId] = useState("");
  const [creatingMaterial, setCreatingMaterial] = useState(false);
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
  const [removeNote, setRemoveNote] = useState("");

  const godowns = godownsQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const balances = stockQuery.data ?? [];
  const transfers = transfersQuery.data ?? [];
  const locations = [
    ...godowns.flatMap((godown) =>
      godown.stockLocation ? [{ value: godown.stockLocation.id, label: `Godown · ${godown.name}` }] : [],
    ),
    ...projects.flatMap((project) =>
      project.stockLocation ? [{ value: project.stockLocation.id, label: `Project · ${project.name}` }] : [],
    ),
  ];
  const balanceGroups = useMemo(() => {
    const map = new Map<string, BalanceGroup>();
    for (const balance of balances) {
      const existing = map.get(balance.material.id);
      if (existing) {
        existing.total += Number(balance.quantity);
        existing.lines.push(balance);
      } else {
        map.set(balance.material.id, {
          materialId: balance.material.id,
          name: balance.material.name,
          uom: balance.material.uom,
          total: Number(balance.quantity),
          lines: [balance],
        });
      }
    }
    return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [balances]);
  const locationsGroup = locationsMaterialId
    ? balanceGroups.find((group) => group.materialId === locationsMaterialId) ?? null
    : null;
  const transferAvailable = balances.find(
    (balance) => balance.stockLocation.id === fromLocationId && balance.material.id === transferMaterialId,
  );

  function balanceLocationLabel(balance: Balance) {
    if (balance.stockLocation.godownId) {
      const godown = godowns.find((item) => item.id === balance.stockLocation.godownId);
      return godown ? `Godown · ${godown.name}` : "Godown";
    }
    if (balance.stockLocation.projectId) {
      const project = projects.find((item) => item.id === balance.stockLocation.projectId);
      return project ? `Project · ${project.name}` : "Project";
    }
    return balance.stockLocation.kind;
  }

  function resetEntryFields() {
    const locationIds = locations.map((location) => location.value);
    setReceiptGodownId(godowns[0]?.id ?? "");
    setReceiptMaterialId(materials[0]?.id ?? "");
    setCreatingMaterial(materials.length === 0);
    setNewMaterial("");
    setUom("BAG");
    setQty("10");
    setDate(toDateKey(new Date()));
    setFromLocationId(locationIds[0] ?? "");
    setToLocationId(locationIds[1] || locationIds[0] || "");
    setTransferMaterialId(materials[0]?.id ?? "");
    setTransferNotes("");
    setPhotos([]);
    setGodownName("");
    setEditingGodown(null);
    setEditingMaterial(null);
    setRemoveQty("");
    setRemoveReason("USED");
    setRemoveProjectId(projects[0]?.id ?? "");
    setRemoveNote("");
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
        await apiFetch(`/api/v1/godowns/${editingGodown}`, {
          method: "PATCH",
          companyId,
          body: JSON.stringify({ name: godownName.trim() }),
        });
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
      if (creatingMaterial || !materialId) {
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
        body: JSON.stringify({
          stockLocationId: godown.stockLocation.id,
          occurredOn: date,
          lines: [{ materialId, quantity: Number(qty) }],
        }),
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
    const quantity = Number(removeQty);
    const available = Number(removeBalance.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter a quantity to remove");
      return;
    }
    if (quantity > available) {
      setError(`Only ${available} ${removeBalance.material.uom} available`);
      return;
    }
    if (removeReason === "USED" && !removeProjectId) {
      setError("Select a project");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (removeReason === "USED") {
        const usage = await apiFetch<{ id: string }>("/api/v1/usages", {
          method: "POST",
          companyId,
          body: JSON.stringify({
            projectId: removeProjectId,
            stockLocationId: removeBalance.stockLocation.id,
            usedOn: date,
            notes: removeNote.trim() || null,
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
            reasonNote: removeNote.trim() || null,
            occurredOn: date,
            lines: [{ materialId: removeBalance.material.id, quantity }],
          }),
        });
        for (const photo of photos) await uploadMedia({ companyId, ownerType: "DISCARD", ownerId: discard.id, ...photo });
      }
      setRemoveBalance(null);
      setLocationsMaterialId(null);
      resetEntryFields();
      await refreshStock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove stock");
    } finally {
      setSaving(false);
    }
  }

  if (gate.loading || (ready && stockQuery.isPending && !stockQuery.data)) {
    return <Screen><Empty>Loading…</Empty></Screen>;
  }

  const token = getSessionToken();
  const quantityLabel = transferAvailable
    ? `Quantity · available ${Number(transferAvailable.quantity)} ${transferAvailable.material.uom}`
    : fromLocationId && transferMaterialId
      ? "Quantity · available 0"
      : "Quantity";

  return (
    <Screen>
      <Title>Stock</Title>
      <Copy>Balances, receipts, and project transfers.</Copy>
      <View style={styles.tabs}>
        {TABS.map(([id, label]) => (
          <View key={id} style={styles.tab}>
            <Button label={label} secondary={tab !== id} onPress={() => setTab(id)} />
          </View>
        ))}
      </View>
      <ErrorText>{!receiveOpen && !transferOpen && !godownOpen && !materialOpen && !removeBalance ? error : null}</ErrorText>

      {tab === "balances" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Balances</Text>
            <IconButton
              label="Receive stock"
              onPress={() => {
                resetEntryFields();
                setReceiveOpen(true);
              }}
            />
          </View>
          {balanceGroups.length === 0 ? <Empty>No stock yet. Receive into a godown.</Empty> : null}
          {balanceGroups.map((group) => (
            <View key={group.materialId} style={styles.row}>
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={styles.rowTitle}>{group.name}</Text>
                  <Pressable
                    accessibilityLabel={`Edit ${group.name}`}
                    onPress={() => {
                      setEditingMaterial({ id: group.materialId, name: group.name, uom: group.uom });
                      setMaterialOpen(true);
                    }}
                  >
                    <IconPencil size={14} color={colors.ink} />
                  </Pressable>
                </View>
                <FilterLink
                  label={`${group.lines.length} ${group.lines.length === 1 ? "location" : "locations"}`}
                  muted
                  onPress={() => setLocationsMaterialId(group.materialId)}
                />
              </View>
              <Badge>{`${group.total} ${group.uom}`}</Badge>
              <Pressable
                accessibilityLabel={`Delete ${group.name}`}
                onPress={() => setMaterialToDelete({ id: group.materialId, name: group.name })}
                hitSlop={8}
              >
                <IconTrash size={16} color={colors.ink} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {tab === "transfers" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Transfers</Text>
            <IconButton
              label="New transfer"
              onPress={() => {
                resetEntryFields();
                setTransferOpen(true);
              }}
            />
          </View>
          {transfers.length === 0 ? <Empty>No transfers yet.</Empty> : null}
          {transfers.map((transfer) => (
            <Pressable
              key={transfer.id}
              style={styles.row}
              onPress={() => {
                setError(null);
                setMediaPhotos([]);
                setMediaTarget({
                  ownerType: "TRANSFER",
                  ownerId: transfer.id,
                  title: `${locationLabel(transfer.fromLocation, transfer.supplierName)} → ${locationLabel(transfer.toLocation)}`,
                  media: transfer.media ?? [],
                });
              }}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {locationLabel(transfer.fromLocation, transfer.supplierName)} → {locationLabel(transfer.toLocation)}
                </Text>
                <Text style={styles.rowSub}>
                  {transfer.lines.map((line) => `${line.material.name} ${Number(line.qtySent)} ${line.material.uom}`).join(" · ")}
                  {transfer.notes ? ` · ${transfer.notes}` : ""}
                </Text>
                <MediaStrip items={transfer.media} token={token} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === "godowns" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Godowns</Text>
            <IconButton
              label="New godown"
              onPress={() => {
                resetEntryFields();
                setGodownOpen(true);
              }}
            />
          </View>
          {godowns.length === 0 ? <Empty>No godowns yet.</Empty> : null}
          {godowns.map((godown) => (
            <View key={godown.id} style={styles.row}>
              <Text style={[styles.rowTitle, styles.rowMain]}>{godown.name}</Text>
              <Pressable
                accessibilityLabel={`Edit ${godown.name}`}
                onPress={() => {
                  setEditingGodown(godown.id);
                  setGodownName(godown.name);
                  setGodownOpen(true);
                }}
                hitSlop={8}
              >
                <IconPencil size={16} color={colors.ink} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete ${godown.name}`}
                onPress={() => setGodownToDelete({ id: godown.id, name: godown.name })}
                hitSlop={8}
              >
                <IconTrash size={16} color={colors.ink} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Sheet
        open={receiveOpen}
        title="Receive stock"
        onClose={() => {
          setReceiveOpen(false);
          resetEntryFields();
        }}
      >
        <SelectField
          label="Godown"
          quiet
          value={receiptGodownId}
          onChange={setReceiptGodownId}
          options={godowns.map((godown) => ({ value: godown.id, label: godown.name }))}
        />
        {materials.length > 0 && !creatingMaterial ? (
          <>
            <View style={styles.fieldHead}>
              <Text style={styles.quietLabel}>Material</Text>
              <FilterLink
                label="New material"
                trailing
                onPress={() => {
                  setCreatingMaterial(true);
                  setReceiptMaterialId("");
                  setNewMaterial("");
                }}
              />
            </View>
            <SelectField
              quiet
              value={receiptMaterialId}
              onChange={setReceiptMaterialId}
              options={materials.map((material) => ({ value: material.id, label: material.name }))}
            />
          </>
        ) : (
          <>
            <View style={styles.fieldHead}>
              <Text style={styles.quietLabel}>New material</Text>
              {materials.length > 0 ? (
                <FilterLink
                  label="Choose existing"
                  trailing
                  onPress={() => {
                    setCreatingMaterial(false);
                    setNewMaterial("");
                    setReceiptMaterialId(materials[0]?.id ?? "");
                  }}
                />
              ) : null}
            </View>
            <TextField value={newMaterial} onChangeText={setNewMaterial} />
            <SelectField label="Unit" quiet value={uom} onChange={setUom} options={UOMS.map((value) => ({ value, label: value }))} />
          </>
        )}
        <Field label="Quantity" quiet>
          <TextField value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        </Field>
        <DateField label="Date" value={date} onChange={setDate} />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Receive stock"
          pending={saving}
          disabled={godowns.length === 0}
          icon={<IconInbox size={16} color={colors.accentInk} />}
          onPress={() => void receive()}
        />
      </Sheet>

      <Sheet
        open={transferOpen}
        title="New transfer"
        onClose={() => {
          setTransferOpen(false);
          resetEntryFields();
        }}
      >
        <SelectField label="From" quiet value={fromLocationId} onChange={setFromLocationId} options={locations} />
        <SelectField label="To" quiet value={toLocationId} onChange={setToLocationId} options={locations} />
        <SelectField
          label="Material"
          quiet
          value={transferMaterialId}
          onChange={setTransferMaterialId}
          options={materials.map((material) => ({ value: material.id, label: material.name }))}
        />
        <Field label={quantityLabel} quiet>
          <TextField value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
        </Field>
        <Field label="Note" quiet>
          <TextField value={transferNotes} onChangeText={setTransferNotes} placeholder="Optional" />
        </Field>
        <DateField label="Date" value={date} onChange={setDate} />
        <PhotoPicker photos={photos} onChange={setPhotos} />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Create transfer"
          pending={saving}
          disabled={locations.length < 2 || !transferMaterialId}
          icon={<IconTruck size={16} color={colors.accentInk} />}
          onPress={() => void transfer()}
        />
      </Sheet>

      <Sheet
        open={godownOpen}
        title={editingGodown ? "Edit godown" : "New godown"}
        onClose={() => {
          setGodownOpen(false);
          resetEntryFields();
        }}
      >
        <Field label="Name" quiet>
          <TextField value={godownName} onChangeText={setGodownName} />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button
          label={editingGodown ? "Save godown" : "Create godown"}
          pending={saving}
          icon={editingGodown ? <IconPencil size={16} color={colors.accentInk} /> : <IconPlus size={16} color={colors.accentInk} />}
          onPress={() => void saveGodown()}
        />
      </Sheet>

      <Sheet
        open={materialOpen}
        title="Edit material"
        onClose={() => {
          setMaterialOpen(false);
          resetEntryFields();
        }}
      >
        <Field label="Name" quiet>
          <TextField
            value={editingMaterial?.name ?? ""}
            onChangeText={(name) => setEditingMaterial((current) => (current ? { ...current, name } : current))}
          />
        </Field>
        <SelectField
          label="Unit"
          quiet
          value={editingMaterial?.uom ?? "BAG"}
          onChange={(next) => setEditingMaterial((current) => (current ? { ...current, uom: next } : current))}
          options={UOMS.map((value) => ({ value, label: value }))}
        />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Save material"
          pending={saving}
          icon={<IconPencil size={16} color={colors.accentInk} />}
          onPress={() => {
            if (!companyId || !editingMaterial) return;
            const material = editingMaterial;
            setSaving(true);
            setError(null);
            void apiFetch(`/api/v1/materials/${material.id}`, {
              method: "PATCH",
              companyId,
              body: JSON.stringify({ name: material.name, uom: material.uom }),
            })
              .then(() => refreshStock())
              .then(() => {
                setMaterialOpen(false);
                resetEntryFields();
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not save material"))
              .finally(() => setSaving(false));
          }}
        />
      </Sheet>

      <Sheet
        open={Boolean(locationsGroup) && !removeBalance}
        title={locationsGroup?.name ?? "Locations"}
        onClose={() => setLocationsMaterialId(null)}
      >
        {locationsGroup ? (
          <>
            <Text style={styles.muted}>
              {`Total ${locationsGroup.total} ${locationsGroup.uom} across ${locationsGroup.lines.length} ${locationsGroup.lines.length === 1 ? "location" : "locations"}`}
            </Text>
            {locationsGroup.lines.map((balance) => (
              <View key={balance.id} style={styles.locationCard}>
                <View style={[styles.row, { borderBottomWidth: 0 }]}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{balanceLocationLabel(balance)}</Text>
                    <Text style={styles.rowSub}>
                      {Number(balance.quantity)} {balance.material.uom}
                    </Text>
                  </View>
                  <FilterLink
                    label="Remove"
                    onPress={() => {
                      setError(null);
                      setLocationsMaterialId(null);
                      setRemoveBalance(balance);
                      setRemoveQty("");
                      setRemoveReason("USED");
                      setRemoveProjectId(balance.stockLocation.projectId || projects[0]?.id || "");
                      setRemoveNote("");
                      setDate(toDateKey(new Date()));
                      setPhotos([]);
                    }}
                  />
                </View>
                <MediaStrip items={balance.media} token={token} />
              </View>
            ))}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(removeBalance)}
        title={removeBalance ? `Remove ${removeBalance.material.name}` : "Remove stock"}
        onClose={() => {
          setRemoveBalance(null);
          resetEntryFields();
        }}
      >
        <SelectField label="Reason" quiet value={removeReason} onChange={setRemoveReason} options={REMOVE_REASONS} />
        {removeReason === "USED" ? (
          <SelectField
            label="Project"
            quiet
            value={removeProjectId}
            onChange={setRemoveProjectId}
            options={projects.map((project) => ({ value: project.id, label: project.name }))}
          />
        ) : null}
        <Field label={removeBalance ? `Quantity · available ${Number(removeBalance.quantity)} ${removeBalance.material.uom}` : "Quantity"} quiet>
          <TextField value={removeQty} onChangeText={setRemoveQty} keyboardType="decimal-pad" />
        </Field>
        <Field label="Note" quiet>
          <TextField value={removeNote} onChangeText={setRemoveNote} placeholder="Optional" />
        </Field>
        <DateField label="Date" value={date} onChange={setDate} />
        <PhotoPicker photos={photos} onChange={setPhotos} />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Remove stock"
          pending={saving}
          disabled={!removeBalance || (removeReason === "USED" && projects.length === 0)}
          icon={<IconMinus size={16} color={colors.accentInk} />}
          onPress={() => void remove()}
        />
      </Sheet>

      <Sheet
        open={Boolean(godownToDelete)}
        title="Delete godown"
        onClose={() => {
          setGodownToDelete(null);
          setError(null);
        }}
      >
        <Copy>{godownToDelete ? `Delete ${godownToDelete.name}? Discard all stock at this godown first.` : ""}</Copy>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Delete godown"
          pending={saving}
          pendingLabel="Deleting…"
          icon={<IconTrash size={16} color={colors.accentInk} />}
          onPress={() => {
            if (!companyId || !godownToDelete) return;
            setSaving(true);
            void apiFetch(`/api/v1/godowns/${godownToDelete.id}`, { method: "DELETE", companyId })
              .then(() => refreshStock())
              .then(() => setGodownToDelete(null))
              .catch((err) => setError(err instanceof Error ? err.message : "Could not delete godown"))
              .finally(() => setSaving(false));
          }}
        />
      </Sheet>

      <Sheet
        open={Boolean(materialToDelete)}
        title="Delete material"
        onClose={() => {
          setMaterialToDelete(null);
          setError(null);
        }}
      >
        <Copy>{materialToDelete ? `Delete ${materialToDelete.name}? Discard all balances for this material first.` : ""}</Copy>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Delete material"
          pending={saving}
          pendingLabel="Deleting…"
          icon={<IconTrash size={16} color={colors.accentInk} />}
          onPress={() => {
            if (!companyId || !materialToDelete) return;
            setSaving(true);
            void apiFetch(`/api/v1/materials/${materialToDelete.id}`, { method: "DELETE", companyId })
              .then(() => refreshStock())
              .then(() => setMaterialToDelete(null))
              .catch((err) => setError(err instanceof Error ? err.message : "Could not delete material"))
              .finally(() => setSaving(false));
          }}
        />
      </Sheet>

      <Sheet
        open={Boolean(mediaTarget)}
        title={mediaTarget?.title ?? "Photos"}
        onClose={() => {
          setMediaTarget(null);
          setMediaPhotos([]);
          setError(null);
        }}
      >
        {mediaTarget && mediaTarget.media.length > 0 ? (
          <MediaStrip items={mediaTarget.media} token={token} large />
        ) : (
          <Empty>No photos yet.</Empty>
        )}
        <PhotoPicker photos={mediaPhotos} onChange={setMediaPhotos} />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Add photos"
          pending={saving}
          disabled={mediaPhotos.length === 0}
          icon={<IconPlus size={16} color={colors.accentInk} />}
          onPress={() => {
            if (!companyId || !mediaTarget || mediaPhotos.length === 0) return;
            setSaving(true);
            setError(null);
            void (async () => {
              try {
                for (const photo of mediaPhotos) {
                  await uploadMedia({ companyId, ownerType: mediaTarget.ownerType, ownerId: mediaTarget.ownerId, ...photo });
                }
                setMediaTarget(null);
                setMediaPhotos([]);
                await refreshStock();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not upload photos");
              } finally {
                setSaving(false);
              }
            })();
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tab: { alignSelf: "flex-start", flexDirection: "row" },
  section: { marginTop: 28 },
  muted: { fontFamily: "Mukta_400Regular", fontSize: 14, color: colors.muted },
  locationCard: { borderBottomWidth: 1, borderBottomColor: colors.line },
  mediaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionLabel: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowMain: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quietLabel: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted },
});
