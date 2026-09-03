# V2 Improvement Brief — external review + assessment

**Provenance:** external review (ChatGPT), received 2026-08-28. Kept verbatim in
"The brief as received" below. This top section is Claude's verification of its claims
against the actual code, plus a working priority order. Update the status markers as
items are done — this file is the running plan.

---

## Verification: what I checked in the code

The review is **substantially accurate**. Every critical claim I tested was true, and on
the most serious one it *understates* the problem.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Firestore rules allow public read/write | **Confirmed** | `firestore.rules` — `match /{document=**} { allow read, write: if true; }` |
| 2 | Passwords stored in plaintext | **Confirmed, worse than stated** | `App.jsx` — login compares `u.password === loginForm.password`; users are written with a raw `password` field. **And there is a CSV export of all users including their passwords.** Combined with (1), anyone holding the API key can read every password. |
| 3 | Document numbering can collide | **Confirmed** | `getNextSeqNum()` takes `Math.max(...)+1` over client-side records. Two users billing at once get the same number. |
| 4 | Screens download whole collections | **Confirmed** | 15 × `useLiveCollection`, each an unconstrained `onSnapshot(collection(db, name))` — including `invoices` and `payments`. No query constraints anywhere. Live listeners, always on. |
| 5 | `paymentStatus` is a stored, editable field | **Confirmed** | Written directly onto invoice documents; not derived from payment transactions. |
| 6 | No audit log, no void mechanism | **Confirmed** | Zero occurrences of `auditLog` or `voidedAt`. Deletes are physical. |
| 7 | No tests | **Confirmed** | `package.json` scripts: dev, build, preview, lint, verify. |
| 8 | `App.jsx` has accumulated too much | **Confirmed** | ~4,900 lines containing UI, business logic and Firestore access. |

### Where the review is wrong or needs qualifying

- **"package.json already has a good lint → build → verify foundation"** — that was added
  today, hours before this review, and only after a scope error shipped a broken app. It is
  one `no-undef` rule, not a foundation. Don't read it as more coverage than it is.
- **Yearly numbering (`INV-2026-0001`)** — I'd advise against it. These numbers are read
  aloud, written on printed receipts and quoted by customers. Changing the visible format
  on a live business buys nothing; fix the *atomicity*, keep the format.
- **Phase order puts refactor (5) before tests (6).** This is backwards and is the review's
  main flaw. Extracting features out of a 4,900-line file with zero tests has nothing to
  catch regressions. Tests on the money math are cheap, touch no UI, and must come first.
- **Firebase Auth migration** is correct but is a big-bang change to login for a business
  that uses this daily. "Migrate existing users safely if possible" is hand-wavy; it needs
  a written rollback plan before a line is changed.
- Several sections (global search, PWA offline, full accessibility audit) are reasonable
  but not urgent, and would compete with the items that actually cause loss.

---

## Working priority order

Ordered by *risk of loss*, not by how interesting the work is. Security is finished; what
remains is correctness and maintainability.

### Done

- [x] **Restrict the Firebase API key** to the app's domain (referrer restrictions set).
- [x] **Stop exporting passwords** — password column removed from the users CSV.
- [x] **Firebase Auth + closed Firestore rules** (2026-08-28). No passwords in Firestore,
      rules live and verified against admin, staff and signed-out access.
      See `docs/SECURITY_CUTOVER.md`.
- [x] **Admin lockout protection and recovery** — last admin cannot be demoted or deleted;
      console recovery documented in `docs/ADMIN_RECOVERY.md`.
- [x] **Receivables aging + exports** (brief §15). Admin → Receivables buckets debt by age
      and agrees with the ledger by construction. Exports go through the existing
      `docType: 'report'` PrintView pipeline rather than a second one, so aging gets A4, A5,
      thermal, PDF, image share and WhatsApp text for free; CSV is `exportToCSV`. Every
      export foots to the rows on screen — the bucket chip and search box filter the sheet
      as well, and `summariseAging` recomputes the totals over what is shown.

