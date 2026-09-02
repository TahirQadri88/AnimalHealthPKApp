# Analytics and Reports — audit before redesign

Written 2026-09-02, before any implementation. The brief was: map what exists, find what is
missing, design the target — and change no accounting calculation unless a failing test
demonstrates an error.

One thing found here **is** demonstrably an error, and it is the reason to do this work at
all.

---

## 1. The finding that matters: aging is computed twice, and one of them is wrong

`reportEngine` ages a customer's debt by **the date of their most recent invoice**:

```js
const lastInv = invoices.filter(o => o.customerId === r.id && o.status === 'Billed')
                        .sort((a,b) => b.date.localeCompare(a.date))[0];
const daysDiff = days between today and lastInv.date;
if (daysDiff <= 30) agingBuckets.current.push(r);
```

That is not the age of the debt. It is the age of the last *sale*. Anything a customer buys
resets their entire outstanding balance to "current".

Measured, same customer and same data through both code paths:

| | 90+ days | Current (0–30) |
|---|---|---|
| **Receivables screen** (`buildAgingReport`) | Rs 118,500 | Rs 1,500 |
| **Analytics screen** (`reportEngine`) | — | **Rs 120,000** |

A debt 200 days old, reported as current because the customer bought Rs 1,500 of something
yesterday. On the screen a person uses to decide who to chase.

`buildAgingReport` is the correct one: it settles each debt oldest-first with the same rule
as payment status, and `receivables.test.js` asserts its totals equal the ledger exactly.
`reportEngine`'s version is a second, older implementation that nothing tests.

**Action: delete the aging code in `reportEngine` and have Analytics call
`buildAgingReport`.** This is the one accounting change in this plan, it is justified by the
comparison above, and it should land as its own commit with a test that both screens now
agree.

---

## 2. What exists today

### Where the numbers come from

| Screen | Source | Tested |
|---|---|---|
| Home dashboard | `services/analytics/dashboard.js` | 17 tests |
| Analytics (all views) | `services/analytics/reportEngine.js` | 15 tests |
| Analytics P&L headline | `services/analytics/profitAndLoss.js` via `reportEngine` | 13 tests |
| Receivables | `services/analytics/receivables.js` | 24 tests |
| Customer ledger | `services/accounting/ledger.js` | tested |

Four separate places compute money for reporting. Three are correct and agree. The fourth
is §1.

### The ten Analytics views

`Overview · Insights · By Product · By Company · By Customer · By Salesperson · By City ·
By Area · By Type · Receivables`

### Every metric `reportEngine` produces

**KPIs** — `productRevenue` (net of returns), `totalCOGS`, `grossMargin`, `netProfit`,
`deliveryBilled`, `transportExpense`, `totalExpenses`, `totalReceivables`,
`creditNotesTotal`, `creditNotesCount`.

**Breakdowns** — and note they do not carry the same fields:

| Breakdown | qty | revenue | cost | profit | orders |
|---|---|---|---|---|---|
| `byProduct` | ✓ | ✓ | ✓ | ✓ | — |
| `byCompany` | ✓ | ✓ | ✓ | ✓ | — |
| `byCustomer` | — | ✓ | ✓ | ✓ | ✓ |
| `bySalesperson` | — | ✓ | — | ✓ | ✓ |
| `byCity` / `byArea` / `byType` | — | ✓ | — | ✓ | ✓ |

**Other** — `trends`, `dailyBreakdown`, `monthlyData` (last 24 months, deliberately ignores
the date filter), `byExpenseCategory`, `agingBuckets` (§1), `receivablesList`,
`collectionRate`, `avgDaysToPay`, `newCustCount`, `repeatCustCount`, `totalBilledAmt`.

### Filters

Period (Today / Week / Month / Year / All Time / Custom range), Brand, Client, Staff. All
applied inside `reportEngine`; the period filter is handed in as a predicate.

### Exports

| | CSV | PDF | WhatsApp text | Image |
|---|---|---|---|---|
| Overview | ✗ *(refused with a toast)* | ✓ | ✓ | ✗ |
| Insights | ✗ | ✓ | ✓ | ✗ |
| Every table view | ✓ | ✓ | ✓ | ✗ |

PDF goes through the `docType: 'report'` PrintView pipeline, which renders three layouts —
`Overview`, `Insights`, and a generic table — at A4/A5, plus `Aging` at all three sizes.

