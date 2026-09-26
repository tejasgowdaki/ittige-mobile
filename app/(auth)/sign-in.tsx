import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "@/components/logo";
import { PhoneAuthForm } from "@/components/phone-auth-form";
import { colors } from "@/theme";

export default function SignInScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.brandRow}>
        <Logo size={44} />
        <Text style={styles.brand}>
          <Text style={styles.amp}>I</Text>ttige
        </Text>
      </View>
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.form}>
        <PhoneAuthForm mode="sign-in" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, padding: 18 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: { fontFamily: "Mukta_800ExtraBold", fontSize: 32, color: colors.ink },
  amp: { color: colors.accent },
  title: { fontFamily: "Mukta_700Bold", fontSize: 36, color: colors.ink, marginVertical: 12 },
  form: { flex: 1 },
});
