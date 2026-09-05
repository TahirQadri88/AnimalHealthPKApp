// Bump this on any change to caching behaviour — the activate handler deletes every cache
// whose name does not match, so bumping is what actually evicts stale content.
const CACHE_NAME = 'animalhealth-v8';
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Store a fresh copy without blocking the response.
const cachePut = (request, response) => {
  if (response && response.ok) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  }
  return response;
};

// Network-first, but not network-forever.
//
// A clean disconnect fails fast and falls back to cache immediately. A connection that is
// present but dead — the usual failure here, not airplane mode — does not fail at all: the
// fetch sits there until the browser's own timeout, and the app hangs on a blank screen with
// every asset it needs already in the cache beside it.
//
// So each network-first fetch races a timer. Three seconds is well past a normal response on
// a bad connection and well short of the browser's patience.
const NETWORK_TIMEOUT_MS = 3000;

const timeout = (ms) => new Promise((_, reject) =>
  setTimeout(() => reject(new Error('network timeout')), ms));

const networkFirst = (request, fallback) =>
  Promise.race([
    fetch(request).then(response => cachePut(request, response)),
    timeout(NETWORK_TIMEOUT_MS),
  ]).catch(() => fallback());

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Firebase has its own offline handling and its own retry policy — the SDK knows far more
  // about when to give up on a Firestore request than this worker does. Left alone
  // deliberately, and NOT given the timeout below: cutting off a long-poll at three seconds
  // would break the realtime listeners.
  if (url.includes('firestore') || url.includes('firebase')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Network-first for the document itself.
  //
  // This MUST NOT be cache-first. index.html names the hashed JS bundle, so a stale copy
  // pins the browser to an old build — and because /assets/ is network-first, the browser
  // then dutifully fetches that old bundle fresh from the server. A crash that had already
  // been fixed and deployed kept reappearing on refresh for exactly this reason: the fix
  // was live, but the cached HTML still pointed at the broken file.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(networkFirst(event.request,
      () => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
    return;
  }

  // Network-first for JS/CSS assets so new deploys always load fresh
  if (url.includes('/assets/')) {
    event.respondWith(networkFirst(event.request, () => caches.match(event.request)));
    return;
  }

  // Cache-first for the static shell (icons, manifest) — unversioned, and they reference
  // nothing else, so a stale copy is harmless.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => cachePut(event.request, response));
      return cached || network;
    })
  );
});
