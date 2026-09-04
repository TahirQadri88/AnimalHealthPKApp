# Working through an internet failure — audit and plan

2026-09-04. Written after reading the code, not from the brief. Brief §34 asks for this and
warns: *"Do not promise full offline accounting unless implemented. Offline invoice creation
needs a proper synchronization/conflict model first."* That warning is the shape of this
plan.

---

## The good news first: the architecture is already right

You do not need a new database, a sync engine, or a rewrite. Firestore with persistent local
cache is an offline-first database that also does realtime — which is exactly the "offline
AND live" combination asked for — and it is already switched on:

```js
db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
```

What that already gives you today, on both laptop and phone:

| | Works offline today? |
|---|---|
| Open the app (shell, JS, CSS) | ✅ service worker caches it |
| Stay signed in | ✅ Auth session is persisted in IndexedDB |
| Read every customer, invoice, payment, product | ✅ served from the IndexedDB cache |
| Ledgers, balances, aging, analytics, P&L | ✅ all computed in the browser from that cache |
| Print and share a document | ✅ PrintView is entirely local |
| Create or edit a record | ⚠️ **the data is saved locally and syncs later — but the UI hangs** |
| Live updates between two devices | ✅ resumes automatically on reconnect |

The reads and the maths were never the problem. Every figure in this app is calculated in the
browser from data the cache already holds — which is why the unbounded listeners that cost so
much in reads are, for offline purposes, an accident in your favour: after one online session
the whole business is on the device.

## The bad news: five specific things break, and one of them locks you out

### 1. Signing out while offline locks you out of your own data ⛔

`signOut()` clears the local Auth session. Signing back in needs `getDoc(loginIndex)` and
`signInWithEmailAndPassword` — **both require the network, and Firebase Auth cannot
authenticate offline under any configuration.** There is no way around that; it is how
password verification works.

So the sharpest single risk is behavioural, not technical: press **Log Out** during an
internet failure and the app is unusable until the connection returns, with all the data
sitting on the device unreachable.

### 2. Saving hangs, even though the save succeeded ⛔

```js
const ack = setDoc(doc(db, collectionName, String(id)), dataObj, { merge });
await ack;                       // ← only settles when the SERVER acknowledges
```

Offline, Firestore applies the write to the local cache **immediately**, queues it in
IndexedDB (so it survives closing the browser), and sends it on reconnect. The data is safe.
But the promise never settles, so:

- `await saveToFirebase(...)` never returns,
- `saveInvoice` never reaches its success path,
- the screen sits there, and the 6-second "Still saving — check your connection" toast is
  the only thing that happens.

**The record is saved and the app says it is stuck.** That is the reverse of the restore bug
fixed on 2026-09-03, and it is just as misleading.

### 3. Two devices billing offline can issue the same invoice number ⛔

`claimDocNumber` runs a Firestore transaction, which needs a server read. Offline it fails,
and the code falls back — by design — to `getNextSeqNum(invoicesRaw, prefix)`, which is
`max()+1` over what this browser holds. Two phones offline both compute `INV-8477`.

This is the "proper conflict model" the brief means. Everything else in this app is naturally
partitioned — one invoice per document, one customer per document, so Firestore's
last-write-wins is adequate — but the document *number* is a shared counter and genuinely
conflicts.

### 4. A flaky connection is worse than no connection

The service worker is network-first for `/assets/` and for the document, for a good reason
recorded in `sw.js`: a cached `index.html` once pinned the browser to a fixed-then-broken
build. But network-first with **no timeout** means a connection that is present-but-dead
(the usual Karachi failure, not a clean disconnect) makes the app wait for the browser's own
timeout before falling back to cache. Clean airplane mode loads instantly; a bad signal
hangs.

### 5. Nothing tells you which state you are in

There is no online/offline indicator anywhere in the app — `navigator.onLine` appears zero
times, and `useLiveCollection` throws away `snapshot.metadata`, which is where Firestore
reports `fromCache` and `hasPendingWrites`. So there is no way to know whether you are
looking at live data or yesterday's, or whether the invoice you just wrote has reached the
server.

---

## The plan, in the order it should be done

Each step is independently useful and independently revertible. Steps 1–3 are the ones that
turn "the data is there but the app misbehaves" into "it works".

### Step 1 — Stop the save from hanging, and say what happened *(the big one)*

`saveToFirebase` returns three states instead of hanging:

- **`'synced'`** — the server acknowledged it.
- **`'queued'`** — accepted into the local cache and the durable mutation queue; it will send
  itself. This is a *success*, not a failure, and it survives closing the app.
- **`'failed'`** — genuinely rejected (a rules denial, a bad document).

Implementation: race the server ack against a short timer (~1.5s). On timeout, return
`'queued'` — the write is already in IndexedDB, so the promise settling early loses nothing.
Keep listening to the original ack in the background so a later failure can still be
reported.

Every caller that treats a truthy return as success keeps working. The restore loop counts
`'synced'` and `'queued'` separately and reports both honestly.

**Test:** a fake `setDoc` whose promise never settles must make `saveToFirebase` return
`'queued'` within the timeout, and a rejecting one must return `'failed'`.

