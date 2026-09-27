import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { IconChevronDown, IconPencil, IconPlus, IconSave, IconTrash, IconUser } from "@/components/icons";
import { Badge, Button, CheckBox, Copy, Empty, ErrorText, Field, Label, PhoneField, Row, Screen, SelectField, Sheet, SwitchRow, TextField, Title } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";
import { useMembersQuery, useProjectsQuery, useRolesQuery, useSettingsQuery } from "@/lib/queries";
import {
  ROLE_PERMISSION_UI,
  codesForEnabledBundles,
  formatPhoneDisplay,
  formatRoleLabel,
  isBundleFullyAllowed,
  isBundlePartiallyAllowed,
  normalizePhone,
} from "@/shared";
import { colors } from "@/theme";

type ProjectAssignment = {
  projectId: string;
  roleSlug: string;
  project: { id: string; name: string; code: string };
};

type Member = {
  id: string;
  companyRole: string;
  allProjects: boolean;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    projectAssignments: ProjectAssignment[];
  };
};

type Invite = {
  id: string;
  phone: string;
  name: string | null;
  companyRole: string;
  status: string;
};

type RoleMatrix = {
  roleSlug: string;
  name: string;
  locked: boolean;
  permissions: { code: string; allowed: boolean }[];
};

type Settings = { defaultAreaUnit: "SQ_FT" | "SQ_M"; scheduleLagThresholdPercent: string | number };

type Tab = "users" | "roles" | "settings";

