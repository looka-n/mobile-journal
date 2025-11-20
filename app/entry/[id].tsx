import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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

  // mode
  const [isEditing, setIsEditing] = useState(false);

  // remote doc
  const [loaded, setLoaded] = useState(false);
  const [remoteTitle, setRemoteTitle] = useState<string>("");
  const [remoteDesc, setRemoteDesc] = useState<string>("");
  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [remoteCover, setRemoteCover] = useState<string | null>(null);

  // draft (write mode)
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [newImages, setNewImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // ensure anonymous auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return unsub;
  }, []);

  // load doc once
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      const snap = await getDoc(doc(db, "entries", id));
      if (!mounted) return;
      if (snap.exists()) {
        const d = snap.data() as any;
        setRemoteTitle(d.title || "");
        setRemoteDesc(d.description || "");
        setRemotePhotos(Array.isArray(d.photos) ? d.photos : []);
        setRemoteCover(d.coverUrl || null);
        // seed editor with current values
        setTitle(d.title || "");
        setMarkdown(d.description || "");
      } else {
        // new entry defaults
        setRemoteTitle("");
        setRemoteDesc("");
        setRemotePhotos([]);
        setRemoteCover(null);
        setTitle("");
        setMarkdown("");
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // header buttons
  useLayoutEffect(() => {
    // Show Edit/Cancel in header
    // (Stack.Screen is still used for the title)
  }, [isEditing]);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
      mediaTypes: ["images"], // current API
    });
    if (!res.canceled) {
      const uris = res.assets.map((a) => a.uri);
      setNewImages((prev) => prev.concat(uris));
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
      const newURLs = await Promise.all(newImages.map(uploadOne));

      // append new photos to existing ones
      const mergedPhotos = newURLs.length ? [...remotePhotos, ...newURLs] : remotePhotos;

      const payload: any = {
        id,
        title: title.trim(),
        description: markdown,
        updatedAt: serverTimestamp(),
      };

      if (newURLs.length) {
        payload.photos = mergedPhotos;
        // keep existing cover; if none, set to first photo
        payload.coverUrl = remoteCover ?? mergedPhotos[0] ?? null;
      }

      await setDoc(doc(db, "entries", id), payload, { merge: true });

      // reflect saved state locally
      setRemoteTitle(payload.title);
      setRemoteDesc(payload.description);
      if (newURLs.length) {
        setRemotePhotos(mergedPhotos);
        setRemoteCover(payload.coverUrl ?? remoteCover);
        setNewImages([]);
      }

      setIsEditing(false);
      Alert.alert("Saved", "Your entry has been saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const displayPhotos = useMemo(
    () => (isEditing ? [...remotePhotos, ...newImages] : remotePhotos),
    [isEditing, remotePhotos, newImages]
  );

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: display || "Entry" }} />
        <Text style={{ opacity: 0.6 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: display || "Entry",
          headerRight: () =>
            isEditing ? (
              <Button title="Cancel" onPress={() => setIsEditing(false)} />
            ) : (
              <Button title="Edit" onPress={() => setIsEditing(true)} />
            ),
        }}
      />

      {/* READ MODE */}
      {!isEditing && (
        <View style={{ gap: 12 }}>
          <Text style={styles.title}>{remoteTitle || "Untitled"}</Text>
          <Text style={styles.body}>{remoteDesc || ""}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {remotePhotos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.image} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* WRITE MODE */}
      {isEditing && (
        <View style={{ gap: 10 }}>
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
            {displayPhotos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.thumb} />
            ))}
          </ScrollView>

          <Button title={saving ? "Saving..." : "Save"} onPress={onSave} disabled={saving} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22, color: "#111827" },
  label: { fontSize: 12, fontWeight: "600", color: "#374151" },
  input: {
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: "#fff",
  },
  multiline: { height: 140, textAlignVertical: "top" },
  image: { width: 200, height: 200, borderRadius: 12, marginRight: 10, backgroundColor: "#e5e7eb" },
  thumb: { width: 100, height: 100, borderRadius: 8, marginRight: 8, backgroundColor: "#e5e7eb" },
});