import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, { RenderItemParams } from "react-native-draggable-flatlist";
import Markdown from "react-native-markdown-display";
import { auth, db, storage } from "../../firebase/FirebaseConfig";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_W = SCREEN_WIDTH;
const CAROUSEL_H = 360;

const formatMDY = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
};

type DraftPhoto = { uri: string; isNew: boolean };

export default function EntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentId = id!;
  const display = formatMDY(currentId);

  const [isEditing, setIsEditing] = useState(false);
  const [remoteTitle, setRemoteTitle] = useState("");
  const [remoteDesc, setRemoteDesc] = useState("");
  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [remoteCover, setRemoteCover] = useState<string | null>(null);
  const [remoteThumbCover, setRemoteThumbCover] = useState<string | null>(null);
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
    (async () => {
      const snap = await getDoc(doc(db, "entries", currentId));
      if (snap.exists()) {
        const d = snap.data() as any;
        setRemoteTitle(d.title || "");
        setRemoteDesc(d.description || "");
        setRemotePhotos(Array.isArray(d.photos) ? d.photos : []);
        setRemoteCover(d.coverUrl || null);
        setRemoteThumbCover(d.thumbCoverUrl || null);
      } else {
        setRemoteTitle("");
        setRemoteDesc("");
        setRemotePhotos([]);
        setRemoteCover(null);
        setRemoteThumbCover(null);
      }
    })();
  }, [currentId]);

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
      Alert.alert("Permission needed", "Allow access to photos.");
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
    const basePath = `entries/${currentId}/${Date.now()}_${index}`;
    const fullRef = ref(storage, `${basePath}.jpg`);
    await uploadBytes(fullRef, blob, { contentType: "image/jpeg" });
    const fullUrl = await getDownloadURL(fullRef);

    const manip = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    const thumbResp = await fetch(manip.uri);
    const thumbBlob = await thumbResp.blob();
    const thumbRef = ref(storage, `${basePath}_thumb.jpg`);
    await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
    const thumbUrl = await getDownloadURL(thumbRef);

    return { fullUrl, thumbUrl };
  };

  const deleteRemovedBlobs = async (oldUrls: string[], newUrls: string[]) => {
    const removed = oldUrls.filter((u) => !newUrls.includes(u));
    if (!removed.length) return;
    await Promise.allSettled(
      removed.map(async (url) => {
        try {
          await deleteObject(ref(storage, url));
        } catch {}
      })
    );
  };

  const onSave = async () => {
    try {
      setSaving(true);

      const newDrafts = draftPhotos.filter((p) => p.isNew);
      const uploaded = await Promise.all(newDrafts.map((p, idx) => uploadOne(p.uri, idx)));

      let upIdx = 0;
      const finalPhotos = draftPhotos.map((p) =>
        p.isNew ? uploaded[upIdx++].fullUrl : p.uri
      );

      // ✅ First image is ALWAYS the cover
      const nextCover: string | null = finalPhotos[0] ?? null;

      // ✅ Thumbnail is tied to that same first image
      let nextThumbCover: string | null = null;
      if (nextCover) {
        // first draft photo corresponds to first final photo
        const coverDraft = draftPhotos[0];

        if (coverDraft?.isNew) {
          // find its uploaded thumb
          const newIdx = newDrafts.indexOf(coverDraft);
          if (newIdx >= 0) {
            nextThumbCover = uploaded[newIdx].thumbUrl;
          }
        } else if (remoteCover === nextCover) {
          // same cover as before → reuse existing thumb if we have one
          nextThumbCover = remoteThumbCover ?? null;
        } else {
          // cover changed to a different existing photo → drop thumb
          // feed will fall back to full cover image (which is correct)
          nextThumbCover = null;
        }
      }

      const payload = {
        id: currentId,
        title: title.trim(),
        description: markdown,
        photos: finalPhotos,
        coverUrl: nextCover,
        thumbCoverUrl: nextThumbCover ?? null,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "entries", currentId), payload, { merge: true });

      await deleteRemovedBlobs(remotePhotos, finalPhotos);

      setRemoteTitle(payload.title);
      setRemoteDesc(payload.description);
      setRemotePhotos(finalPhotos);
      setRemoteCover(nextCover);
      setRemoteThumbCover(nextThumbCover ?? null);

      setIsEditing(false);
      Alert.alert("Saved", "Entry updated.");
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: display,
          animation: "fade_from_bottom",
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 18 }}>
              {isEditing ? (
                <>
                  <Pressable onPress={() => setIsEditing(false)}>
                    <Ionicons name="close" size={24} color="#111" />
                  </Pressable>
                  <Pressable disabled={saving} onPress={onSave}>
                    <Ionicons
                      name="checkmark"
                      size={28}
                      color={saving ? "#aaa" : "#2563eb"}
                    />
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil" size={22} color="#111" />
                </Pressable>
              )}
            </View>
          ),
        }}
      />

      {!isEditing && (
        <View style={{ gap: 12 }}>
          <Text style={styles.title}>{remoteTitle || "Untitled"}</Text>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
          </View>

          {/* Carousel */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_W);
              if (i !== active) setActive(i);
            }}
            style={{ width: CAROUSEL_W, height: CAROUSEL_H, alignSelf: "center" }}
          >
            {remotePhotos.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: CAROUSEL_W, height: CAROUSEL_H, backgroundColor: "#eee" }}
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

          <Markdown style={markdownStyles}>{remoteDesc}</Markdown>
        </View>
      )}

      {isEditing && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Untitled"
            style={styles.titleInput}
            placeholderTextColor="#aaa"
          />

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
          </View>

          {/* Image carousel */}
          {!!displayPhotos.length && (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  const i = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_W);
                  if (i !== active) setActive(i);
                }}
                style={{
                  width: CAROUSEL_W,
                  height: CAROUSEL_H,
                  alignSelf: "center",
                }}
              >
                {displayPhotos.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{ width: CAROUSEL_W, height: CAROUSEL_H, backgroundColor: "#eee" }}
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

          {/* Draggable thumbnails */}
          <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 12 }}>
            <DraggableFlatList
              horizontal
              data={draftPhotos}
              keyExtractor={(item, i) => item.uri + i}
              onDragEnd={({ data }) => setDraftPhotos(data)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ alignItems: "center" }}
              renderItem={({ item, drag, isActive }: RenderItemParams<DraftPhoto>) => (
                <Pressable
                  onLongPress={drag}
                  disabled={isActive}
                  style={[
                    styles.editThumbWrap,
                    isActive && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <Image source={{ uri: item.uri }} style={styles.editThumb} />
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() =>
                      setDraftPhotos((prev) => prev.filter((p) => p.uri !== item.uri))
                    }
                  >
                    <Text style={styles.removeTxt}>✕</Text>
                  </Pressable>
                </Pressable>
              )}
            />

            <Pressable style={styles.cameraTile} onPress={pickImages}>
              <Text style={{ fontSize: 28, color: "#666" }}>📷</Text>
            </Pressable>
          </View>

          {/* Full-height editor */}
          <TextInput
            value={markdown}
            onChangeText={setMarkdown}
            placeholder="How was your day?"
            multiline
            style={[styles.input, styles.multiline]}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 12 },

  title: { fontSize: 24, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },

  multiline: {
    minHeight: 240,
    textAlignVertical: "top",
  },

  dividerContainer: { paddingBottom: 20 },
  divider: { height: 2, backgroundColor: "#ddd", width: "90%", borderRadius: 1 },

  dotsWrap: { flexDirection: "row", alignSelf: "center", gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ccc" },
  dotActive: { backgroundColor: "#111" },

  editThumbWrap: { marginRight: 10, width: 120, height: 120 },
  editThumb: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },

  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  removeTxt: { color: "#fff", fontWeight: "700", lineHeight: 16 },

  cameraTile: {
    width: 120,
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ddd",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
  },
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