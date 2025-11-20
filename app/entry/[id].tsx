import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Markdown from "react-native-markdown-display";
import { auth, db, storage } from "../../firebase/FirebaseConfig";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_W = SCREEN_WIDTH - 32;
const CAROUSEL_H = 360;

const formatMDY = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

type DraftPhoto = { uri: string; isNew: boolean };

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const display = formatMDY(id || "");

  const [isEditing, setIsEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [remoteTitle, setRemoteTitle] = useState("");
  const [remoteDesc, setRemoteDesc] = useState("");
  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [remoteCover, setRemoteCover] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return unsub;
  }, []);

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
      } else {
        setRemoteTitle("");
        setRemoteDesc("");
        setRemotePhotos([]);
        setRemoteCover(null);
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (isEditing) {
      setTitle(remoteTitle);
      setMarkdown(remoteDesc);
      setDraftPhotos(remotePhotos.map((u) => ({ uri: u, isNew: false })));
    }
  }, [isEditing, remoteTitle, remoteDesc, remotePhotos]);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.9,
      mediaTypes: ["images"],
    });
    if (!res.canceled) {
      const newOnes = res.assets.map((a) => ({ uri: a.uri, isNew: true } as DraftPhoto));
      setDraftPhotos((prev) => prev.concat(newOnes));
    }
  };

  const uploadOne = async (uri: string, index: number) => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const objectRef = ref(storage, `entries/${id}/${Date.now()}_${index}.jpg`);
    await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(objectRef);
  };

  const deleteRemovedBlobs = async (oldUrls: string[], newUrls: string[]) => {
    const removed = oldUrls.filter((u) => !newUrls.includes(u));
    if (!removed.length) return;
    // Best-effort deletes; don’t block the save if one fails
    await Promise.allSettled(
      removed.map(async (url) => {
        try {
          // ref(...) accepts Storage paths and download URLs
          const r = ref(storage, url);
          await deleteObject(r);
        } catch (err) {
          console.warn("Delete failed for", url, err);
        }
      })
    );
  };

  const onSave = async () => {
    if (!id) return;
    try {
      setSaving(true);

      // Upload new photos; preserve current draft order
      const newUris = draftPhotos.filter((p) => p.isNew).map((p) => p.uri);
      const uploaded = await Promise.all(newUris.map(uploadOne));
      let upIdx = 0;
      const finalPhotos = draftPhotos.map((p) => (p.isNew ? uploaded[upIdx++] : p.uri));

      // Cover: keep if still present; else first or null
      let nextCover: string | null = remoteCover;
      if (!nextCover || !finalPhotos.includes(nextCover)) nextCover = finalPhotos[0] ?? null;

      // Write Firestore first
      const payload: any = {
        id,
        title: title.trim(),
        description: markdown,
        photos: finalPhotos,
        coverUrl: nextCover,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "entries", id), payload, { merge: true });

      // Then clean up removed blobs (best-effort)
      await deleteRemovedBlobs(remotePhotos, finalPhotos);

      // Reflect saved state locally
      setRemoteTitle(payload.title);
      setRemoteDesc(payload.description);
      setRemotePhotos(finalPhotos);
      setRemoteCover(nextCover);

      setIsEditing(false);
      Alert.alert("Saved", "Your entry has been saved.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const displayPhotos = useMemo(
    () => (isEditing ? draftPhotos.map((p) => p.uri) : remotePhotos),
    [isEditing, draftPhotos, remotePhotos]
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
          headerRight: () => (
            isEditing ? <Button title="Cancel" onPress={() => setIsEditing(false)} /> : <Button title="Edit" onPress={() => setIsEditing(true)} />
          ),
        }}
      />

      {!isEditing && (
        <View style={{ gap: 12 }}>
          <Text style={styles.title}>{remoteTitle || "Untitled"}</Text>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_W);
              if (i !== active) setActive(i);
            }}
            scrollEventThrottle={16}
            style={{ width: CAROUSEL_W, height: CAROUSEL_H, alignSelf: "center" }}
          >
            {remotePhotos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: CAROUSEL_W, height: CAROUSEL_H, borderRadius: 12, backgroundColor: "#e5e7eb" }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {remotePhotos.length > 1 && (
            <View style={styles.dotsWrap}>
              {remotePhotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
              ))}
            </View>
          )}

          <Markdown style={markdownStyles}>{remoteDesc || ""}</Markdown>
        </View>
      )}

      {isEditing && (
        <View style={{ gap: 10 }}>
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="A short title" style={styles.input} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
            {draftPhotos.map((p, i) => (
              <View key={p.uri + i} style={styles.editThumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.editThumb} />
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => setDraftPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Text style={styles.removeTxt}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Button title="Add Photos" onPress={pickImages} />

          <Text style={styles.label}>Markdown</Text>
          <TextInput
            value={markdown}
            onChangeText={setMarkdown}
            placeholder="How was your day?"
            style={[styles.input, styles.multiline]}
            multiline
          />

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
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  multiline: { height: 140, textAlignVertical: "top" },

  dotsWrap: { flexDirection: "row", alignSelf: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#d1d5db" },
  dotActive: { backgroundColor: "#111827" },

  image: { width: 200, height: 200, borderRadius: 12, marginRight: 10, backgroundColor: "#e5e7eb" },

  editThumbWrap: { marginRight: 10, width: 120, height: 120 },
  editThumb: { width: 120, height: 120, borderRadius: 10, backgroundColor: "#e5e7eb" },

  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.50)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  removeTxt: { color: "#fff", fontWeight: "700", lineHeight: 16 },

  dividerContainer: { paddingBottom: 20 },
  divider: { height: 2, backgroundColor: "#d1d5db", width: "90%", borderRadius: 1 },
});

const markdownStyles: Record<string, any> = {
  body: { fontSize: 16, color: "#111827", lineHeight: 22 },
  heading1: { fontSize: 24, fontWeight: "700", marginVertical: 8 },
  heading2: { fontSize: 20, fontWeight: "700", marginVertical: 6 },
  link: { color: "#2563eb" },
  list_item: { flexDirection: "row", alignItems: "flex-start" },
  code_inline: { backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 4, fontFamily: "monospace" },
};