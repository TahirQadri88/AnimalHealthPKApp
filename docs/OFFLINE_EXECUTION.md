# Offline work — the execution plan

Companion to `docs/OFFLINE_PLAN.md`, which is the audit and the reasoning. **This file is the
checklist.** It is written to be picked up cold, by someone with no memory of the
conversation that produced it: exact files, exact shapes, the tests to write, and the traps
that will bite.

Read `docs/OFFLINE_PLAN.md` first — it is short, and it says which of these matter and why.

Ground rules, unchanged from the rest of this project:

- **One step per commit.** A revert must be a single `git revert`.
- **`npm run verify` and `npm run lint:scope` after every step.** The scope baseline is
  **20**; twenty-one means you introduced one.
- **A module that imports `src/firebase.js` cannot be loaded by a test** — it initialises
  Auth on import and throws without credentials. This constraint decides the shape of
  step 1, so do not design around it later.

---

## Commit set A — the hour that matters (steps 1, 2, 6)

These three remove both ways the app currently misbehaves offline, plus the risk of the
cache being evicted. Do them first, in this order.

### A1. Saves must not hang — `settleWrite`

**The bug.** `saveToFirebase` in `src/App.jsx` does `await ack` on `setDoc`. Offline,
Firestore applies the write to the local cache immediately and queues it durably in
IndexedDB, but the promise only settles on **server** acknowledgement — so it never returns,
and every caller awaiting it stalls with the data already safe.

**New file: `src/lib/pendingWrite.js`** — pure, no firebase import, therefore testable.

```js
export const SYNCED = 'synced';   // the server acknowledged it
export const QUEUED = 'queued';   // in the local cache and the durable mutation queue
export const FAILED = 'failed';   // genuinely rejected

// Never rejects. Resolves QUEUED if the ack has not settled within timeoutMs; keeps
// listening so a later rejection can still be surfaced through onLateFailure.
export const settleWrite = (ack, { timeoutMs = 1500, onLateFailure } = {}) => { ... }

// The one predicate callers should use. `FAILED` is a truthy STRING — see the trap below.
export const isAccepted = (result) => result !== FAILED;
```

**Then in `src/App.jsx`,** `saveToFirebase` returns `settleWrite(ack, ...)` instead of
`await ack`, keeps the existing 6-second "Still saving" toast for the online-but-slow case,
and keeps `silent`.

> ### ⚠️ The trap that will bite
>
> There are **75 `saveToFirebase` call sites** and exactly **one** reads the return value:
> `src/components/admin/AppSettingsView.jsx:119`, in the restore loop, which does
> `const ok = await saveToFirebase(...); if (ok) written += 1;`.
>
> `'failed'` is a **truthy string**. Left alone, that line would count every failure as a
> success — reintroducing precisely the bug the restore rework fixed. **Update it in this
> same commit** to `isAccepted(...)`, and report `queued` separately from `synced` in the
> toast: *"412 restored, 88 queued — they will send when the connection returns."*

**Tests — `src/lib/pendingWrite.test.js`:**

| Test | How |
|---|---|
| resolves `SYNCED` when the ack resolves | a resolved promise |
| resolves `FAILED` when the ack rejects | a rejected promise |
| resolves `QUEUED` when the ack never settles | `new Promise(() => {})` + `vi.useFakeTimers()` |
| never rejects, whatever the ack does | rejected ack, assert `.not.toThrow()` |
| reports a rejection that arrives after the timeout | spy on `onLateFailure` |
| does not call `onLateFailure` when it synced | spy, assert not called |
| `isAccepted` is false only for `FAILED` | all three constants |

Plus a regression test on the restore path asserting that a `FAILED` write is **not**
counted as written.

**Verify by hand:** DevTools → Network → Offline. Save a customer. The toast must appear and
the form must close. Go online; the record must appear in Firestore.

### A2. Do not let anyone log out into a lockout

