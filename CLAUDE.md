# AnimalHealthPKApp

React + Vite + Firebase Firestore. Wholesale veterinary pharmacy management for Khyber
Traders, Karachi. Deployed from `main` (and `claude/**` branches) via GitHub Actions.

`src/components/PrintView.jsx` renders seven document types — invoice, estimate, dispatch
note, credit note, payment receipt, ledger, report — across three paper formats: A4, A5 and
80mm thermal.

---

## ⚠️ Thermal receipt printing — read this before touching print geometry

This cost many rounds of trial and error and several wrong diagnoses. The rules below are
each paid for. Do not "simplify" them away.

### 1. Trust the paper, not the driver

The Black Copper BC-85AC reports `Paper(80(72) x 3276mm)` in its Windows driver. **Its head
actually reaches ~68mm, not 72mm.** Sizing the page to the advertised 72mm put the content's
right edge past the last dot, and every receipt lost the final character of every
right-aligned figure.

Printer specs are a starting hypothesis. Measure with `tools/thermal-calibration.html`.

### 2. The page box must equal the head's real reach

```js
const pageSize   = isThermal ? '68mm auto' : ...   // measured, not advertised
const thermalCap = '68mm';
```

Browsers scale the page box to fit the printable area. Match the two and the ratio is 1.0,
so a millimetre is a millimetre — and the printer stops resampling the raster, which also
costs sharpness.

### 3. Size everything as a percentage of the page box, never in absolute mm

