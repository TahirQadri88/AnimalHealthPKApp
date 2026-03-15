# Implementation Plan: Three Fixes

## Issue 1 — Remove stale "Pending/Paid" status from printed invoices
**Root cause:** `paymentStatus` is saved on the invoice at creation time and never updated when separate payments are recorded later via the Payments tab (which creates `REC-XXXXX` records in a separate collection). So an invoice can permanently show "Pending" even after the customer's account is fully settled.

**Fix:** Remove the payment-status badge from the invoice print view entirely.
- File: `src/components/PrintView.jsx`, lines 949–955
- Delete the `{data.paymentStatus && (…)}` block
- This is clean and correct — the ledger/account balance is the source of truth for payment status, not a stale field on the invoice

---

## Issue 2 — Text not centered inside capsule/pill badges in shared images
**Root cause:** The "INVOICE", "PAYMENT RECEIPT" and other pill badges use `display: 'inline-block'`. When html2canvas clones and renders the element off-screen at a fixed width, inline text rendering can shift slightly, making the pill text appear off-centre.

**Fix:** Add `textAlign: 'center'` and `lineHeight: '1'` directly on every badge/pill `<div>` in PrintView.jsx.

Affected badge locations:
- **Main doc-type badge** (lines 596–609): the dark "INVOICE" / "PAYMENT RECEIPT" pill
- **Payment status badge** (line 951): only relevant if we keep it — covered by Issue 1 removal
- **Notes/terms badge** (line ~1055): the green notes pill

Change each from:
```jsx
display: 'inline-block', padding: '2px 10px', ...
```
to:
```jsx
display: 'inline-block', padding: '2px 10px', textAlign: 'center', lineHeight: '1.2', ...
```

---

## Issue 3 — Invoice IDs too long and random; make sequential
**Root cause:**
- Invoices: `INV-${Date.now()}` → e.g. `INV-1741822345678` (13 digits, unreadable)
- Receipts: `REC-${Math.floor(Math.random()*100000)}` → e.g. `REC-47382` (random, can collide)

**Fix:** Sequential numbering with zero-padded 4-digit counter, derived from existing records (no Firestore counter document needed).

**Helper function** (add near the top of App.jsx, after helpers import):
```js
const getNextSeqNum = (items, prefix) => {
  // Timestamps are 13 digits (~1.7 trillion); ignore them as "legacy"
  const LEGACY_THRESHOLD = 10000000; // anything ≥ this is a timestamp, not a seq num
  const nums = items.map(item => {
    const s = String(item.id || '');
    if (!s.startsWith(prefix + '-')) return 0;
    const n = parseInt(s.slice(prefix.length + 1), 10);
    return !isNaN(n) && n < LEGACY_THRESHOLD ? n : 0;
  });
  return Math.max(0, ...nums) + 1;
};
```

**Changes:**

1. **New invoice ID** (App.jsx ~line 708–711):
```js
// Before
finalInvoice.id = `${prefix}-${Date.now()}`;

// After
const allInvoices = invoices; // already in scope
const nextNum = getNextSeqNum(allInvoices, prefix);
finalInvoice.id = `${prefix}-${String(nextNum).padStart(4, '0')}`;
```
Result: `INV-0001`, `INV-0002`, … `ORD-0001`, `EST-0001` — all sharing their own prefix counter.

2. **New receipt ID** (App.jsx ~line 231):
```js
// Before
id: `REC-${Math.floor(Math.random()*100000)}`

// After
id: `REC-${String(getNextSeqNum(payments, 'REC')).padStart(4, '0')}`
```
Result: `REC-0001`, `REC-0002`, …

Note: `payments` is already in scope inside the App component via `useLiveCollection`.

---

## Files to change
| File | Lines | Change |
|------|-------|--------|
| `src/components/PrintView.jsx` | 949–955 | Remove payment status badge block |
| `src/components/PrintView.jsx` | 598–608 | Add `textAlign:'center', lineHeight:'1.2'` to doc-type pill |
| `src/components/PrintView.jsx` | ~1055 | Add same to notes pill |
| `src/App.jsx` | ~after imports | Add `getNextSeqNum` helper |
| `src/App.jsx` | 708–711 | Switch invoice ID to sequential |
| `src/App.jsx` | 231 | Switch receipt ID to sequential |