export default function TeamScreen() {
  const router = useRouter();
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const queryClient = useQueryClient();
  const isAdmin = me?.companies.find((company) => company.id === companyId)?.companyRole === "ADMIN";
  const myUserId = me?.id ?? null;
  const membersQuery = useMembersQuery<Member, Invite>(Boolean(companyId && isAdmin));
  const rolesQuery = useRolesQuery<RoleMatrix>(Boolean(companyId && isAdmin));
  const projectsQuery = useProjectsQuery(Boolean(companyId && isAdmin));
  const settingsQuery = useSettingsQuery<Settings>(Boolean(companyId && isAdmin));
  const [tab, setTab] = useState<Tab>("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const [projectRole, setProjectRole] = useState("PROJECT_SUPERVISOR");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [inviteToRevoke, setInviteToRevoke] = useState<Invite | null>(null);
  const [roles, setRoles] = useState<RoleMatrix[] | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<RoleMatrix | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [areaUnit, setAreaUnit] = useState<"SQ_FT" | "SQ_M">("SQ_FT");
  const [lag, setLag] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const memberships = membersQuery.data?.memberships ?? [];
  const invites = membersQuery.data?.invites ?? [];
  const roleList = roles ?? rolesQuery.data ?? [];
  const active = roleList.find((role) => role.roleSlug === selectedRole) ?? roleList[0];
  const projectRoleOptions = roleList
    .filter((role) => !role.locked && role.roleSlug !== "ADMIN")
    .map((role) => ({ value: role.roleSlug, label: role.name }));
  const assignableOptions = projectRoleOptions.length
    ? projectRoleOptions
    : [{ value: "PROJECT_SUPERVISOR", label: formatRoleLabel("PROJECT_SUPERVISOR") }];
  const settings = settingsQuery.data;

  if (gate.loading || (isAdmin && membersQuery.isPending && !membersQuery.data)) {
    return <Screen><Empty>Loading…</Empty></Screen>;
  }
  if (gate.needsOnboarding) {
    return (
      <Screen>
        <Title>Users</Title>
        <Copy>Set up your company first.</Copy>
        <Button label="Go home" onPress={() => router.replace("/")} />
      </Screen>
    );
  }
  if (!isAdmin) {
    return (
      <Screen>
        <Title>Users</Title>
        <Copy>Only admins can manage users, roles, and company settings.</Copy>
        <Button label="Go home" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  function roleDisplayName(slug: string) {
    return roleList.find((role) => role.roleSlug === slug)?.name || formatRoleLabel(slug);
  }

  function memberSubtitle(member: Member) {
    const parts = [formatPhoneDisplay(member.user.phone)];
    if (member.user.email) parts.push(member.user.email);
    if (member.companyRole !== "ADMIN") {
      const count = member.user.projectAssignments.length;
      parts.push(`${count} project${count === 1 ? "" : "s"}`);
    }
    return parts.join(" · ");
  }

  function resetInvite() {
    setName("");
    setPhone("");
    setAsAdmin(false);
    setAllProjects(false);
    setAssignments({});
    setProjectRole(assignableOptions[0]?.value ?? "PROJECT_SUPERVISOR");
    setError(null);
  }

  function assignmentPayload() {
    return Object.entries(assignments)
      .filter(([, roleSlug]) => roleSlug)
      .map(([projectId, roleSlug]) => ({ projectId, roleSlug }));
  }

  function accessError() {
    const normalized = normalizePhone(phone);
    if (!name.trim() && !normalized) return "Name and a valid mobile number are required";
    if (!name.trim()) return "Name is required";
    if (!normalized) return "Enter a valid 10-digit Indian mobile number";
    if (!asAdmin && !allProjects && assignmentPayload().length === 0) return "Select at least one project";
    return null;
  }

  async function invite() {
    if (!companyId) return;
    const blocked = accessError();
    if (blocked) {
      setError(blocked);
      return;
    }
    const normalized = normalizePhone(phone)!;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/members", {
        method: "POST",
        companyId,
        body: JSON.stringify({
          phone: normalized,
          name: name.trim(),
          isAdmin: asAdmin,
          allProjects: asAdmin ? false : allProjects,
          projectRole: asAdmin || !allProjects ? undefined : projectRole,
          assignments: asAdmin || allProjects ? [] : assignmentPayload(),
        }),
      });
      setInviteOpen(false);
      resetInvite();
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite");
    } finally {
      setSaving(false);
    }
  }

  async function saveAccess() {
    if (!companyId || !editing) return;
    const blocked = accessError();
    if (blocked) {
      setError(blocked);
      return;
    }
    const normalized = normalizePhone(phone)!;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/members/${editing.id}`, {
        method: "PATCH",
        companyId,
        body: JSON.stringify({
          phone: normalized,
          name: name.trim(),
          isAdmin: asAdmin,
          allProjects: asAdmin ? false : allProjects,
          projectRole: asAdmin || !allProjects ? undefined : projectRole,
          assignments: asAdmin || allProjects ? [] : assignmentPayload(),
        }),
      });
      setEditing(null);
      resetInvite();
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save access");
    } finally {
      setSaving(false);
    }
  }

  function openMember(member: Member) {
    setEditing(member);
    setName(member.user.name);
    setPhone(member.user.phone.replace(/^\+91/, ""));
    setAsAdmin(member.companyRole === "ADMIN");
    setAllProjects(member.allProjects);
    setProjectRole(
      member.allProjects ? member.companyRole : assignableOptions[0]?.value ?? "PROJECT_SUPERVISOR",
    );
    setAssignments(
      Object.fromEntries(member.user.projectAssignments.map((item) => [item.projectId, item.roleSlug])),
    );
    setError(null);
  }

  function currentEnabledBundleIds(permissions: RoleMatrix["permissions"]) {
    const map = new Map(permissions.map((permission) => [permission.code, permission.allowed]));
    return ROLE_PERMISSION_UI.flatMap((group) =>
      group.bundles.filter((bundle) => isBundleFullyAllowed(bundle, map)).map((bundle) => bundle.id),
    );
  }

  function applyEnabledBundles(permissions: RoleMatrix["permissions"], enabledBundleIds: string[]) {
    const enabledCodes = new Set<string>(codesForEnabledBundles(enabledBundleIds));
    const uiCodes = new Set<string>(
      ROLE_PERMISSION_UI.flatMap((group) => group.bundles.flatMap((bundle) => bundle.codes)),
    );
    return permissions.map((item) =>
      uiCodes.has(item.code) ? { ...item, allowed: enabledCodes.has(item.code) } : item,
    );
  }

  function updateActivePermissions(enabledBundleIds: string[]) {
    if (!active || active.locked) return;
    setRoles(
      roleList.map((role) =>
        role.roleSlug === active.roleSlug
          ? { ...role, permissions: applyEnabledBundles(role.permissions, enabledBundleIds) }
          : role,
      ),
    );
  }

  function setBundleAllowed(bundleId: string, allowed: boolean) {
    if (!active) return;
    const enabledIds = new Set(currentEnabledBundleIds(active.permissions));
    if (allowed) enabledIds.add(bundleId);
    else enabledIds.delete(bundleId);
    updateActivePermissions([...enabledIds]);
  }

  function setGroupAllowed(groupId: string, allowed: boolean) {
    const group = ROLE_PERMISSION_UI.find((item) => item.id === groupId);
    if (!group || !active) return;
    const enabledIds = new Set(currentEnabledBundleIds(active.permissions));
    for (const bundle of group.bundles) {
      if (allowed) enabledIds.add(bundle.id);
      else enabledIds.delete(bundle.id);
    }
    updateActivePermissions([...enabledIds]);
  }

  async function saveRole() {
    if (!companyId || !active || active.locked) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await apiFetch<{ roles: RoleMatrix[] }>(`/api/v1/roles/${encodeURIComponent(active.roleSlug)}/permissions`, {
        method: "PUT",
        companyId,
        body: JSON.stringify({
          name: active.name,
          permissions: active.permissions.map((permission) => ({ code: permission.code, allowed: permission.allowed })),
        }),
      });
      setRoles(payload.roles);
      setRoleOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save role");
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    if (!companyId || !newRole.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await apiFetch<{ roles: RoleMatrix[] }>("/api/v1/roles", {
        method: "POST",
        companyId,
        body: JSON.stringify({ name: newRole.trim() }),
      });
      setRoles(payload.roles);
      const created = payload.roles.find(
        (role) => role.name.toLowerCase() === newRole.trim().toLowerCase() && !role.locked,
      );
      setNewRole("");
      setCreateRoleOpen(false);
      if (created) {
        setSelectedRole(created.roleSlug);
        setRoleOpen(true);
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create role");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteRole() {
    if (!companyId || !roleToDelete) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await apiFetch<{ roles: RoleMatrix[] }>(`/api/v1/roles/${encodeURIComponent(roleToDelete.roleSlug)}`, {
        method: "DELETE",
        companyId,
      });
      setRoles(payload.roles);
      setRoleToDelete(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.roles(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete role");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemoveMember() {
    if (!companyId || !memberToDelete) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/members/${memberToDelete.id}`, { method: "DELETE", companyId });
      setMemberToDelete(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove user");
    } finally {
      setSaving(false);
    }
  }

  async function confirmRevokeInvite() {
    if (!companyId || !inviteToRevoke) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/members/${inviteToRevoke.id}?kind=invite`, { method: "DELETE", companyId });
      setInviteToRevoke(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(companyId) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke invite");
    } finally {
      setSaving(false);
    }
  }

  function roleSummary(role: RoleMatrix) {
    if (role.locked) return "All permissions locked";
    const map = Object.fromEntries(role.permissions.map((item) => [item.code, item.allowed]));
    const total = ROLE_PERMISSION_UI.reduce((sum, group) => sum + group.bundles.length, 0);
    const allowed = ROLE_PERMISSION_UI.reduce(
      (sum, group) => sum + group.bundles.filter((bundle) => isBundleFullyAllowed(bundle, map)).length,
      0,
    );
    return `${allowed} of ${total} permissions enabled`;
  }

  const sheetError = inviteOpen || editing || roleOpen || createRoleOpen || settingsOpen || memberToDelete || inviteToRevoke || roleToDelete;

  return (
    <Screen>
      <Title>Users</Title>
      <Copy>Users, role permissions, and company settings.</Copy>
      <View style={styles.tabs}>
        {(
          [
            ["users", "Users"],
            ["roles", "Roles"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab !== id && styles.tabSecondary]}>
            <Text style={[styles.tabText, tab !== id && styles.tabTextSecondary]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error && !sheetError ? <ErrorText>{error}</ErrorText> : null}

      {tab === "users" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Label>Users</Label>
            <Pressable
              accessibilityLabel="Invite user"
              onPress={() => {
                resetInvite();
                setInviteOpen(true);
              }}
              style={[styles.iconBtn, styles.iconAccent]}
            >
              <IconPlus size={16} color={colors.accentInk} />
            </Pressable>
          </View>
          {membersQuery.isPending && memberships.length === 0 ? <Empty>Loading…</Empty> : null}
          {memberships.map((member) => (
            <View key={member.id} style={styles.person}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{member.user.name}</Text>
                <Text style={styles.personMeta}>{memberSubtitle(member)}</Text>
              </View>
              <View style={styles.actions}>
                {member.companyRole === "ADMIN" ? <Badge>{roleDisplayName(member.companyRole)}</Badge> : null}
                {member.companyRole !== "ADMIN" ? (
                  <Pressable onPress={() => openMember(member)}>
                    <Text style={styles.link}>Manage access</Text>
                  </Pressable>
                ) : null}
                {member.user.id !== myUserId ? (
                  <Pressable
                    accessibilityLabel={`Remove ${member.user.name}`}
                    onPress={() => {
                      setError(null);
                      setMemberToDelete(member);
                    }}
                    style={[styles.iconBtn, styles.iconGhost]}
                  >
                    <IconTrash size={16} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {invites.length > 0 ? (
            <View style={styles.section}>
              <Label>Pending invites</Label>
              {invites.map((invite) => (
                <View key={invite.id} style={styles.person}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{invite.name || formatPhoneDisplay(invite.phone)}</Text>
                    <Text style={styles.personMeta}>{formatPhoneDisplay(invite.phone)}</Text>
                  </View>
                  <View style={styles.actions}>
                    {invite.companyRole === "ADMIN" ? <Badge>{roleDisplayName(invite.companyRole)}</Badge> : null}
                    <Pressable
                      accessibilityLabel="Revoke invite"
                      onPress={() => {
                        setError(null);
                        setInviteToRevoke(invite);
                      }}
                      style={[styles.iconBtn, styles.iconGhost]}
                    >
                      <IconTrash size={16} color={colors.ink} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === "roles" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Label>Role permissions</Label>
            <Pressable
              accessibilityLabel="Create role"
              onPress={() => {
                setError(null);
                setNewRole("");
                setCreateRoleOpen(true);
              }}
              style={[styles.iconBtn, styles.iconAccent]}
            >
              <IconPlus size={16} color={colors.accentInk} />
            </Pressable>
          </View>
          {rolesQuery.isPending && roleList.length === 0 ? <Empty>Loading roles…</Empty> : null}
          {roleList.length === 0 && !rolesQuery.isPending ? <Empty>No roles configured yet.</Empty> : null}
          {roleList.map((role) => (
            <View key={role.roleSlug} style={styles.person}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{role.name}</Text>
                <Text style={styles.personMeta}>{roleSummary(role)}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityLabel={role.locked ? `View ${role.name}` : `Edit ${role.name}`}
                  onPress={() => {
                    setError(null);
                    setCollapsedGroups([]);
                    setSelectedRole(role.roleSlug);
                    setRoleOpen(true);
                  }}
                  style={[styles.iconBtn, styles.iconGhost]}
                >
                  <IconPencil size={16} color={colors.ink} />
                </Pressable>
                {!role.locked ? (
                  <Pressable
                    accessibilityLabel={`Delete ${role.name}`}
                    onPress={() => {
                      setError(null);
                      setRoleToDelete(role);
                    }}
                    style={[styles.iconBtn, styles.iconGhost]}
                  >
                    <IconTrash size={16} color={colors.ink} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {tab === "settings" ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Label>Company settings</Label>
            <Pressable
              accessibilityLabel="Edit settings"
              onPress={() => {
                setError(null);
                setAreaUnit(settings?.defaultAreaUnit ?? "SQ_FT");
                setLag(String(settings?.scheduleLagThresholdPercent ?? 10));
                setSettingsOpen(true);
              }}
              style={[styles.iconBtn, styles.iconGhost]}
            >
              <IconPencil size={16} color={colors.ink} />
            </Pressable>
          </View>
          {!settings ? (
            <Empty>Loading…</Empty>
          ) : (
            <>
              <Row
                title="Default area unit"
                subtitle={settings.defaultAreaUnit === "SQ_M" ? "Square meter (sqm)" : "Square foot (sqft)"}
              />
              <Row title="Schedule lag threshold" subtitle={`${Number(settings.scheduleLagThresholdPercent)}%`} />
            </>
          )}
        </View>
      ) : null}

      <Sheet
        open={inviteOpen || Boolean(editing)}
        title={editing ? `Edit access · ${editing.user.name}` : "Invite user"}
        onClose={() => {
          setInviteOpen(false);
          setEditing(null);
          resetInvite();
        }}
      >
        <PhoneField value={phone} onChangeText={setPhone} />
        <Field label="Name" quiet>
          <TextField value={name} onChangeText={setName} placeholder="Full name" />
        </Field>
        <SwitchRow label="Admin" value={asAdmin} onValueChange={setAsAdmin} />
        {!asAdmin ? (
          <SwitchRow
            label="All projects"
            value={allProjects}
            onValueChange={(checked) => {
              setAllProjects(checked);
              if (checked) setAssignments({});
            }}
          />
        ) : null}
        {!asAdmin && allProjects ? (
          <SelectField
            label="Role for all projects"
            quiet
            value={projectRole}
            onChange={setProjectRole}
            options={assignableOptions}
          />
        ) : null}
        {!asAdmin && !allProjects ? (
          <View style={styles.projects}>
            <Text style={styles.projectsLabel}>Projects</Text>
            {(projectsQuery.data ?? []).length === 0 ? (
              <Empty>No projects yet. Create a project first, or choose All projects.</Empty>
            ) : (
              (projectsQuery.data ?? []).map((project, index) => {
                const selected = Object.prototype.hasOwnProperty.call(assignments, project.id);
                return (
                  <View key={project.id} style={[styles.projectCard, index === 0 && styles.projectCardFirst]}>
                    <SwitchRow
                      label={project.name}
                      value={selected}
                      onValueChange={(checked) => {
                        setAssignments((current) => {
                          const next = { ...current };
                          if (checked) next[project.id] = assignableOptions[0]?.value ?? "PROJECT_SUPERVISOR";
                          else delete next[project.id];
                          return next;
                        });
                      }}
                    />
                    {selected ? (
                      <SelectField
                        value={assignments[project.id] ?? assignableOptions[0]?.value ?? ""}
                        onChange={(roleSlug) =>
                          setAssignments((current) => ({ ...current, [project.id]: roleSlug }))
                        }
                        options={assignableOptions}
                      />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Button
          label={editing ? "Save access" : "Invite"}
          pendingLabel={editing ? "Saving…" : "Sending…"}
          pending={saving}
          icon={
            editing ? (
              <IconSave size={16} color={colors.accentInk} />
            ) : (
              <IconUser size={16} color={colors.accentInk} />
            )
          }
          onPress={() => void (editing ? saveAccess() : invite())}
        />
      </Sheet>

      <Sheet open={Boolean(memberToDelete)} title="Remove user" onClose={() => setMemberToDelete(null)}>
        <Text style={styles.confirmCopy}>
          Remove <Text style={styles.confirmName}>{memberToDelete?.user.name ?? ""}</Text> from this company? They will lose access immediately.
        </Text>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Remove user"
          pending={saving}
          icon={<IconTrash size={16} color={colors.accentInk} />}
          onPress={() => void confirmRemoveMember()}
        />
      </Sheet>

      <Sheet open={Boolean(inviteToRevoke)} title="Revoke invite" onClose={() => setInviteToRevoke(null)}>
        <Copy>
          {inviteToRevoke
            ? `Revoke the invite for ${inviteToRevoke.name || formatPhoneDisplay(inviteToRevoke.phone)}?`
            : ""}
        </Copy>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Revoke invite"
          pending={saving}
          pendingLabel="Revoking…"
          icon={<IconTrash size={16} color={colors.accentInk} />}
          onPress={() => void confirmRevokeInvite()}
        />
      </Sheet>

      <Sheet
        open={roleOpen}
        title={active ? (active.locked ? `${active.name} (locked)` : `Edit ${active.name}`) : "Edit permissions"}
        onClose={() => setRoleOpen(false)}
      >
        {active?.locked ? (
          <>
            <Copy>Admin permissions are fixed and cannot be changed.</Copy>
            <Button label="Close" secondary onPress={() => setRoleOpen(false)} />
          </>
        ) : (
          <Field label="Role name" quiet>
            <TextField
              value={active?.name ?? ""}
              onChangeText={(name) => {
                if (!active) return;
                setRoles(roleList.map((role) => (role.roleSlug === active.roleSlug ? { ...role, name } : role)));
              }}
              placeholder="e.g. Site engineer"
            />
          </Field>
        )}
        {ROLE_PERMISSION_UI.map((group) => {
          const map = Object.fromEntries((active?.permissions ?? []).map((item) => [item.code, item.allowed]));
          const bundles = group.bundles.map((bundle) => ({
            ...bundle,
            fully: isBundleFullyAllowed(bundle, map),
            partial: isBundlePartiallyAllowed(bundle, map),
          }));
          const fullyCount = bundles.filter((bundle) => bundle.fully).length;
          const allFully = bundles.length > 0 && fullyCount === bundles.length;
          const someAllowed = (fullyCount > 0 && !allFully) || bundles.some((bundle) => bundle.partial);
          const open = !collapsedGroups.includes(group.id);
          const locked = Boolean(active?.locked);
          return (
            <View key={group.id} style={styles.accordion}>
              <View style={styles.accordionHead}>
                <CheckBox
                  checked={allFully}
                  partial={someAllowed}
                  disabled={locked}
                  onPress={() => setGroupAllowed(group.id, !allFully)}
                />
                <Pressable
                  style={styles.accordionToggle}
                  onPress={() =>
                    setCollapsedGroups((current) =>
                      current.includes(group.id) ? current.filter((item) => item !== group.id) : [...current, group.id],
                    )
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{group.label}</Text>
                    <Text style={styles.personMeta}>
                      {fullyCount} of {group.bundles.length} enabled
                    </Text>
                  </View>
                  <View style={open ? styles.chevronOpen : undefined}>
                    <IconChevronDown size={16} color={colors.muted} />
                  </View>
                </Pressable>
              </View>
              {open
                ? bundles.map((bundle) => (
                    <Pressable
                      key={bundle.id}
                      style={styles.permissionRow}
                      disabled={locked}
                      onPress={() => setBundleAllowed(bundle.id, !bundle.fully)}
                    >
                      <Text style={styles.personName}>{bundle.name}</Text>
                      <CheckBox checked={bundle.fully} partial={bundle.partial && !bundle.fully} disabled={locked} />
                    </Pressable>
                  ))
                : null}
            </View>
          );
        })}
        <ErrorText>{error}</ErrorText>
        {active && !active.locked ? (
          <Button
            label="Save role"
            pending={saving}
            icon={<IconSave size={16} color={colors.accentInk} />}
            onPress={() => void saveRole()}
          />
        ) : null}
      </Sheet>

      <Sheet open={createRoleOpen} title="New role" onClose={() => { setCreateRoleOpen(false); setNewRole(""); setError(null); }}>
        <Field label="Role name" quiet>
          <TextField value={newRole} onChangeText={setNewRole} placeholder="e.g. Site engineer" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Create role"
          pending={saving}
          pendingLabel="Creating…"
          icon={<IconPlus size={16} color={colors.accentInk} />}
          onPress={() => void createRole()}
        />
      </Sheet>

      <Sheet open={Boolean(roleToDelete)} title="Delete role" onClose={() => setRoleToDelete(null)}>
        <Copy>
          {roleToDelete
            ? `Delete ${roleToDelete.name}? This cannot be undone. Roles that are still in use cannot be deleted.`
            : ""}
        </Copy>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Delete role"
          pending={saving}
          icon={<IconTrash size={16} color={colors.accentInk} />}
          onPress={() => void confirmDeleteRole()}
        />
      </Sheet>

      <Sheet open={settingsOpen} title="Company settings" onClose={() => { setSettingsOpen(false); setError(null); }}>
        <SelectField
          label="Default area unit"
          value={areaUnit}
          onChange={(value) => setAreaUnit(value as "SQ_FT" | "SQ_M")}
          options={[
            { value: "SQ_FT", label: "Square foot (sqft)" },
            { value: "SQ_M", label: "Square meter (sqm)" },
          ]}
        />
        <Field label="Schedule lag threshold %" quiet>
          <TextField value={lag} onChangeText={setLag} keyboardType="number-pad" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Save settings"
          pending={saving}
          icon={<IconSave size={16} color={colors.accentInk} />}
          onPress={() => {
            if (!companyId) return;
            setSaving(true);
            void apiFetch("/api/v1/settings", {
              method: "PATCH",
              companyId,
              body: JSON.stringify({
                defaultAreaUnit: areaUnit,
                transferRequiresApproval: false,
                discardRequiresApproval: false,
                scheduleLagThresholdPercent: Number(lag),
              }),
            })
              .then(() => {
                setSettingsOpen(false);
                return queryClient.invalidateQueries({ queryKey: queryKeys.settings(companyId) });
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save settings"))
              .finally(() => setSaving(false));
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  tab: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  tabText: { color: colors.accentInk, fontFamily: "Mukta_700Bold", fontSize: 16 },
  tabTextSecondary: { color: colors.ink },
  section: { marginTop: 28 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  personName: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  personMeta: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(58,34,24,0.35)",
  },
  confirmCopy: { fontFamily: "Mukta_400Regular", fontSize: 16, lineHeight: 24, color: colors.muted },
  confirmName: { fontFamily: "Mukta_700Bold", color: colors.ink },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconAccent: { backgroundColor: colors.accent },
  iconGhost: { backgroundColor: "transparent" },
  accordion: { marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: "hidden" },
  accordionHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12 },
  accordionToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingRight: 12 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  projects: { marginTop: 8 },
  projectsLabel: { fontFamily: "Mukta_500Medium", fontSize: 15, color: colors.muted, marginBottom: 4 },
  projectCard: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  projectCardFirst: { borderTopWidth: 0, paddingTop: 0 },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
