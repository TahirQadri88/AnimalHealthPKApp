// Receivables aging — how old is the money owed to us.
//
// Total outstanding was already on the dashboard, but with no age against it. A figure
// without age cannot be acted on: Rs 500K owed across this week is a healthy business,
// the same figure sitting past ninety days is a problem.
//
// The hard requirement is that this MUST agree with the customer ledger. A report that
// says one thing while the ledger says another is worse than no report, so the buckets are
// built by settling the same debts with the same credits using the same oldest-first rule
// as payment status, and there is a test asserting the totals match the ledger exactly.
//
// Two things the invoice list alone cannot tell you, both handled here:
//   • An opening balance is real debt with no invoice behind it. It predates the system, so
//     it is treated as the oldest debt of all and ages from the customer's first invoice.
//   • Cash taken at billing time belongs to its own invoice; everything else flows down the
//     queue from the oldest unpaid debt.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const daysBetween = (fromDateStr, asOfStr) => {
  const from = new Date(fromDateStr);
  const to = new Date(asOfStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, Math.floor((to - from) / 86400000));
};

// No payment terms are recorded anywhere, so "Current" means the last thirty days rather
// than "not yet due". Stated plainly because it is a judgement, not an accounting fact.
export const AGING_BUCKETS = [
  { key: 'current', label: 'Current (0–30)', min: 0, max: 30 },
  { key: 'd31_60', label: '31–60 days', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 days', min: 61, max: 90 },
  { key: 'd90plus', label: '90+ days', min: 91, max: Infinity },
];

export const bucketFor = (ageDays) =>
  AGING_BUCKETS.find(b => ageDays >= b.min && ageDays <= b.max) || AGING_BUCKETS[AGING_BUCKETS.length - 1];

// What a single customer still owes, split by the age of each unpaid debt.
export const customerAging = (customerId, { customers = [], invoices = [], payments = [], asOf } = {}) => {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return null;

  const billed = invoices
    .filter(o => o.customerId === customerId && o.status === 'Billed')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  // Oldest debt first. An opening balance has no date of its own, so it ages from the
  // earliest invoice we know about — or from today if the customer has never been invoiced,
  // which keeps a brand-new opening balance out of the 90+ bucket on day one.
  const debts = [];
  const opening = num(customer.openingBalance);
  if (opening > 0) {
    debts.push({ id: 'OPENING', ref: 'Opening balance', date: billed[0]?.date || asOf, amount: opening, isOpening: true });
  }
  billed.forEach(inv => debts.push({ id: inv.id, ref: inv.id, date: inv.date, amount: num(inv.total) }));

  // Cash taken at billing time settles its own invoice before anything else moves.
  let pool = 0;
  const settled = new Map();
  billed.forEach(inv => {
    const onInvoice = Math.min(num(inv.receivedAmount), num(inv.total));
    settled.set(inv.id, onInvoice);
    pool += Math.max(0, num(inv.receivedAmount) - num(inv.total));
  });

  pool += payments
    .filter(p => p.customerId === customerId)
    .reduce((s, p) => s + num(p.amount) + num(p.discount), 0);
  pool += invoices
    .filter(o => o.customerId === customerId && o.status === 'CreditNote')
    .reduce((s, cn) => s + num(cn.total), 0);

  const open = [];
  let totalOutstanding = 0;
  for (const debt of debts) {
    let owed = debt.amount - (settled.get(debt.id) || 0);
    if (pool > 0 && owed > 0) {
      const applied = Math.min(owed, pool);
      owed -= applied;
      pool -= applied;
    }
    if (owed > 0.5) {
      const ageDays = daysBetween(debt.date, asOf);
      open.push({ ...debt, outstanding: owed, ageDays, bucket: bucketFor(ageDays).key });
      totalOutstanding += owed;
    }
  }

  const oldest = open.reduce((max, d) => Math.max(max, d.ageDays), 0);
  return {
    customerId,
    name: customer.name,
    phone: customer.phone,
    totalOutstanding,
    oldestAgeDays: oldest,
    // Credit left over after every debt is settled — the customer is in credit.
    creditBalance: pool > 0.5 ? pool : 0,
    open,
    buckets: AGING_BUCKETS.reduce((acc, b) => {
      acc[b.key] = open.filter(d => d.bucket === b.key).reduce((s, d) => s + d.outstanding, 0);
      return acc;
    }, {}),
  };
};

// Bucket totals for a set of aging rows.
//
// Exported separately because the screen filters (bucket chip, search box) hide rows, and an
// export must foot to what is actually on the page. Totalling the whole report while showing
// a subset is how a printed sheet ends up disagreeing with the screen it came from.
export const summariseAging = (rows = []) => ({
  totals: AGING_BUCKETS.reduce((acc, b) => {
    acc[b.key] = rows.reduce((s, r) => s + ((r.buckets && r.buckets[b.key]) || 0), 0);
    return acc;
  }, {}),
  grandTotal: rows.reduce((s, r) => s + (r.totalOutstanding || 0), 0),
  customerCount: rows.length,
});

// Every customer who owes something, worst first.
export const buildAgingReport = ({ customers = [], invoices = [], payments = [], asOf } = {}) => {
  const rows = customers
    .map(c => customerAging(c.id, { customers, invoices, payments, asOf }))
    .filter(r => r && r.totalOutstanding > 0.5);

  return {
    asOf,
    rows: rows.sort((a, b) => b.oldestAgeDays - a.oldestAgeDays || b.totalOutstanding - a.totalOutstanding),
    ...summariseAging(rows),
  };
};
