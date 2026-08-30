# Firestore read cost — audit

**Trigger:** 2026-08-28, the project crossed the Spark free tier's 50,000 reads/day.
53,000 reads, 61 writes, 1 delete.

**Resolved.** A clean day (30–31 Aug, no deploys) measured **6,000 reads — 12% of the free
limit**, with **zero denies and zero errors**. The 54,000 was our own deployment churn. See
"Clean-day baseline" below; the scaling concern still stands but is months away.

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
| Listeners no longer attach before sign-in | Removes a full duplicate read of every collection on every page load, and the denied evaluations that went with it |
| **Persistent local cache (IndexedDB)** | Reloads can serve unchanged documents from cache and resume listeners from a token, rather than re-reading everything |

### The persistent cache is not "local-first"

Worth separating, because the two get conflated and the second genuinely is risky:

- **Local-first** means the app owns its data, writes queue offline and a sync engine
  reconciles conflicts. A large architectural change. **Not done, not planned.**
- **Firestore's persistent cache** is one configuration option on `initializeFirestore`. No
  business logic changes, no data flow changes, no conflict model. Firebase's own answer to
  repeated reads of unchanged documents.

The behaviour worth knowing: a screen may paint from cache a moment before the server
confirms, and an offline device will show the last known data rather than an error. For a
wholesale ledger that is an improvement over a blank screen, but it is a change, so watch
for anything that looks stale after another device edits it.

The persistent cache is the biggest single lever, but **it is not a quota bypass and it does
not make reloads free.** Resume tokens expire, a reconnect can re-deliver a whole result
set, and a device with a cold cache still reads everything once. The honest claim is
narrower: it avoids *unnecessary repeated* network reads of documents that have not changed.
Expect a meaningful reduction, not a collapse to near-zero — and judge it on the measured
figure, not on the mechanism.

---

## Measured baseline — 2026-08-29, one hour of real use

**1,500 reads, 7 writes, 0 deletes in 60 minutes.** The per-minute graph is flat at zero
except for a single spike of roughly 900 in one minute.

Two things follow, and they matter more than yesterday's headline number.

**An open, idle app costs nothing.** The flat line is listeners sitting attached with no
billing. Realtime is not the expense — attaching is.

**One cold load costs roughly 900 reads**, which is about the whole database. That number
explains yesterday exactly:

```
20 deploys × 3 users = 60 forced reloads
60 loads × 900 reads = 54,000 reads     ← yesterday's figure
```

That is close enough to settle it. **Yesterday's 54k was our own deployment churn**, not the
business using the app. Normal use of 10–20 loads a day sits around 9k–18k, comfortably
inside the free tier.

### But it scales badly, and that is the real point

Cost is roughly *documents in the database × cold loads per day*. The database is currently
small — about 900 documents — which is the only reason unbounded listeners are survivable:

| Total documents | 20 loads/day | |
|---|---|---|
| 900 (today) | 18,000 | fine |
| 3,000 | 60,000 | **over the free limit** |
| 10,000 | 200,000 | far over |

Nothing needs doing today. The work in "The real remaining problem" below becomes necessary
somewhere around 2,500–3,000 documents, and invoices are the collection that will get there
first. Worth re-measuring an hour of normal use every few months rather than waiting for
another quota mail.

## Clean-day baseline — 30–31 August, no deploys

|  | 28 Aug (churn) | 30–31 Aug (clean) |
|---|---|---|
| Reads | 54,000 | **6,000** — 12% of the limit |
| Writes | 61 | 8 |
| Denies | 120 | **0** |
| Rule errors | 1 | **0** |
| Peak listeners | 45 | 15 |
| Peak connections | 4 | 1 |

**Zero denies settles the diagnosis.** They were signed-out listener attachments, and gating
subscription on a session removed every one. The single rule error was migration residue, as
suspected, and has not recurred.

