import { useEffect, useRef } from "react";
import { Redirect, useRouter } from "expo-router";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { useAuth } from "@/lib/auth-context";
import { colors } from "@/theme";

function HeroLine() {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={[
        styles.line,
        {
          opacity,
          transformOrigin: "left center",
          transform: [{ scaleX: scale }],
        },
      ]}
    />
  );
}

export default function Index() {
  const { signedIn } = useAuth();
  const router = useRouter();
  if (signedIn) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={styles.safe}>
      <HeroBackdrop />
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>Field to office</Text>
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Stock</Text>
            <Text style={[styles.brand, styles.mark]}>&</Text>
          </View>
          <Text style={styles.brand}>Site</Text>
        </View>
        <HeroLine />
        <Text style={styles.copy}>Build faster. Track smarter. Manage everything</Text>
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push("/sign-in")}>
            <Text style={styles.primaryText}>Sign in with phone</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push("/sign-up")}>
            <Text style={styles.secondaryText}>Create account</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: "flex-end" },
  inner: { paddingHorizontal: 22, paddingBottom: 36 },
  eyebrow: {
    color: colors.muted,
    letterSpacing: 1.9,
    textTransform: "uppercase",
    fontSize: 12,
    lineHeight: 18,
    paddingRight: 6,
    fontFamily: "Mukta_500Medium",
  },
  brandBlock: { marginTop: 6 },
  brandRow: { flexDirection: "row", alignItems: "flex-end" },
  brand: {
    fontFamily: "Mukta_800ExtraBold",
    fontSize: 56,
    lineHeight: 72,
    letterSpacing: -1.4,
    color: colors.ink,
  },
  mark: { color: colors.accent },
  line: { width: 88, height: 3, marginVertical: 18, backgroundColor: colors.accent },
  copy: {
    maxWidth: 320,
    color: colors.muted,
    fontFamily: "Mukta_400Regular",
    fontSize: 17,
    lineHeight: 25,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 28 },
  primary: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryText: { color: colors.accentInk, fontFamily: "Mukta_700Bold", fontSize: 16 },
  secondary: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryText: { color: colors.ink, fontFamily: "Mukta_700Bold", fontSize: 16 },
});
