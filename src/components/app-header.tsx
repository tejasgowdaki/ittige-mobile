import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, type MeResponse } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { queryKeys } from "@/lib/query-keys";
import { formatPhoneDisplay, normalizePhone } from "@/shared";
import { IconLogout, IconSave, IconTeam, IconUser } from "@/components/icons";
import { Badge, Empty, ErrorText, Field, PhoneField, Row, SelectField, Sheet, TextField } from "@/components/ui";
import { colors } from "@/theme";

export function AppHeader() {
  const router = useRouter();
  const { companyName, me, companyId, setCompanyId } = useCompany();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<"menu" | "profile" | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = me?.companies.find((company) => company.id === companyId) ?? null;
  const isAdmin = current?.companyRole === "ADMIN";
  const initial = (me?.name?.trim()?.[0] || me?.phone?.slice(-1) || "?").toUpperCase();
  const projects = me?.projectAssignments.filter((item) => item.companyId === companyId) ?? [];

  function localPhone(phone: string | null | undefined) {
    const normalized = phone ? normalizePhone(phone) : null;
    return normalized?.startsWith("+91") ? normalized.slice(3) : "";
  }

  async function saveProfile() {
    if (!profileName.trim()) return;
    const phone = isAdmin ? normalizePhone(profilePhone) : null;
    if (isAdmin && !phone) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<MeResponse>("/api/v1/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName.trim(),
          ...(phone ? { phone } : {}),
        }),
      });
      queryClient.setQueryData(queryKeys.me, updated);
      setProfileName("");
      setProfilePhone("");
      setError(null);
      setSheet(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, styles.amp]}>I</Text>
          <Text style={styles.brand}>ttige</Text>
        </View>
        {companyName ? <Text style={styles.company}>{companyName}</Text> : null}
      </View>
      {me && me.companies.length > 1 ? (
        <SelectField
          label="Company"
          compact
          value={companyId ?? ""}
          onChange={setCompanyId}
          options={me.companies.map((company) => ({ value: company.id, label: company.name }))}
        />
      ) : null}
      <Pressable style={styles.avatar} onPress={() => setSheet("menu")}>
        <Text style={styles.avatarText}>{initial}</Text>
      </Pressable>
      <Sheet
        open={sheet !== null}
        title={sheet === "profile" ? "Profile" : "Account"}
        onClose={() => {
          setProfileName("");
          setProfilePhone("");
          setError(null);
          setSheet(null);
        }}
      >
        {sheet === "menu" ? (
          <>
            <Text style={styles.name}>{me?.name || "Account"}</Text>
            <Text style={styles.company}>{me?.phone ? formatPhoneDisplay(me.phone) : ""}</Text>
            <MenuItem
              icon={<IconUser size={16} color={colors.ink} />}
              label="Profile"
              onPress={() => {
                setProfileName(me?.name ?? "");
                setProfilePhone(localPhone(me?.phone));
                setError(null);
                setSheet("profile");
              }}
            />
            {isAdmin ? (
              <MenuItem
                icon={<IconTeam size={16} color={colors.ink} />}
                label="Users"
                onPress={() => {
                  setSheet(null);
                  router.push("/team");
                }}
              />
            ) : null}
            <MenuItem
              icon={<IconLogout size={16} color={colors.ink} />}
              label={signingOut ? "Signing out…" : "Sign out"}
              onPress={() => {
                if (signingOut) return;
                setSigningOut(true);
                setSheet(null);
                void signOut().finally(() => setSigningOut(false));
              }}
            />
          </>
        ) : (
          <>
            <Field label="Name">
              <TextField value={profileName} onChangeText={setProfileName} />
            </Field>
            {isAdmin ? (
              <>
                <PhoneField quiet={false} value={profilePhone} onChangeText={setProfilePhone} />
                {profilePhone !== localPhone(me?.phone) ? (
                  <Text style={styles.hint}>Next sign-in uses this number.</Text>
                ) : null}
              </>
            ) : (
              <Field label="Phone">
                <TextField value={me?.phone ? formatPhoneDisplay(me.phone) : ""} editable={false} />
              </Field>
            )}
            {current ? (
              <Field label="Role" quiet>
                {current.companyRole === "ADMIN" ? (
                  <Badge>Admin</Badge>
                ) : current.allProjects ? (
                  <>
                    <Text style={styles.name}>{current.roleName}</Text>
                    <Text style={styles.company}>All projects</Text>
                  </>
                ) : projects.length === 0 ? (
                  <Empty>No project access assigned.</Empty>
                ) : (
                  projects.map((assignment) => (
                    <Row
                      key={assignment.projectId}
                      title={assignment.projectName}
                      subtitle={assignment.roleName}
                    />
                  ))
                )}
              </Field>
            ) : null}
            <ErrorText>{error}</ErrorText>
            <Pressable
              style={[
                styles.save,
                (saving || profileName.trim().length < 1 || (isAdmin && profilePhone.length !== 10)) && styles.disabled,
              ]}
              disabled={saving || profileName.trim().length < 1 || (isAdmin && profilePhone.length !== 10)}
              onPress={() => void saveProfile()}
            >
              <IconSave size={16} color={colors.accentInk} />
              <Text style={styles.saveText}>{saving ? "Saving…" : isAdmin ? "Save" : "Save name"}</Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: __DEV__ ? 52 : 18,
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  brandRow: { flexDirection: "row", alignItems: "flex-end" },
  brand: {
    fontFamily: "Mukta_800ExtraBold",
    fontSize: 26,
    lineHeight: 44,
    letterSpacing: -0.6,
    color: colors.ink,
    paddingRight: 2,
  },
  amp: { color: colors.accent, paddingRight: 0 },
  company: { fontFamily: "Mukta_400Regular", color: colors.muted, fontSize: 13 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(58,34,24,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.ink, fontFamily: "Mukta_700Bold", fontSize: 15 },
  name: { fontFamily: "Mukta_700Bold", fontSize: 18, color: colors.ink },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  menuLabel: { fontFamily: "Mukta_600SemiBold", fontSize: 16, color: colors.ink },
  save: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  hint: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginTop: 6 },
  saveText: { color: colors.accentInk, fontFamily: "Mukta_700Bold", fontSize: 16 },
  disabled: { opacity: 0.55 },
});

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}
