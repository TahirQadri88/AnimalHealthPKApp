# Firestore read cost — audit

**Trigger:** 2026-08-28, the project crossed the Spark free tier's 50,000 reads/day.
53,000 reads, 61 writes, 1 delete. Reads are the entire problem.

---

## Where the number comes from

`useLiveCollection` is called **15 times**, each attaching `onSnapshot` to a whole
collection with no `where`, `limit` or date bound.

**15 collections × 3 signed-in users = 45**, which is exactly the peak listener count the
console reported. That match is worth trusting — it means nothing exotic is going on: no
duplicate subscriptions, no leak, no runaway loop. The architecture reads everything, and
that is the whole story.

Every attach reads every document in the collection, and until persistence was enabled,
every page load re-attached from scratch.

### What made 28 August unusually expensive

Around twenty deploys, each forcing every open tab to reload and re-read every collection.
Plus a self-inflicted bug — listeners attached before sign-in, pulled everything, then were
torn down and replaced when the session resolved, doubling the reads on every single load.

Both are fixed. **Measure a quiet day before sizing further work**: the steady-state figure
is likely far below 53k, and optimising against a number produced by our own deployment
churn would be optimising the wrong thing.

---

## Fixed so far

| Change | Effect |
|---|---|
| Listeners no longer attach before sign-in | Removes a full duplicate read of every collection on every page load |
| **Persistent local cache (IndexedDB)** | Reloads serve from cache and resume listeners from a token, fetching only what changed rather than everything |

The persistent cache is the big one. Staff reload throughout the day, and the same invoices
were being paid for over and over.

---

## Where each collection is really used

Counted by mapping every reference to its enclosing component. A count of 1 is usually just
the `useContext` destructure, not real use.

| Collection | Grows forever? | Real consumers | Scopeable? |
|---|---|---|---|
| `invoices` | **yes** | Analytics, Billing, Dashboard, Payments, Ledger, CreditNote, BulkOps | Hard — see below |
| `payments` | **yes** | Dashboard, Payments, Ledger, PaymentModal, Analytics | Hard — same reason |
| `customers` | slowly | Analytics, Dashboard, Billing, Masters, Segments | Possible later |
| `products` | slowly | Products, BulkOps, CreditNote, CompanyManager | Fine as-is |
| `expenses` | yes | Expenses, Analytics, **Dashboard** | Dashboard use blocks admin-gating |
| `app_users` | no | UserManagement, Analytics, Settings | Admin-only in practice |
| `expenseCategories` | no | Expenses, Masters | Admin-only in practice |
| `companies` | no | CompanyManager, BulkOps, Analytics, ProductModal | Small |
| `cities`, `areas`, `customerTypes`, `vehicleTypes`, `riders`, `transportCompanies`, `appSettings` | no | various | **Leave alone** — a handful of documents each |

Admin-gating the three admin-only collections was considered and rejected for now: it saves
one staff user three small listeners, and each gate is a chance to break a screen. Poor
trade against the persistent cache, which helps everyone on every load.

---

## The real remaining problem

`invoices` and `payments` grow without limit and are read by every screen. They cannot
simply be date-bounded, because **the customer ledger needs full history** — an opening
balance is meaningless if the query starts in January.

The design that fixes it properly:

1. A **rolling window** (say 12 months) for the global listeners that feed lists, dashboard
   and billing. That is all those screens ever show.
2. **Per-customer queries on demand** — `where('customerId','==',id)` when a ledger opens,
   fetching that customer's full history and nothing else.
3. **Date-scoped analytics** — query the selected period rather than filtering everything
   client-side.

This changes how data flows through the app, so it needs doing deliberately, with the
ledger verified against known balances before and after. Not a quick patch.

---

## Not the answer

- **Upgrading the Firebase plan.** It converts a design problem into a monthly bill that
  grows with the same curve.
- **Replacing listeners with one-time reads everywhere.** Realtime genuinely earns its keep
  where two people work the same data. Unbounded queries are the fault, not listeners.
- **Weakening the security rules.** The `get()` calls in them are billable reads, but that
  is a cost of authorisation, not waste. Read volume will not reach zero and should not.
