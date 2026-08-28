import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Keep the session across reloads. Staff use this on phones all day; re-typing a password
// on every refresh is how you end up with weak passwords.
setPersistence(auth, browserLocalPersistence).catch(() => {});

// Staff log in with a username, but Firebase Auth identifies accounts by email, so map one
// to the other deterministically. The domain is internal and never receives mail —
// email/password auth needs no verified address.
//
// Renaming a user does NOT move their login: the Auth account keeps the address it was
// created with. That is why the address is stored on the user document during migration
// instead of being recomputed at every sign-in — recomputing would silently lock out
// anyone whose name was later corrected.
const authEmailFor = (name) =>
  `${String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'user'}@animalhealthpk.app`;

export {
  db,
  auth,
  app,
  firebaseConfig,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getAuth,
  initializeApp,
  deleteApp,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  authEmailFor,
};
