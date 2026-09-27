import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { IconClose, IconImage, IconPlus } from "@/components/icons";
import { colors } from "@/theme";

export type PickedPhoto = { uri: string; name: string; mimeType: string };

export function PhotoPicker({
  photos,
  onChange,
  label = "Photos",
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  label?: string;
}) {
  async function add(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true });
    if (result.canceled) return;
    const next = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `photo-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
    }));
    onChange([...photos, ...next]);
  }

  function choose() {
    Alert.alert("Add photos", undefined, [
      { text: "Camera", onPress: () => void add("camera") },
      { text: "Gallery or files", onPress: () => void add("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.uri} style={styles.thumb}>
              <Image source={{ uri: photo.uri }} style={styles.image} />
              <Pressable
                accessibilityLabel={`Remove ${photo.name}`}
                style={styles.remove}
                onPress={() => onChange(photos.filter((item) => item.uri !== photo.uri))}
              >
                <IconClose size={14} color={colors.accentInk} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.tile} onPress={choose} accessibilityLabel="Add more photos">
            <IconPlus size={20} color={colors.muted} />
            <Text style={styles.tileText}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.empty} onPress={choose}>
          <View style={styles.iconBox}>
            <IconImage size={22} color={colors.accent} />
          </View>
          <Text style={styles.addTitle}>Add photos</Text>
          <Text style={styles.addHint}>Gallery or files</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted, marginBottom: 6 },
  empty: {
    minHeight: 72,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  addTitle: { fontFamily: "Mukta_700Bold", fontSize: 16, color: colors.ink },
  addHint: { fontFamily: "Mukta_400Regular", fontSize: 13, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumb: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  image: { width: "100%", height: "100%" },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(58,34,24,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tileText: { fontFamily: "Mukta_600SemiBold", fontSize: 13, color: colors.muted },
});
