import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { IconCheck, IconClose, IconPlus, IconTrash } from "@/components/icons";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Badge, Button, Copy, Empty, ErrorText, Field, IconButton, Label, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { apiFetch, uploadMedia } from "@/lib/api-client";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { DateCalendar, DateField } from "@/components/date-field";
import { formatDisplayDate, toDateKey } from "@/lib/dates";
import { queryKeys } from "@/lib/query-keys";
import {
  useLaborTypesQuery,
  useProjectsQuery,
  useProjectQuery,
  useSiteLogQuery,
  useStockQuery,
  useWorkTypesQuery,
} from "@/lib/queries";
import { formatFloorLabel } from "@/shared";
import { colors } from "@/theme";

type Kind = "LABOR" | "PROGRESS" | "NOTE";
type RecordKind = Kind | "STOCK";
type Entry = {
  id: string;
  kind: Kind;
  entryDate: string;
  laborCount: number | null;
  note: string | null;
  laborType: { name: string } | null;
  project: { id: string; name: string };
  submittedBy: { id: string; name: string } | null;
  lines: {
    completionPercent: string | number;
    space: { id: string; name: string; floor?: number };
    workType: { id: string; name: string };
  }[];
};
type Balance = {
  quantity: string | number;
  material: { id: string; name: string; uom: string };
  stockLocation: { id: string; project: { id: string } | null };
};

const NEW_TYPE = "__new__";
const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "LABOR", label: "Labor" },
  { value: "PROGRESS", label: "Progress" },
  { value: "NOTE", label: "Note" },
];
const RECORD_OPTIONS: { value: RecordKind; label: string }[] = [
  ...KIND_OPTIONS,
  { value: "STOCK", label: "Stock" },
];
const STOCK_REASONS = [
  { value: "USED", label: "Used on project" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "EXPIRED", label: "Expired" },
  { value: "WASTAGE", label: "Wastage" },
  { value: "THEFT", label: "Theft" },
  { value: "OTHER", label: "Other" },
];

function dateKey(value: string) {
  return String(value).slice(0, 10);
}

function kindLabel(kind: Kind) {
  if (kind === "LABOR") return "Labor";
  if (kind === "PROGRESS") return "Progress";
  return "Note";
}

function formatPercent(value: string | number) {
  const num = Number(value);
  if (Number.isNaN(num)) return "0%";
  return `${Math.round(num * 10) / 10}%`;
}

function summedWorkCompletion(entries: Entry[], projectId: string, spaceId: string, workTypeId: string) {
  let total = 0;
  for (const entry of entries) {
    if (entry.kind !== "PROGRESS" || entry.project.id !== projectId) continue;
    for (const line of entry.lines) {
      if (line.space.id !== spaceId || line.workType.id !== workTypeId) continue;
      const value = Number(line.completionPercent);
      if (!Number.isNaN(value)) total += value;
    }
  }
  return total;
}

function entrySummary(entry: Entry) {
  if (entry.kind === "LABOR") {
    return `${entry.laborType?.name ?? "Labor"} · ${entry.laborCount ?? 0}`;
  }
  if (entry.kind === "NOTE") {
    const text = entry.note?.trim() || "Note";
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  }
  if (entry.lines.length === 1) {
    const line = entry.lines[0];
    return `${line.space.name} · ${line.workType.name} · ${formatPercent(line.completionPercent)}`;
  }
  return `${entry.lines.length} work lines`;
}

