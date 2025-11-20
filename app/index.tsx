import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

const { width } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = Math.floor((width - GAP * 4) / 3);
const PAGE_SIZE = 90;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const utcToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const daysAgoUTC = (start: Date, n: number) => {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const formatMDY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

export default function Index() {
  const router = useRouter();
  const [dates, setDates] = useState<string[]>([]);
  const startDateRef = useRef<Date>(utcToday());
  const loadedPagesRef = useRef(0);

  const seedPage = useCallback((pageIndex: number) => {
    const startOffset = pageIndex * PAGE_SIZE;
    const next: string[] = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      const d = daysAgoUTC(startDateRef.current, startOffset + i);
      next.push(toISODate(d));
    }
    return next;
  }, []);

  const loadMore = useCallback(() => {
    const page = loadedPagesRef.current + 1;
    const next = seedPage(page);
    loadedPagesRef.current = page;
    setDates((prev) => prev.concat(next));
  }, [seedPage]);

  useEffect(() => {
    setDates(seedPage(0));
    loadedPagesRef.current = 0;
  }, [seedPage]);

  const renderItem = ({ item }: { item: string }) => (
    <Pressable style={styles.box} onPress={() => router.push(`/entry/${item}`)}>
      <View style={styles.datePill}>
        <Text style={styles.dateText}>{formatMDY(item)}</Text>
      </View>
    </Pressable>
  );

  return (
    <FlatList
      data={dates}
      keyExtractor={(date) => date}
      numColumns={3}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
      removeClippedSubviews
      initialNumToRender={PAGE_SIZE}
      windowSize={7}
      onEndReached={loadMore}
      onEndReachedThreshold={0.2}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: GAP, backgroundColor: "#fff" },
  box: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
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
