import React, { useEffect, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEntry, saveEntry } from '../../firebase/firestore';
import Markdown from 'react-native-markdown-display';
import ImageCarousel from '../../components/ImageCarousel';
import EntryStyles from '../../styles/EntryStyles';
import { markdownStyles } from '../../styles/MarkdownStyles';
import { pickImage } from '../../firebase/storage';
import { Feather } from '@expo/vector-icons';

export default function EntryScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();

  const [photos, setPhotos] = useState<string[]>([]);
  const [entryText, setEntryText] = useState('Loading...');
  const [isEditing, setIsEditing] = useState(false);

  const handleAddPhoto = async () => {
    if (!entryId) return;
    const url = await pickImage(entryId);
    if (!url) return;
    console.log('URL:', url);
    const newPhotos = [...photos, url];
    setPhotos(newPhotos);
    await saveEntry(entryId, newPhotos, entryText);
  };

  useEffect(() => {
    if (!entryId) return;
    const loadEntry = async () => {
      const entry = await getEntry(entryId);
      if (entry) {
        setEntryText(entry.markdownText);
        setPhotos(entry.photos || []);
      } else {
        setEntryText('No entry found.');
      }
    };
    loadEntry();
  }, [entryId]);

  return (
    <ScrollView>
      <View style={EntryStyles.photoContainer}>
        <ImageCarousel images={photos} />
      </View>

    {/* <View style={{ alignItems: 'flex-end', margin: 16 }}>
    <TouchableOpacity
        onPress={() => {
        if (isEditing && entryId) {
            saveEntry(entryId, photos, entryText);
        }
        setIsEditing(!isEditing);
        }}
        style={EntryStyles.editIcon}
    >
        <Feather name={isEditing ? 'check' : 'edit-3'} size={24} color="#444" />
    </TouchableOpacity>
    </View> */}

    <TouchableOpacity onPress={handleAddPhoto} style={{ marginTop: 12, alignSelf: 'flex-end', marginRight: 16 }}>
        <Feather name="image" size={24} color="#444" />
    </TouchableOpacity>

      <View style={EntryStyles.markdownContainer}>
        {isEditing ? (
          <TextInput
            multiline
            value={entryText}
            onChangeText={setEntryText}
            style={{
              fontSize: 16,
              padding: 12,
              textAlignVertical: 'top',
              minHeight: 200,
              fontFamily: 'Georgia',
              color: '#333',
            }}
          />
        ) : (
          <Markdown style={markdownStyles}>{entryText}</Markdown>
        )}
      </View>
    </ScrollView>
  );
}