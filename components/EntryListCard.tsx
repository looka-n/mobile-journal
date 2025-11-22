import { memo } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { formatMDY, toParts } from "../hooks/useEntriesFeed";

export const EntryListCard = memo(function EntryListCard({
  date,
  cover,
  title,
  onPress,
}: {
  date: string;
  cover?: string | null;
  title?: string;
  onPress: () => void;
}) {
  const { mo, day, yr } = toParts(date);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.coverWrap}>
        {cover ? (
          <ImageBackground source={{ uri: cover }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: "#e5e7eb" }]} />
        )}
        <View style={styles.dateOverlay}>
          <Text style={styles.dateMo}>{mo}</Text>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateYr}>{yr}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text numberOfLines={2} style={styles.title}>
          {title?.trim() || "Untitled"}
        </Text>
        <Text style={styles.sub}>{formatMDY(date)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  coverWrap: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  cover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  } as any,
  dateOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dateMo: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  dateDay: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 26 },
  dateYr: { color: "#fff", fontSize: 10, fontWeight: "700", opacity: 0.95 },
  right: { flex: 1, justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "600", color: "#111827" },
  sub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});