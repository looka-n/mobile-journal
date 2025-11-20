import { Stack, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Button, Dimensions, FlatList, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { db } from "../firebase/FirebaseConfig";

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

const DateCell = memo(function DateCell({
  date,
  onPress,
  coverCache,
  existCallback,
}: {
  date: string;
  onPress: () => void;
  coverCache: React.MutableRefObject<Map<string, string | null>>;
  existCallback: (date: string, exists: boolean) => void;
}) {
  const [cover, setCover] = useState<string | null | undefined>(coverCache.current.get(date));

  useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await getDoc(doc(db, "entries", date));
      const exists = snap.exists();
      existCallback(date, exists);
      const url = exists ? ((snap.data() as any).coverUrl ?? null) : null;
      coverCache.current.set(date, url);
      if (mounted) setCover(url);
    })();
    return () => {
      mounted = false;
    };
  }, [date, coverCache, existCallback]);

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
  const [version, setVersion] = useState(0);

  const startDateRef = useRef<Date>(utcToday());
  const loadedPagesRef = useRef(0);
  const coverCache = useRef(new Map<string, string | null>());
  const existsCache = useRef(new Map<string, boolean>());

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

  const onExistKnown = useCallback((date: string, exists: boolean) => {
    if (existsCache.current.get(date) !== exists) {
      existsCache.current.set(date, exists);
      setVersion((v) => v + 1);
    }
  }, []);

  const data = showRealOnly ? dates.filter((d) => existsCache.current.get(d) === true) : dates;

  const renderItem = ({ item }: { item: string }) => (
    <DateCell
      date={item}
      coverCache={coverCache}
      existCallback={onExistKnown}
      onPress={() => router.push(`/entry/${item}`)}
    />
  );

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