// The answers the owner asked for that the Analytics screen did not give:
//   who owes and is late, what sells and earns (rising and falling), lines sold below cost
//   or at a thin margin, and regular customers who have stopped buying.
// Each list is built from the same ledger, aging and breakdown rules the rest of the screen
// uses, and attention.test.js reconciles each one against them.
import { buildCustomerLedger } from '../accounting/ledger';
import { buildAgingReport } from './receivables';
import { custKey, productKey, companyKey, buildCustomerIndex } from './keys';

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);

// ── Who owes, who is late ─────────────────────────────────────────────────────────────
/**
 * growing: owing more now than at the start of the period (needs a period).
 * late:    the oldest unpaid bill is over `lateDays` old (the aging report's own ages).
 * quiet:   owes money and has paid nothing for `quietDays` or more (or never).
 */
export const debtWatch = ({ customers = [], invoices = [], payments = [], asOf, periodStart = null, lateDays = 30, quietDays = 30, onlyCustomers = null }) => {
  const keep = (id) => !onlyCustomers || onlyCustomers.size === 0 || onlyCustomers.has(String(id));
  const aging = buildAgingReport({ customers, invoices, payments, asOf });
  const byId = new Map(aging.rows.map(r => [r.customerId, r]));
  const growing = [], late = [], quiet = [];
  customers.filter(c => keep(c.id)).forEach(c => {
    const ledger = buildCustomerLedger(c.id, { customers, invoices, payments });
    if (!ledger) return;
    const now = ledger.closingBal;
    const lastPay = [
      ...payments.filter(p => p.customerId === c.id).map(p => p.date),
      ...invoices.filter(o => o.customerId === c.id && o.status === 'Billed' && num(o.receivedAmount) > 0).map(o => o.date),
    ].sort().pop() || null;
    const base = { id: c.id, name: c.name, phone: c.phone || '', balance: now, lastPayment: lastPay };
    if (periodStart) {
      const before = ledger.rows.filter(r => r.date < periodStart);
      const then = before.length ? before[before.length - 1].balance : ledger.openingBal;
      if (now - then > 0.5) growing.push({ ...base, then, change: now - then });
    }
    const ag = byId.get(c.id);
    if (ag && ag.oldestAgeDays > lateDays) {
      const overdue = ag.open.filter(d => d.ageDays > lateDays).reduce((s, d) => s + d.outstanding, 0);
      late.push({ ...base, oldestDays: ag.oldestAgeDays, overdue });
    }
    if (now > 0.5) {
      const since = lastPay ? daysBetween(lastPay, asOf) : null;
      if (since === null || since >= quietDays) quiet.push({ ...base, daysSincePayment: since });
    }
  });
  growing.sort((a, b) => b.change - a.change);
  late.sort((a, b) => b.overdue - a.overdue);
  quiet.sort((a, b) => b.balance - a.balance);
  return { growing, late, quiet };
};

// ── What sells, what earns ────────────────────────────────────────────────────────────
// Net sales and gross profit per product or brand inside a window, counted exactly as the
// breakdown tables count them (reportEngine): rate x quantity of billed lines, less credit
// notes, brand filter on the line, client and staff filters on the document.
export const salesByKey = ({ invoices = [], products = [], window, dimension = 'product', filterCompanies = new Set(), filterCustomers = new Set(), filterSalespersons = new Set() }) => {
  const out = {};
  if (!window) return out;
  const keyOf = dimension === 'company' ? companyKey : productKey;
  const companyOf = (item) => products.find(p => p.id === item.productId)?.companyId;
  invoices.forEach(o => {
    if (o.status !== 'Billed' && o.status !== 'CreditNote') return;
    if (o.date < window.start || o.date > window.end) return;
    if (filterCustomers.size && !filterCustomers.has(String(o.customerId))) return;
    if (filterSalespersons.size && !filterSalespersons.has(String(o.salespersonId))) return;
    const sign = o.status === 'CreditNote' ? -1 : 1;
    (o.items || []).forEach(item => {
      if (filterCompanies.size && !filterCompanies.has(String(companyOf(item)))) return;
      const rev = num(item.price) * num(item.quantity), cost = num(item.costPrice) * num(item.quantity);
      const k = keyOf(item);
      const row = (out[k] ||= { revenue: 0, profit: 0, qty: 0 });
      row.revenue += sign * rev; row.profit += sign * (rev - cost); row.qty += sign * num(item.quantity);
    });
  });
  return out;
};

