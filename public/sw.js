// Bump this on any change to caching behaviour — the activate handler deletes every cache
// whose name does not match, so bumping is what actually evicts stale content.
const CACHE_NAME = 'animalhealth-v7';
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

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Network-first for Firebase (always fresh data)
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
    event.respondWith(
      fetch(event.request)
        .then(response => cachePut(event.request, response))
        .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Network-first for JS/CSS assets so new deploys always load fresh
  if (url.includes('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => cachePut(event.request, response))
        .catch(() => caches.match(event.request))
    );
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
