// ../firebase/FirebaseConfig.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyB3tRChmnV82Fb8wCxwQF0KDzNGAXN013A",
  authDomain: "mobile-journal-30c6a.firebaseapp.com",
  projectId: "mobile-journal-30c6a",
  storageBucket: "mobile-journal-30c6a.firebasestorage.app",
  messagingSenderId: "180278538688",
  appId: "1:180278538688:web:448b1b2445e4e79cecd825",
};

// Initialize Firebase app
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Proper Auth setup for React Native (persists between sessions)
export const auth =
  Platform.OS === "web"
    ? getAuth(app)
    : (() => {
        try {
          return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch {
          // If already initialized (during hot reload)
          return getAuth(app);
        }
      })();
