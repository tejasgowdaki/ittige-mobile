import { useEffect, useRef, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { useAuth } from "@/lib/auth-context";
import { colors, radius } from "@/theme";

const SWITCH_MS = 4000;
const SHRINK_MS = 1300;

const features = [
  {
    title: "Today",
    copy: "Projects, progress, and stock in one place.",
    source: require("../assets/landing/today.jpg"),
  },
  {
    title: "Projects",
    copy: "Clients, spaces, and what is being built.",
    source: require("../assets/landing/projects.jpg"),
  },
  {
    title: "Site log",
    copy: "Labor, progress, and notes by date.",
    source: require("../assets/landing/progress.jpg"),
  },
  {
    title: "Stock",
    copy: "Balances, receipts, and transfers.",
    source: require("../assets/landing/stock.jpg"),
  },
  {
    title: "Requests",
    copy: "Raise needs, approve sources, and confirm receipts.",
    source: require("../assets/landing/requests.jpg"),
  },
];

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
  const [live, setLive] = useState(false);
  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const imageOpacity = useRef(new Animated.Value(1)).current;
  const shrink = useRef(new Animated.Value(0)).current;
  const feature = features[index];
  const fontSize = shrink.interpolate({ inputRange: [0, 1], outputRange: [56, 34] });
  const lineHeight = shrink.interpolate({ inputRange: [0, 1], outputRange: [72, 42] });
  const letterSpacing = shrink.interpolate({ inputRange: [0, 1], outputRange: [-1.4, -0.8] });
  const extraOpacity = shrink.interpolate({
    inputRange: [0, 0.38],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const extraHeight = shrink.interpolate({
    inputRange: [0, 0.72],
    outputRange: [28, 0],
    extrapolate: "clamp",
  });
  const detailHeight = shrink.interpolate({
    inputRange: [0, 0.72],
    outputRange: [96, 0],
    extrapolate: "clamp",
  });
  const stageMaxHeight = shrink.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1200],
  });
  const siteHeight = shrink.interpolate({
    inputRange: [0, 0.72],
    outputRange: [72, 0],
    extrapolate: "clamp",
  });
  const inlineSiteOpacity = shrink.interpolate({
    inputRange: [0.58, 0.92],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const inlineSiteWidth = shrink.interpolate({
    inputRange: [0.58, 1],
    outputRange: [0, 120],
    extrapolate: "clamp",
  });
  const spacerGrow = shrink.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stageGrow = shrink.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const stageOpacity = shrink.interpolate({
    inputRange: [0.18, 0.72],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const brandStyle = { fontSize, lineHeight, letterSpacing };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLive(true);
      Animated.timing(shrink, {
        toValue: 1,
        duration: SHRINK_MS,
        easing: Easing.bezier(0.33, 0.7, 0.2, 1),
        useNativeDriver: false,
      }).start();
    }, 5000);
    return () => clearTimeout(timer);
  }, [shrink]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      Animated.timing(imageOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((current) => (current + 1) % features.length);
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    }, SWITCH_MS);
    return () => clearInterval(timer);
  }, [imageOpacity, live]);

  if (signedIn) return <Redirect href="/(app)" />;

  return (
    <SafeAreaView style={styles.safe}>
      <HeroBackdrop />
      <View style={styles.hero}>
        <Animated.View style={{ flexGrow: spacerGrow }} />
        <View style={styles.inner}>
          <Animated.Text
            style={[styles.eyebrow, { opacity: extraOpacity, maxHeight: extraHeight, overflow: "hidden" }]}
          >
            Field to office
          </Animated.Text>
          <View style={styles.brandBlock}>
            <View style={styles.brandRow}>
              <Animated.Text style={[styles.brand, brandStyle]}>Stock</Animated.Text>
              <Animated.Text style={[styles.brand, styles.mark, brandStyle]}>&</Animated.Text>
              <Animated.Text
                accessible={live}
                style={[
                  styles.brand,
                  brandStyle,
                  { opacity: inlineSiteOpacity, maxWidth: inlineSiteWidth, overflow: "hidden" },
                ]}
              >
                Site
              </Animated.Text>
            </View>
            <Animated.Text
              accessible={!live}
              style={[styles.brand, brandStyle, { opacity: extraOpacity, maxHeight: siteHeight, overflow: "hidden" }]}
            >
              Site
            </Animated.Text>
          </View>
          <Animated.View style={{ opacity: extraOpacity, maxHeight: detailHeight, overflow: "hidden" }}>
            <HeroLine />
            <Text style={styles.copy}>Build faster. Track smarter. Manage everything</Text>
          </Animated.View>
          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={() => router.push("/sign-in")}>
              <Text style={styles.primaryText}>Sign in with phone</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => router.push("/sign-up")}>
              <Text style={styles.secondaryText}>Create account</Text>
            </Pressable>
          </View>
        </View>
        <Animated.View
          style={[
            styles.stage,
            { flexGrow: stageGrow, maxHeight: stageMaxHeight, opacity: stageOpacity, overflow: "hidden" },
          ]}
          pointerEvents={live ? "auto" : "none"}
        >
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureCopy}>{feature.copy}</Text>
          <Animated.View
            style={[styles.featureFrame, { opacity: imageOpacity }]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setFrame((current) =>
                current.width === width && current.height === height ? current : { width, height },
              );
            }}
          >
            {frame.width > 0 && frame.height > 0 ? (
              <Image
                source={feature.source}
                style={{ width: frame.width, height: frame.height }}
                contentFit="contain"
              />
            ) : null}
          </Animated.View>
          <View style={styles.dots}>
            {features.map((item, itemIndex) => (
              <View
                key={item.title}
                style={[styles.dot, itemIndex === index && styles.dotActive]}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { flex: 1 },
  inner: { paddingHorizontal: 22, paddingBottom: 28 },
  stage: { minHeight: 0, paddingHorizontal: 22, paddingBottom: 12 },
  featureTitle: {
    fontFamily: "Mukta_800ExtraBold",
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
  },
  featureCopy: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: "Mukta_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  featureFrame: {
    flex: 1,
    marginTop: 12,
    borderRadius: radius + 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "rgba(58,34,24,0.22)" },
  dotActive: { width: 22, backgroundColor: colors.accent },
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
