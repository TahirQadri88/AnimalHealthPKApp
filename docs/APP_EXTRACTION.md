# Breaking up `src/App.jsx` — 6,033 lines, one screen at a time

The brief has wanted this for months and deliberately put it last: there was nothing to
catch a regression. There is now — 214 tests over seven extracted services, plus two lint
rules that between them catch the exact two ways this file has broken before. This is the
plan for doing it without another white screen.

---

## The two crashes this file has already caused, and what catches each

Both shipped green through `vite build`. Neither would be caught by a type checker, and
neither showed up in the smoke test.

**1. An identifier that looked module-scope and wasn't.** A helper was inserted above
`const PERMS = [`, which appears exactly once in the file and sits *inside a component
body*. Deployed, it threw `ReferenceError: Can't find variable: isTransportMethod` on
render. → **`npm run lint`** (`no-undef`) reports this, five times, at the exact lines.

**2. A dependency array evaluated before its declaration.** `useEffect(..., [authUid])`
placed above `const [authUid]`. Dependency arrays run *during render*, so this threw
`Cannot access 'f' before initialization`. → **`npm run lint:scope`** (`no-use-before-define`)
reports this. It also reports call-time-safe cases, so judge each NEW name: a use in a
dependency array, in JSX, or at the top level of a component body is a real crash; a use
inside a function body is fine.

Moving code between files is *exactly* the operation that produces both. Run both after
every step, and compare the `lint:scope` count against the baseline — **20 problems today,
all pre-existing and call-time-safe**. Twenty-one means you introduced one.

## The third failure mode, which this project has not hit yet

**Nothing extracted may import from `App.jsx`.**

`App.jsx` will import the component; if the component imports a helper back from `App.jsx`,
that is a cycle. ESM tolerates cycles by handing back a binding that is still `undefined` at
module-initialisation time — so it fails at import, before React renders, with a blank page
and an error naming a file that looks innocent. It would not be caught by either lint rule.

This is why **Phase 0 comes first**: everything shared moves into its own module *before*
any component moves out. If an extraction seems to need something from `App.jsx`, that thing
is Phase 0 work, not an exception.

---

## The verification recipe, per step

An extraction is behaviour-preserving by definition. That makes it unusually checkable —
lean on that rather than on reading the diff.

**A render test cannot be written before the move.** The first draft of this plan said to
snapshot the markup first; that is impossible. A component still inside `App.jsx` cannot be
imported by a test, because `App.jsx` imports `src/firebase.js`, which initialises Auth at
import time and throws without credentials. So the proof of purity works on the *source*,
which is stronger anyway — it shows nothing changed at all, rather than that the output
matched on whatever inputs a test happened to try.

1. **Move it.** Cut, paste, add imports and one `export`. Change nothing else — not
   formatting, not a variable name, not "while I'm here".
2. **Prove it was a pure move:**
   `node tools/extraction-diff.mjs <Name> <newFile>` — takes the component's text out of
   the previous commit's `App.jsx` and out of the new file, normalises only the `export`
   keyword, and requires them byte-identical. Anything else prints the offending lines.
3. **Add a render test in the new file** — `react-dom/server`, a stubbed
   `AppContext.Provider` where the component needs one. `useEffect` does not run under
   SSR, so no DOM stub is needed. This is the permanent net from that point on.
4. `npm run verify` (lint → test → build), then `npm run lint:scope` and compare to 20.
5. Load the built bundle: `npx serve -s dist -l 4173` and `node tools/smoke-test.mjs`. It
   only proves the bundle boots — but a cycle or a missing import kills the bundle, so for
   *this* work it is a real check rather than theatre.
6. **One component per commit.** A revert has to be a single `git revert`, not an
   archaeology exercise.

Do not trust `extraction-diff.mjs` blindly either: its first version located a component's
end by the next line starting with `const`, which in this flat-formatted file is the
component's own first local variable — it reported a 36-line component as "1 line
identical". It now balances brackets, and cross-checks that result against the next
capitalised declaration, because an apostrophe in JSX text ("Driver's") pairs with the next
one hundreds of lines away and swallows every brace between. When the two disagree it says
so out loud rather than printing a tick.

If a component cannot be rendered under SSR (it touches `window` during render, not in an
effect), say so in the commit and rely on steps 4–5. Do not skip step 1 silently.

---

## Order

Leaves first, smallest first, most-understood first. Every component below already takes
everything it needs from `AppContext`, so the move is mechanical once Phase 0 is done.

### Phase 0 — shared scaffolding (no component moves)

Six small commits. Nothing else can start safely until these exist.

