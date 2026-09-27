import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { Button, ErrorText, Field, TextField } from "@/components/ui";
import { useCompany } from "@/lib/company-context";
import { colors } from "@/theme";

export function OnboardingForm() {
  const { createCompany } = useCompany();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (name.trim().length < 2) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createCompany(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create company");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field label="Company name">
        <TextField value={name} onChangeText={setName} placeholder="Acme Builders" />
      </Field>
      <ErrorText>{error}</ErrorText>
      <Button
        label="Create company"
        pending={saving}
        pendingLabel="Creating…"
        disabled={name.trim().length < 2}
        icon={<IconPlus size={16} color={colors.accentInk} />}
        onPress={() => void submit()}
      />
    </>
  );
}
