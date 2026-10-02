import { StyleSheet, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

export function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="hero-blush" cx="70%" cy="20%" r="38%">
            <Stop offset="0" stopColor="#f0c9ba" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#f0c9ba" stopOpacity="0" />
          </RadialGradient>
          <Pattern id="hero-stripes" width="19" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <Line x1="0" y1="0" x2="0" y2="19" stroke="rgba(198,78,47,0.045)" strokeWidth="1" />
          </Pattern>
          <LinearGradient id="hero-veil" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f7ede7" stopOpacity="0.2" />
            <Stop offset="0.45" stopColor="#f7ede7" stopOpacity="0.72" />
            <Stop offset="1" stopColor="#f7ede7" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#f7ede7" />
        <Rect width="100%" height="100%" fill="url(#hero-blush)" />
        <Rect width="100%" height="100%" fill="url(#hero-stripes)" />
        <Rect width="100%" height="100%" fill="url(#hero-veil)" />
      </Svg>
    </View>
  );
}
