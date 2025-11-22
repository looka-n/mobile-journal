import { memo } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { formatMDY } from "../hooks/useEntriesFeed";

export const EntryGridCell = memo(function EntryGridCell({
  date,
  cover,
  onPress,
  size,
  gap,
}: {
  date: string;
  cover?: string | null;
  onPress: () => void;
  size: number;
  gap: number;
}) {
  return (
    <Pressable style={[styles.box, { width: size, height: size, margin: gap }]} onPress={onPress}>
      {cover ? <ImageBackground source={{ uri: cover }} style={styles.bg} /> : null}
      <View style={styles.datePill}>
        <Text style={styles.dateText}>{formatMDY(date)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  bg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" } as any,
  datePill: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
  },
  dateText: { color: "#fff", fontSize: 10, fontWeight: "600" },
});