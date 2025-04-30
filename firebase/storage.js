import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import uuid from 'react-native-uuid';

export async function pickImage(entryId) {
  console.log('📸 Launching image picker...');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    base64: true, // ✅ MUST be true
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.base64) {
    console.log('❌ No image picked or missing base64.');
    return null;
  }

  const asset = result.assets[0];
  const base64DataUrl = `data:image/jpeg;base64,${asset.base64}`; // ✅ make it a real data URL
  const filename = `${entryId}-${uuid.v4()}.jpg`;
  const imageRef = ref(storage, `journal_photos/${filename}`);

  try {
    console.log('☁️ Uploading as data_url...');
    await uploadString(imageRef, base64DataUrl, 'data_url'); // ✅ data_url instead of base64
    console.log('✅ Upload complete.');

    const url = await getDownloadURL(imageRef);
    console.log('✅ Download URL:', url);
    return url;
  } catch (err) {
    console.error('🔥 Upload failed:', err);
    return null;
  }
}