### Step 2 — Do not let anyone log out into a lockout

- When offline, the Log Out button asks for confirmation naming the consequence: *"You are
  offline. Signing out now means you cannot sign back in until the internet returns. Your
  work is saved and will sync."*
- The same warning appears in the offline banner from step 3.
- No change at all when online.

Small, and it removes the only failure that makes the data genuinely unreachable.

### Step 3 — An honest status pill

One small indicator, always visible, with three states read from real signals rather than
guessed:

| State | Source | Says |
|---|---|---|
| **Live** | `navigator.onLine` + a snapshot with `fromCache: false` | nothing (a quiet dot) |
| **Offline — N changes waiting** | `navigator.onLine === false`, count of pending writes | "Offline · 3 changes waiting to sync" |
| **Syncing** | pending writes while back online | "Syncing 3 changes…" |

The pending count comes from `snapshot.metadata.hasPendingWrites`, which
`useLiveCollection` currently discards. That is the only honest source — a counter kept in
React state would be wrong the moment a queued write is sent by a different tab.

Tapping it explains what is and is not possible offline, including the sign-in limit.

### Step 4 — Reserved number blocks, so offline billing cannot collide

Extend `claimDocNumber` with `claimDocBlock(prefix, size)`: one transaction that advances
`counters/{prefix}.next` by `size` and hands back the range. The device stores the unused
numbers in `localStorage` and consumes them one at a time — online or offline, without a
transaction.

- Refill the block whenever online and fewer than half remain.
- The format is untouched: `INV-8477` stays `INV-8477`. That constraint was argued for in the
  brief and holds.
- **Trade-off, stated plainly: unused numbers in a block become gaps.** A gap is far better
  than a duplicate — a duplicate means two customers hold papers with the same invoice
  number — and gaps already occur when a claimed number is abandoned.
- Size 10, so a worst-case gap is small.
- The existing client-side `getNextSeqNum` stays as the floor, exactly as now.

**Test:** two simulated devices, each with a block, must never produce the same number; a
device whose block is exhausted offline must refuse to bill rather than guess.

That last point is the honest limit: with no block left and no network, the app should say
*"No invoice numbers left offline — reconnect once to reserve more"* rather than issue a
number it cannot vouch for.

### Step 5 — Service worker: network-first *with a timeout*

Race each `/assets/` and document fetch against ~3 seconds and fall back to cache. Keeps the
fresh-deploy behaviour that `sw.js` protects on a good connection, and makes a dead-but-
present connection load from cache instead of stalling. Bump `CACHE_NAME` to `v8` — the
activate handler evicts by name, so bumping is what actually applies it.

### Step 6 — Ask the browser to keep the cache

`navigator.storage.persist()` asks not to have the IndexedDB cache evicted under storage
pressure. One line, and on a phone that is the difference between opening offline with
everything and opening offline with nothing. Also expose `navigator.storage.estimate()` in
Settings so the cache size is visible.

### Step 7 — "Ready for offline" check in Settings

A panel that answers *"if the internet dies right now, am I covered?"*: whether the service
worker is registered, whether persistent storage was granted, how many documents are cached
per collection, when each was last synced, and how many writes are pending. Not a fix —
it is how you find out that step 6 was refused before it matters.

---

## What will still not work offline, and why

Stated so nothing here over-promises:

| | Why |
|---|---|
| **Signing in** | Firebase Auth verifies passwords on the server. No configuration changes this. Mitigated by never expiring the session and by step 2. |
| **First use on a new device** | The cache is empty until one online session fills it. Unavoidable; the Settings panel in step 7 makes it visible. |
| **Adding or editing a user, or permissions** | Three records must stay in step (`app_users`, `userRoles`, `loginIndex`) and the rules are evaluated server-side. Should be blocked offline with a clear message, not queued. |
| **Google Drive / Firebase backup** | Both are network operations. They already skip and retry. |
| **Audit log reads** | Read on demand with `getDocs`; serves from cache if previously read, otherwise empty. Acceptable. |
| **Security rules** | Never evaluated locally. A write that the rules will reject is accepted into the queue offline and rejected on sync — which is why step 1 keeps watching the original ack, so a rejection is still reported. |

---

## Effort, and what to do first

| Step | Size | Value |
|---|---|---|
| 1. Saves stop hanging | Small — one function, plus tests | **Highest.** Fixes a live bug that also misreports |
| 2. Logout guard | Very small | **Highest.** Removes the only true lockout |
| 3. Status pill | Small–medium | High. Nobody can trust an offline app that will not say it is offline |
| 4. Reserved number blocks | Medium | High if two people ever bill at once offline; otherwise insurance |
| 5. SW timeout | Small | Medium. Only matters on a bad connection, which is the common case here |
| 6. Persistent storage | One line | Medium, and free |
| 7. Readiness panel | Small | Medium. Diagnostic rather than functional |

**Steps 1, 2 and 6 together are roughly an hour and remove the two ways the app currently
misbehaves offline plus the risk of an evicted cache.** They are the recommended first
commit set. Steps 3–5 make it comfortable. Step 4 is the one the brief's warning is really
about, and it should not be skipped if two devices ever bill at the same time.
