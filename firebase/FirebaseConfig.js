// Import the functions you need from the SDKs you need
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB3tRChmnV82Fb8wCxwQF0KDzNGAXN013A",
  authDomain: "mobile-journal-30c6a.firebaseapp.com",
  projectId: "mobile-journal-30c6a",
  storageBucket: "mobile-journal-30c6a.firebasestorage.app",
  messagingSenderId: "180278538688",
  appId: "1:180278538688:web:448b1b2445e4e79cecd825"
};

// Initialize Firebase
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);