- [x] **Audit log + void instead of delete** (2026-09-01, brief §11 and §12). `auditLogs` had
      been append-only in the rules since the security cutover with nothing writing to it,
      and invoices, payments and expenses were removed with `deleteDoc`. Creates, edits and
      voids of invoices, payments, credit notes and expenses now write an entry; financial
      records are voided rather than deleted and can be restored. Admin → Activity shows
      both. Void is a separate `voided` flag, NOT `status:'void'` as the brief asked — that
      field already carries the document type. The void filter is applied once, at the
      provider, so it reaches every balance and report; `getNextSeqNum` deliberately keeps
      reading the raw lists so a voided document never gives its number away.

      Still open in this area: the void buttons are gated in the UI only. `firestore.rules`
      allows `update: if active()` on all three collections, so a non-admin could set the
      flag directly — the same UI-only gap as §H below, not a new one.

- [x] **Dashboard nets sales returns** (2026-09-01). Home counted `status === 'Billed'`
      only, so a credit note reduced nothing: the same period showed one figure on Home and
      another in Analytics, and "Top 5 Products by Sales Value" still ranked goods that had
      come back. Extracted to `services/analytics/dashboard.js` with tests, the way
      `computePnL` was.

      Home and Analytics still differ by design and by label: Home's **Sales** is what was
      billed (invoice totals, so delivery charged and discount given are in it), while
      Analytics' **Product Sales** is line-item level and excludes both. Both now net
      returns; only the question differs.

### Next

**A. The verification pass below** — it is the only item left that needs the live app rather
than this repo, and it has been outstanding since the security cutover.

Everything else on this list is either done or deliberately parked. The two parked items —
Firestore query scoping (D) and read permissions in the rules, which depends on it — are
parked with reasons written down, not forgotten.

- [x] **Backup and restore** (2026-09-03, brief §33). The backup half had been running
  weekly for months; the restore half had never been executed, and it accepted any JSON at
  all, wrote to any collection named in the file including the append-only audit log, wrote
  records with no id to a document called "undefined", and — because `saveToFirebase`
  swallowed its own errors and returned nothing — counted its own iterations, so a restore
  in which every write failed still reported every record written. Now inspected before
  anything is written (`services/backup/restore.js`, 27 tests), shown to the person with
  what is refused and why, offered a "download current data first" step, and reported
  afterwards on what the server actually acknowledged.

### Done since this list was written

- [x] **Analytics and Reports** (2026-09-03). All eight items of `docs/ANALYTICS_AUDIT.md`;
  §5 of that file records what shipped, the three breakdown faults the drill-down work
  uncovered, and what is deliberately left open. The aging duplication that prompted the
  audit — a 200-day-old balance reported as current because the customer bought yesterday —
  is fixed and both screens now read from `buildAgingReport`.
- [x] **B. Atomic document numbering.** `lib/claimDocNumber.js` claims the number in a
  Firestore transaction over `counters/{prefix}`, seeded and floored by the old client-side
  guess so numbering continues from existing records and can never reissue. The format is
  unchanged, as this file argued it should be. Degrades to the old behaviour with a console
  warning if the transaction cannot run.
- [x] **G. Derive `paymentStatus`.** `paymentStatusById` in `App.jsx` runs `allocateCredits`
  over the real invoices and payments; the stored field survives only as a fallback for a
  record the allocation does not reach. `getCustomerBalance` has been the single
  customer-balance calculation since the ledger was extracted.

### Previously, in this order

**A. Verification pass — no code, ~20 minutes, do this first.**
Everything built for the closed-rules path was reasoned through rather than executed; it
cannot be tested from a dev machine without access to the live project. Untested paths:
disabled user, wrong password, and one full invoice → payment → ledger → print cycle. That
last one matters most because printing touches several collections at once.

**B. Atomic document numbering — small, and a live bug.**
`getNextSeqNum()` takes `Math.max(...)+1` over records already loaded in the browser, so
two people billing at the same moment get the same invoice number. With three users that is
a matter of when, not if. Move to a Firestore transaction over a `counters/` collection.
Keep the `INV-0001` format — those numbers are read aloud and printed on receipts, and
changing the format buys nothing. Legacy ids must stay readable.

