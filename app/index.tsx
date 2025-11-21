import { Stack, useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dimensions,
  FlatList,
  ImageBackground,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
const toParts = (iso: string) => {
  const dt = new Date(iso + "T00:00:00Z");
  const mo = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const day = dt.getUTCDate().toString().padStart(2, "0");
  const yr = dt.getUTCFullYear().toString();
  return { mo, day, yr };
};

/* ---------- Cells ---------- */

const GridCell = memo(function GridCell({
  date,
  cover,
  onPress,
}: {
  date: string;
  cover: string | null | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.gridBox} onPress={onPress}>
      {cover ? <ImageBackground source={{ uri: cover }} style={styles.bg} /> : null}
      <View style={styles.gridDatePill}>
        <Text style={styles.gridDateText}>{formatMDY(date)}</Text>
      </View>
    </Pressable>
  );
});

const ListCell = memo(function ListCell({
  date,
  cover,
  title,
  onPress,
}: {
  date: string;
  cover: string | null | undefined;
  title: string | undefined;
  onPress: () => void;
}) {
  const { mo, day, yr } = toParts(date);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardCoverWrap}>
        {cover ? (
          <ImageBackground source={{ uri: cover }} style={styles.cardCover} />
        ) : (
          <View style={[styles.cardCover, { backgroundColor: "#e5e7eb" }]} />
        )}
        <View style={styles.dateOverlay}>
          <Text style={styles.dateMo}>{mo}</Text>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateYr}>{yr}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {title?.trim() || "Untitled"}
        </Text>
        <Text style={styles.cardSub}>{formatMDY(date)}</Text>
      </View>
    </Pressable>
  );
});

/* ---------- Screen ---------- */

export default function Index() {
  const router = useRouter();

  // Infinite date list
  const [dates, setDates] = useState<string[]>([]);
  const startDateRef = useRef<Date>(utcToday());
  const loadedPagesRef = useRef(0);

  // Realtime caches
  const coverCache = useRef(new Map<string, string | null>());
  const titleCache = useRef(new Map<string, string | undefined>());
  const existsCache = useRef(new Map<string, boolean>());

  // UI state
  const [showRealOnly, setShowRealOnly] = useState(false);
  const [version, setVersion] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  // Realtime listener for recent window
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
            titleCache.current.delete(id);
            changed = true;
          }
        } else {
          existsCache.current.set(id, true);
          coverCache.current.set(id, d.coverUrl ?? null);
          titleCache.current.set(id, d.title ?? "");
          changed = true;
        }
      });
      if (changed) setVersion((v) => v + 1);
    });

    return () => unsub();
  }, []);

  // Lazy load for out-of-window on view
  const ensureLoaded = useCallback(async (date: string) => {
    if (existsCache.current.has(date)) return;
    const snap = await getDoc(doc(db, "entries", date));
    const exists = snap.exists();
    existsCache.current.set(date, exists);
    if (exists) {
      const d = snap.data() as any;
      coverCache.current.set(date, d.coverUrl ?? null);
      titleCache.current.set(date, d.title ?? "");
    } else {
      coverCache.current.set(date, null);
      titleCache.current.set(date, "");
    }
    setVersion((v) => v + 1);
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    for (const v of viewableItems) ensureLoaded(v.item as string);
  }).current;

  // Data according to toggle
  const data = showRealOnly ? dates.filter((d) => existsCache.current.get(d) === true) : dates;

  // Gesture: pinch to toggle grid/list
  const pinchState = useRef<{ startDist?: number } | null>({ startDist: undefined });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches?.length === 2,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;
        const [a, b] = touches;
        const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

        if (!pinchState.current?.startDist) {
          pinchState.current = { startDist: dist };
          return;
        }
        const delta = dist - (pinchState.current.startDist || 0);

        if (delta > 30 && viewMode === "grid") {
          setViewMode("list");
          pinchState.current = { startDist: undefined };
        } else if (delta < -30 && viewMode === "list") {
          setViewMode("grid");
          pinchState.current = { startDist: undefined };
        }
      },
      onPanResponderRelease: () => {
        pinchState.current = { startDist: undefined };
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => {
        pinchState.current = { startDist: undefined };
      },
    })
  ).current;

  const renderItem = ({ item }: { item: string }) =>
    viewMode === "grid" ? (
      <GridCell
        date={item}
        cover={coverCache.current.get(item)}
        onPress={() => router.push(`/entry/${item}`)}
      />
    ) : (
      <ListCell
        date={item}
        cover={coverCache.current.get(item)}
        title={titleCache.current.get(item)}
        onPress={() => router.push(`/entry/${item}`)}
      />
    );

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Stack.Screen
        options={{
          title: "Remark",
          headerRight: () => (
            <Button
              title={viewMode === "grid" ? "List" : "Grid"}
              onPress={() => setViewMode((m) => (m === "grid" ? "list" : "grid"))}
            />
          ),
        }}
      />
      <FlatList
        key={viewMode} // <— force remount when numColumns changes
        extraData={version + (showRealOnly ? 1 : 0)}
        data={data}
        keyExtractor={(date) => date}
        numColumns={viewMode === "grid" ? 3 : 1}
        renderItem={renderItem}
        contentContainerStyle={viewMode === "grid" ? styles.gridContainer : styles.listContainer}
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

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  /* grid */
  gridContainer: { padding: GAP, backgroundColor: "#fff" },
  gridBox: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: GAP,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  bg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover" } as any,
  gridDatePill: {
    position: "absolute",
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
  },
  gridDateText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  /* list */
  listContainer: { backgroundColor: "#fff", paddingVertical: 6 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  cardCoverWrap: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  cardCover: {
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
  cardRight: { flex: 1, justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});