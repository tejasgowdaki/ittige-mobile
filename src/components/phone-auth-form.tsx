import { PhoneAuthProvider, signInWithCredential, signInWithCustomToken } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { getFirebaseAuth, getFirebaseConfig, isFirebaseClientConfigured } from "@/lib/firebase";
import { formatPhoneDisplay, normalizePhone } from "@/shared";
import { IconCheck, IconSend } from "@/components/icons";
import { Button, Copy, ErrorText, Field, PhoneField, TextField } from "@/components/ui";
import { colors } from "@/theme";

type Mode = "sign-in" | "sign-up";

function authErrorMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: string }).code || "");
    if (code.includes("invalid-phone-number")) return "Enter a valid Indian mobile number";
    if (code.includes("invalid-verification-code")) return "Invalid OTP";
    if (code.includes("too-many-requests")) return "Too many attempts. Try again later.";
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function PhoneAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { establishSession } = useAuth();
  const verificationId = useRef<string | null>(null);
  const [devAuth, setDevAuth] = useState<{ enabled: boolean; otp: string | null } | null>(null);
  const [localNumber, setLocalNumber] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [challengeHtml, setChallengeHtml] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ enabled?: boolean; otp?: string | null }>("/api/v1/dev-auth")
      .then((payload) => setDevAuth({ enabled: Boolean(payload.enabled), otp: payload.otp ?? null }))
      .catch(() => setDevAuth({ enabled: false, otp: null }));
  }, []);

  function recaptchaHtml(phone: string) {
    const config = getFirebaseConfig();
    return `<!DOCTYPE html><html><body>
      <div id="recaptcha"></div>
      <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
      <script>
        firebase.initializeApp(${JSON.stringify(config)});
        const auth = firebase.auth();
        const verifier = new firebase.auth.RecaptchaVerifier("recaptcha", { size: "normal" });
        auth.signInWithPhoneNumber(${JSON.stringify(phone)}, verifier)
          .then((result) => window.ReactNativeWebView.postMessage(JSON.stringify({ verificationId: result.verificationId })))
          .catch((err) => window.ReactNativeWebView.postMessage(JSON.stringify({ error: err.message || "Could not send OTP" })));
      </script>
    </body></html>`;
  }

  async function onChallenge(event: WebViewMessageEvent) {
    setChallengeHtml(null);
    setSaving(false);
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { verificationId?: string; error?: string };
      if (!payload.verificationId) throw new Error(payload.error || "Could not send OTP");
      verificationId.current = payload.verificationId;
      setStep("code");
    } catch (err) {
      setError(authErrorMessage(err, "Could not send OTP"));
    }
  }

  async function sendCode() {
    setError(null);
    setSaving(true);
    try {
      const phone = normalizePhone(localNumber);
      if (!phone) throw new Error("Enter a valid 10-digit Indian mobile number");
      if (devAuth?.enabled) {
        setPendingPhone(phone);
        setStep("code");
        if (devAuth.otp) setCode(devAuth.otp);
        return;
      }
      if (!isFirebaseClientConfigured()) {
        throw new Error("Firebase is not configured. Add EXPO_PUBLIC_FIREBASE_*");
      }
      setPendingPhone(phone);
      setChallengeHtml(recaptchaHtml(phone));
    } catch (err) {
      setError(authErrorMessage(err, "Could not send OTP"));
      setSaving(false);
    } finally {
      if (devAuth?.enabled) setSaving(false);
    }
  }

  async function verifyCode() {
    if (!pendingPhone) return;
    setError(null);
    setSaving(true);
    try {
      const auth = getFirebaseAuth();
      if (devAuth?.enabled) {
        const payload = await apiFetch<{ customToken?: string }>("/api/v1/dev-auth/verify", {
          method: "POST",
          body: JSON.stringify({ phone: pendingPhone, code: code.trim() }),
        });
        if (!payload.customToken) throw new Error("Dev auth failed");
        const credential = await signInWithCustomToken(auth, payload.customToken);
        await establishSession(await credential.user.getIdToken());
      } else {
        if (!verificationId.current) throw new Error("Request a new OTP");
        const credential = PhoneAuthProvider.credential(verificationId.current, code.trim());
        const signed = await signInWithCredential(auth, credential);
        await establishSession(await signed.user.getIdToken());
      }
      router.replace("/");
    } catch (err) {
      setError(authErrorMessage(err, "Could not verify code"));
    } finally {
      setSaving(false);
    }
  }

  if (!devAuth) return <Copy>Loading…</Copy>;

  if (challengeHtml) {
    return (
      <View style={styles.web}>
        <Copy>Confirm you are not a robot to receive the OTP.</Copy>
        <WebView originWhitelist={["*"]} source={{ html: challengeHtml }} onMessage={(event) => void onChallenge(event)} />
      </View>
    );
  }

  if (step === "code") {
    return (
      <View>
        <Text style={styles.sent}>
          Code sent to <Text style={styles.sentStrong}>{pendingPhone ? formatPhoneDisplay(pendingPhone) : ""}</Text>
        </Text>
        <Field label="OTP" quiet>
          <TextField
            value={code}
            keyboardType="number-pad"
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Verify & continue"
          pending={saving}
          pendingLabel="Verifying…"
          disabled={code.trim().length < 4}
          icon={<IconCheck size={16} color={colors.accentInk} />}
          onPress={() => void verifyCode()}
        />
        <Button
          label="Change number"
          secondary
          onPress={() => {
            setStep("phone");
            setCode("");
            setError(null);
            verificationId.current = null;
          }}
        />
      </View>
    );
  }

  return (
    <View>
      {devAuth.enabled ? <Text style={styles.dev}>Dev OTP enabled — no SMS sent</Text> : null}
      <PhoneField value={localNumber} onChangeText={setLocalNumber} />
      <ErrorText>{error}</ErrorText>
      <Button
        label={devAuth.enabled ? "Continue" : "Send OTP"}
        pending={saving}
        pendingLabel="Sending…"
        disabled={localNumber.length !== 10}
        icon={<IconSend size={16} color={colors.accentInk} />}
        onPress={() => void sendCode()}
      />
      <Pressable onPress={() => router.replace(mode === "sign-in" ? "/sign-up" : "/sign-in")}>
        <Text style={styles.switchLink}>
          {mode === "sign-in" ? "New here? Create account" : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dev: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(200,106,88,0.16)",
    color: colors.warn,
    fontFamily: "Mukta_700Bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  sent: { fontFamily: "Mukta_400Regular", fontSize: 16, lineHeight: 24, color: colors.muted, marginBottom: 8 },
  sentStrong: { fontFamily: "Mukta_700Bold", color: colors.ink },
  switchLink: {
    textAlign: "center",
    marginTop: 4,
    color: colors.muted,
    fontFamily: "Mukta_400Regular",
    fontSize: 16,
  },
  web: { height: 420 },
});
