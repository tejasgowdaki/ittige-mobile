import { useMemo, useState } from "react";
import { Button, Copy, Empty, Row, Screen, TextField, Title } from "@/components/ui";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { formatDisplayDate } from "@/lib/dates";
import { useActivityQuery, useMembersQuery } from "@/lib/queries";
import { activityFilterModulesForPermissions, AUDIT_MODULE_LABELS, formatAuditModule } from "@/shared";
import { FilterLink } from "@/components/ui";

type ActivityEvent = {
  id: string;
  module: string;
  action: string;
  summary: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
  changes?: { field: string; from: unknown; to: unknown }[];
};
type Member = { user: { id: string; name: string } };

function formatValue(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ActivityScreen() {
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const isAdmin = me?.companies.find((company) => company.id === companyId)?.companyRole === "ADMIN";
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const modules = useMemo(() => activityFilterModulesForPermissions(permissions), [permissions]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [actorIds, setActorIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const membersQuery = useMembersQuery<Member, never>(ready && Boolean(isAdmin));
  const activityQuery = useActivityQuery<ActivityEvent>(
    { modules: selectedModules, actorIds, from: from || undefined, to: to || undefined },
    ready,
  );

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;
  if (gate.needsOnboarding) return <Screen><Empty>Set up your company first.</Empty></Screen>;

  const events = activityQuery.data?.events ?? [];
  const people = membersQuery.data?.memberships ?? [];

  return (
    <Screen>
      <Title>Activity</Title>
      <Copy>Recent changes across modules you can access.</Copy>
      {modules.map((module) => (
        <FilterLink
          key={module}
          label={AUDIT_MODULE_LABELS[module]}
          active={selectedModules.includes(module)}
          onPress={() => setSelectedModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module])}
        />
      ))}
      {isAdmin
        ? people.map((member) => (
            <FilterLink
              key={member.user.id}
              label={member.user.name}
              active={actorIds.includes(member.user.id)}
              onPress={() => setActorIds((current) => current.includes(member.user.id) ? current.filter((item) => item !== member.user.id) : [...current, member.user.id])}
            />
          ))
        : null}
      <TextField value={from} onChangeText={setFrom} placeholder="From YYYY-MM-DD" />
      <TextField value={to} onChangeText={setTo} placeholder="To YYYY-MM-DD" />
      <Button label="Clear" secondary onPress={() => { setSelectedModules([]); setActorIds([]); setFrom(""); setTo(""); }} />
      {events.length === 0 ? <Empty>No activity.</Empty> : null}
      {events.map((event) => (
        <Row
          key={event.id}
          title={event.summary || `${formatAuditModule(event.module)} · ${event.action}`}
          subtitle={`${event.actor?.name ?? "Someone"} · ${formatDisplayDate(event.createdAt.slice(0, 10))}${event.changes?.length ? ` · ${event.changes.map((change) => `${change.field}: ${formatValue(change.from)} → ${formatValue(change.to)}`).join(", ")}` : ""}`}
        />
      ))}
    </Screen>
  );
}
