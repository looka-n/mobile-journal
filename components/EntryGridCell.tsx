import { memo, useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatMDY } from "../hooks/useEntriesFeed";

type Props = {
  date: string;
  cover?: string | null;
  onPress: () => void;
  size: number;
  gap: number;
  index: number;
};

export const EntryGridCell = memo(function EntryGridCell({
  date,
  cover,
  onPress,
  size,
  gap,
  index,
}: Props) {
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
        styles.box,
        {
          width: size,
          height: size,
          margin: gap,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable style={{ flex: 1 }} onPress={onPress}>
        {cover ? <ImageBackground source={{ uri: cover }} style={styles.bg} /> : null}
        <View style={styles.datePill}>
          <Text style={styles.dateText}>{formatMDY(date)}</Text>
        </View>
      </Pressable>
    </Animated.View>
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
