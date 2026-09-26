import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PhoneAuthForm } from "@/components/phone-auth-form";
import { colors } from "@/theme";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <Text style={styles.title}>{mode === "sign-in" ? "Sign in" : "Create account"}</Text>
        <Text style={styles.copy}>Indian mobile (+91). We’ll text you an OTP.</Text>
        <PhoneAuthForm mode={mode} />
        <Pressable onPress={() => router.replace("/")} style={styles.cancelHit}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: "center" },
  inner: { width: "100%", maxWidth: 420, alignSelf: "center", paddingHorizontal: 22 },
  title: {
    fontFamily: "Mukta_700Bold",
    fontSize: 32,
    lineHeight: 42,
    letterSpacing: -0.8,
    color: colors.ink,
    marginBottom: 12,
    paddingTop: 4,
  },
  copy: {
    fontFamily: "Mukta_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginBottom: 18,
    paddingRight: 4,
  },
  cancelHit: { marginTop: 18, alignItems: "center" },
  cancel: { fontFamily: "Mukta_400Regular", fontSize: 16, color: colors.muted },
});