**C. Tests for the money math — DONE.** vitest wired into `npm run verify`; invoice
arithmetic extracted to `services/accounting/invoiceTotals.js` with tests, plus the Karachi
date handling. Found and fixed a real bug on the first run (`formatDateDisp` rendering
"date-undefined-ot"). Ledger and analytics calculations are still inline and untested —
extract them the same way when touching them.

**C (original scope, partly remaining).**
Invoice subtotal, discount, delivery, total, profit; ledger opening balance through to
closing; analytics revenue, COGS, gross and net profit; date ranges (today, week, month,
custom) against the Karachi timezone. Pure functions, no UI risk. Nothing structural should
be attempted before these exist, because there is currently nothing to catch a regression
in a 5,000-line file.

**D. Firestore read cost — audit in `docs/FIRESTORE_READS.md`. Partly done.**
53,000 reads against a 50,000/day limit, with 61 writes and 1 delete. Reads are the whole
problem, and the shape of it is not mysterious: `useLiveCollection` is called 15 times, each
attaching `onSnapshot` to an entire collection with no `where`, `limit` or date bound. Three
signed-in users × 15 collections is exactly the 45 peak listeners the console reported.
Every attach reads every document in the collection, and every page load re-attaches.

Two contributing factors already dealt with: listeners no longer attach before sign-in (they
were pulling everything on the login screen and then being replaced the moment the session
resolved — a second full read per load), and that fix is live.

Before optimising further, note that 2026-08-28 was not a normal day — dozens of deploys,
each forcing every open tab to reload and re-read every collection. Measure a quiet day
before assuming the steady-state number is anywhere near 53k.

Then audit rather than guess, per collection: which screens need it, whether realtime is
actually valuable, how many documents it returns, and whether it can be scoped by date,
paginated, loaded on demand, or read once. Priorities in order: **invoices** and
**payments** first (they grow forever and are read on every screen), then **customers** and
**expenses**. Leave `cities`, `areas`, `customerTypes`, `vehicleTypes`, `riders`,
`transportCompanies` alone — a handful of documents each, and scoping them buys nothing.

Do NOT upgrade the Firebase plan to make this go away, and do NOT blanket-replace realtime
listeners with one-time reads. Realtime is genuinely useful where two people work the same
data; the problem is unbounded queries, not listeners as such.

Worth knowing: the `get()` calls in the security rules are themselves billable reads. That
is not a reason to weaken the rules — security first — but it means read volume will not go
to zero.

**E. Audit log — the rules are already in place.**
`auditLogs` is append-only in `firestore.rules` and nothing writes to it. Record who did
what, when, and to which record for: invoice created/edited/voided, payment
created/edited/voided, credit note, expense, customer edit, product price change,
permission change, settings change. Never log credentials.

**F. Void instead of delete.** Financial records should carry
`{status:'void', voidedAt, voidedBy, voidReason}` rather than being removed. Pairs
naturally with D — a deletion you cannot see is exactly what the audit log is for.

**G. Derive `paymentStatus`** from payment transactions instead of storing it on the
invoice, alongside a single customer-balance calculation used everywhere. Do this after C:
it changes numbers on screen, and tests are what make that safe.

**H. Enforce permissions in the rules — DONE for writes (2026-09-01).** `can()` now governs
`receivePayments`, `addCustomers`, `addEditProducts`, `salesReturns`, `editOwnInvoices`,
`issueInvoices` and `collectOnBill`. `npm run test:rules` executes the file against the
Firestore emulator; the suite was written against the old rules first, where six of it
failed, and reverting the rules today makes eleven fail.

One fix fell out of it: the billing screen offers "Add / Edit Products" to staff holding
`addEditProducts`, and the rules refused them — a button that could only ever produce a
permission error. The permission now governs that collection.

**Reads remain UI-only, and cannot be closed from this file.** Every screen attaches an
unconstrained `onSnapshot` to a whole collection, and Firestore evaluates a rule against the
QUERY, not the rows: a rule restricting invoices to their author denies that listener
outright and the app goes blank. `viewAllInvoices`, `viewLedger`, `viewCustomers` and
`viewDashboard` need the client query scoped first — which is D above.

