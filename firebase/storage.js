import { storage } from "../firebase/firebaseConfig.js";
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import uuid from 'react-native-uuid';

// TODO: TEST FUNCTION
export async function pickImage(entryId) {
  console.log('🔍 Starting image upload');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    base64: true, // ✅ required for uploadString
    allowsEditing: true,
    aspect: [4, 3],
  });

  if (result.canceled) {
    console.log('🚫 Picker canceled');
    return null;
  }

  const asset = result.assets[0];

  if (!asset.base64) {
    console.error('🚫 No base64 data returned.');
    return null;
  }

  const filename = `${entryId}-${uuid.v4()}.jpg`;
  const imageRef = ref(storage, `journal_photos/${filename}`);

  try {
    await uploadString(imageRef, asset.base64, 'base64', {
      contentType: 'image/jpeg',
    });

    console.log('☁️ Uploaded to Firebase Storage');
    const url = await getDownloadURL(imageRef);
    console.log('✅ Download URL:', url);
    return url;
  } catch (err) {
    console.error('💥 Upload failed:', err);
    return null;
  }
}