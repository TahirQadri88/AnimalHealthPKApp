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

## Roadmap and known weaknesses

`docs/IMPROVEMENT_BRIEF.md` holds an external review of the app plus my verification of its
claims and a working priority order. Read it before starting improvement work — it is the
running plan, with checkboxes to update.

The short version of what is verified and unfixed:

- **Security is done** (2026-08-28). Firebase Auth for every account, no passwords in
  Firestore, and `firestore.rules` is closed and mirrors what is published. Anything
  touching login, users or roles must keep three records in step — the `app_users` profile,
  the `userRoles/{uid}` mirror the rules read, and the public `loginIndex` sign-in needs
  before authenticating. See `docs/SECURITY_CUTOVER.md`.
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
