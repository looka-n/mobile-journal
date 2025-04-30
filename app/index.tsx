import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format, subDays } from 'date-fns';
import { getAllEntries } from '../firebase/firestore';

const screenWidth = Dimensions.get('window').width;
const itemSize = screenWidth / 3;

interface Entry {
  id: string;
  photos: string[];
  markdownText: string;
}

const CHUNK_SIZE = 30;

export default function EntryGrid() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [daysLoaded, setDaysLoaded] = useState(0);
  const [firestoreData, setFirestoreData] = useState<Entry[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const firestore = await getAllEntries();
      setFirestoreData(firestore);
      loadMoreDates(firestore);
    };
    load();
  }, []);

  const loadMoreDates = (firestore = firestoreData) => {
    const newDates = generateDates(daysLoaded, CHUNK_SIZE);

    const newEntries = newDates.map((date) => {
      const match = firestore.find((e) => e.id === date);
      return match || { id: date, photos: [], markdownText: '' };
    });

    setEntries((prev) => [...prev, ...newEntries]);
    setDaysLoaded((prev) => prev + CHUNK_SIZE);
  };

  const generateDates = (startFrom: number, count: number): string[] => {
    const dates: string[] = [];
    for (let i = startFrom; i < startFrom + count; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dates.push(date);
    }
    return dates;
  };

  const renderItem = ({ item }: { item: Entry }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() =>
        router.push({
          pathname: '/entry/[entryId]',
          params: { entryId: item.id },
        })
      }
    >
      {item.photos?.[0] ? (
        <Image source={{ uri: item.photos[0] }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.date}>{item.id}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={entries}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={3}
      onEndReached={() => loadMoreDates()}
      onEndReachedThreshold={0.7}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    width: itemSize,
    height: itemSize,
    padding: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  date: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
  },
});