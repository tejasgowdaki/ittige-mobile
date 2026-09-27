import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { IconCheck, IconClose, IconPlus, IconTrash } from "@/components/icons";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { Badge, Button, Copy, Empty, ErrorText, Field, FieldError, IconButton, Label, Row, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { apiBaseUrl, apiFetch, uploadMedia } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session-store";
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
    id?: string;
    completionPercent: string | number;
    space: { id: string; name: string; floor?: number };
    workType: { id: string; name: string };
  }[];
};
type StockLine = { materialId: string; quantity: string };
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
  const router = useRouter();
  const params = useLocalSearchParams<{ new?: string | string[] }>();
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
  const [stockLines, setStockLines] = useState<StockLine[]>([{ materialId: "", quantity: "" }]);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dayFocus, setDayFocus] = useState<string | null>(null);
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
    setStockLines([{ materialId: "", quantity: "" }]);
    setPhotos([]);
    setFieldErrors({});
    setError(null);
  }

  const openedFromQuery = useRef("");
  const newToken = Array.isArray(params.new) ? params.new[0] ?? "" : params.new ?? "";
  useEffect(() => {
    if (!newToken || openedFromQuery.current === newToken) return;
    openedFromQuery.current = newToken;
    resetLogForm();
    setOpen(true);
    router.setParams({ new: "" });
  }, [newToken, router]);

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

  function validate() {
    const next: Record<string, string> = {};
    if (!projectId) next.projectId = "Select a project";
    if (!entryDate) next.entryDate = "Select a date";
    if (kind === "LABOR") {
      if (laborMode === "new" || laborTypes.length === 0) {
        if (!newLabor.trim()) next.laborType = "Enter a labor type";
      } else if (!laborTypeId) next.laborType = "Select a labor type";
      const count = Number(laborCount);
      if (!laborCount.trim() || Number.isNaN(count) || count < 0) next.laborCount = "Enter a valid count";
    }
    if (kind === "PROGRESS") {
      if (!spaceId) next.spaceId = "Select a space";
      if (workMode === "new" || workTypes.length === 0) {
        if (!newWork.trim()) next.workType = "Enter a work type";
      } else if (!workTypeId) next.workType = "Select a work type";
      const value = Number(percent);
      if (!percent.trim() || Number.isNaN(value)) next.percent = "Enter a percentage";
      else if (value < 0 || value > 100) next.percent = "Must be between 0 and 100";
    }
    if (kind === "NOTE" && !note.trim()) next.note = "Enter a note";
    if (kind === "STOCK") {
      const locationId = projectQuery.data?.stockLocation?.id;
      if (!locationId) next.projectId = "This project has no stock location";
      if (projectBalances.length === 0) {
        next.stock = "No stock on this project";
        return next;
      }
      const seen = new Set<string>();
      stockLines.forEach((line, index) => {
        if (!line.materialId) {
          next[`stock-${index}`] = "Select a material";
          return;
        }
        if (seen.has(line.materialId)) {
          next[`stock-${index}`] = "Material already added";
          return;
        }
        seen.add(line.materialId);
        const balance = projectBalances.find((item) => item.material.id === line.materialId);
        const qty = Number(line.quantity);
        if (!line.quantity.trim() || !Number.isFinite(qty) || qty <= 0) {
          next[`stock-${index}`] = "Enter a quantity";
          return;
        }
        const available = balance ? Number(balance.quantity) : 0;
        if (qty > available) next[`stock-${index}`] = `Only ${available} ${balance?.material.uom ?? ""} available`;
      });
    }
    return next;
  }

  async function submit() {
    if (!companyId) return;
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === "STOCK") {
        const locationId = projectQuery.data?.stockLocation?.id;
        if (!locationId) throw new Error("This project has no stock location");
        const lines = stockLines.map((line) => ({ materialId: line.materialId, quantity: Number(line.quantity) }));
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

  const focusedEntries = dayFocus ? entries.filter((entry) => dateKey(entry.entryDate) === dayFocus) : [];
  const dayLaborTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of focusedEntries) {
      if (entry.kind !== "LABOR") continue;
      const name = entry.laborType?.name ?? "Labor";
      totals.set(name, (totals.get(name) ?? 0) + (entry.laborCount ?? 0));
    }
    return [...totals.entries()];
  }, [focusedEntries]);
  const mediaQuery = useQuery({
    queryKey: ["media", companyId ?? "", "SITE_LOG", view?.id ?? ""],
    queryFn: () =>
      apiFetch<{ media: { id: string; url: string; caption?: string | null }[] }>(
        `/api/v1/media/file?ownerType=SITE_LOG&ownerId=${view!.id}`,
        { companyId },
      ).then((payload) => payload.media),
    enabled: Boolean(companyId) && Boolean(view?.id) && (view?.kind === "PROGRESS" || view?.kind === "NOTE"),
  });

  if (gate.loading || (ready && projectsQuery.isPending && !projectsQuery.data)) {
    return <Screen><Empty>Loading…</Empty></Screen>;
  }

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

      <View style={styles.history}>
        <Label>History</Label>
        {logQuery.isPending && !logQuery.data ? <Empty>Loading…</Empty> : null}
        {logQuery.error ? (
          <ErrorText>{logQuery.error instanceof Error ? logQuery.error.message : "Could not load history"}</ErrorText>
        ) : null}
        {!logQuery.isPending && !logQuery.error && entries.length === 0 ? <Empty>No entries yet. Add labor, progress, or a note.</Empty> : null}
        {grouped.map(([day, dayEntries]) => (
          <View key={day}>
            <Pressable onPress={() => setDayFocus(day)}>
              <Text style={styles.day}>
                {`${day} · ${dayEntries.length} entr${dayEntries.length === 1 ? "y" : "ies"}`}
              </Text>
            </Pressable>
            {dayEntries.map((entry) => (
              <Pressable key={entry.id} style={styles.entry} onPress={() => setView(entry)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>{filterProjectId ? kindLabel(entry.kind) : entry.project.name}</Text>
                  <Text style={styles.entryMeta}>
                    {`${filterProjectId ? "" : `${kindLabel(entry.kind)} · `}${entrySummary(entry)}`}
                  </Text>
                </View>
                <Badge>{kindLabel(entry.kind)}</Badge>
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
        {projects.length === 0 ? <Empty>No projects yet.</Empty> : null}
        {projects.map((project) => (
          <Pressable
            key={project.id}
            style={styles.option}
            onPress={() => {
              setFilterProjectId(project.id);
              setProjectOpen(false);
              setDayFocus(null);
            }}
          >
            <Text style={[styles.entryTitle, { flex: 1 }, project.id === filterProjectId && styles.active]}>{project.name}</Text>
            {project.id === filterProjectId ? <IconCheck size={16} color={colors.accent} /> : null}
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
        <FieldError>{fieldErrors.projectId}</FieldError>
        <DateField label="Date" value={entryDate} onChange={setEntryDate} />
        <FieldError>{fieldErrors.entryDate}</FieldError>
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
                <FieldError>{fieldErrors.laborType}</FieldError>
              </Field>
            ) : null}
            <FieldError>{laborMode === "existing" && laborTypes.length > 0 ? fieldErrors.laborType : null}</FieldError>
            <Field label="Count" quiet>
              <TextField value={laborCount} onChangeText={setLaborCount} keyboardType="number-pad" />
              <FieldError>{fieldErrors.laborCount}</FieldError>
            </Field>
            <Field label="Note (optional)" quiet>
              <TextField value={note} onChangeText={setNote} multiline />
            </Field>
          </>
        ) : null}
        {kind === "PROGRESS" ? (
          projectQuery.isPending ? (
            <Empty>Loading spaces…</Empty>
          ) : spaces.length === 0 ? (
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
              <FieldError>{fieldErrors.spaceId}</FieldError>
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
                <FieldError>{fieldErrors.workType}</FieldError>
              </Field>
            ) : null}
              <FieldError>{workMode === "existing" && workTypes.length > 0 ? fieldErrors.workType : null}</FieldError>
              <Field label="Completion %" quiet>
                <TextField value={percent} onChangeText={setPercent} keyboardType="decimal-pad" />
                <FieldError>{fieldErrors.percent}</FieldError>
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
            <FieldError>{fieldErrors.note}</FieldError>
          </Field>
        ) : null}
        {kind === "STOCK" ? (
          <>
            <SelectField label="What happened?" quiet value={stockReason} onChange={setStockReason} options={STOCK_REASONS} />
            {stockQuery.isPending ? <Empty>Loading stock…</Empty> : null}
            {!stockQuery.isPending && projectBalances.length === 0 ? <Empty>No stock on this project.</Empty> : null}
            <FieldError>{fieldErrors.stock}</FieldError>
            {projectBalances.length > 0
              ? stockLines.map((line, index) => {
                  const balance = projectBalances.find((item) => item.material.id === line.materialId);
                  return (
                    <View key={index}>
                      <View style={styles.lineHead}>
                        <Text style={styles.filterLabel}>{stockLines.length > 1 ? `Material ${index + 1}` : "Material"}</Text>
                        {stockLines.length > 1 ? (
                          <Pressable
                            onPress={() => setStockLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            <Text style={styles.link}>Remove</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      <SelectField
                        quiet
                        value={line.materialId}
                        onChange={(next) =>
                          setStockLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, materialId: next } : item)))
                        }
                        options={projectBalances.map((item) => ({ value: item.material.id, label: item.material.name }))}
                      />
                      <Field label={balance ? `Qty · ${Number(balance.quantity)} ${balance.material.uom}` : "Qty"} quiet>
                        <TextField
                          value={line.quantity}
                          onChangeText={(next) =>
                            setStockLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity: next } : item)))
                          }
                          keyboardType="decimal-pad"
                        />
                      </Field>
                      <FieldError>{fieldErrors[`stock-${index}`]}</FieldError>
                    </View>
                  );
                })
              : null}
            {projectBalances.length > 0 ? (
              <Pressable onPress={() => setStockLines((current) => [...current, { materialId: "", quantity: "" }])}>
                <Text style={styles.link}>Add material</Text>
              </Pressable>
            ) : null}
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

      <Sheet open={Boolean(dayFocus)} title={dayFocus ? `Day · ${dayFocus}` : "Day"} onClose={() => setDayFocus(null)}>
        {dayLaborTotals.length > 0 ? (
          <>
            <Label>Labor totals</Label>
            {dayLaborTotals.map(([name, total]) => (
              <Row key={name} title={name} subtitle={`${total} people`} />
            ))}
          </>
        ) : null}
        <Label>Entries</Label>
        {focusedEntries.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => {
              setDayFocus(null);
              setView(entry);
            }}
          >
            <Row
              title={`${kindLabel(entry.kind)}${filterProjectId ? "" : ` · ${entry.project.name}`}`}
              subtitle={entrySummary(entry)}
            />
          </Pressable>
        ))}
      </Sheet>

      <Sheet open={Boolean(view)} title="Log entry" onClose={() => setView(null)}>
        {view ? (
          <>
            <Label>{view.project.name}</Label>
            <Text style={styles.entryTitle}>{kindLabel(view.kind)}</Text>
            <Copy>{dateKey(view.entryDate)}</Copy>
            {view.kind === "LABOR" ? (
              <>
                <Label>Labor</Label>
                <Copy>{`${view.laborType?.name ?? "Labor"} · ${view.laborCount ?? 0}`}</Copy>
                {view.note ? <Copy>{view.note}</Copy> : null}
              </>
            ) : null}
            {view.kind === "NOTE" ? (
              <>
                <Label>Note</Label>
                <Copy>{view.note ?? ""}</Copy>
              </>
            ) : null}
            {view.kind === "PROGRESS" ? (
              <>
                <Label>Progress</Label>
                {view.lines.map((line, index) => (
                  <Row
                    key={line.id ?? `${line.space.id}-${index}`}
                    title={line.space.name}
                    subtitle={`${formatFloorLabel(Number(line.space.floor ?? 0))} · ${line.workType.name} · ${formatPercent(line.completionPercent)}`}
                  />
                ))}
              </>
            ) : null}
            {view.kind === "PROGRESS" || view.kind === "NOTE" ? (
              <>
                <Label>Photos</Label>
                {mediaQuery.isPending ? <Empty>Loading photos…</Empty> : null}
                {!mediaQuery.isPending && (mediaQuery.data?.length ?? 0) === 0 ? <Empty>No photos attached.</Empty> : null}
                <View style={styles.photoGrid}>
                  {(mediaQuery.data ?? []).map((item) => (
                    <Image
                      key={item.id}
                      source={{
                        uri: item.url.startsWith("http") ? item.url : `${apiBaseUrl()}${item.url}`,
                        headers: getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : undefined,
                      }}
                      style={styles.photo}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </>
            ) : null}
            {view.submittedBy?.id === me?.id ? (
              <Button
                label="Delete entry"
                secondary
                icon={<IconTrash size={16} color={colors.ink} />}
                onPress={() => {
                  setError(null);
                  setEntryToDelete(view);
                }}
              />
            ) : null}
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
            ? `Delete this ${kindLabel(entryToDelete.kind).toLowerCase()} entry for ${entryToDelete.project.name} on ${dateKey(entryToDelete.entryDate)}? This cannot be undone.`
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
  section: { marginTop: 18 },
  history: { marginTop: 22 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 8 },
  lineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: { width: 88, height: 88, borderRadius: 10 },
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
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  active: { color: colors.accent },
  confirmRow: { flexDirection: "row", gap: 8 },
  currentNote: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 6 },
});