**The risk.** `signOut()` clears the local session. Signing back in needs
`getDoc(loginIndex)` **and** `signInWithEmailAndPassword`, both of which need the network.
Firebase Auth cannot authenticate offline under any configuration. So logging out during an
outage makes all the cached data unreachable until the connection returns.

**Change `logout` in `src/App.jsx`** — not the buttons. There are two of them
(`src/App.jsx:798` sidebar, `:812` mobile header) and guarding the function covers both:

```js
const logout = async () => {
  if (!navigator.onLine && !await showConfirm(
    'You are offline. Signing out now means you cannot sign back in until the internet '
    + 'returns — Firebase checks the password on its server. Your work is saved and will '
    + 'sync by itself. Sign out anyway?')) return;
  ...
};
```

`showConfirm(message)` already returns `Promise<boolean>`; nothing new is needed.

**Test** in `src/App.test.jsx` if one exists, otherwise assert the copy is present via the
existing render tests. The behaviour itself needs a hand check: DevTools offline → Log Out →
the dialog must appear; Cancel must leave you signed in.

### A3. Ask the browser to keep the cache

**New file: `src/lib/offlineStorage.js`** (no firebase import, so it stays testable):

```js
// Ask not to be evicted under storage pressure. On a phone this is the difference between
// opening offline with everything and opening offline with nothing.
export const requestPersistentStorage = async (storage = navigator?.storage) => { ... }
export const storageEstimate = async (storage = navigator?.storage) => { ... }
```

Both must tolerate the API being absent (older browsers, and any non-secure context) and
must never throw. Called once from `src/main.jsx`, fire-and-forget.

**Tests:** granted, refused, API missing entirely, and API present but throwing.

**Note:** browsers grant this on their own criteria — an installed PWA usually gets it,
a tab that has been visited once may not. It is a request, not a guarantee, which is why
step 7 exists.

---

## Commit set B — making it comfortable (steps 3, 5)

### B1. A sync status pill

Three states, from real signals rather than guesses:

| State | Source |
|---|---|
| Live | `navigator.onLine === true` and no pending writes |
| Offline · N waiting | `navigator.onLine === false`, N from pending writes |
| Syncing N… | online with pending writes outstanding |

**Where the pending count comes from.** `snapshot.metadata.hasPendingWrites` — which
`src/hooks/useLiveCollection.js` currently discards. A counter kept in React state would be
wrong the moment another tab sends a queued write.

> ### ⚠️ Do not change what `useLiveCollection` returns
>
> It returns a bare array and **fifteen call sites in `App.jsx` destructure it as one**.
> Changing the shape is a fifteen-site edit for no benefit.
>
> Instead add a tiny module-level store — `src/lib/syncStatus.js`, subscribe/publish, no
> React — that `useLiveCollection` pushes each snapshot's `metadata` into, and a
> `useSyncStatus()` hook reads. No extra listeners, no extra reads, no changed signature.

Render it in both headers (`src/App.jsx` around `:806` desktop, `:807` mobile). Tapping it
explains what does and does not work offline, **including that signing in needs the
internet** — the one thing users must know before an outage rather than during one.

### B2. Service worker: network-first *with a timeout*

`public/sw.js` is network-first for `/assets/` and for the document. **Keep that** — the
comment in the file records why (a cached `index.html` once pinned the browser to a broken
build, and the fix kept "not working" on refresh). The problem is only that there is no
timeout, so a present-but-dead connection waits for the browser's own.

Race each fetch against ~3 seconds, fall back to cache. Clean offline already fails fast;
this fixes the bad-signal case, which is the common one.

**Bump `CACHE_NAME` to `animalhealth-v8`.** The activate handler deletes every cache whose
name does not match, so bumping is what actually applies the change. Forgetting this means
testing the old worker and concluding the change did nothing.

---

## Commit set C — the conflict model (step 4)

### C1. Reserved document-number blocks

