// Whether what you are looking at has reached the server.
//
// The app had no idea. `navigator.onLine` appeared nowhere, and useLiveCollection threw away
// `snapshot.metadata`, which is where Firestore reports the two facts that matter:
//
//   fromCache        — this snapshot was served entirely from the local cache, so the SDK is
//                      not currently in touch with the server.
//   hasPendingWrites — this snapshot contains writes the server has not acknowledged.
//
// Kept as a plain module-level store rather than React state, for two reasons. Fifteen call
// sites destructure useLiveCollection's return as a bare array, so its signature must not
// change; and a queued write can be sent by a DIFFERENT TAB, which a counter living in one
// tab's React state would never see.
//
// The derivation is pure and exported on its own so it can be tested without a browser.

const listeners = new Set();

// collection name → { fromCache, pending }
let collections = {};
let online = true;
let lastSyncedAt = null;

/** Pure: the whole of the status logic, so it can be tested. */
export const deriveStatus = ({ online: isOnline, collections: cols = {}, lastSyncedAt: at = null } = {}) => {
  const entries = Object.values(cols);
  const pending = entries.reduce((sum, c) => sum + (c.pending || 0), 0);
  // Any collection out of touch with the server means we are not fully live. Firestore sets
  // fromCache per listener, and they do not all reconnect in the same millisecond.
  const fromCache = entries.some(c => c.fromCache);

  let state;
  if (isOnline === false) state = 'offline';
  else if (pending > 0) state = 'syncing';
  // Connected as far as the browser is concerned, but Firestore has not reached the server.
  // This is the dead-but-present connection navigator.onLine cannot see, and the common
  // failure here — a signal that is up and carrying nothing.
  else if (fromCache && entries.length > 0) state = 'stale';
  else state = 'live';

  return { state, pending, fromCache, online: isOnline !== false, lastSyncedAt: at };
};

const notify = () => { listeners.forEach(fn => { try { fn(); } catch { /* a bad listener must not stop the rest */ } }); };

let snapshot = deriveStatus({ online: true, collections: {} });
const recompute = () => {
  const next = deriveStatus({ online, collections, lastSyncedAt });
  // useSyncExternalStore compares by reference and will loop forever on a fresh object every
  // time, so only replace it when something actually changed.
  if (next.state === snapshot.state && next.pending === snapshot.pending
      && next.fromCache === snapshot.fromCache && next.online === snapshot.online
      && next.lastSyncedAt === snapshot.lastSyncedAt) return;
  snapshot = next;
  notify();
};

export const getSyncSnapshot = () => snapshot;

export const subscribeSyncStatus = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Called by useLiveCollection for every snapshot, including metadata-only ones. */
export const publishCollectionMeta = (name, { fromCache, pending }) => {
  const prev = collections[name];
  if (prev && prev.fromCache === fromCache && prev.pending === pending) return;
  collections = { ...collections, [name]: { fromCache, pending } };
  if (!fromCache) lastSyncedAt = Date.now();
  recompute();
};

export const publishOnline = (isOnline) => {
  if (online === isOnline) return;
  online = isOnline;
  recompute();
};

/** Count the documents in a snapshot the server has not acknowledged. */
export const countPending = (snap) => {
  // The whole-snapshot flag is false far more often than not, and checking it first avoids
  // walking thousands of invoices on every metadata event.
  if (!snap?.metadata?.hasPendingWrites) return 0;
  let n = 0;
  snap.forEach(d => { if (d.metadata?.hasPendingWrites) n += 1; });
  return n;
};

/** Test seam — resets the module between tests. */
export const __resetSyncStatus = () => {
  collections = {};
  online = true;
  lastSyncedAt = null;
  snapshot = deriveStatus({ online: true, collections: {} });
  listeners.clear();
};