This is the load-bearing rule. The print pipeline applies scale factors you do not control
(browser page-fitting, driver fit-to-printable, the dialog's scale setting). Measurements on
this printer landed anywhere from 0.75× to 1.0× depending on page size.

Absolute mm values do not survive that trip. Percentages do: content at 100% of the page box
maps onto 100% of the printable area whatever the factor. Most of the failed attempts here
were absolute-mm fixes that were silently rescaled before reaching paper — which is why
"make it 2mm narrower" repeatedly produced *no visible change*.

### 4. Never pin a px viewport in the print popup

`<meta viewport width=272>` makes the browser lay out at 272px and then stretch that to the
paper — a second scale factor stacked on the first. Use `width=device-width` and let the
layout width come from the `@page` box.

### 5. Do not inject the app's stylesheets into a thermal popup

`handlePrint` copies `document.styleSheets` into the popup for A4/A5, which need the
page-break helpers (`.keep-together`, thead/tfoot grouping). **Thermal must not get them.**
They carry `@page{size:auto}` and `table{width:100%!important}` written for A4, which
override the receipt geometry and make the popup's final layout impossible to reason about.

### 6. Arial, not Arial Black

At 203 dpi on a 1-bit head an ultra-heavy face at 8–9px smears: strokes merge and the
antialiased grey edge pixels get dithered into fuzz. Arial has real Regular and Bold faces,
so `fontWeight: 700–900` resolves to true Bold with no synthesis. Forcing `font-weight:900`
on top of Arial Black triggers faux-bold synthesis and is worse still.

### 7. Close every overflow path, not just the obvious one

Right-edge clipping had several independent causes; fixing one at a time never sufficed.
The thermal stylesheet in `buildHtmlDoc` must keep:

- `#doc *{min-width:0}` — flex and grid items default to `min-width:auto`, so a long
  `Rs. 118,500` refuses to shrink and spills out instead of wrapping. Covers the totals
  rows and the ledger's 4-column summary grid.
- `#doc td,#doc th{white-space:normal!important;overflow-wrap:anywhere}` — `nowrap` cells in
  a `table-layout:fixed` table overflow their column rather than wrapping.
- `#doc table{width:100%!important;max-width:100%!important}` — the report table uses auto
  layout and would otherwise size itself past the container.
- The 3mm gutter (`thermalPadX`) keeps ink clear of the edge. The `@media print` rule must
  not zero `padding-left/right`; both derive from `thermalPadX` so they cannot drift apart.

### 8. `@media print` colour overrides are unreliable across browsers

Colours are baked directly onto the clone's inline styles in `buildHtmlDoc` when
`screenHide` is set, rather than relying on the print cascade. `data-dk="1"` marks
dark-background elements so they can be restored to black-with-white-text after the
monochrome pass. Keep both mechanisms — the CSS is the fallback, the inline baking is what
actually works.

---

## Two looks, not three: screen and paper

Every screen destination shows the same document — **preview, Save / Share, PDF and Image
are identical**, yellow blocks with black lettering. Paper is the only exception:
`buildHtmlDoc(screenHide=true)` bakes monochrome onto the clone's inline styles, and the
print stylesheet carries `#doc [data-dk]{background-color:black!important}` as the belt to
that braces.

It used to be three looks. The blocks were navy with yellow text, and the image share
repainted them on its own clone — which made the image the odd one out against the very
preview it was generated from, and produced a genuinely confusing UI. The colours live in
the document now and there is nothing to repaint.

**Every block MUST carry `data-dk="1"`.** This is the load-bearing rule of the new
arrangement. `buildHtmlDoc` used to find blocks by darkness so print could restore them as
black bars; a yellow block is light, so that test no longer finds one. Fourteen elements
carry the attribute and the print pass reads nothing else. Add a block without it and it
prints as bare text with no bar — which is exactly the regression that had every A4 table
header printing flat before 2026-09-01.

The luminance test (`isBlockBackground`) is still there and still earns its place: it
catches the two **coloured status bars** — the purple estimate notice and the rose credit
note — which keep their own colour on screen because they carry meaning rather than
branding, and are dark enough to be tagged automatically for paper.

Verify a change here by simulating the print pass rather than reading it: render the
document, apply the whiten-then-restore-`[data-dk]` sequence, and count the bars. Fifteen
elements come back black on an invoice, and nothing overflows the 68mm box.

---

## A setting that nothing reads is a lie to the user

Four Settings fields shipped doing nothing: `showBusinessNameOnReports` was read into a
variable and never used, and `phone` / `email` / `address` were saved to Firestore, echoed
back into the form, and never rendered — under a heading that reads *"Used on invoices,
receipts, and all generated documents."* Both toggles and all three fields round-tripped
perfectly, so nothing looked broken from the inside.

`npm run lint` cannot catch this: the config is `no-undef` only, and an unused read is
valid JavaScript. When adding a Settings field, grep for it in `PrintView.jsx` and assert
it in `PrintView.docs.test.jsx` — the tests there now cover every business-profile field
in both directions (present when set, absent when blank).

---

## Sizing type to a box: measure the fill, don't eyeball the box

"The masthead box is too wide" turned out to be the opposite problem. Measuring the
business name's rendered width against the box's inner width gave 69% on thermal, 46% on
A5, 38% on A4 — the box is the document's width, which is right for a masthead; the name
was simply too small on paper. Thermal, sized by printing rather than by eye, was the
reference that already looked correct.

Two things worth keeping from that:

- **Measure the ratio, not the element.** A range over the text node
  (`range.selectNodeContents(el).getBoundingClientRect().width`) against the parent's
  content box answers "is this too wide or too small" in one number. A block-level heading
  reports the full container width, so measuring the element itself tells you nothing.
- **Type sized to a box must be derived from the content.** `mastheadFontPx` scales with
  the business name's length and floors at the previous fixed size, so a short name fills
  the box and a long one degrades to exactly what shipped before. A hard-coded 42px would
  have looked right for "Khyber Traders" and wrapped to three lines for anyone else.

---

## Debugging print output: measure, don't guess

The single biggest time sink here was reasoning about geometry from photographs and
adjusting numbers on a hunch. What actually worked:

1. **Print `tools/thermal-calibration.html`.** Bars of known width with their number at the
   tip give a *discrete* answer — a label either reached the paper or it did not. That beats
   estimating millimetres from a tilted photo, which produced two confidently wrong
   conclusions (including a "1.11× inflation" that was really a shrink).
2. **Prefer discrete evidence over measured pixels.** Perspective in a hand-held photo is
   easily 5–10%, enough to confuse 0.9× with 1.0×.
3. **Watch for a change that alters layout but not the symptom.** When a 4mm gutter visibly
   re-wrapped the text yet recovered no clipped digits, that ruled out a fixed offset and
   pointed at scaling. A fixed offset cannot behave that way.
4. **A standalone calibration file does not test the app.** It has its own `@page`; it
   measures the printer, not the fix. Verify fixes by printing a real document.

## Before pushing: `npm run verify`

`npm run verify` = lint then build. **A green `vite build` does not mean the app runs.**

This was learned the hard way: a helper was inserted above `const PERMS = [`, which looked
like module scope but sits inside a component body. It compiled cleanly, the build passed,
and the deployed app threw `ReferenceError: Can't find variable: isTransportMethod` on
render — every user hit a blank error screen.

- **`npm run lint`** is the guard that catches it. The ESLint config is deliberately narrow:
  `no-undef` only. On the broken file it reported the fault five times, at the exact lines.
  Keep the run clean, so that a clean run means something.
- **`tools/smoke-test.mjs`** loads the built bundle in a headless browser. Useful, but it
  only reaches the login screen — it passed the crash above without complaint, because that
  screen sits behind a login. Do not mistake it for a regression net. Set `CHROMIUM_PATH`
  to pin a browser binary.
- **`src/components/PrintView.docs.test.jsx` locks the thermal layouts.** Anything added to
  a document for paper must stay off the 68mm roll — an extra column is exactly what pushed
  right-aligned figures past the last dot before. It asserts the column count of every
  items table at every size, so a change that reaches thermal fails the run rather than the
  printer. When changing a document, also render it at thermal before and after and diff
  the markup: `renderToStaticMarkup` at `format:'thermal'` on HEAD vs the working tree is a
  byte-exact answer, which beats looking at a photo.
- **Print layouts can be tested without a browser.** `src/components/PrintView.aging.test.jsx`
  renders the real `PrintView` through `react-dom/server` at all three paper sizes and
  asserts the figures reach the page — including that the markup contains no `undefined`
  or `NaN`, which is what a renamed data key looks like on paper. `useEffect` does not run
  under SSR, so no DOM stub is needed. Copy that file's shape for any new document type;
  it is the only automated check that has ever exercised a PrintView layout.
- CI runs `npm run lint` before `npm run build`, so this cannot deploy again.
- Keep `eslint` in **devDependencies**, not installed ad hoc. A guard that isn't in
  package.json doesn't exist on CI or a fresh clone — this one shipped that way once.
- Globals from CDN `<script>` tags in `index.html` (currently `html2pdf`) must be declared
  in the ESLint config, or `no-undef` reports them as faults and the run stops being useful.

When inserting code by matching surrounding text, check the anchor's **scope**, not just
that the text is unique. `const PERMS = [` appears once in the file and is still the wrong
place to hang a module-level helper.

## Declaration order inside components: `npm run lint:scope`

A dependency array is evaluated **during render**, so anything named in one must already be
declared above it:

```js
useEffect(() => {...}, [authUid]);   // reads authUid at render time
const [authUid] = useState();        // ...so this has to come first
```

Getting that backwards shipped a white screen with
`ReferenceError: Cannot access 'f' before initialization`. The effect *body* was fine — it
was the deps that ran early.

`npm run lint:scope` finds these. It is a separate script from `npm run lint` because it
also reports call-time-safe cases (a function referencing a const declared lower down is
fine — it runs later), and that noise would stop the main lint from meaning anything. Run
it after adding or moving a declaration and judge each NEW name it reports:

- use in a **dependency array, JSX, or the top level of a component body** → real crash
- use **inside a function body** → fine

Two crashes now have come from misjudging where a declaration sits relative to its use.
Both were invisible to `vite build` and to the browser smoke test.

## Never erase a field because a lookup failed

`isTransportMethod()` answers "does this method use a courier". It returns false both for
"no" and for "I have never heard of this method". Those are different, and code that
DELETES data must tell them apart — use `isKnownVehicleType()` first.

Vehicle types can be renamed or deleted while invoices deliberately keep the old name, so
unknown methods are normal, not exceptional. `saveInvoice` once blanked
`transportCompany` and `biltyNumber` for any unrecognised method, which silently destroyed
the consignment number of every invoice on a renamed courier type the next time it was
saved — and the logistics block doesn't render for an unknown method, so nothing was
visible on screen either. The form now also keeps that block open when an unknown method
still carries courier details, so orphaned invoices stay editable.

## firestore.rules is executed, not reasoned about: `npm run test:rules`

A mistake in that file locks three people out of their own business data, and it is the one
file in the repo that nothing else checks — editing it here deploys nothing, so a wrong rule
is only discovered by a person who cannot work.

`npm run test:rules` starts the Firestore emulator and runs `tools/firestore-rules.test.mjs`
against the real file, with the cast that actually exists: an admin, a staff member holding
every permission, a staff member holding none, a deactivated account, and a signed-out
visitor. Run it before pasting anything into the console.

It is deliberately **not** part of `npm run verify` — it needs a JVM and a downloaded
emulator jar — so it has its own vitest config, and the main config excludes it.

The habit worth copying: the suite was written against the OLD rules first. Ten tests passed
(what the rules already got right) and six failed (the gap), which is what a gap looks like
when it is measured rather than asserted. After the change, all pass — and reverting just
`firestore.rules` makes eleven fail again, which is the check that the tests discriminate at
all. A test that passes before and after proves nothing.

Two rules details worth keeping:

- **`can()` uses `.get(key, default)`, never `permissions[key]`.** A missing map key is an
  ERROR in rules, not `false`, and an error fails the whole expression. The admin bootstrap
  writes `permissions: {}`, and role documents predate every permission ever added.
- **Ownership compares `resource.data.salespersonId` to `roleDoc().appUserId`.** The mirror
  carries the app_users id for exactly this reason. The two defaults differ in type as well
  as value, so a record with no author never matches a user with no mirrored id.

---

## Dates are date-only, so the ledger's tie-break IS its order

`buildCustomerLedger` sorts by `new Date(row.date).getTime()`. Every entry on a given day
therefore shares a timestamp, and what actually decides the sequence is the tie-break. That
sequence is not cosmetic: **`getInvoiceLedger` in `PrintView` reads `rows[idx - 1].balance`
as the invoice's printed "Previous Balance"**, and three other places do the same.

The original code expressed "invoice, then the cash taken on it, then a receipt, then a
credit note" as +0/+1/+2/+3 nudges on the day's timestamp. Those slots are per-DAY, not
per-invoice, so two bills on one day sorted `INV-8475, INV-8476, INV-8475-PAY`: the row
before the second bill was the *unpaid* first bill. A customer who settled their morning
bill in cash was handed an afternoon bill claiming Rs. 136,000 still outstanding.

Cash taken at billing now shares its invoice's timestamp **and its group**, one slot below
it, so it travels with the invoice wherever that invoice sorts. Standalone receipts still
land after every invoice of the day — a payment carries no invoice id, so there is nothing
better to pair it with.

Two things to keep:

- **Adding an entry type means giving it a `group` and a `slot`, not a new nudge.** A nudge
  orders it against the whole day; a group orders it against the document it belongs to.
- **This class of fault is only visible on paper.** `src/components/PrintView.prevbalance.test.jsx`
  renders the real `PrintView` through the real `buildCustomerLedger` — no stubbed ledger —
  with the reported figures, at all three sizes. Reverting `ledger.js` alone makes it fail
  with the exact figure from the screenshot, which is the check that it discriminates.

## Voiding, not deleting — and one filter point

Financial records are never removed. `voidRecord` writes `{voided, voidedAt, voidedBy,
voidReason}` and the record stays in Firestore.

Two decisions worth keeping:

- **Void is its own flag, not `status: 'void'`.** The improvement brief asked for the
  latter, but invoices already use `status` for the document TYPE — Billed, Booked,
  CreditNote, Estimate — and nineteen places branch on it. Overwriting it would void a
  credit note by erasing the fact that it ever was one.
- **The filter is applied in exactly one place.** The provider turns `invoicesRaw` /
  `paymentsRaw` / `expensesRaw` into `invoices` / `payments` / `expenses`, and every
  balance, report, export and list downstream reads the filtered arrays. Voiding therefore
  subtracts everywhere at once. Do not add a second filter in the accounting services —
  `src/services/audit/void.integration.test.js` asserts the whole path instead, so dropping
  the filter at the provider fails the test run.

**Document numbering must read the RAW lists.** A voided invoice still owns its number; it
is printed on paper somewhere. `getNextSeqNum(invoicesRaw, …)`, never `invoices`. The
Firestore counter in `claimDocNumber` only moves upward and would normally absorb a low
guess, but it falls back to this client-side scan when the transaction cannot run — which
is exactly when a duplicate number would ship.

**`auditLogs` is append-only and must never get a listener.** It only grows.
`AuditView` reads it once per visit with `orderBy('at','desc')` and `limit(LOG_PAGE)`.
A failed audit write is swallowed: a payment that saved without logging is bad, a payment
refused because the log was unreachable is worse.

---

## Firestore reads cost money — check before adding a listener

The project blew through the 50,000 reads/day free tier on 2026-08-28. `useLiveCollection`
attaches `onSnapshot` to a WHOLE collection: 15 calls × 3 users was exactly the 45 peak
listeners the console showed. Persistent local cache is now enabled, which is what stops
every page reload re-reading everything, and listeners no longer attach before sign-in.

Before adding another `useLiveCollection`, ask whether the screen needs the whole
collection and whether it needs realtime at all. `invoices` and `payments` grow forever and
still stream in full — see `docs/FIRESTORE_READS.md` for why they cannot simply be
date-bounded (the ledger needs full history) and what the proper fix looks like.

## Where the code lives

`src/App.jsx` was 6,033 lines and is now 882 — one component, `App`: the provider, the
fifteen collection subscriptions, the auth and user-account functions, `ctx`, and tab
routing. Everything else moved out over six phases in September 2026, each move proved
byte-identical by `tools/extraction-diff.mjs`. The full account, including the five rules
it produced, is in `docs/APP_EXTRACTION.md`.

```
src/
  App.jsx                 composition root — provider, collections, auth, routing
  context/AppContext.js   the one context; import it from here, never from App.jsx
  hooks/                  useLiveCollection
  lib/                    pure helpers: transport, docNumbers, a11y, constants, loginNames,
                          driveBackup — and claimDocNumber, kept apart because it needs firebase
  services/               the money: ledger, invoiceTotals, costPriceChange, profitAndLoss,
                          receivables, dashboard, reportEngine, audit
  components/ui/          ModalWrapper, ConfirmDialog, ScrollableTabBar, MultiPicker
  components/modals/      nine modals
  components/tabs/        Dashboard, Billing, Customers, Payments, Products, Admin
  components/admin/       eleven admin views
  components/PrintView.jsx    the documents — finished, do not reorganise
```

Two rules carry most of the weight:

- **Nothing may import from `App.jsx`.** That is a cycle, and ESM answers a cycle with an
  `undefined` binding at module-initialisation time — a blank page before React renders,
  which neither lint rule reports.
- **A module that imports `src/firebase.js` cannot be loaded by a test**, because that file
  initialises Auth on import and throws without credentials. Pure helpers live in their own
  module; components take what they need from the context (`claimDocNumber`, `fetchAuditLog`).
  This came up five separate times during the extraction.

---

## Roadmap and known weaknesses

`docs/IMPROVEMENT_BRIEF.md` holds an external review of the app plus my verification of its
claims and a working priority order. Read it before starting improvement work — it is the
running plan, with checkboxes to update.

The short version of what is verified and unfixed:

- **Security is done** (2026-08-28). Firebase Auth for every account, no passwords in
  Firestore, and `firestore.rules` is closed and mirrors what is published. Anything
  touching login, users or roles must keep three records in step — the `app_users` profile,
  the `userRoles/{uid}` mirror the rules read, and the public `loginIndex` sign-in needs
  before authenticating. See `docs/SECURITY_CUTOVER.md`, and `docs/ADMIN_RECOVERY.md` for
  what to do when nobody can administer the app.
- **Granular permissions are enforced for WRITES, not reads** (2026-09-01). `can()` now
  governs `receivePayments`, `addCustomers`, `addEditProducts`, `salesReturns`,
  `editOwnInvoices`, `issueInvoices` and `collectOnBill`. Reads are still UI-only and this
  is a structural limit, not an omission: every screen attaches an unconstrained
  `onSnapshot` to a whole collection, and Firestore evaluates a rule against the QUERY
  rather than the rows, so "only your own invoices" denies the listener outright and the
  app goes blank. `viewAllInvoices` and `viewLedger` cannot be enforced until the client
  query is scoped — which `docs/FIRESTORE_READS.md` wants anyway.
- Document numbers come from `Math.max(...)+1` over client-side records, so two people
  billing at the same moment get the same invoice number.
- All 15 collections are loaded in full by unconstrained `onSnapshot` listeners, including
  invoices and payments.
- `paymentStatus` is stored and editable rather than derived from payment transactions.
- No audit log, no void mechanism — financial deletes are physical.
- No tests. Write these **before** refactoring `App.jsx`, not after: the brief's own phase
  order gets this backwards, and there is nothing else to catch a regression in a
  4,900-line file.

## Deploying

GitHub Actions deploys on push to `main` and `claude/**`. Allow ~3 minutes before testing on
a device, and confirm the deploy landed before concluding a fix did not work — several
"nothing changed" reports here were simply prints taken against the previous build.