**I. Incremental `App.jsx` extraction — DONE (2026-09-02).** 6,033 lines to 882, 263 tests
to 421, no regression reaching the app. Account and rules in `docs/APP_EXTRACTION.md`.
Originally planned in detail in `docs/APP_EXTRACTION.md`
(2026-09-01) — six phases, leaves first, one component per commit, each move proved by
rendering the component through `react-dom/server` before and after and requiring
byte-identical markup. The prerequisite (C, tests for the money maths) now exists.

The rule that matters most is the one this project has not been bitten by yet: **nothing
extracted may import from `App.jsx`**. That is a cycle, and ESM answers a cycle with an
`undefined` binding at module-init time — a blank page, before React renders, that neither
lint rule would catch. Shared helpers move into their own modules first.

### Optional, not on the path

- **Real-email login.** Usernames are already real addresses
  (`animalhealthpk@gmail.com`, `owais797@icloud.com`, `ghousia.qadri@gmail.com`), so
  Firebase Auth could use them directly and enable self-service password reset. Recovery is
  already covered by admin reset, so this is convenience. Needs a fallback during the
  switch: the account email changes when the user clicks a link in their inbox, and the
  login index still points at the old address until it is updated.

### Scope guard

The review is right to fence this off, and it matches how the app is used: **no purchase
management, supplier payables, stock ledger, warehouse or ERP modules.** Products stay
catalogue data. If one of these is genuinely wanted later it should be asked for
explicitly, not arrived at by drift.

---

## The brief as received

> Verbatim, as received. Read the assessment above before acting on any of it.

### ROLE

You are working on an existing production-oriented React/Vite PWA called AnimalHealthPKApp.
This is a real wholesale business management application for a veterinary wholesale business.

Your job is NOT to rebuild the application from scratch. Your job is to:

1. Audit the existing codebase.
2. Understand the existing business logic before changing it.
3. Preserve all currently working functionality.
4. Improve security, reliability, maintainability, accounting correctness, UX, performance, and operational workflow.
5. Make changes incrementally and safely.
6. Avoid adding unnecessary ERP functionality.

IMPORTANT: Do NOT introduce Purchase Management, Supplier Payables, or Inventory/Stock Management as new features.

The application is intentionally focused on: Sales, Billing, Estimates, Orders, Invoices, Dispatch, Sales Returns, Customers, Customer Ledgers, Payments / Collections, Expenses, Business Analytics, Products as master/catalog data, Riders / Delivery, User management, Settings, Backup / restore.

### 1. FIRST RULE — AUDIT BEFORE MODIFYING

Before changing code, read CLAUDE.md, README.md, AnimalHealthApp_Build_Prompt.txt, PLAN.md; inspect package.json, Firebase configuration, Firestore rules, all major files under src/. Identify current collections and data models, all invoice/document types, all calculations affecting money, all permission checks, all delete operations, all Firebase writes, all places where invoice/receipt IDs are generated, all places where customer balances are calculated, all places where profit/revenue calculations are performed, all places where dates are filtered, all print/share/PDF functionality.

Do NOT start refactoring immediately. First produce an internal architecture map.

### 2. CURRENT BUSINESS SCOPE

SALES: Estimates, Orders, Invoices, Dispatch Notes, Sales Returns / Credit Notes.

CUSTOMERS: Customer master, search, segmentation, ledger, opening balance, outstanding balance, transaction history, customer-specific invoices and payments.

COLLECTIONS: Cash, Bank Transfer, Cheque, other configured methods, payment receipts, customer outstanding balances, collection reporting.

EXPENSES: Expense entry, categories, date filtering, reporting, profit calculation.

DELIVERY: Rider, Rickshaw, Suzuki, Intercity Transport, Self-Pickup, Driver, Transport company, Bilty, Delivery address.

