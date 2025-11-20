// Import the functions you need from the SDKs you need
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseKeys } from "./firebaseKeys";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseKeys);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);