export default function ProgressScreen() {
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const logQuery = useSiteLogQuery<Entry>({}, ready);
  const projectsQuery = useProjectsQuery(ready);
  const laborQuery = useLaborTypesQuery(ready);
  const workQuery = useWorkTypesQuery(ready);
  const [filterKinds, setFilterKinds] = useState<Kind[]>([]);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RecordKind>("PROGRESS");
  const [projectId, setProjectId] = useState("");
  const progressLogQuery = useSiteLogQuery<Entry>(
    { projectId, kind: "PROGRESS" },
    open && Boolean(projectId),
  );
  const projectQuery = useProjectQuery<{ spaces: { id: string; name: string; floor: number }[]; stockLocation?: { id: string } | null }>(
    projectId || undefined,
    open && Boolean(projectId),
  );
  const stockQuery = useStockQuery<Balance>(ready && open && kind === "STOCK");
  const [entryDate, setEntryDate] = useState(toDateKey(new Date()));
  const [laborTypeId, setLaborTypeId] = useState("");
  const [laborMode, setLaborMode] = useState<"existing" | "new">("existing");
  const [newLabor, setNewLabor] = useState("");
  const [laborCount, setLaborCount] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [workMode, setWorkMode] = useState<"existing" | "new">("existing");
  const [newWork, setNewWork] = useState("");
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");
  const [stockReason, setStockReason] = useState("USED");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [view, setView] = useState<Entry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const projects = projectsQuery.data ?? [];
  const laborTypes = laborQuery.data ?? [];
  const workTypes = workQuery.data ?? [];
  const spaces = projectQuery.data?.spaces ?? [];
  const selectedProject = projects.find((project) => project.id === filterProjectId);
  const entries = useMemo(() => {
    let list = logQuery.data ?? [];
    if (filterKinds.length > 0) list = list.filter((entry) => filterKinds.includes(entry.kind));
    if (filterProjectId) list = list.filter((entry) => entry.project.id === filterProjectId);
    if (filterDate) list = list.filter((entry) => dateKey(entry.entryDate) === filterDate);
    return list;
  }, [logQuery.data, filterKinds, filterProjectId, filterDate]);
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = dateKey(entry.entryDate);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return [...map.entries()];
  }, [entries]);
  const projectBalances = (stockQuery.data ?? []).filter(
    (balance) => balance.stockLocation.project?.id === projectId && Number(balance.quantity) > 0,
  );
  const currentCompletion = useMemo(() => {
    if (!spaceId) return null;
    if (workMode === "new" || workTypes.length === 0) return 0;
    if (!workTypeId || !progressLogQuery.isSuccess) return null;
    return summedWorkCompletion(progressLogQuery.data ?? [], projectId, spaceId, workTypeId);
  }, [spaceId, workMode, workTypes.length, workTypeId, progressLogQuery.isSuccess, progressLogQuery.data, projectId]);

  function resetLogForm() {
    setKind("PROGRESS");
    setProjectId("");
    setEntryDate(toDateKey(new Date()));
    setLaborTypeId("");
    setLaborMode("existing");
    setNewLabor("");
    setLaborCount("");
    setSpaceId("");
    setWorkTypeId("");
    setWorkMode("existing");
    setNewWork("");
    setPercent("");
    setNote("");
    setStockReason("USED");
    setMaterialId("");
    setQuantity("");
    setPhotos([]);
    setError(null);
  }

  function closeLog() {
    setOpen(false);
    resetLogForm();
  }

  function toggleKind(next: Kind) {
    setFilterKinds((current) => (current.includes(next) ? current.filter((item) => item !== next) : [...current, next]));
  }

  async function resolveType(path: string, mode: "existing" | "new", existingId: string, name: string, empty: boolean) {
    if (mode === "existing" && !empty) return existingId;
    const created = await apiFetch<{ id: string }>(path, {
      method: "POST",
      companyId,
      body: JSON.stringify({ name: name.trim() }),
    });
    return created.id;
  }

  async function submit() {
    if (!companyId || !projectId) {
      setError("Select a project");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (kind === "STOCK") {
        const locationId = projectQuery.data?.stockLocation?.id;
        if (!locationId || !materialId || Number(quantity) <= 0) throw new Error("Material and quantity are required");
        const lines = [{ materialId, quantity: Number(quantity) }];
        if (stockReason === "USED") {
          const usage = await apiFetch<{ id: string }>("/api/v1/usages", {
            method: "POST",
            companyId,
            body: JSON.stringify({ projectId, stockLocationId: locationId, usedOn: entryDate, notes: note.trim() || null, lines }),
          });
          for (const photo of photos) await uploadMedia({ companyId, ownerType: "MATERIAL_USAGE", ownerId: usage.id, ...photo });
        } else {
          const discard = await apiFetch<{ id: string }>("/api/v1/discards", {
            method: "POST",
            companyId,
            body: JSON.stringify({ stockLocationId: locationId, reason: stockReason, reasonNote: note.trim() || null, occurredOn: entryDate, lines }),
          });
          for (const photo of photos) await uploadMedia({ companyId, ownerType: "DISCARD", ownerId: discard.id, ...photo });
        }
      } else {
        let body: Record<string, unknown> = { projectId, entryDate, kind };
        if (kind === "LABOR") {
          body = {
            ...body,
            laborTypeId: await resolveType("/api/v1/labor-types", laborMode, laborTypeId, newLabor, laborTypes.length === 0),
            laborCount: Number(laborCount),
            note: note.trim() || null,
          };
        } else if (kind === "PROGRESS") {
          body = {
            ...body,
            note: note.trim() || null,
            lines: [{
              spaceId,
              workTypeId: await resolveType("/api/v1/work-types", workMode, workTypeId, newWork, workTypes.length === 0),
              completionPercent: Number(percent),
            }],
          };
        } else {
          body = { ...body, note: note.trim() };
        }
        const entry = await apiFetch<{ id: string }>("/api/v1/site-log", { method: "POST", companyId, body: JSON.stringify(body) });
        if (photos.length && (kind === "PROGRESS" || kind === "NOTE")) {
          for (const photo of photos) await uploadMedia({ companyId, ownerType: "SITE_LOG", ownerId: entry.id, ...photo });
        }
      }
      closeLog();
      await queryClient.invalidateQueries({ queryKey: queryKeys.siteLog(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stock(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!companyId || !entryToDelete || entryToDelete.submittedBy?.id !== me?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/site-log/${entryToDelete.id}`, { method: "DELETE", companyId });
      setEntryToDelete(null);
      setView(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.siteLog(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete entry");
    } finally {
      setDeleting(false);
    }
  }

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Title>Site log</Title>
          <Copy>Labor, progress, and notes — by date.</Copy>
        </View>
        <IconButton
          label="New log entry"
          onPress={() => {
            resetLogForm();
            setOpen(true);
          }}
        />
      </View>

      <View style={styles.section}>
        <Label>Filters</Label>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Type</Text>
          {KIND_OPTIONS.map((option) => (
            <TextLink
              key={option.value}
              label={option.label}
              active={filterKinds.includes(option.value)}
              onPress={() => toggleKind(option.value)}
            />
          ))}
          {filterKinds.length > 0 ? <TextLink label="Clear" muted onPress={() => setFilterKinds([])} /> : null}
        </View>
        <View style={styles.filterRow}>
          <TextLink
            label={filterDate ? formatDisplayDate(filterDate) : "Select date"}
            active={Boolean(filterDate)}
            onPress={() => setDateOpen(true)}
          />
          {filterDate ? (
            <Pressable accessibilityLabel="Clear date filter" onPress={() => setFilterDate("")} hitSlop={8}>
              <IconClose size={12} color={colors.muted} />
            </Pressable>
          ) : null}
          <TextLink
            label={selectedProject?.name ?? "Select project"}
            active={Boolean(filterProjectId)}
            onPress={() => setProjectOpen(true)}
          />
          {filterProjectId ? (
            <Pressable accessibilityLabel="Clear project filter" onPress={() => setFilterProjectId("")} hitSlop={8}>
              <IconClose size={12} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Label>History</Label>
        {logQuery.isPending && !logQuery.data ? <Empty>Loading…</Empty> : null}
        {!logQuery.isPending && entries.length === 0 ? <Empty>No entries yet. Add labor, progress, or a note.</Empty> : null}
        {grouped.map(([day, dayEntries]) => (
          <View key={day}>
            <Text style={styles.day}>
              {`${formatDisplayDate(day)} · ${dayEntries.length} entr${dayEntries.length === 1 ? "y" : "ies"}`}
            </Text>
            {dayEntries.map((entry) => (
              <Pressable key={entry.id} style={styles.entry} onPress={() => setView(entry)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>{filterProjectId ? kindLabel(entry.kind) : entry.project.name}</Text>
                  <Text style={styles.entryMeta}>
                    {`${filterProjectId ? "" : `${kindLabel(entry.kind)} · `}${entrySummary(entry)}`}
                  </Text>
                </View>
                <Badge>{kindLabel(entry.kind).toUpperCase()}</Badge>
                {entry.submittedBy?.id === me?.id ? (
                  <Pressable
                    accessibilityLabel="Delete entry"
                    style={styles.iconGhost}
                    onPress={() => {
                      setError(null);
                      setEntryToDelete(entry);
                    }}
                  >
                    <IconTrash size={16} color={colors.ink} />
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Sheet open={dateOpen} title="Select date" onClose={() => setDateOpen(false)}>
        <DateCalendar
          value={filterDate}
          onChange={(next) => {
            setFilterDate(next);
            setDateOpen(false);
          }}
        />
      </Sheet>
      <Sheet open={projectOpen} title="Select project" onClose={() => setProjectOpen(false)}>
        {projects.map((project) => (
          <Pressable
            key={project.id}
            style={styles.option}
            onPress={() => {
              setFilterProjectId(project.id);
              setProjectOpen(false);
            }}
          >
            <Text style={[styles.entryTitle, project.id === filterProjectId && styles.active]}>{project.name}</Text>
          </Pressable>
        ))}
      </Sheet>

      <Sheet open={open} title="Log entry" onClose={closeLog}>
        <SelectField
          label="Project"
          quiet
          value={projectId}
          onChange={(next) => {
            setProjectId(next);
            setSpaceId("");
          }}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
        />
        <DateField label="Date" value={entryDate} onChange={setEntryDate} />
        <SelectField
          label="What are you recording?"
          quiet
          value={kind}
          onChange={(next) => setKind(next as RecordKind)}
          options={RECORD_OPTIONS}
        />
        {kind === "LABOR" ? (
          <>
            <SelectField
              label="Labor type"
              quiet
              value={laborMode === "new" || laborTypes.length === 0 ? NEW_TYPE : laborTypeId}
              onChange={(next) => {
                if (next === NEW_TYPE) {
                  setLaborMode("new");
                  return;
                }
                setLaborMode("existing");
                setLaborTypeId(next);
                setNewLabor("");
              }}
              options={[...laborTypes.map((item) => ({ value: item.id, label: item.name })), { value: NEW_TYPE, label: "New labor type…" }]}
            />
            {laborMode === "new" || laborTypes.length === 0 ? (
              <Field label={laborTypes.length === 0 ? "Labor type name" : "New labor type name"} quiet>
                <TextField value={newLabor} onChangeText={setNewLabor} placeholder="e.g. Mason, Helper" />
              </Field>
            ) : null}
            <Field label="Count" quiet>
              <TextField value={laborCount} onChangeText={setLaborCount} keyboardType="number-pad" />
            </Field>
            <Field label="Note (optional)" quiet>
              <TextField value={note} onChangeText={setNote} multiline />
            </Field>
          </>
        ) : null}
        {kind === "PROGRESS" ? (
          spaces.length === 0 ? (
            <Empty>Add spaces on the project before logging progress.</Empty>
          ) : (
            <>
              <SelectField
                label="Space"
                quiet
                value={spaceId}
                onChange={setSpaceId}
                options={spaces.map((space) => ({ value: space.id, label: `${formatFloorLabel(Number(space.floor))} · ${space.name}` }))}
              />
              <SelectField
                label="Work type"
                quiet
                value={workMode === "new" || workTypes.length === 0 ? NEW_TYPE : workTypeId}
                onChange={(next) => {
                  if (next === NEW_TYPE) {
                    setWorkMode("new");
                    return;
                  }
                  setWorkMode("existing");
                  setWorkTypeId(next);
                  setNewWork("");
                }}
                options={[...workTypes.map((item) => ({ value: item.id, label: item.name })), { value: NEW_TYPE, label: "New work type…" }]}
              />
              {workMode === "new" || workTypes.length === 0 ? (
                <Field label={workTypes.length === 0 ? "Work type name" : "New work type name"} quiet>
                  <TextField value={newWork} onChangeText={setNewWork} placeholder="e.g. Bathroom wall work" />
                </Field>
              ) : null}
              <Field label="Completion %" quiet>
                <TextField value={percent} onChangeText={setPercent} keyboardType="decimal-pad" />
                {currentCompletion !== null ? (
                  <Text style={styles.currentNote}>Currently {formatPercent(currentCompletion)} done</Text>
                ) : null}
              </Field>
            </>
          )
        ) : null}
        {kind === "NOTE" ? (
          <Field label="Note" quiet>
            <TextField value={note} onChangeText={setNote} multiline />
          </Field>
        ) : null}
        {kind === "STOCK" ? (
          <>
            <SelectField label="What happened?" quiet value={stockReason} onChange={setStockReason} options={STOCK_REASONS} />
            {projectBalances.length === 0 ? (
              <Empty>No stock on this project.</Empty>
            ) : (
              <SelectField
                label="Material"
                quiet
                value={materialId}
                onChange={setMaterialId}
                options={projectBalances.map((balance) => ({
                  value: balance.material.id,
                  label: `${balance.material.name} (${balance.quantity} ${balance.material.uom})`,
                }))}
              />
            )}
            <Field label="Quantity" quiet>
              <TextField value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
            </Field>
            <Field label="Note (optional)" quiet>
              <TextField value={note} onChangeText={setNote} multiline />
            </Field>
          </>
        ) : null}
        {kind === "PROGRESS" || kind === "NOTE" || kind === "STOCK" ? <PhotoPicker photos={photos} onChange={setPhotos} /> : null}
        <ErrorText>{error}</ErrorText>
        <Button
          label={kind === "STOCK" ? "Update stock" : "Save entry"}
          pendingLabel="Saving…"
          pending={saving}
          disabled={(kind === "PROGRESS" && spaces.length === 0) || (kind === "STOCK" && projectBalances.length === 0)}
          icon={<IconCheck size={16} color={colors.accentInk} />}
          onPress={() => void submit()}
        />
      </Sheet>

      <Sheet open={Boolean(view)} title="Entry" onClose={() => setView(null)}>
        {view ? (
          <>
            <Text style={styles.entryTitle}>{view.project.name}</Text>
            <Copy>{`${kindLabel(view.kind)} · ${formatDisplayDate(dateKey(view.entryDate))}`}</Copy>
            <Copy>{entrySummary(view)}</Copy>
            {view.note ? <Copy>{view.note}</Copy> : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        open={Boolean(entryToDelete)}
        title="Delete entry"
        onClose={() => {
          if (deleting) return;
          setEntryToDelete(null);
          setError(null);
        }}
      >
        <Copy>
          {entryToDelete
            ? `Delete this ${kindLabel(entryToDelete.kind).toLowerCase()} entry for ${entryToDelete.project.name} on ${formatDisplayDate(dateKey(entryToDelete.entryDate))}? This cannot be undone.`
            : ""}
        </Copy>
        <ErrorText>{error}</ErrorText>
        <View style={styles.confirmRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="Cancel"
              secondary
              disabled={deleting}
              onPress={() => {
                setEntryToDelete(null);
                setError(null);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Delete"
              pendingLabel="Deleting…"
              pending={deleting}
              icon={<IconTrash size={16} color={colors.accentInk} />}
              onPress={() => void confirmDelete()}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

function TextLink({
  label,
  active,
  muted,
  onPress,
}: {
  label: string;
  active?: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.linkHit}>
      <Text style={[styles.link, active && styles.linkActive, muted && styles.linkMuted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  section: { marginTop: 28 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  filterLabel: { fontFamily: "Mukta_500Medium", fontSize: 15, color: colors.muted, marginRight: 8 },
  linkHit: { paddingVertical: 8, marginRight: 12 },
  link: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  linkActive: { color: colors.accent },
  linkMuted: { color: colors.muted, fontFamily: "Mukta_500Medium" },
  day: {
    marginTop: 16,
    marginBottom: 4,
    fontFamily: "Mukta_600SemiBold",
    fontSize: 13,
    color: colors.muted,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  entryTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  entryMeta: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  iconGhost: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  option: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  active: { color: colors.accent },
  confirmRow: { flexDirection: "row", gap: 8 },
  currentNote: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 6 },
});
