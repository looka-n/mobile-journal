import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Button,
  Dimensions,
  FlatList,
  PanResponder,
  Platform,
  View,
} from "react-native";
import { EntryGridCell } from "../components/EntryGridCell";
import { EntryListCard } from "../components/EntryListCard";
import { useEntriesFeed } from "../hooks/useEntriesFeed";

const { width } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = Math.floor((width - GAP * 4) / 3);
const PAGE_SIZE = 90;

export default function Index() {
  const router = useRouter();

  const {
    data,
    version,
    loadMore,
    viewabilityConfig,
    onViewableItemsChanged,
    getCover,
    getTitle,
  } = useEntriesFeed({ pageSize: PAGE_SIZE, daysWindow: 120 });

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // jump-to-date picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  const goToDate = (date: Date) => {
    // Normalized ISO YYYY-MM-DD
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
      // iOS: treat selection as final for now
      if (!date) return;
      setShowPicker(false);
      setPickerDate(date);
      goToDate(date);
    }
  };

  // Pinch gesture to toggle grid/list
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
        if (delta > 30 && viewMode === "grid") {
          setViewMode("list");
          pinchState.current.startDist = undefined;
        } else if (delta < -30 && viewMode === "list") {
          setViewMode("grid");
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

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Stack.Screen
        options={{
          title: "Remark",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Jump" onPress={() => setShowPicker(true)} />
              <Button
                title={viewMode === "grid" ? "List" : "Grid"}
                onPress={() =>
                  setViewMode((m) => (m === "grid" ? "list" : "grid"))
                }
              />
            </View>
          ),
        }}
      />

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