PRODUCTS: master/catalog data only. DO NOT build a stock management system. Keep to Name, Company, Unit, Cost price, Selling price, Active/inactive, relevant metadata. Do not add purchase stock, stock ledger, warehouse management, stock transfers, supplier purchases, payables unless explicitly requested later.

### 3. CRITICAL SECURITY IMPROVEMENT

The current Firestore rules are effectively allow read/write to everyone. This is unacceptable for production. The application currently uses custom username/password logic rather than Firebase Authentication. Replace this architecture with Firebase Authentication.

Target architecture: Firebase Authentication → Authenticated UID → User profile in app_users → Role → Permissions → Firestore Security Rules.

Do NOT rely on React UI permission checks as the security boundary. UI permissions are only for user experience. Firestore rules must enforce actual authorization.

### 4. AUTHENTICATION

Replace plaintext password storage with Firebase Authentication. Users should have `{ uid, name, role, permissions, active, createdAt, updatedAt }`. Do NOT store passwords in Firestore.

Support login, logout, session persistence, admin users, staff users, disabled users, password reset, current-user state. Do not break the current staff/admin permission model. Migrate existing users safely if possible. Do not silently delete existing user records.

### 5. FIRESTORE SECURITY RULES

Create proper collection-level security. At minimum: unauthenticated users get no database access; authenticated users only permitted operations; admin full access; staff restricted according to permissions.

Protect sensitive operations: deleting invoices, deleting payments, deleting customers, modifying financial records, modifying users, changing permissions, changing settings, backup operations.

### 6. CUSTOMER LEDGER — MAKE THIS THE FINANCIAL SOURCE OF TRUTH

Customer balance must be derived consistently from transactions: Opening Balance + Invoices − Sales Returns − Payments = Outstanding Balance.

Create centralized business functions, e.g. `calculateCustomerBalance(customerId)`, `calculateCustomerLedger(customerId)`, `calculateInvoiceBalance(invoiceId)`, `calculateReceivables()`.

Do not duplicate balance calculations across Customer list, Dashboard, Ledger, Analytics, Invoice modal, Payment modal, Reports. All should use the same calculation layer.

### 7. CENTRALIZE FINANCIAL CALCULATIONS

Create a business-logic layer independent from React UI:

```text
src/
  services/
    accounting/
      ledger.js
      invoiceCalculations.js
      paymentCalculations.js
      analyticsCalculations.js
      receivables.js
  utils/
    dates.js
    numbering.js
    validation.js
```

Examples: `calculateInvoiceSubtotal(items)`, `calculateInvoiceTotal(items, discount, deliveryCharge)`, `calculateInvoiceProfit(invoice)`, `calculateCustomerBalance(customerId)`, `calculateGrossRevenue(invoices)`, `calculateSalesReturns(creditNotes)`, `calculateNetRevenue(...)`, `calculateGrossProfit(...)`, `calculateNetProfit(...)`, `calculateCollectionTotal(...)`.

The UI should call these functions. The UI should NOT contain complex accounting formulas.

### 8. DO NOT TRUST STORED DERIVED VALUES BLINDLY

Review `paymentStatus`, `receivedAmount`, `total`, `profit`, `balance`, `outstanding`. Determine which values are source data and which are derived. Source transactions should be authoritative; derived values calculated consistently. Do not create multiple conflicting sources of truth.

### 9. INVOICE PAYMENT STATUS

Payment status can become stale when payments are recorded separately from invoices. Do not reintroduce this problem. Payment status should be derived from invoice total + customer ledger/payment transactions. States: Pending, Partial, Paid. Centralize the rules. Avoid a manually editable payment status.

### 10. DOCUMENT NUMBERING

Keep the user-friendly `INV-0001` / `REC-0001` / `ORD-0001` / `EST-0001` format. Review concurrency: determining the next number from client-side records creates collisions when two users create records simultaneously. Implement an atomic Firestore numbering strategy with a `counters/` collection and Firestore transactions. Consider yearly numbering (`INV-2026-0001`) only if it will not break existing records. Legacy IDs must remain readable. Never rewrite old document IDs automatically.

### 11. FINANCIAL RECORD DELETION

