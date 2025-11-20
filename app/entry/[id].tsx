import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useState } from "react";
import { Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db, storage } from "../../firebase/FirebaseConfig";

const formatMDY = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const display = formatMDY(id || "");

  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return unsub;
  }, []);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!res.canceled) {
      const uris = res.assets.map(a => a.uri);
      setImages(prev => prev.concat(uris));
    }
  };

  const uploadOne = async (uri: string, index: number) => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const objectRef = ref(storage, `entries/${id}/${Date.now()}_${index}.jpg`);
    await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(objectRef);
  };

  const onSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const photoURLs = await Promise.all(images.map(uploadOne));
      await setDoc(
        doc(db, "entries", id),
        {
          id,
          title: title.trim(),
          description: markdown,
          photos: photoURLs,
          coverUrl: photoURLs[0] || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      Alert.alert("Saved", "Your entry has been saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: display || "Entry" }} />

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="A short title"
        style={styles.input}
      />

      <Text style={styles.label}>Markdown</Text>
      <TextInput
        value={markdown}
        onChangeText={setMarkdown}
        placeholder="How was your day?"
        style={[styles.input, styles.multiline]}
        multiline
      />

      <Button title="Add Photos" onPress={pickImages} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
        {images.map((uri, i) => (
          <Image key={uri + i} source={{ uri }} style={styles.thumb} />
        ))}
      </ScrollView>

      <Button title={saving ? "Saving..." : "Save"} onPress={onSave} disabled={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: "#fff",
  },
  multiline: { height: 140, textAlignVertical: "top" },
  thumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: "#e5e7eb" },
});
