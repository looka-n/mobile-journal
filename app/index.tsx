import { Stack, useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button, Dimensions, FlatList, ImageBackground, Pressable, StyleSheet, Text, View, ViewToken } from "react-native";
import { db } from "../firebase/FirebaseConfig";

const { width } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = Math.floor((width - GAP * 4) / 3);
const PAGE_SIZE = 90;
const DAYS_WINDOW = 120;

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

const DateCell = memo(function DateCell({
  date,
  cover,
  onPress,
}: {
  date: string;
  cover: string | null | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.box} onPress={onPress}>
      {cover ? <ImageBackground source={{ uri: cover }} style={styles.bg} /> : null}
      <View style={styles.datePill}>
        <Text style={styles.dateText}>{formatMDY(date)}</Text>
      </View>
    </Pressable>
  );
});

export default function Index() {
  const router = useRouter();
  const [dates, setDates] = useState<string[]>([]);
  const [showRealOnly, setShowRealOnly] = useState(false);
  const [version, setVersion] = useState(0); // bump to refresh cells

  const startDateRef = useRef<Date>(utcToday());
  const loadedPagesRef = useRef(0);
  const coverCache = useRef(new Map<string, string | null>());
  const existsCache = useRef(new Map<string, boolean>());

  const ensureLoaded = useCallback(async (date: string) => {
    if (existsCache.current.has(date)) return; // already known
    try {
      const snap = await getDoc(doc(db, "entries", date));
      const exists = snap.exists();
      existsCache.current.set(date, exists);
      coverCache.current.set(
        date,
        exists ? ((snap.data() as any).coverUrl ?? null) : null
      );
      setVersion((v) => v + 1);
    } catch (err) {
      console.warn("ensureLoaded failed for", date, err);
    }
  }, []);

  // Seed infinite list
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

  // Realtime listener for recent entries (today .. today-DAYS_WINDOW)
  useEffect(() => {
    const today = startDateRef.current;
    const todayId = toISODate(today);
    const startId = toISODate(daysAgoUTC(today, DAYS_WINDOW - 1));

    const q = query(
      collection(db, "entries"),
      where("id", ">=", startId),
      where("id", "<=", todayId),
      orderBy("id", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      let changed = false;
      snap.docChanges().forEach((ch) => {
        const d = ch.doc.data() as any;
        const id = d.id as string;
        if (ch.type === "removed") {
          if (existsCache.current.has(id)) {
            existsCache.current.delete(id);
            coverCache.current.delete(id);
            changed = true;
          }
        } else {
          existsCache.current.set(id, true);
          coverCache.current.set(id, d.coverUrl ?? null);
          changed = true;
        }
      });
      if (changed) setVersion((v) => v + 1);
    });

    return () => unsub();
  }, []);

  const data = showRealOnly
    ? dates.filter((d) => existsCache.current.get(d) === true)
    : dates;

  const renderItem = ({ item }: { item: string }) => (
    <DateCell
      date={item}
      cover={coverCache.current.get(item)}
      onPress={() => router.push(`/entry/${item}`)}
    />
  );

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      for (const v of viewableItems) ensureLoaded(v.item as string);
    }
  ).current;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: "Remark",
          headerRight: () => (
            <Button title={showRealOnly ? "All" : "Real"} onPress={() => setShowRealOnly((s) => !s)} />
          ),
        }}
      />
      <FlatList
        extraData={version + (showRealOnly ? 1 : 0)}
        data={data}
        keyExtractor={(date) => date}
        numColumns={3}
        renderItem={renderItem}
        contentContainerStyle={styles.container}
        removeClippedSubviews
        initialNumToRender={PAGE_SIZE}
        windowSize={7}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
      />
    </View>
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