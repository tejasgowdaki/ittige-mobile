import { Image, type ImageStyle, type StyleProp } from "react-native";

export function Logo({ size, style }: { size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require("../../assets/icon.png")}
      accessibilityLabel="Ittige"
      style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
    />
  );
}
