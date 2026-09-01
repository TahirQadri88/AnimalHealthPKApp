// Home dashboard figures.
//
// Extracted for the same reason computePnL was: the dashboard counted only invoices with
// status 'Billed', so a credit note reduced nothing. Analytics was fixed to net returns;
// Home never was. The two screens therefore disagreed about the same period's sales, and
// "Top 5 Products by Sales Value" still ranked goods that had come back.
//
// ── What "Sales" means here, and why it is not netSales from computePnL ──────
// The dashboard reports what was BILLED — invoice totals, which include delivery charged
// and any discount given. computePnL deliberately works at line-item level and excludes
// both, because a P&L accounts for delivery separately. They are different questions and
// both are right; the bug was only ever that returns were ignored. So this subtracts
// credit-note totals from billed totals and leaves the definition otherwise alone.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sales for the period: what was billed, less what came back.
 * Both lists must already be filtered by date, salesperson and void state.
 */
export const netBilled = ({ billedInvoices = [], creditNotes = [] } = {}) =>
  billedInvoices.reduce((s, o) => s + num(o.total), 0)
  - creditNotes.reduce((s, o) => s + num(o.total), 0);

/**
 * Per-product totals, with returned lines subtracted from the product they came back to.
 *
 * Bonus lines are counted on BOTH sides: they carry a real costPrice and no price, so a
 * bonus given away is a loss of its cost and a bonus returned gives that cost back. (The
 * Analytics reportEngine skips bonus lines on credit notes, which leaves returned free
 * stock permanently expensed — a smaller, separate discrepancy, noted rather than copied.)
 */
export const productTotals = ({ billedInvoices = [], creditNotes = [] } = {}) => {
  const byProduct = {};
  const touch = (name) => {
    if (!byProduct[name]) byProduct[name] = { name, qty: 0, revenue: 0, profit: 0 };
    return byProduct[name];
  };
  const walk = (docs, sign) => docs.forEach(doc => (doc.items || []).forEach(item => {
    const name = item?.name || '—';
    const rev = num(item?.price) * num(item?.quantity);
    const cost = num(item?.costPrice) * num(item?.quantity);
    const row = touch(name);
    row.qty += sign * num(item?.quantity);
    row.revenue += sign * rev;
    row.profit += sign * (rev - cost);
  }));
  walk(billedInvoices, 1);
  walk(creditNotes, -1);
  return byProduct;
};

/** The three Top-5 lists the dashboard renders, netted for returns. */
export const topProducts = ({ billedInvoices = [], creditNotes = [], limit = 5 } = {}) => {
  const arr = Object.values(productTotals({ billedInvoices, creditNotes }));
  const by = (key) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, limit);
  return { topValue: by('revenue'), topQty: by('qty'), topProfit: by('profit') };
};

/** Month-on-month movement, or null when there is no base to compare against. */
export const momChangePct = (thisPeriod, lastPeriod) => {
  const base = num(lastPeriod);
  if (base <= 0) return null;
  return (((num(thisPeriod) - base) / base) * 100).toFixed(1);
};
