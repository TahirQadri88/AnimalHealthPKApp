// Stands in for src/firebase.js in the full-app preview. Same exports, backed by the sample
// data in memory: listeners fire with it, writes land in it and notify, so screens behave
// as they would against Firestore. Nothing reaches a network or a real database.
import * as data from './sample-data';
import { loginSlug, authEmailFor } from '../../src/lib/loginNames';

const store = {};
for (const [name, rows] of Object.entries(data)) if (Array.isArray(rows)) store[name] = new Map(rows.map(r => [String(r.id), r]));
const listeners = {};
const col = (n) => (store[n] ||= new Map());
const snapshotOf = (n) => {
  const docs = [...col(n).values()].map(v => ({ id: String(v.id), data: () => v, metadata: { hasPendingWrites: false } }));
  return { metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => docs, forEach: (f) => docs.forEach(f), docs, size: docs.length, empty: !docs.length };
};
const notify = (n) => (listeners[n] || []).forEach(cb => cb(snapshotOf(n)));

export const db = { preview: true };
export const app = {};
export const firebaseConfig = {};
const user = { uid: new URLSearchParams(location.search).get('as') === 'staff' ? 'uid-staff' : 'uid-admin' };
export const auth = { currentUser: user };
export const collection = (_db, name) => ({ collection: name });
export const doc = (_db, name, id) => ({ collection: name, id: String(id) });
export const query = (ref) => ref;
export const orderBy = () => null;
export const limit = () => null;
export const onSnapshot = (ref, opts, cb) => {
  const f = typeof opts === 'function' ? opts : cb;
  (listeners[ref.collection] ||= []).push(f);
  setTimeout(() => f(snapshotOf(ref.collection)), 0);
  return () => { listeners[ref.collection] = listeners[ref.collection].filter(x => x !== f); };
};
const docSnap = (ref) => { const v = col(ref.collection).get(ref.id); return { id: ref.id, exists: () => !!v, data: () => v }; };
export const getDoc = async (ref) => docSnap(ref);
export const getDocs = async (ref) => snapshotOf(ref.collection);
export const setDoc = async (ref, value, opts = {}) => {
  const prev = col(ref.collection).get(ref.id);
  col(ref.collection).set(ref.id, opts.merge ? { ...prev, ...value } : value);
  notify(ref.collection);
};
export const deleteDoc = async (ref) => { col(ref.collection).delete(ref.id); notify(ref.collection); };
export const runTransaction = async (_db, fn) => fn({
  get: async (ref) => docSnap(ref),
  set: (ref, v) => setDoc(ref, v),
  update: (ref, v) => setDoc(ref, v, { merge: true }),
});
export const onAuthStateChanged = (_auth, cb) => { setTimeout(() => cb(user), 0); return () => {}; };
export const signOut = async () => {};
export const signInWithEmailAndPassword = async () => ({ user });
export const createUserWithEmailAndPassword = async () => ({ user: { uid: `uid-${Date.now()}` } });
export const getAuth = () => auth;
export const initializeApp = () => ({});
export const deleteApp = async () => {};
export { loginSlug, authEmailFor };