**The problem.** `claimDocNumber` needs a Firestore transaction, which needs a server read.
Offline it returns `null` and every call site falls back to
`getNextSeqNum(invoicesRaw, prefix)` — `max()+1` over what this browser holds. Two devices
offline compute the same number, and both print it.

**Four call sites**, all with the same shape `(await claimDocNumber(p, guess)) ?? guess`:

- `src/components/tabs/BillingTab.jsx:87` — saving an invoice
- `src/components/tabs/BillingTab.jsx:458` — converting an estimate to an invoice
- `src/components/modals/PaymentModal.jsx:31` — `REC-`
- `src/components/modals/CreditNoteModal.jsx:89` — `CN-`

**The design.** `claimDocBlock(prefix, size)` — one transaction that advances
`counters/{prefix}.next` by `size` and returns the range. The device keeps the unused numbers
in `localStorage` and consumes them one at a time, needing no transaction and no network.

- Refill whenever online and fewer than half the block remains.
- **The format does not change.** `INV-8477` stays `INV-8477`; that constraint was argued for
  in the brief and holds.
- **Trade-off, stated plainly: unused numbers become gaps.** A gap is far better than a
  duplicate — a duplicate means two customers holding papers with the same invoice number —
  and gaps already occur when a claimed number is abandoned. Size 10 keeps the worst case
  small.
- `getNextSeqNum` stays as the floor, exactly as now.

**The honest limit.** With the block exhausted and no network, the app must **refuse to
bill**: *"No invoice numbers left offline — reconnect once to reserve more."* Issuing a
number it cannot vouch for is the failure this whole step exists to prevent.

Put the block arithmetic in a pure module (`src/lib/docNumberBlock.js`) so it can be tested;
only the transaction itself belongs beside `claimDocNumber`, which imports firebase.

**Tests:** two simulated devices with separate blocks never collide; a block is consumed in
order; refill triggers below half; an exhausted block offline returns `null` rather than
guessing; a block survives a reload (`localStorage` round-trip).

---

## Commit set D — knowing where you stand (step 7)

### D1. "Ready for offline" panel in Settings

Answers *"if the internet dies right now, am I covered?"* — service worker registered,
persistent storage granted or refused, documents cached per collection, when each last
synced, writes pending. Not a fix; it is how you discover that A3 was refused **before** it
matters.

---

## How to actually test any of this

Automated tests cover the pure modules. The behaviour itself needs hands, in this order:

1. **DevTools → Network → Offline** on the laptop. Reload — the app must open, signed in,
   with all data. Create an invoice — it must save and close, not hang.
2. **Go back online.** The record must appear in Firestore, and the pill must return to Live.
3. **Two devices, both offline, both billing** — the numbering test. Without commit set C
   they will collide; that is the point of C.
4. **Kill the browser mid-outage and reopen it.** Queued writes live in IndexedDB and must
   still send. This is the test that proves `QUEUED` is a real promise and not a hopeful one.
5. **Phone, airplane mode**, installed to the home screen. Different storage rules from a
   desktop tab, which is why A3 matters most here.

`tools/smoke-test.mjs` cannot reach any of this — it only proves the bundle boots, and it
stops at the login screen.

---

## Order and effort

| # | Step | Size | Do it because |
|---|---|---|---|
| A1 | Saves stop hanging | Small | It is a live bug that also misreports |
| A2 | Logout guard | Very small | It is the only true lockout |
| A3 | Persistent storage | One line + a wrapper | Free, and decisive on a phone |
| B1 | Status pill | Small–medium | Nobody trusts an offline app that will not say it is offline |
| B2 | Service worker timeout | Small | A bad signal is the common failure here, not a clean one |
| C1 | Reserved number blocks | Medium | Only if two devices might bill at once offline — but then, essential |
| D1 | Readiness panel | Small | Diagnostic; it tells you A3 was refused |

**Start with A1 → A2 → A3.** They are independent of each other and of everything after them.