| New module | Contents | Notes |
|---|---|---|
| `src/context/AppContext.js` | `createContext` + a `useApp()` hook | Every component imports this instead of `App.jsx` |
| `src/lib/docNumbers.js` | `getNextSeqNum` | Pure. Test `LEGACY_THRESHOLD`, and that it must be fed the RAW lists |
| `src/lib/claimDocNumber.js` | `claimDocNumber` | Separate **because** it imports `../firebase` — see the rule below |
| `src/lib/transport.js` | `isTransportMethod`, `isKnownVehicleType`, `usesCarrierPerson` | Pure. Test the distinction that matters: unknown method ≠ "not a courier" (see CLAUDE.md) |
| `src/lib/a11y.js` | `makeArrowNav` | Pure |
| `src/hooks/useLiveCollection.js` | the hook | Keep the sign-in gate comment with it |
| `src/components/ui/` | `ModalWrapper`, `ConfirmDialog`, `ScrollableTabBar`, `MultiPicker` | Presentational; the easiest render tests in the file |

### Phase 1 — prove the recipe on four small leaves

| # | Component | Lines | Why this one |
|---|---|---|---|
| 1 | `RidersAdminView` | 79 | Smallest real view, self-contained, no money |
| 2 | `ExpensesView` | 90 | Small, one collection |
| 3 | `CompanyManager` | 112 | Small, master data only |
| 4 | `CustomersTab` | 89 | First tab, still small |

If the recipe survives four, it will survive the rest. If it does not, stop and fix the
recipe — not the component.

### Phase 2 — the remaining admin views

`TransportCompaniesManager` (133, used twice — check both call sites), `AuditView` (149),
`ReceivablesView` (171), `MastersView` (120), `SegmentsAdminView` (127),
`UserManagementView` (155), `BulkOpsView` (244), `AppSettingsView` (238).

`UserManagementView` and `AppSettingsView` touch the three-records-in-step rule
(`app_users`, `userRoles`, `loginIndex` — see `docs/SECURITY_CUTOVER.md`). Move them, do
not refactor them, and sign in afterwards.

### Phase 3 — modals — DONE (2026-09-02)

Nine, not the seven listed here originally: `PaymentModal` and `ExpenseCategoryModal` were
missed when this was written.

Two things this phase taught, both now rules:

- **`UserModal` nearly broke the tooling.** It carries `PERMS` declared at column zero
  inside its own body, and both `move.py` and `extraction-diff` treated any capitalised
  declaration as the next component — so the move would have cut it in half and the diff
  would have compared two identically-truncated slices and printed a tick. The boundary now
  recognises `const X = (` or `function X(`; `const X = [` is data. Check this before
  trusting a line count.
- **A component that imports `../firebase` cannot be tested,** and three modals hit it.
  `claimDocNumber` now comes through the context, as `fetchAuditLog` already did. Do the
  pure move first with the import, then switch to context in a follow-up commit, so the
  move stays provable.

### Phase 4 — the big tabs — DONE (2026-09-02)

`DashboardTab` (204), `PaymentsTab` (112), `BillingTab` (459).

`BillingTab` is the riskiest single move in the project: it owns `saveInvoice`, the
courier-field logic that once destroyed consignment numbers, and document numbering. Move it
alone, on its own day, and bill one real invoice through it — estimate, convert, print — as
part of the check.

### Phase 5 — `AnalyticsView` (1,101 lines), last

**Do not move this as one lump.** First extract `reportEngine` (≈200 lines of money maths,
currently inline and untested) into `src/services/analytics/reportEngine.js` with tests, the
way `computePnL`, `ledger` and `dashboard` were. That is where the value is: it is the
largest piece of untested financial code left, and a bug in its credit-note handling was
found and fixed on 2026-09-01 by reading rather than by any test failing.

Only once it is a tested service does the view around it become a mechanical move.

### Phase 6 — what remains in `App.jsx`

The provider, the collections, the auth and user functions, `ctx`, and tab routing. Roughly
600–900 lines, and legitimately one file: it is the composition root.

---

## Rules for the whole job

- **Never put a pure helper in the same module as one that imports `../firebase`.**
  `src/firebase.js` initialises Auth at import time and throws without credentials, so a
  test importing that module cannot even load. `getNextSeqNum` and `claimDocNumber` were
  extracted together on the first attempt and the pure half was instantly untestable; they
  are two files now. Ask "can this be imported by a test?" before choosing the file.
- **Move, do not improve.** Every extraction is a pure move. If something is obviously
  wrong on the way past, note it and fix it in a *separate* commit, before or after — never
  inside the move, because then the byte-identical markup check no longer holds and you have
  given up the only real proof you had.
- **One component per commit**, so any single step can be reverted alone.
- **Stop at the first surprise.** Two of the three crashes in this project's history came
  from pressing on through something that looked odd.
- **Do not touch `PrintView.jsx`.** It is already its own file, it carries the thermal
  geometry, and it has the repo's best test coverage. It is finished.
- **Deploy between phases, not between steps.** Give each phase a couple of days of real
  use before starting the next. The cost of this work is entirely in undetected breakage,
  and the only detector for a UI regression here is somebody using it.

## Cost and honest expectations

Roughly 30 commits over six phases. It buys no feature and fixes no bug. What it buys is
that the next feature does not have to be threaded into a 6,000-line file, and that the
money maths keeps moving into tested services — which is the part that has repeatedly found
real errors.

If it has to stop half-finished, stop at the end of a phase. A half-extracted app is not
worse than an unextracted one, as long as nothing imports backwards.
