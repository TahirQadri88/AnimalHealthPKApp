// Ask the browser not to throw the offline cache away.
//
// Everything this app can do offline depends on one thing: the Firestore persistent cache
// in IndexedDB. By default that is "best-effort" storage, which a browser is free to evict
// under storage pressure — and on a phone, pressure is normal. Evicted means opening the app
// during an outage shows an empty business.
//
// navigator.storage.persist() asks for the "persistent" bucket instead, which is not evicted
// automatically. It is a request, not a guarantee: browsers decide on their own criteria
// (an installed PWA usually qualifies; a tab visited once often does not), and Firefox may
// prompt. Nothing here forces the issue — it asks, records the answer, and moves on.
//
// No firebase import, so this can be tested. Every function tolerates the API being absent
// entirely (older browsers, and any page not served over HTTPS) and none of them throw:
// this runs at start-up, and a start-up path that can throw is a white screen.

/**
 * Request durable storage. Resolves the granted state, or null if the browser has no
 * opinion to give.
 */
export const requestPersistentStorage = async (storage = globalThis.navigator?.storage) => {
  if (!storage?.persist || !storage?.persisted) return null;
  try {
    // Already granted: do not ask again. A repeat request can re-prompt in some browsers.
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return null;
  }
};

/** How much has been stored and how much the browser is willing to hold, or null. */
export const storageEstimate = async (storage = globalThis.navigator?.storage) => {
  if (!storage?.estimate) return null;
  try {
    const { usage, quota } = await storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) return null;
    return { usage, quota, percentUsed: +((usage / quota) * 100).toFixed(1) };
  } catch {
    return null;
  }
};

/** Whether durable storage is already granted, without asking for it. */
export const isStoragePersisted = async (storage = globalThis.navigator?.storage) => {
  if (!storage?.persisted) return null;
  try { return await storage.persisted(); } catch { return null; }
};
