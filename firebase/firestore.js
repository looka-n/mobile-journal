import { db } from "../firebase/firebaseConfig.js";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";

export async function saveEntry(date, photos = [], markdownText = '') {
  const ref = doc(db, 'entries', date);
  await setDoc(ref, {
    photos,
    markdownText,
    updatedAt: new Date()
  });
}

export async function getEntry(date) {
  const ref = doc(db, 'entries', date);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getAllEntries() {
  const snapshot = await getDocs(collection(db, 'entries'));
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      photos: data.photos || [],
      markdownText: data.markdownText || '',
    };
  });
}