For accounting records prefer VOID over physical deletion: `{ status: "void", voidedAt, voidedBy, voidReason }`. Applies to invoices, payments, credit notes, expenses. Physical deletion restricted to administrators and preferably limited to non-financial master data. Do not break existing delete functionality without a migration plan.

### 12. AUDIT LOG

Introduce an `auditLogs` collection: `{ id, userId, userName, action, entityType, entityId, timestamp, before, after, metadata }`.

Track: invoice created/edited/voided, payment created/edited/voided, credit note created/edited, expense created/edited, customer edited, product price changed, user permission changed, settings changed. Do not log passwords.

### 13. PRODUCT PRICE CHANGES

Existing invoices must preserve their historical selling rate and cost price. Do NOT automatically rewrite historical financial documents. A product's current price is not the price used on a historical invoice. Review the existing cost-price update behaviour and ensure historical accounting remains correct.

### 14. CUSTOMER EXPERIENCE

Customer card should quickly expose: Customer Name, Outstanding, Last Invoice, Last Payment, Last Transaction, and actions [Ledger] [New Invoice] [Receive Payment] [WhatsApp]. Avoid unnecessary navigation. Clicking a customer anywhere should consistently open the customer ledger.

### 15. RECEIVABLES / COLLECTION CENTER

Add a dedicated receivables view if one does not already exist. Display customer, outstanding amount, last payment, last invoice, days since last payment, days since last transaction. Filters: All, High Balance, Overdue, Recently Active. Actions: View Ledger, Receive Payment, WhatsApp, Call. CUSTOMER RECEIVABLES only — no supplier/payables functionality.

### 16. DASHBOARD

A business command center rather than decorative charts. Today: Sales, Collections, Expenses, Gross Profit, Net Profit. Outstanding: Total Receivables, number of customers with balance, high-balance customers. Operations: pending invoices, pending dispatch, sales returns. Quick Actions: New Invoice, Receive Payment, New Expense, Customers, Dispatch. Charts should support decisions.

### 17. ANALYTICS

Metrics: Gross Revenue, Sales Returns, Net Revenue, COGS, Gross Profit, Gross Margin, Expenses, Net Profit, Collections, Receivables. Breakdowns: Company, Product, Customer, Salesperson, City, Area, Customer Type. Date filters must behave consistently via one centralized date-range utility.

### 18. DATE HANDLING

Audit every date operation. Pakistan/Karachi business timezone must be handled consistently. Avoid UTC/local conversions causing wrong day, wrong monthly totals, wrong invoice dates, incorrect dashboard totals. Centralize `getBusinessDate()`, `getTodayRange()`, `getWeekRange()`, `getMonthRange()`, `getYearRange()`, `getCustomRange()`. All reports use the same definitions.

### 19. DISPATCH CENTER

Create a fast dispatch workflow showing invoice, customer, amount, method, rider, with [View] [Print] [Call]. Filters: Pending, Dispatched, Self-Pickup, Intercity, Rider, Date. Easy to use on mobile.

### 20. MOBILE-FIRST BILLING

Optimize for rapid invoice creation: Customer → Product → Quantity → Add → … → Save. Reduce modal switching. Support searchable products, recently used products, quick customer creation, duplicate invoice, repeat previous order, keyboard navigation, clear save states, clear validation. Do not complicate the UI to add features.

### 21. GLOBAL SEARCH

Consider searching across customer name, customer phone, invoice number, receipt number, product, company. Results should clearly identify the entity.

### 22. WHATSAPP WORKFLOW

After creating an invoice/payment receipt provide [Print] [Share] [WhatsApp] [New]. Generate a concise customer-facing message. Do not automatically send messages — the user must explicitly choose.

### 23. PRINTING AND SHARING

Protect existing print functionality: invoice print, payment receipt, credit note, dispatch note, customer ledger, reports. Ensure correct alignment, correct Urdu/English rendering, no stale payment-status information, working mobile sharing, PDF generation surviving UI refactors, content within print margins. Do not unnecessarily redesign print templates.

### 24. MODAL SYSTEM