### Permissions

**None are checked inside Analytics.** That is currently correct rather than a hole:
`AdminTab` refuses non-admins outright, so the whole area is admin-only. It becomes a hole
the moment any of this is shown to staff.

---

## 3. Gaps

### Correctness

1. **Aging computed twice, one version wrong** — §1.
2. **Customer and segment breakdowns are keyed by customer NAME, not id.**
   `custSegment[o.customerName]`, `byCustomer[o.customerName]`. Two customers with the same
   name merge into one row. A rename relies on the cascade that rewrites `customerName` on
   every past invoice; if that ever partially fails, one customer's history splits in two.
3. **`totalBilledAmt` is computed and never rendered** — dead, like the four Settings fields
   were. Either surface it or remove it.

### Missing dimensions

4. **Collections.** `collectionRate` and `avgDaysToPay` exist as single numbers on the
   Insights page. There is no view of *money in* — by day, by customer, by method, by
   collector. For a wholesale business run on credit, this is the most conspicuous absence.
5. **Returns.** `creditNotesTotal` and a count. No view of what is coming back, from whom,
   which product, or why — and the reason is captured on every credit note.
6. **Expenses.** A bar list by category on Insights. No trend, no comparison to prior
   period, no drill-down to the expenses themselves.
7. **Profitability by margin, not just by value.** Every breakdown ranks on revenue or
   profit. Nothing surfaces margin %, so a high-turnover low-margin product looks like the
   best line in the business.
8. **No product-level margin trend** — whether a product's margin is eroding over time is
   not answerable, and cost-price history now exists to answer it.

### Drill-down

9. **Only one destination exists: the customer ledger.** Product, company, salesperson, city,
   area and type rows are dead ends. You cannot get from "Antox 9 made Rs 15,000" to the
   invoices that make up that number — which is the question a person actually asks next.

### Presentation

10. **`monthlyData` ignores the date filter** — deliberately, but nothing on screen says so,
    so the trend chart silently disagrees with every other figure on the page.
11. **Overview and Insights cannot export CSV**, which is reasonable for a P&L layout but is
    delivered as an error toast rather than a disabled control.
12. **No image export**, though every other document in the app has one and it is the format
    most often sent on WhatsApp.

---

## 4. The target

Three surfaces, three questions. This framing came from the external review and it is a good
one:

- **Dashboard — *what needs my attention today?*** Exceptions and today's numbers. Already
  close.
- **Analytics — *why is the business performing this way?*** Trends, comparisons, breakdowns
  by every dimension.
- **Reports — *which transactions make up this number?*** The drill-down that does not exist
  yet.

Every report follows one shape: **Filters → KPIs → Trend → Breakdown → Table → Drill-down →
Export.**

### Order of work, by value and by risk

| # | Work | Why here |
|---|---|---|
| 1 | **Fix the aging duplication** | It is wrong, it is visible, and it is one function call |
| 2 | **Key breakdowns by customer id** | Silent data-merging bug; small change, needs care |
| 3 | **Drill-down: any breakdown row → its transactions** | The single biggest capability gap |
| 4 | **A Collections view** | The largest missing dimension for a credit business |
| 5 | **A Returns view** | The data is already captured and unused |
| 6 | **Margin % everywhere, and margin trend** | Turns ranking into insight |
| 7 | **Unify the export matrix**, image included | Consistency; small |
| 8 | **Expense trend and drill-down** | Completes the P&L story |

Items 1–2 are corrections and should go first, separately, each with a test that
demonstrates the old behaviour was wrong. Items 3–8 are additive.

### Rules for the implementation

- **Every new metric goes in `reportEngine` (or a sibling service) with tests, never in the
  component.** The whole reason this work is safe now is that the maths came out of the
  `useMemo`.
- **No accounting calculation changes without a failing test first.** §1 and §2 qualify;
  nothing else here does.
- **Do not add Inventory, Purchases, Supplier Payables or Warehouse.** Out of scope, and the
  scope guard in `docs/IMPROVEMENT_BRIEF.md` says so for good reasons.
- **Reuse the tested services.** `buildAgingReport`, `computePnL`, `buildCustomerLedger` and
  `allocateCredits` already exist and agree with each other. A second implementation of any
  of them is how §1 happened.
