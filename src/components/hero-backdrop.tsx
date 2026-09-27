import { StyleSheet, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

export function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="hero-base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#f7ede7" />
            <Stop offset="0.45" stopColor="#f7ede7" />
            <Stop offset="1" stopColor="#ead5ca" />
          </LinearGradient>
          <RadialGradient id="hero-corner" cx="100%" cy="0%" rx="60%" ry="40%">
            <Stop offset="0" stopColor="rgba(240,201,186,0.9)" />
            <Stop offset="0.5" stopColor="rgba(240,201,186,0)" />
          </RadialGradient>
          <RadialGradient id="hero-accent-wash" cx="10%" cy="0%" rx="80%" ry="50%">
            <Stop offset="0" stopColor="rgba(198,78,47,0.12)" />
            <Stop offset="0.55" stopColor="rgba(198,78,47,0)" />
          </RadialGradient>
          <RadialGradient id="hero-blush" cx="70%" cy="20%" r="38%">
            <Stop offset="0" stopColor="rgba(240,201,186,0.55)" />
            <Stop offset="1" stopColor="rgba(240,201,186,0)" />
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
        <Rect width="100%" height="100%" fill="url(#hero-base)" />
        <Rect width="100%" height="100%" fill="url(#hero-corner)" />
        <Rect width="100%" height="100%" fill="url(#hero-accent-wash)" />
        <Rect width="100%" height="100%" fill="url(#hero-blush)" />
        <Rect width="100%" height="100%" fill="url(#hero-stripes)" />
        <Rect width="100%" height="100%" fill="url(#hero-veil)" />
      </Svg>
    </View>
  );
}
