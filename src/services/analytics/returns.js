// What is coming back, and why.
//
// Analytics knew two things about sales returns: their total value and how many credit notes
// there were. Nothing said which products come back, from whom, or for what reason — and the
// reason is typed onto every credit note, so the data was there and simply never read.
//
// The reason field is free text ("Expired", "expired stock", "Wrong item"), so reasons are
// grouped case-insensitively on a trimmed string and a blank one is reported as such rather
// than dropped. Naming the gap is the point: "no reason recorded" sitting at the top of the
// list is the finding.
//
// Return rate is measured against GROSS sales in the same period — what went out before
// anything came back — because netting the returns out of the denominator would flatter the
// number exactly when returns are worst.
import { custKey, productKey, companyKey, salespersonKey, buildCustomerIndex } from './keys';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const NO_REASON = 'No reason recorded';

export const normaliseReason = (reason) => {
  const s = String(reason || '').trim();
  return s ? s : NO_REASON;
};

// "Expired", "expired " and "EXPIRED" are one reason. The group is matched on the folded
// string; the label shown is the first spelling seen, because inventing a canonical
// capitalisation would put words in a person's mouth.
export const reasonGroupKey = (reason) => normaliseReason(reason).toLowerCase();

const tally = (map, key, { value = 0, units = 0, cost = 0 }, extra = {}) => {
  if (!map[key]) map[key] = { key, value: 0, units: 0, cost: 0, count: 0, ...extra };
  // `extra.key` lets a caller group on one string and display another.
  map[key].value += value;
  map[key].units += units;
  map[key].cost += cost;
  map[key].count += 1;
};

const sorted = (map) => Object.values(map).sort((a, b) => b.value - a.value);

const daysBetween = (from, to) => {
  const a = new Date(from), b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
};

export const buildReturns = ({
  invoices = [], products = [], customers = [],
  checkCustomFilter = () => true,
  filterCompanies = new Set(), filterCustomers = new Set(), filterSalespersons = new Set(),
} = {}) => {
  const index = buildCustomerIndex(customers);
  const brandOf = (item) => products.find(p => p.id === item.productId)?.companyId;
  const passesBrandFilter = (item) =>
    filterCompanies.size === 0 || filterCompanies.has(String(brandOf(item)));
  const wanted = (o) =>
    checkCustomFilter(o.date)
    && (filterCustomers.size === 0 || filterCustomers.has(String(o.customerId)))
    && (filterSalespersons.size === 0 || filterSalespersons.has(String(o.salespersonId)));

  // The denominator: what was billed in the same period, on the same filters.
  let grossSales = 0;
  invoices.filter(o => o.status === 'Billed' && wanted(o)).forEach(o => {
    (o.items || []).forEach(item => {
      if (!passesBrandFilter(item)) return;
      grossSales += num(item.price) * num(item.quantity);
    });
  });

  const byReason = {}, byProduct = {}, byCustomer = {}, byCompany = {}, bySalesperson = {};
  const rows = [];
  const totals = { value: 0, cost: 0, units: 0, count: 0, withoutReason: 0, grossSales, ratePct: 0 };

  const invoiceDate = {};
  invoices.forEach(o => { if (o.status === 'Billed') invoiceDate[o.id] = o.date; });

  invoices.filter(o => o.status === 'CreditNote' && wanted(o)).forEach(cn => {
    const reason = normaliseReason(cn.reason);
    let value = 0, cost = 0, units = 0;
    const lines = [];
    (cn.items || []).forEach(item => {
      if (!passesBrandFilter(item)) return;
      const qty = num(item.quantity);
      const v = num(item.price) * qty;
      const c = num(item.costPrice) * qty;
      value += v; cost += c; units += qty;
      lines.push({ name: productKey(item), company: companyKey(item), qty, price: num(item.price), value: v, cost: c, isBonus: !!item.isBonus });
      tally(byProduct, productKey(item), { value: v, units: qty, cost: c }, { company: companyKey(item) });
      tally(byCompany, companyKey(item), { value: v, units: qty, cost: c });
    });
    // A credit note whose every line was filtered out contributed nothing here.
    if (!lines.length) return;

    const origDate = cn.originalInvoiceId ? invoiceDate[cn.originalInvoiceId] : undefined;
    rows.push({
      id: cn.id, date: cn.date, reason,
      hasReason: reason !== NO_REASON,
      originalInvoiceId: cn.originalInvoiceId || '',
      daysSinceSale: origDate ? daysBetween(origDate, cn.date) : null,
      customerId: cn.customerId, customerName: index.labelFor(cn),
      salespersonName: salespersonKey(cn),
      value, cost, units, lines,
    });

    tally(byReason, reasonGroupKey(reason), { value, units, cost }, { key: reason });
    tally(byCustomer, custKey(cn), { value, units, cost }, { id: cn.customerId, name: index.labelFor(cn) });
    tally(bySalesperson, salespersonKey(cn), { value, units, cost });

    totals.value += value; totals.cost += cost; totals.units += units; totals.count += 1;
    if (reason === NO_REASON) totals.withoutReason += 1;
  });

  totals.ratePct = grossSales > 0 ? +((totals.value / grossSales) * 100).toFixed(2) : 0;

  rows.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  return {
    rows, totals,
    byReason: sorted(byReason),
    byProduct: sorted(byProduct),
    byCompany: sorted(byCompany),
    byCustomer: sorted(byCustomer),
    bySalesperson: sorted(bySalesperson),
  };
};
