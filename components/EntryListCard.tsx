import { memo, useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatMDY, toParts } from "../hooks/useEntriesFeed";

type Props = {
  date: string;
  cover?: string | null;
  title?: string;
  onPress: () => void;
  index: number;
};

export const EntryListCard = memo(function EntryListCard({
  date,
  cover,
  title,
  onPress,
  index,
}: Props) {
  const { mo, day, yr } = toParts(date);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        delay: index * 35,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        delay: index * 35,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable style={styles.cardInner} onPress={onPress}>
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
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
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