**15 peak listeners is 15 collections × one user** — this was a single-user day (1 peak
connection), so 6,000 is a light figure, not a ceiling. Three people working concurrently
would put it near 18,000, which is still only about a third of the limit.

Reads arrive in three per-hour spikes of roughly 1,500 with nothing in between, which is the
same shape as before: attaching costs, sitting idle does not.

**Nothing to do.** The scaling maths in the section above is unchanged — cost still tracks
database size — but at 12% of the limit on a working day, the query-scoping work stays
where it is: dated to roughly 2,500–3,000 documents, not urgent.

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

## The 105 denied rule evaluations

**105 ÷ 15 collections = exactly 7.** Almost certainly seven page loads while signed out,
each attaching all fifteen listeners and having every one refused. That was the pre-sign-in
subscription bug, and it is fixed — listeners now wait for a session.

Two other sources are expected and already dealt with:

- **`counters` writes before the rule was published.** The atomic numbering code shipped
  before the matching rule went live, so each invoice save attempted a transaction, was
  refused, logged a warning and fell back. By design — degraded, not broken — but each
  attempt is a deny.
- **`backups` writes by a non-admin.** Auto-backup used to run for whoever was signed in;
  it is now admin-only.

The single rule **error** (as opposed to deny) most likely dates from the migration window,
when an account could authenticate before its `userRoles` document existed. The rule
functions guard with `exists()` before reading, so this should not recur.

**If denies keep climbing after a normal day, that is a bug, not noise** — it means the UI
is still attempting something the rules refuse. Check which collection and whether it is a
read or a write before changing any rule; the fix belongs in the app, not in the rules.

## The free solution, when the time comes

No plan upgrade, no new service. Cost is roughly *documents pulled per cold load* × *cold
loads*, so the whole job is to stop pulling documents nobody is looking at. In order of
impact per unit of effort:

### 1. Per-customer ledger query — do this first

`where('customerId','==',id)` when a ledger opens, instead of filtering every invoice in
memory. A customer with 50 invoices costs 50 reads rather than the whole collection.

This one comes first because it is what **unblocks** step 2: the ledger is the only screen
that genuinely needs full history, and once it fetches its own, nothing else does.

Single-field equality, so no composite index needed.

### 2. Rolling window on the invoice and payment listeners

Bound the global listeners to something like the last 90 days. Billing lists, dispatch and
the dashboard never show more than that anyway, so nothing visible changes.

Turns "every invoice ever" into "invoices from this quarter" — a constant, not a number that
grows forever. This is the change that actually fixes the scaling curve.

Needs a `date` index; Firestore creates single-field ones automatically.

### 3. Date-scoped analytics

Query the selected period rather than reading everything and filtering client-side. A
"This Month" report should read this month.

`customerId` + `date` together needs a composite index — free, and the console offers a
one-click link the first time a query needs one.

### 4. Lazy-load the admin-only collections

`app_users`, `expenseCategories`, `companies` attach on the Admin tab rather than at
startup. Small collections, so this is cleanup rather than a saving — worth doing while the
surrounding code is already open.

### 5. Only if the above is not enough: a dashboard summary document

One document holding today's totals, updated when an invoice is written. Dashboard reads 1
document instead of hundreds.

Deliberately last. It is denormalisation: the same figure then exists in two places and can
disagree. Writes are nearly free here (7 a day against a 20,000 limit) so it is affordable,
but only take it on if steps 1–3 have not done the job.

### What this is worth

Steps 1–3 change cost from *"database size × loads"* to *"recent activity × loads"*. Recent
activity is roughly constant, so the daily figure stops tracking how long the business has
been running — which is the only property that actually matters here.

### And if it were ever exceeded anyway

Reads beyond the free tier cost about $0.06 per 100,000. Even a careless 200,000 a day is
roughly $3–4 a month. Worth knowing so the decision stays an engineering one: this is not a
looming bill, and there is no reason to rush the work or to compromise the ledger's
correctness to avoid it.

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