Preserve existing careful modal behaviour: Escape behaviour, focus trap, initial focus, scrolling, mobile height, desktop layout, background click, accessibility labels. Do not replace working modal infrastructure with a generic library without strong reason.

### 25. ACCESSIBILITY

Audit button labels, aria-labels, keyboard navigation, focus visibility, form labels, colour contrast, disabled states, modal focus, screen-reader meaning. Do not sacrifice accessibility for visual styling.

### 26. ERROR HANDLING

Every important Firebase operation should have idle / loading / success / error states with a retry path. Do not silently swallow Firebase errors. Log technical detail to console only where appropriate; show useful user-facing messages without exposing internals.

### 27. FIRESTORE PERFORMANCE

Review every `onSnapshot`. Avoid unnecessary listeners. Look for duplicate listeners, listeners for data no longer needed, full collection reads for small UI operations, repeated recalculation of large arrays, unnecessary rerenders. Use memoization, indexed queries, pagination, filtered queries. Do NOT prematurely optimize tiny collections — prioritize actual bottlenecks.

### 28. FIRESTORE COST CONTROL

Review whether every screen downloads entire collections, particularly invoices, payments, audit logs, backups. Avoid repeatedly reading large collections to calculate a small dashboard value. Use query constraints, date filters, aggregation, carefully designed summary documents. Do not denormalize financial data without documenting the source of truth.

### 29. STATE MANAGEMENT

Do NOT introduce Redux merely for architecture. Keep AppContext for shared state, move business logic into services, reusable UI into components, feature-specific state closer to its feature. Avoid a giant global context containing everything.

### 30. APP.JSX REFACTOR

Do not rewrite in one operation. Refactor gradually toward:

```text
src/
  features/
    billing/    { Billing.jsx, InvoiceForm.jsx, InvoiceList.jsx, CreditNoteModal.jsx }
    customers/  { Customers.jsx, CustomerLedger.jsx }
    payments/   { Payments.jsx, PaymentModal.jsx }
    expenses/   { Expenses.jsx }
    analytics/  { Analytics.jsx }
    dispatch/   { Dispatch.jsx }
  components/ { ui/, modals/, forms/, tables/, print/ }
  services/   { accounting/, firebase/, backup/ }
  hooks/      { useAuth.js, usePermissions.js, useFirestore.js }
  utils/      { dates.js, formatting.js, numbering.js, validation.js }
```

Extract one feature at a time. After each extraction run `npm run lint`, `npm run build`, `npm run verify`. The application must continue working.

### 31. TESTING

Add automated tests for business-critical calculations.

- Invoice: subtotal, discount, delivery, total, transport expense, profit.
- Ledger: opening balance, invoice, payment, sales return, multiple transactions, zero balance.
- Analytics: revenue, returns, COGS, gross profit, expenses, net profit.
- Dates: today, week, month, last month, year, custom range.
- Numbering: sequential invoice, sequential receipt, legacy IDs, concurrent creation strategy.
- Permissions: admin, staff, restricted staff.

### 32. DATA VALIDATION

Centralized `validateCustomer()`, `validateProduct()`, `validateInvoice()`, `validatePayment()`, `validateExpense()`, `validateCreditNote()`. Validate both UI input and service/database operations. Never assume frontend validation alone is sufficient.

### 33. BACKUP AND RESTORE

Audit automatic backup, Google Drive backup, Firestore backup collections, restore process. A backup is only useful if restoration works. Add/verify a safe restore workflow. Never allow an accidental restore to overwrite production data without confirmation (warn, offer "Create Backup First", require explicit continue).

### 34. PWA QUALITY

Review service worker, manifest, installability, app icons, offline shell, cache strategy, update behaviour. Do not promise full offline accounting unless implemented. Offline invoice creation needs a proper synchronization/conflict model first.

### 35. UI/UX DIRECTION

Maintain the existing visual identity — do not turn it into generic SaaS UI. Prioritize clean, professional, fast, mobile-first, high information density where useful, strong hierarchy, clear status indicators, good spacing, consistent buttons/forms/tables, minimal unnecessary animation.

