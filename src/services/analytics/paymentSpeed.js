// When each bill was actually settled, and how long customers take to pay.
//
// "Avg Days to Pay" used to measure, for each paid invoice, the days to the customer's NEXT
// payment of any size on or after the invoice date. A Rs 500 receipt the day after a Rs
// 200,000 bill made that bill look paid in one day. This settles bills the way the ledger
// does (allocateCredits: cash taken at billing to its own bill, everything else oldest bill
// first) but walks the credits in date order, so each bill gets the DATE it was fully paid.
// The totals are the allocator's, so a bill is settled here exactly when the app calls it Paid.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

/** Map of invoice id -> date it was fully settled, or null while it is still open. */
export const settlementDates = (customerId, { invoices = [], payments = [] } = {}) => {
  const billed = invoices
    .filter(o => o.customerId === customerId && o.status === 'Billed')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const credits = [];
  billed.forEach(inv => {
    const over = num(inv.receivedAmount) - num(inv.total);
    if (over > 0) credits.push({ date: inv.date, amt: over });
  });
  payments.filter(p => p.customerId === customerId).forEach(p => credits.push({ date: p.date, amt: num(p.amount) + num(p.discount) }));
  invoices.filter(o => o.customerId === customerId && o.status === 'CreditNote').forEach(cn => credits.push({ date: cn.date, amt: num(cn.total) }));
  credits.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const out = new Map();
  let ci = 0, avail = 0, availDate = null;
  for (const inv of billed) {
    let owed = num(inv.total) - Math.min(num(inv.receivedAmount), num(inv.total));
    let last = inv.date;
    while (owed > 0.5) {
      if (avail <= 0) {
        if (ci >= credits.length) break;
        avail = credits[ci].amt; availDate = credits[ci].date; ci += 1;
        continue;
      }
      const take = Math.min(owed, avail);
      owed -= take; avail -= take;
      if (availDate > last) last = availDate;
    }
    out.set(inv.id, owed <= 0.5 ? last : null);
  }
  return out;
};

/**
 * Days to pay for the bills settled inside `window` ({start, end}, or null for all time),
 * among `invoices` already narrowed to the customers and staff on screen. Also how many of
 * those customers' bills are still open and the oldest of them.
 */
export const paymentSpeed = ({ invoices = [], payments = [], window = null, include = () => true, today }) => {
  const inWin = (d) => !window || (d >= window.start && d <= window.end);
  const ids = [...new Set(invoices.filter(o => o.status === 'Billed' && include(o)).map(o => o.customerId))];
  let days = 0, count = 0, open = 0, oldestOpen = 0;
  ids.forEach(cid => {
    const dates = settlementDates(cid, { invoices, payments });
    invoices.filter(o => o.customerId === cid && o.status === 'Billed' && include(o)).forEach(inv => {
      const s = dates.get(inv.id);
      if (s) { if (inWin(s)) { days += Math.max(0, daysBetween(inv.date, s)); count += 1; } }
      else { open += 1; oldestOpen = Math.max(oldestOpen, daysBetween(inv.date, today)); }
    });
  });
  return { avgDays: count ? Math.round(days / count) : null, settledCount: count, openCount: open, oldestOpenDays: open ? oldestOpen : null };
};
