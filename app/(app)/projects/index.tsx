import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { OnboardingForm } from "@/components/onboarding-form";
import { IconPlus } from "@/components/icons";
import { Button, Copy, Empty, ErrorText, Field, FieldError, IconButton, Label, Row, Screen, SelectField, Sheet, TextField, Title } from "@/components/ui";
import { colors } from "@/theme";
import { apiFetch } from "@/lib/api-client";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";
import { useClientsQuery, useProjectsQuery } from "@/lib/queries";
import type { AreaUnitCode } from "@/shared";

const NEW_CLIENT = "__new__";

export default function ProjectsScreen() {
  const router = useRouter();
  const { companyId } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const clientsQuery = useClientsQuery(ready);
  const projectsQuery = useProjectsQuery(ready);
  const clients = clientsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const [open, setOpen] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [areaUnit, setAreaUnit] = useState<AreaUnitCode>("SQ_FT");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id);
  }, [clientId, clients]);

  function resetForm() {
    setClientMode("existing");
    setClientId(clients[0]?.id ?? "");
    setClientName("");
    setName("");
    setAddressLine("");
    setAreaUnit("SQ_FT");
    setError(null);
    setFieldErrors({});
  }

  function closeForm() {
    setOpen(false);
    resetForm();
  }

  async function create() {
    if (!companyId) return;
    const next: Record<string, string> = {};
    if (clientMode === "existing" && clients.length > 0 && !clientId) next.clientId = "Select a client";
    if ((clientMode === "new" || clients.length === 0) && !clientName.trim()) next.clientName = "Client name is required";
    if (!name.trim()) next.name = "Project name is required";
    else if (name.trim().length > 160) next.name = "Project name is too long";
    if (addressLine.trim().length > 200) next.addressLine = "Address is too long";
    setFieldErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      let resolvedClientId = clientMode === "existing" ? clientId : "";
      if (!resolvedClientId) {
        const client = await apiFetch<{ id: string }>("/api/v1/clients", {
          method: "POST",
          companyId,
          body: JSON.stringify({ name: clientName.trim() }),
        });
        resolvedClientId = client.id;
      }
      await apiFetch("/api/v1/projects", {
        method: "POST",
        companyId,
        body: JSON.stringify({
          clientId: resolvedClientId,
          name: name.trim(),
          addressLine: addressLine.trim() || null,
          status: "ACTIVE",
          areaUnit,
        }),
      });
      closeForm();
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.clients(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;
  if (gate.needsOnboarding) {
    return (
      <Screen>
        <Title>Set up your company</Title>
        <Copy>Create a company before adding projects.</Copy>
        <OnboardingForm />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Title>Projects</Title>
          <Copy>Projects tied to clients and spaces.</Copy>
        </View>
        <IconButton label="New project" onPress={() => { resetForm(); setOpen(true); }} />
      </View>
      <View style={{ marginTop: 28 }}>
        <Label>All projects</Label>
      </View>
      {projectsQuery.isPending ? <Empty>Loading…</Empty> : null}
      {projectsQuery.error ? (
        <ErrorText>{projectsQuery.error instanceof Error ? projectsQuery.error.message : "Could not load projects"}</ErrorText>
      ) : null}
      {!projectsQuery.isPending && projects.length === 0 ? <Empty>No projects yet.</Empty> : null}
      {projects.map((project) => (
        <Row
          key={project.id}
          title={project.name}
          subtitle={`${project.client.name}${project.addressLine ? ` · ${project.addressLine}` : ""}`}
          onPress={() => router.push(`/projects/${project.id}`)}
        />
      ))}
      <Sheet open={open} title="New project" onClose={closeForm}>
        {clients.length > 0 ? (
          <>
            <SelectField
              label="Client"
              quiet
              value={clientMode === "new" ? NEW_CLIENT : clientId}
              onChange={(next) => {
                if (next === NEW_CLIENT) setClientMode("new");
                else {
                  setClientMode("existing");
                  setClientId(next);
                }
              }}
              options={[...clients.map((client) => ({ value: client.id, label: client.name })), { value: NEW_CLIENT, label: "New client…" }]}
            />
            <FieldError>{fieldErrors.clientId}</FieldError>
          </>
        ) : null}
        {clientMode === "new" || clients.length === 0 ? (
          <Field label={clients.length === 0 ? "Client" : "New client name"} quiet>
            <TextField value={clientName} onChangeText={setClientName} maxLength={160} />
            <FieldError>{fieldErrors.clientName}</FieldError>
          </Field>
        ) : null}
        <Field label="Project name" quiet>
          <TextField value={name} onChangeText={setName} maxLength={160} />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field label="Address (optional)" quiet>
          <TextField value={addressLine} onChangeText={setAddressLine} multiline maxLength={200} placeholder="Street, area, city" />
          <FieldError>{fieldErrors.addressLine}</FieldError>
        </Field>
        <SelectField
          label="Area unit"
          quiet
          value={areaUnit}
          onChange={(next) => setAreaUnit(next as AreaUnitCode)}
          options={[
            { value: "SQ_FT", label: "Square foot (sqft)" },
            { value: "SQ_M", label: "Square meter (sqm)" },
          ]}
        />
        <Text style={{ color: colors.muted, fontFamily: "Mukta_400Regular", fontSize: 13, marginTop: -4 }}>
          Locked after the project is created.
        </Text>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Create project"
          pending={saving}
          icon={<IconPlus size={16} color={colors.accentInk} />}
          onPress={() => void create()}
        />
      </Sheet>
    </Screen>
  );
}
