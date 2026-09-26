import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DateCalendar } from "@/components/date-field";
import { IconClose, IconFilter } from "@/components/icons";
import { CheckBox, Copy, Empty, Screen, Sheet, Title } from "@/components/ui";
import { useCompany, useCompanyGate } from "@/lib/company-context";
import { formatDisplayDate, toDateKey } from "@/lib/dates";
import { useActivityQuery, useMembersQuery } from "@/lib/queries";
import { activityFilterModulesForPermissions, AUDIT_MODULE_LABELS, formatAuditModule, type ActivityFilterModule } from "@/shared";
import { colors } from "@/theme";

type ActivityEvent = {
  id: string;
  module: string;
  action: string;
  summary: string;
  metadata: {
    changes?: { field: string; from: unknown; to: unknown }[];
  } | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};
type Member = { user: { id: string; name: string } };
type Picker = "person" | "from" | "to" | null;

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChangeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ActivityScreen() {
  const { companyId, me } = useCompany();
  const gate = useCompanyGate();
  const ready = !gate.needsOnboarding && Boolean(companyId);
  const isAdmin = me?.companies.find((company) => company.id === companyId)?.companyRole === "ADMIN";
  const permissions = me?.companies.find((company) => company.id === companyId)?.permissions ?? [];
  const moduleOptions = useMemo(
    () => activityFilterModulesForPermissions(permissions).map((value) => ({ value, label: AUDIT_MODULE_LABELS[value] })),
    [permissions],
  );
  const [modules, setModules] = useState<ActivityFilterModule[]>([]);
  const [actorIds, setActorIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);
  const membersQuery = useMembersQuery<Member, never>(ready && Boolean(isAdmin));
  const activityQuery = useActivityQuery<ActivityEvent>(
    { modules, actorIds, from: from || undefined, to: to || undefined },
    ready,
  );

  if (gate.loading) return <Screen><Empty>Loading…</Empty></Screen>;
  if (gate.needsOnboarding) return <Screen><Empty>Set up your company first.</Empty></Screen>;

  const events = activityQuery.data?.events ?? [];
  const people = membersQuery.data?.memberships ?? [];
  const filterCount = modules.length + actorIds.length + (from ? 1 : 0) + (to ? 1 : 0);
  const selectedPeople = people.filter((item) => actorIds.includes(item.user.id));
  const personLabel =
    selectedPeople.length === 0
      ? "Select person"
      : selectedPeople.length <= 2
        ? selectedPeople.map((item) => item.user.name).join(" · ")
        : `${selectedPeople.length} people`;

  function clearFilters() {
    setModules([]);
    setActorIds([]);
    setFrom("");
    setTo("");
  }

  return (
    <Screen>
      <Title>Activity</Title>
      <Copy>Recent changes across modules you can access.</Copy>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <View style={styles.sectionActions}>
            {filterCount > 0 ? <TextLink label="Clear" muted onPress={clearFilters} /> : null}
            <Pressable
              accessibilityLabel={filtersOpen ? "Hide filters" : "Show filters"}
              accessibilityState={{ selected: filtersOpen }}
              onPress={() => setFiltersOpen((current) => !current)}
              style={styles.filterBtn}
            >
              <IconFilter size={18} color={colors.ink} />
              {filterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{filterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {filtersOpen ? (
          <>
            {moduleOptions.length > 1 ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Module</Text>
                {moduleOptions.map((option) => (
                  <TextLink
                    key={option.value}
                    label={option.label}
                    active={modules.includes(option.value)}
                    onPress={() =>
                      setModules((current) =>
                        current.includes(option.value)
                          ? current.filter((item) => item !== option.value)
                          : [...current, option.value],
                      )
                    }
                  />
                ))}
                {modules.length > 0 ? <TextLink label="Clear" muted onPress={() => setModules([])} /> : null}
              </View>
            ) : null}
            {isAdmin ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Person</Text>
                <TextLink label={personLabel} active={actorIds.length > 0} onPress={() => setPicker("person")} />
                {actorIds.length > 0 ? (
                  <Pressable accessibilityLabel="Clear person" onPress={() => setActorIds([])} hitSlop={8}>
                    <IconClose size={12} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>From</Text>
              <TextLink
                label={from ? formatDisplayDate(from) : "Select date"}
                active={Boolean(from)}
                onPress={() => setPicker("from")}
              />
              {from ? (
                <Pressable accessibilityLabel="Clear from date" onPress={() => setFrom("")} hitSlop={8}>
                  <IconClose size={12} color={colors.muted} />
                </Pressable>
              ) : null}
              <Text style={[styles.filterLabel, styles.filterLabelGap]}>To</Text>
              <TextLink
                label={to ? formatDisplayDate(to) : "Select date"}
                active={Boolean(to)}
                onPress={() => setPicker("to")}
              />
              {to ? (
                <Pressable accessibilityLabel="Clear to date" onPress={() => setTo("")} hitSlop={8}>
                  <IconClose size={12} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {activityQuery.isPending ? <Empty>Loading…</Empty> : null}
        {!activityQuery.isPending && events.length === 0 ? <Empty>No activity yet</Empty> : null}
        {events.map((event) => {
          const changes = event.metadata?.changes ?? [];
          const changeLine =
            changes.length > 0
              ? changes
                  .map((change) => `${change.field} ${formatChangeValue(change.from)} → ${formatChangeValue(change.to)}`)
                  .join(" · ")
              : null;
          return (
            <View key={event.id} style={styles.row}>
              <Text style={styles.rowTitle}>
                {event.summary}
                {changeLine ? ` · ${changeLine}` : ""}
              </Text>
              <Text style={styles.rowSub}>
                {`${event.actor?.name ?? "System"} · ${formatAuditModule(event.module)} · ${formatActivityTime(event.createdAt)}`}
              </Text>
            </View>
          );
        })}
      </View>

      <Sheet open={picker === "person"} title="Select person" onClose={() => setPicker(null)}>
        {people.length === 0 ? <Empty>No people yet.</Empty> : null}
        {people.map((member) => {
          const active = actorIds.includes(member.user.id);
          return (
            <Pressable
              key={member.user.id}
              style={styles.pick}
              onPress={() =>
                setActorIds((current) =>
                  current.includes(member.user.id) ? current.filter((id) => id !== member.user.id) : [...current, member.user.id],
                )
              }
            >
              <CheckBox checked={active} />
              <Text style={[styles.rowTitle, active && styles.active]}>{member.user.name}</Text>
            </Pressable>
          );
        })}
        {actorIds.length > 0 ? <TextLink label="Clear" muted onPress={() => setActorIds([])} /> : null}
      </Sheet>

      <Sheet
        open={picker === "from" || picker === "to"}
        title={picker === "to" ? "To date" : "From date"}
        onClose={() => setPicker(null)}
      >
        <DateCalendar
          value={(picker === "to" ? to : from) || toDateKey(new Date())}
          onChange={(next) => {
            if (picker === "to") setTo(next);
            else setFrom(next);
            setPicker(null);
          }}
        />
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
  section: { marginTop: 20 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionLabel: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  filterBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  filterBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: colors.accentInk,
    fontFamily: "Mukta_700Bold",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    includeFontPadding: false,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 4 },
  filterLabel: { fontFamily: "Mukta_500Medium", fontSize: 15, color: colors.muted, marginRight: 8 },
  filterLabelGap: { marginLeft: 8 },
  linkHit: { paddingVertical: 8, marginRight: 8 },
  link: {
    fontFamily: "Mukta_600SemiBold",
    fontSize: 15,
    color: colors.ink,
    textDecorationLine: "underline",
  },
  linkActive: { color: colors.accent },
  linkMuted: { color: colors.muted, fontFamily: "Mukta_500Medium", textDecorationLine: "none" },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTitle: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  rowSub: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 4 },
  active: { color: colors.accent },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