### 36. RESPONSIVE DESIGN

Natural on iPhone, Android, tablet, desktop. Mobile should not be a compressed desktop layout. Thumb-friendly controls; important actions reachable without excessive scrolling.

### 37. DATA MIGRATION

Before changing data models: identify current documents and legacy formats, create migration utilities if necessary, never silently discard old fields, preserve historical invoices, payments, customer balances and legacy document numbers. Every migration reversible where practical.

### 38. LOGGING

Structured development logging where useful; avoid excessive console output in production. Errors should include operation, collection, record ID, user, timestamp. Never log passwords, auth tokens or credentials.

### 39. DOCUMENTATION

Create or maintain README.md, CLAUDE.md, ARCHITECTURE.md, DATA_MODEL.md, SECURITY.md, TESTING.md, CHANGELOG.md. Document architecture, Firebase setup, collections, permissions, financial calculations, numbering, backup, deployment, migration strategy. Future AI coding agents will use these.

### 40. DO NOT ADD THESE FEATURES

Unless explicitly requested later: Purchase Management, Supplier Payables, Warehouse Management, Stock Ledger, Stock Transfers, Purchase Orders, Supplier Statements, complex ERP modules. Also avoid unnecessary notifications, unnecessary AI features, complicated dashboards, unnecessary charts, unnecessary dependencies.

### 41. DEVELOPMENT PROCESS

- PHASE 1 — AUDIT: architecture summary, security findings, financial logic findings, UX findings, performance findings, technical debt, recommended priority. No large changes yet.
- PHASE 2 — SECURITY: Firebase Auth, secure Firestore rules, user migration, permission enforcement.
- PHASE 3 — ACCOUNTING CORE: centralized calculations, centralized ledger, reliable payment status, reliable numbering, audit trail.
- PHASE 4 — UX: dashboard, customer workflow, receivables, billing, dispatch, global search, WhatsApp workflow.
- PHASE 5 — ARCHITECTURE: gradually break down App.jsx.
- PHASE 6 — TESTING: business logic and critical workflow tests.
- PHASE 7 — PERFORMANCE: optimize Firestore reads and React rendering after measuring bottlenecks.

### 42. IMPORTANT CODING RULES

Before every change: understand existing behaviour, search for all references, consider historical data, mobile, print output, permissions, Firestore security, simultaneous users. After every significant change run `npm run lint`, `npm run build`, `npm run verify`, and tests if they exist. Do not leave the repository in a broken build state.

### 43. CHANGE MANAGEMENT

For major changes: dedicated branch, one logical group of changes, run verification, review the diff, test affected workflows, commit descriptively. Avoid giant "Improve app" commits. Prefer `security: migrate users to Firebase Auth`, `accounting: centralize customer ledger calculation`, `billing: implement atomic document numbering`, `ux: improve customer receivables workflow`, `refactor: extract billing feature from App.jsx`.

### 44. FINAL SUCCESS CRITERIA

- **Security:** no public database access, no plaintext passwords, real authentication, real authorization.
- **Accounting:** one consistent ledger calculation, reliable invoice/payment/return relationships, historical records preserved.
- **Reliability:** clear errors, reliable saves, safe destructive operations, audit history, tested calculations.
- **UX:** fast billing, fast collections, excellent customer lookup, ledger and dispatch workflow, mobile-first.
- **Performance:** reasonable Firestore reads, fast initial load, minimal unnecessary rerenders.
- **Maintainability:** business logic separated from UI, smaller feature components, clear documentation, tests around critical calculations.
- **Scope:** remains a focused wholesale sales/accounting/operations application. DO NOT turn this into a generic ERP.

### FINAL INSTRUCTION

Before writing code, inspect the existing implementation carefully. Do not assume the build prompt matches the current code. The actual repository is the source of truth. Where old documentation, the build prompt and the current implementation conflict, identify the difference and explain the risk before making a destructive change.

Preserve working functionality. Improve incrementally. Turn AnimalHealthPKApp from a successful vibe-coded prototype into a secure, reliable, maintainable production business application — without unnecessary feature expansion.
