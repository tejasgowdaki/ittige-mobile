import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconPlus, IconSave, IconTrash } from "@/components/icons";
import { Button, Copy, Empty, ErrorText, Field, FieldError, FilterLink, Label, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useCompany } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";
import { useProjectQuery } from "@/lib/queries";
import { touchRecentProject } from "@/lib/session-store";
import {
  PROJECT_STATUS_OPTIONS,
  SPACE_TYPES,
  areaUnitSymbol,
  formatFloorLabel,
  formatProjectStatus,
  toEditableProjectStatus,
  type AreaUnitCode,
  type ProjectStatusOption,
} from "@/shared";
import { colors } from "@/theme";

const NEW_FLOOR = "__new__";

type Space = { id: string; name: string; spaceType: string; floor: number; area: string | number };
type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  addressLine: string | null;
  areaUnit: AreaUnitCode;
  totalArea: string | number;
  client: { name: string };
  spaces: Space[];
};

function uniqueFloors(spaces: Space[]) {
  return [...new Set(spaces.map((space) => Number(space.floor)))].sort((a, b) => a - b);
}

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const projectQuery = useProjectQuery<ProjectDetail>(projectId, Boolean(companyId && projectId));
  const project = projectQuery.data ?? null;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ProjectStatusOption>("ACTIVE");
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState("");
  const [spaceType, setSpaceType] = useState("BEDROOM");
  const [floorMode, setFloorMode] = useState<"existing" | "new">("existing");
  const [floor, setFloor] = useState("0");
  const [newFloor, setNewFloor] = useState("");
  const [area, setArea] = useState("100");
  const [floorFilter, setFloorFilter] = useState<number[]>([]);
  const [spaceToDelete, setSpaceToDelete] = useState<Space | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (companyId && projectId) void touchRecentProject(companyId, projectId);
  }, [companyId, projectId]);

  async function refresh() {
    if (!companyId || !projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.project(companyId, projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) }),
    ]);
  }

  function closeProject() {
    setEditing(false);
    setName("");
    setAddress("");
    setStatus("ACTIVE");
    setError(null);
    setFieldErrors({});
  }

  function closeSpace() {
    setSpaceOpen(false);
    setEditingSpaceId(null);
    setSpaceName("");
    setSpaceType("BEDROOM");
    setFloorMode("existing");
    setFloor("0");
    setNewFloor("");
    setArea("100");
    setError(null);
    setFieldErrors({});
  }

  async function saveProject() {
    if (!companyId || !projectId) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Project name is required";
    else if (name.trim().length > 160) next.name = "Project name is too long";
    if (address.trim().length > 200) next.addressLine = "Address is too long";
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        companyId,
        body: JSON.stringify({ name: name.trim(), addressLine: address.trim() || null, status }),
      });
      closeProject();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update project");
    } finally {
      setSaving(false);
    }
  }

  function openSpace(space?: Space) {
    const existing = project ? uniqueFloors(project.spaces) : [];
    setEditingSpaceId(space?.id ?? null);
    setSpaceName(space?.name ?? "");
    setSpaceType(space?.spaceType ?? "BEDROOM");
    setArea(space ? String(Number(space.area)) : "100");
    if (space && existing.includes(Number(space.floor))) {
      setFloorMode("existing");
      setFloor(String(Number(space.floor)));
      setNewFloor("");
    } else if (space) {
      setFloorMode("new");
      setFloor(String(existing[0] ?? Number(space.floor)));
      setNewFloor(String(Number(space.floor)));
    } else if (existing.length > 0) {
      setFloorMode("existing");
      setFloor(String(existing[existing.length - 1]));
      setNewFloor("");
    } else {
      setFloorMode("new");
      setFloor("0");
      setNewFloor("0");
    }
    setError(null);
    setSpaceOpen(true);
  }

  async function saveSpace() {
    if (!companyId || !projectId || !project) return;
    const existing = uniqueFloors(project.spaces);
    const usingNewFloor = existing.length === 0 || floorMode === "new";
    const floorNumber = usingNewFloor ? Number(newFloor) : Number(floor);
    const next: Record<string, string> = {};
    if (!spaceName.trim()) next.name = "Space name is required";
    else if (spaceName.trim().length > 120) next.name = "Space name is too long";
    if (usingNewFloor && (newFloor.trim() === "" || !/^-?\d+$/.test(newFloor.trim()))) {
      next.floor = "Floor must be a whole number (0 = ground)";
    } else if (!usingNewFloor && Number.isNaN(floorNumber)) {
      next.floor = "Select a floor";
    }
    const areaValue = Number(area);
    if (!area.trim() || Number.isNaN(areaValue)) next.area = "Area is required";
    else if (areaValue <= 0) next.area = "Area must be greater than 0";
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      const body = { name: spaceName.trim(), spaceType, floor: floorNumber, area: Number(area) };
      if (editingSpaceId) {
        await apiFetch(`/api/v1/projects/${projectId}/spaces/${editingSpaceId}`, {
          method: "PATCH",
          companyId,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/api/v1/projects/${projectId}/spaces`, {
          method: "POST",
          companyId,
          body: JSON.stringify(body),
        });
      }
      closeSpace();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save space");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSpace() {
    if (!companyId || !projectId || !spaceToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/spaces/${spaceToDelete.id}`, { method: "DELETE", companyId });
      setSpaceToDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete space");
    } finally {
      setDeleting(false);
    }
  }

  if (projectQuery.isPending) return <Screen><Empty>Loading…</Empty></Screen>;
  if (projectQuery.error) {
    return (
      <Screen>
        <ErrorText>{projectQuery.error instanceof Error ? projectQuery.error.message : "Could not load project"}</ErrorText>
      </Screen>
    );
  }
  if (!project) return <Screen><Empty>Project not found.</Empty></Screen>;

  const unit = areaUnitSymbol(project.areaUnit);
  const floors = uniqueFloors(project.spaces);
  const activeFloors = floorFilter.filter((value) => floors.includes(value));
  const visible =
    activeFloors.length === 0
      ? project.spaces
      : project.spaces.filter((space) => activeFloors.includes(Number(space.floor)));
  const shownArea = visible.reduce((sum, space) => sum + Number(space.area), 0);

  return (
    <Screen>
      <Pressable onPress={() => router.push("/projects")}>
        <Text style={styles.back}>← Projects</Text>
      </Pressable>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Title>{project.name}</Title>
        </View>
        <Pressable
          accessibilityLabel="Edit project"
          style={styles.iconGhost}
          onPress={() => {
            setName(project.name);
            setAddress(project.addressLine ?? "");
            setStatus(toEditableProjectStatus(project.status));
            setError(null);
            setEditing(true);
          }}
        >
          <IconPencil size={16} color={colors.ink} />
        </Pressable>
      </View>
      <Copy>
        {`${project.client.name}${project.addressLine ? ` · ${project.addressLine}` : ""} · ${formatProjectStatus(project.status)}`}
      </Copy>

      <View style={styles.sectionHead}>
        <Label>{`Spaces · ${(activeFloors.length === 0 ? Number(project.totalArea) : shownArea).toFixed(0)} ${unit} total`}</Label>
        <Pressable accessibilityLabel="Add space" style={styles.iconAccent} onPress={() => openSpace()}>
          <IconPlus size={18} color={colors.accentInk} />
        </Pressable>
      </View>
      {floors.length > 1 ? (
        <View style={styles.filters}>
          <Text style={styles.filterLabel}>Floor</Text>
          {floors.map((floorValue) => (
            <FilterLink
              key={floorValue}
              label={formatFloorLabel(floorValue)}
              active={activeFloors.includes(floorValue)}
              onPress={() =>
                setFloorFilter((current) =>
                  current.includes(floorValue)
                    ? current.filter((value) => value !== floorValue)
                    : [...current, floorValue].sort((a, b) => a - b),
                )
              }
            />
          ))}
          {activeFloors.length > 0 ? (
            <FilterLink label="Clear" muted onPress={() => setFloorFilter([])} />
          ) : null}
        </View>
      ) : null}
      {error && !editing && !spaceOpen && !spaceToDelete ? <ErrorText>{error}</ErrorText> : null}
      {project.spaces.length === 0 ? <Empty>No spaces yet.</Empty> : null}
      {project.spaces.length > 0 && visible.length === 0 ? <Empty>No spaces on the selected floors.</Empty> : null}
      {visible.map((space) => (
        <View key={space.id} style={styles.space}>
          <View style={{ flex: 1 }}>
            <Text style={styles.spaceName}>{space.name}</Text>
            <Text style={styles.spaceMeta}>
              {`${formatFloorLabel(Number(space.floor))} · ${space.spaceType.replaceAll("_", " ")} · ${Number(space.area)} ${unit}`}
            </Text>
          </View>
          <Pressable accessibilityLabel={`Edit ${space.name}`} style={styles.iconGhost} onPress={() => openSpace(space)}>
            <IconPencil size={16} color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Delete ${space.name}`}
            style={styles.iconGhost}
            onPress={() => {
              setError(null);
              setSpaceToDelete(space);
            }}
          >
            <IconTrash size={16} color={colors.ink} />
          </Pressable>
        </View>
      ))}

      <Sheet
        open={editing}
        title="Edit project"
        onClose={closeProject}
      >
        <Field label="Project name" quiet>
          <TextField value={name} onChangeText={setName} maxLength={160} />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field label="Address (optional)" quiet>
          <TextField value={address} onChangeText={setAddress} multiline maxLength={200} placeholder="Street, area, city" />
          <FieldError>{fieldErrors.addressLine}</FieldError>
        </Field>
        <SelectField
          label="Status"
          quiet
          value={status}
          onChange={(next) => setStatus(next as ProjectStatusOption)}
          options={PROJECT_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Save project"
          pendingLabel="Saving…"
          pending={saving}
          icon={<IconSave size={16} color={colors.accentInk} />}
          onPress={() => void saveProject()}
        />
      </Sheet>

      <Sheet open={spaceOpen} title={editingSpaceId ? "Edit space" : "Add space"} onClose={closeSpace}>
        <Field label="Name" quiet>
          <TextField value={spaceName} onChangeText={setSpaceName} maxLength={120} />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        {floors.length > 0 ? (
          <SelectField
            label="Floor"
            quiet
            value={floorMode === "new" ? NEW_FLOOR : floor}
            onChange={(next) => {
              if (next === NEW_FLOOR) {
                setFloorMode("new");
                setNewFloor("");
                return;
              }
              setFloorMode("existing");
              setFloor(next);
            }}
            options={[
              ...floors.map((value) => ({ value: String(value), label: formatFloorLabel(value) })),
              { value: NEW_FLOOR, label: "New floor…" },
            ]}
          />
        ) : null}
        {floors.length === 0 || floorMode === "new" ? (
          <Field label={floors.length > 0 ? "New floor number" : "Floor"} quiet>
            <TextField
              value={newFloor}
              onChangeText={setNewFloor}
              keyboardType="number-pad"
              placeholder="0 = ground"
            />
            {floors.length === 0 ? <Text style={styles.hint}>0 = ground, negative = basement</Text> : null}
            <FieldError>{fieldErrors.floor}</FieldError>
          </Field>
        ) : null}
        <SelectField
          label="Type"
          quiet
          value={spaceType}
          onChange={setSpaceType}
          options={SPACE_TYPES.map((type) => ({ value: type, label: type.replaceAll("_", " ") }))}
        />
        <Field label={`Area (${unit})`} quiet>
          <TextField value={area} onChangeText={setArea} keyboardType="decimal-pad" />
          <FieldError>{fieldErrors.area}</FieldError>
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button
          label={editingSpaceId ? "Save space" : "Add space"}
          pendingLabel="Saving…"
          pending={saving}
          icon={
            editingSpaceId ? (
              <IconSave size={16} color={colors.accentInk} />
            ) : (
              <IconPlus size={16} color={colors.accentInk} />
            )
          }
          onPress={() => void saveSpace()}
        />
      </Sheet>

      <Sheet
        open={Boolean(spaceToDelete)}
        title="Delete space"
        onClose={() => {
          if (deleting) return;
          setSpaceToDelete(null);
          setError(null);
        }}
      >
        <Text style={styles.deleteCopy}>
          Delete <Text style={styles.deleteName}>{spaceToDelete?.name ?? ""}</Text>? This cannot be undone.
        </Text>
        <ErrorText>{error}</ErrorText>
        <View style={styles.confirmRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="Cancel"
              secondary
              disabled={deleting}
              onPress={() => {
                setSpaceToDelete(null);
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
              onPress={() => void confirmDeleteSpace()}
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.muted, fontFamily: "Mukta_500Medium", fontSize: 14, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionHead: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 10 },
  deleteCopy: { fontFamily: "Mukta_400Regular", fontSize: 16, lineHeight: 24, color: colors.muted },
  deleteName: { fontFamily: "Mukta_700Bold", color: colors.ink },
  filterLabel: { fontFamily: "Mukta_500Medium", fontSize: 15, color: colors.muted, marginRight: 8 },
  space: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  spaceName: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  spaceMeta: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  iconGhost: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  iconAccent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { marginTop: 6, color: colors.muted, fontFamily: "Mukta_400Regular", fontSize: 13 },
  confirmRow: { flexDirection: "row", gap: 8 },
});
