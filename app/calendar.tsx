import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Dimensions,
    FlatList,
    ImageBackground,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { EntryGridCell } from "../components/EntryGridCell";
import { EntryListCard } from "../components/EntryListCard";
import { db } from "../firebase/FirebaseConfig";
import { useEntriesFeed } from "../hooks/useEntriesFeed";

const { width } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = Math.floor((width - GAP * 4) / 3);
const PAGE_SIZE = 90;

// Calendar constants
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const CAL_CELL_SIZE = (width - 32) / 7;

type DayCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

type MonthDef = {
  year: number;
  monthIndex: number;
  label: string;
  key: string;
};

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const buildMonthMatrix = (year: number, monthIndex: number): DayCell[] => {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startDow = first.getUTCDay();
  const startDate = new Date(Date.UTC(year, monthIndex, 1 - startDow));

  const days: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate.getTime());
    d.setUTCDate(startDate.getUTCDate() + i);
    days.push({
      iso: toISO(d),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === monthIndex,
    });
  }
  return days;
};

const formatMonthYear = (year: number, monthIndex: number) => {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

// Only past + current months; oldest at top, current month at bottom
const buildPastMonths = (today: Date, monthsBack = 12): MonthDef[] => {
  const res: MonthDef[] = [];
  const baseYear = today.getUTCFullYear();
  const baseMonth = today.getUTCMonth();

  for (let offset = monthsBack - 1; offset >= 0; offset--) {
    const d = new Date(Date.UTC(baseYear, baseMonth - offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    res.push({
      year: y,
      monthIndex: m,
      label: formatMonthYear(y, m),
      key: `${y}-${m}`,
    });
  }
  return res;
};

export default function Index() {
  const router = useRouter();

  // feed hook for grid/list
  const {
    data,
    version,
    loadMore,
    viewabilityConfig,
    onViewableItemsChanged,
    getCover,
    getTitle,
  } = useEntriesFeed({ pageSize: PAGE_SIZE, daysWindow: 120 });

  const [viewMode, setViewMode] = useState<"calendar" | "grid" | "list">("grid");

  // jump-to-date picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  const goToDate = (date: Date) => {
    const iso = date.toISOString().slice(0, 10);
    router.push(`/entry/${iso}`);
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      if (event.type === "dismissed") {
        setShowPicker(false);
        return;
      }
      if (event.type === "set" && date) {
        setShowPicker(false);
        setPickerDate(date);
        goToDate(date);
      }
    } else {
      if (!date) return;
      setShowPicker(false);
      setPickerDate(date);
      goToDate(date);
    }
  };

  // pinch gesture: Calendar <-> Grid <-> List
  const pinchState = useRef<{ startDist?: number }>({});
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches?.length === 2,
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (!touches || touches.length < 2) return;
        const [a, b] = touches;
        const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        if (!pinchState.current.startDist) {
          pinchState.current.startDist = dist;
          return;
        }
        const delta = dist - (pinchState.current.startDist || 0);

        // zoom IN (calendar -> grid -> list)
        if (delta > 30) {
          setViewMode((m) => {
            if (m === "calendar") return "grid";
            if (m === "grid") return "list";
            return m;
          });
          pinchState.current.startDist = undefined;
        }
        // zoom OUT (list -> grid -> calendar)
        else if (delta < -30) {
          setViewMode((m) => {
            if (m === "list") return "grid";
            if (m === "grid") return "calendar";
            return m;
          });
          pinchState.current.startDist = undefined;
        }
      },
      onPanResponderRelease: () => {
        pinchState.current.startDist = undefined;
      },
      onPanResponderTerminate: () => {
        pinchState.current.startDist = undefined;
      },
    })
  ).current;

  // animated grid/list item renderer
  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) =>
      viewMode === "grid" ? (
        <EntryGridCell
          date={item}
          cover={getCover(item) ?? undefined}
          onPress={() => router.push(`/entry/${item}`)}
          size={ITEM_SIZE}
          gap={GAP}
          index={index}
        />
      ) : (
        <EntryListCard
          date={item}
          cover={getCover(item) ?? undefined}
          title={getTitle(item)}
          onPress={() => router.push(`/entry/${item}`)}
          index={index}
        />
      ),
    [viewMode, getCover, getTitle, router]
  );

  // --------- CALENDAR DATA ---------

  const today = useMemo(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }, []);
  const todayIso = toISO(today);

  // Only past + current months, oldest at top, current at bottom
  const months = useMemo(() => buildPastMonths(today, 12), [today]);

  const [calendarCovers, setCalendarCovers] = useState<Record<string, string | null>>({});

  // load all covers in the months window
  useEffect(() => {
    if (!months.length) return;
    const first = new Date(Date.UTC(months[0].year, months[0].monthIndex, 1));
    const lastMonth = months[months.length - 1];
    const afterLast = new Date(Date.UTC(lastMonth.year, lastMonth.monthIndex + 1, 1));

    const startId = toISO(first);
    const endId = toISO(new Date(afterLast.getTime() - 1)); // up to end of current month

    const q = query(
      collection(db, "entries"),
      where("id", ">=", startId),
      where("id", "<=", endId),
      orderBy("id", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const next: Record<string, string | null> = {};
      snap.forEach((doc) => {
        const d = doc.data() as any;
        const id = d.id as string;
        next[id] = d.thumbCoverUrl ?? d.coverUrl ?? null;
      });
      setCalendarCovers(next);
    });

    return () => unsub();
  }, [months]);

  const isToday = (iso: string) => iso === todayIso;

  // scroll to bottom (current month) when entering calendar view
  const calendarScrollRef = useRef<ScrollView | null>(null);
  useEffect(() => {
    if (viewMode === "calendar" && calendarScrollRef.current) {
      // slight timeout to allow layout
      setTimeout(() => {
        calendarScrollRef.current?.scrollToEnd({ animated: false });
      }, 0);
    }
  }, [viewMode]);

  // --------- HEADER VIEW BUTTON ---------

  const viewButtonLabel =
    viewMode === "calendar" ? "Grid" : viewMode === "grid" ? "List" : "Calendar";

  const cycleViewMode = () => {
    setViewMode((m) =>
      m === "calendar" ? "grid" : m === "grid" ? "list" : "calendar"
    );
  };

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Stack.Screen
        options={{
          title: "Remark",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Jump" onPress={() => setShowPicker(true)} />
              <Button title={viewButtonLabel} onPress={cycleViewMode} />
            </View>
          ),
        }}
      />

      {viewMode === "calendar" ? (
        <ScrollView
          ref={calendarScrollRef}
          style={styles.calendarScreen}
          contentContainerStyle={styles.calScrollOuter}
        >
          {months.map((month) => {
            const days = buildMonthMatrix(month.year, month.monthIndex);
            return (
              <View key={month.key} style={styles.monthBlock}>
                <Text style={styles.calMonthLabel}>{month.label}</Text>

                <View style={styles.calWeekRow}>
                  {DAYS.map((d) => (
                    <Text key={d} style={styles.calWeekday}>
                      {d}
                    </Text>
                  ))}
                </View>

                <View style={styles.calGrid}>
                  {days.map((cell) => {
                    const cover = calendarCovers[cell.iso];
                    const todayFlag = isToday(cell.iso);
                    const isFuture = cell.iso > todayIso; // disable days after today

                    const dayInnerCommon = [
                      styles.calDayInner,
                      !cell.inMonth && styles.calDayInnerOutside,
                      isFuture && styles.calFutureInner,
                    ];

                    const onPress = () => {
                      if (isFuture) return; // do nothing for future dates
                      router.push(`/entry/${cell.iso}`);
                    };

                    return (
                      <Pressable
                        key={cell.iso}
                        style={[
                          styles.calDayCell,
                          todayFlag && styles.calTodayOutline,
                        ]}
                        onPress={onPress}
                      >
                        {cover && !isFuture ? (
                          <ImageBackground
                            source={{ uri: cover }}
                            style={dayInnerCommon}
                            imageStyle={styles.calThumbImage}
                          >
                            <Text style={styles.calDayNumberOnImage}>{cell.day}</Text>
                          </ImageBackground>
                        ) : (
                          <View style={[...dayInnerCommon, styles.calNoThumbBox]}>
                            <Text
                              style={[
                                styles.calDayNumberPlain,
                                !cell.inMonth && styles.calDayNumberOutside,
                                isFuture && styles.calDayNumberFuture,
                              ]}
                            >
                              {cell.day}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <FlatList
          key={viewMode}
          data={data}
          extraData={version}
          keyExtractor={(date) => date}
          numColumns={viewMode === "grid" ? 3 : 1}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: viewMode === "grid" ? GAP : 6,
            backgroundColor: "#fff",
          }}
          removeClippedSubviews
          initialNumToRender={PAGE_SIZE}
          windowSize={7}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
        />
      )}

      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // calendar
  calendarScreen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  calScrollOuter: {
    paddingBottom: 24,
  },
  monthBlock: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  calMonthLabel: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  calWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  calWeekday: {
    width: CAL_CELL_SIZE,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
  },
  calDayCell: {
    width: CAL_CELL_SIZE,
    height: CAL_CELL_SIZE * 1.2,
    padding: 4,
  },
  calDayInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  calDayInnerOutside: {
    opacity: 0.4,
  },
  calFutureInner: {
    backgroundColor: "#f9fafb",
  },
  calThumbImage: {
    borderRadius: 10,
  },
  calNoThumbBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  calDayNumberOnImage: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  calDayNumberPlain: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  calDayNumberOutside: {
    color: "#9ca3af",
  },
  calDayNumberFuture: {
    color: "#d1d5db",
  },
  calTodayOutline: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#000",
  },
});
