// Money in.
//
// For a business run entirely on credit this was the most conspicuous hole in Analytics:
// there were two numbers about collection — a collection rate and an average days-to-pay —
// and no view of the cash itself. Who paid, when, how much, and by what means.
//
// Two things this has to get right, and both are easy to get wrong:
//
//   • Cash taken at the counter when the bill is raised is a collection. It lives on the
//     invoice as receivedAmount, not in the payments collection, and on some days it is most
//     of the money that comes in. A view built from `payments` alone would understate badly.
//   • A round-off discount is NOT money received. It reduces the balance, so the ledger
//     treats it as credit, but nobody handed it over. `received` and `discount` are reported
//     separately and `credited` is their sum, which is what the ledger moves by.
//
// Payment method is inferred from the free-text "Mode / Note" field, because there is no
// method field to read. Stated plainly wherever it is shown: it is a guess from a string a
// person typed, not a recorded fact.
import { custKey, salespersonKey, buildCustomerIndex } from './keys';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const AT_BILLING = 'At billing';
export const UNRECORDED = 'Unrecorded';

// Order matters: "cheque deposited in bank" is a cheque, not a bank transfer.
const METHOD_PATTERNS = [
  [/cheq|chq|check/i, 'Cheque'],
  [/easypaisa|jazz\s*cash|jazzcash|raast|online|nayapay|sadapay/i, 'Online'],
  [/bank|transfer|ibft|iban|deposit|a\/c|account/i, 'Bank Transfer'],
  [/cash/i, 'Cash'],
];

export const classifyMethod = (note) => {
  const s = String(note || '').trim();
  if (!s) return 'Unspecified';
  for (const [re, label] of METHOD_PATTERNS) if (re.test(s)) return label;
  return 'Other';
};

const tally = (map, key, amount, extra = {}) => {
  if (!map[key]) map[key] = { key, amount: 0, count: 0, ...extra };
  map[key].amount += amount;
  map[key].count += 1;
  return map[key];
};

const sorted = (map) => Object.values(map).sort((a, b) => b.amount - a.amount);

export const buildCollections = ({
  invoices = [], payments = [], customers = [],
  checkCustomFilter = () => true,
  filterCustomers = new Set(),
} = {}) => {
  const index = buildCustomerIndex(customers);
  const wantedCustomer = (doc) => filterCustomers.size === 0 || filterCustomers.has(String(doc.customerId));

  const rows = [];

  // Cash taken when the bill was raised.
  invoices
    .filter(o => o.status === 'Billed' && num(o.receivedAmount) > 0 && checkCustomFilter(o.date) && wantedCustomer(o))
    .forEach(o => rows.push({
      id: `${o.id}-PAY`, ref: o.id, date: o.date,
      customerId: o.customerId, customerName: index.labelFor(o),
      received: num(o.receivedAmount), discount: 0,
      method: AT_BILLING, note: '', atBilling: true,
      collectedBy: salespersonKey(o),
    }));

  // Receipts taken later. These carry no user, so who collected them is not recorded.
  payments
    .filter(p => checkCustomFilter(p.date) && wantedCustomer(p))
    .forEach(p => rows.push({
      id: p.id, ref: p.id, date: p.date,
      customerId: p.customerId, customerName: index.labelFor(p),
      received: num(p.amount), discount: num(p.discount),
      method: classifyMethod(p.note), note: p.note || '', atBilling: false,
      collectedBy: UNRECORDED,
    }));

  rows.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const byDay = {}, byCustomer = {}, byMethod = {}, byCollector = {};
  const totals = { received: 0, discount: 0, credited: 0, count: 0, atBilling: 0, receipts: 0 };

  rows.forEach(r => {
    totals.received += r.received;
    totals.discount += r.discount;
    totals.count += 1;
    if (r.atBilling) totals.atBilling += r.received; else totals.receipts += r.received;

    tally(byDay, r.date, r.received);
    tally(byCustomer, custKey(r), r.received, { id: r.customerId, name: r.customerName });
    tally(byMethod, r.method, r.received);
    tally(byCollector, r.collectedBy, r.received);
  });
  totals.credited = totals.received + totals.discount;

  return {
    rows,
    totals,
    // Chronological, because it is drawn as a trend.
    byDay: Object.values(byDay).sort((a, b) => String(a.key).localeCompare(String(b.key))),
    byCustomer: sorted(byCustomer),
    byMethod: sorted(byMethod),
    byCollector: sorted(byCollector),
  };
};
