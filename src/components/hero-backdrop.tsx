import { StyleSheet, View } from "react-native";
import Svg, { Defs, Line, Pattern, RadialGradient, Rect, Stop } from "react-native-svg";

export function HeroBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="hero-stripes" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <Line x1="0" y1="0" x2="0" y2="22" stroke="rgba(198,78,47,0.08)" strokeWidth="1" />
          </Pattern>
          <RadialGradient id="hero-blush" cx="70%" cy="18%" r="42%">
            <Stop offset="0" stopColor="rgba(240,201,186,0.7)" />
            <Stop offset="1" stopColor="rgba(240,201,186,0)" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="#f7ede7" />
        <Rect width="100%" height="100%" fill="url(#hero-stripes)" />
        <Rect width="100%" height="100%" fill="url(#hero-blush)" />
      </Svg>
    </View>
  );
}
