import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

const shiftISO = (iso: string, deltaDays: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
};

type DraftPhoto = { uri: string; isNew: boolean };

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [currentId, setCurrentId] = useState(id!);
  const display = formatMDY(currentId || "");

  const [isEditing, setIsEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [remoteTitle, setRemoteTitle] = useState("");
  const [remoteDesc, setRemoteDesc] = useState("");
  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [remoteCover, setRemoteCover] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const SWIPE_PX = 60;
  const SWIPE_VX = 0.25;

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !isEditing && Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),

    onPanResponderRelease: (_, g) => {
      if (isEditing || !currentId) return;
      const goPrev = g.dx <= -SWIPE_PX || g.vx <= -SWIPE_VX;
      const goNext = g.dx >= SWIPE_PX || g.vx >= SWIPE_VX;
      if (goPrev) setCurrentId(shiftISO(currentId, -1));
      else if (goNext) setCurrentId(shiftISO(currentId, +1));
    },
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) signInAnonymously(auth).catch(() => {});
    });
    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!currentId) return;
      setLoaded(false);
      const snap = await getDoc(doc(db, "entries", currentId));
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
  }, [currentId]);

  useEffect(() => setActive(0), [currentId]);
  useEffect(() => setActive(0), [remotePhotos.length]);

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
    const objectRef = ref(storage, `entries/${currentId}/${Date.now()}_${index}.jpg`);
    await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
    return await getDownloadURL(objectRef);
  };

  const deleteRemovedBlobs = async (oldUrls: string[], newUrls: string[]) => {
    const removed = oldUrls.filter((u) => !newUrls.includes(u));
    if (!removed.length) return;
    await Promise.allSettled(
      removed.map(async (url) => {
        try {
          const r = ref(storage, url);
          await deleteObject(r);
        } catch (err) {
          console.warn("Delete failed for", url, err);
        }
      })
    );
  };

  const onSave = async () => {
    if (!currentId) return;
    try {
      setSaving(true);
      const newUris = draftPhotos.filter((p) => p.isNew).map((p) => p.uri);
      const uploaded = await Promise.all(newUris.map(uploadOne));
      let upIdx = 0;
      const finalPhotos = draftPhotos.map((p) => (p.isNew ? uploaded[upIdx++] : p.uri));

      let nextCover: string | null = remoteCover;
      if (!nextCover || !finalPhotos.includes(nextCover)) nextCover = finalPhotos[0] ?? null;

      const payload: any = {
        id: currentId,
        title: title.trim(),
        description: markdown,
        photos: finalPhotos,
        coverUrl: nextCover,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "entries", currentId), payload, { merge: true });

      await deleteRemovedBlobs(remotePhotos, finalPhotos);

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
    <View style={styles.container} {...responder.panHandlers}>
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
        <View style={{ gap: 12 }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
            style={styles.titleInput}
            placeholderTextColor="#9ca3af"
          />
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
          </View>
          {!!displayPhotos.length && (
            <>
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
                {displayPhotos.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{ width: CAROUSEL_W, height: CAROUSEL_H, borderRadius: 12, backgroundColor: "#e5e7eb" }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {displayPhotos.length > 1 && (
                <View style={styles.dotsWrap}>
                  {displayPhotos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginVertical: 12 }}
            contentContainerStyle={{ alignItems: "center" }}
          >
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
            <Pressable style={styles.cameraTile} onPress={pickImages}>
              <Text style={{ fontSize: 28, color: "#6b7280" }}>📷</Text>
            </Pressable>
          </ScrollView>
          <View style={styles.tabBar}>
            <Pressable onPress={() => setShowPreview(false)} style={[styles.tab, !showPreview && styles.tabActive]}>
              <Text style={[styles.tabText, !showPreview && styles.tabTextActive]}>Write</Text>
            </Pressable>
            <Pressable onPress={() => setShowPreview(true)} style={[styles.tab, showPreview && styles.tabActive]}>
              <Text style={[styles.tabText, showPreview && styles.tabTextActive]}>Preview</Text>
            </Pressable>
          </View>
          {!showPreview ? (
            <TextInput
              value={markdown}
              onChangeText={setMarkdown}
              placeholder="How was your day?"
              style={[styles.input, styles.multiline]}
              multiline
            />
          ) : (
            <Markdown style={markdownStyles}>{markdown || "_Nothing yet..._"}</Markdown>
          )}
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
  cameraTile: {
    width: 120,
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
  },
  tabBar: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabText: { color: "#6b7280", fontWeight: "600" },
  tabTextActive: { color: "#111827" },
});

const markdownStyles: Record<string, any> = {
  body: { fontSize: 16, color: "#111827", lineHeight: 22 },
  heading1: { fontSize: 24, fontWeight: "700", marginVertical: 8 },
  heading2: { fontSize: 20, fontWeight: "700", marginVertical: 6 },
  link: { color: "#2563eb" },
  list_item: { flexDirection: "row", alignItems: "flex-start" },
  code_inline: {
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: "monospace",
  },
};