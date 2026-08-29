import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, runTransaction,
} from "firebase/firestore";
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
// Persistent local cache — the single biggest lever on read cost.
//
// Without it every page load re-reads every document a listener touches. Staff reload all
// day, so the same invoices were being charged for over and over; that is how the account
// crossed the 50,000 reads/day free limit. With IndexedDB persistence the SDK serves the
// cached copy and resumes each listener from where it left off, fetching only what changed.
//
// It also makes the app usable on a dropped connection, which matters on a phone in a
// warehouse.
//
// Falls back to the in-memory default when IndexedDB is unavailable — private windows, or
// an older browser. The app works either way; it just pays full price for reads.
let db;
try {
  db = initializeFirestore(app, {
    // Several tabs open at once is normal here, and without a multi-tab manager only one
    // of them gets persistence.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  console.warn('Firestore persistent cache unavailable — falling back to memory cache.', err);
  db = getFirestore(app);
}
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
const loginSlug = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'user';

const authEmailFor = (name) => `${loginSlug(name)}@animalhealthpk.app`;

export {
  db,
  auth,
  app,
  firebaseConfig,
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  runTransaction,
  getAuth,
  initializeApp,
  deleteApp,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  authEmailFor,
  loginSlug,
};