/** Products or brands ranked by how much their gross profit moved against the comparison window. */
export const movers = ({ current = {}, previous = {}, limit = 10, minPrevious = 1 }) => {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  const rows = [...keys].map(k => {
    const now = current[k] || { revenue: 0, profit: 0 };
    const then = previous[k] || { revenue: 0, profit: 0 };
    return {
      key: k, revenue: now.revenue, profit: now.profit, prevRevenue: then.revenue, prevProfit: then.profit,
      change: now.profit - then.profit,
      changePct: then.profit >= minPrevious ? +(((now.profit - then.profit) / then.profit) * 100).toFixed(1) : null,
    };
  });
  return {
    rising: rows.filter(r => r.change > 0.5).sort((a, b) => b.change - a.change).slice(0, limit),
    falling: rows.filter(r => r.change < -0.5).sort((a, b) => a.change - b.change).slice(0, limit),
  };
};

// ── Below cost or thin margin ─────────────────────────────────────────────────────────
/** Billed lines in the window sold below cost, or under `thinPct` margin. Lines with no cost are skipped. */
export const marginAlerts = ({ invoices = [], products = [], customers = [], window, thinPct = 5, filterCompanies = new Set(), filterCustomers = new Set(), filterSalespersons = new Set() }) => {
  const label = buildCustomerIndex(customers).labelFor;
  const companyOf = (item) => products.find(p => p.id === item.productId)?.companyId;
  const below = [], thin = [];
  invoices.forEach(o => {
    if (o.status !== 'Billed') return;
    if (window && (o.date < window.start || o.date > window.end)) return;
    if (filterCustomers.size && !filterCustomers.has(String(o.customerId))) return;
    if (filterSalespersons.size && !filterSalespersons.has(String(o.salespersonId))) return;
    (o.items || []).forEach(item => {
      if (item.isBonus) return;
      if (filterCompanies.size && !filterCompanies.has(String(companyOf(item)))) return;
      const price = num(item.price), cost = num(item.costPrice), qty = num(item.quantity);
      if (cost <= 0 || price <= 0 || qty <= 0) return;
      const marginPct = ((price - cost) / price) * 100;
      const row = { invoiceId: o.id, date: o.date, customerId: o.customerId, customer: label(o), name: item.name, qty, price, cost, marginPct: +marginPct.toFixed(1), gap: (price - cost) * qty };
      if (price < cost) below.push(row); else if (marginPct < thinPct) thin.push(row);
    });
  });
  below.sort((a, b) => a.gap - b.gap);
  thin.sort((a, b) => a.marginPct - b.marginPct);
  return { below, thin, belowLoss: below.reduce((s, r) => s + r.gap, 0) };
};

// ── Who stopped buying ────────────────────────────────────────────────────────────────
/**
 * Customers with at least `minBills` bills on different days whose days since the last bill
 * are more than twice their usual gap (the median gap between their bills), and at least
 * `minDays`. A weekly buyer is flagged after `minDays` quiet days; one who buys every two
 * months only after four months.
 */
export const lapsedCustomers = ({ customers = [], invoices = [], asOf, minBills = 3, minDays = 30, onlyCustomers = null }) => {
  const keep = (id) => !onlyCustomers || onlyCustomers.size === 0 || onlyCustomers.has(String(id));
  const label = buildCustomerIndex(customers).labelFor;
  const byCust = {};
  invoices.forEach(o => { if (o.status === 'Billed' && keep(o.customerId)) (byCust[custKey(o)] ||= []).push(o); });
  const out = [];
  Object.values(byCust).forEach(list => {
    const days = [...new Set(list.map(o => o.date))].sort();
    if (days.length < minBills) return;
    const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d)).sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const usualGap = gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
    const last = days[days.length - 1];
    const since = daysBetween(last, asOf);
    if (since <= Math.max(2 * usualGap, minDays)) return;
    const total = list.reduce((s, o) => s + num(o.total), 0);
    const months = Math.max(1, Math.round(daysBetween(days[0], last) / 30.44) + 1);
    const c = customers.find(x => String(x.id) === String(list[0].customerId));
    out.push({
      id: list[0].customerId, name: label(list[0]), phone: c?.phone || '',
      lastBill: last, lastBillId: list.filter(o => o.date === last).map(o => o.id).sort().pop(),
      daysSince: since, usualGap, bills: list.length, monthlyValue: Math.round(total / months),
    });
  });
  return out.sort((a, b) => b.monthlyValue - a.monthlyValue);
};
