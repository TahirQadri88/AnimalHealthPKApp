// "Which transactions make up this number?"
//
// Every Analytics breakdown answered how much and stopped there. Only the customer rows led
// anywhere, and only to the ledger. You could not get from "Antox 9 made Rs 15,000" to the
// invoices behind it — which is the question a person asks next, every time.
//
// The hard requirement is the same one the aging report failed: this MUST agree with the row
// it was opened from. It shares the keying helpers with reportEngine (keys.js) and repeats
// its filter rules exactly, and drilldown.test.js asserts, dimension by dimension, that the
// totals here equal the breakdown row there on the same data. A drill-down listing a
// different set of documents than the figure above it is worse than no drill-down.
import { custKey, productKey, companyKey, salespersonKey, buildCustomerIndex } from './keys';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// The breakdown a row came from, and what its key means.
export const DIMENSIONS = {
  product:     { label: 'Product',     scope: 'line' },
  company:     { label: 'Brand',       scope: 'line' },
  customer:    { label: 'Customer',    scope: 'document' },
  salesperson: { label: 'Salesperson', scope: 'document' },
  city:        { label: 'City',        scope: 'document' },
  area:        { label: 'Area',        scope: 'document' },
  type:        { label: 'Customer type', scope: 'document' },
};

export const drillDown = ({
  dimension, key,
  invoices = [], products = [], customers = [],
  checkCustomFilter = () => true,
  filterCompanies = new Set(), filterCustomers = new Set(), filterSalespersons = new Set(),
} = {}) => {
  const wanted = String(key);
  const index = buildCustomerIndex(customers);
  const brandOf = (item) => products.find(p => p.id === item.productId)?.companyId;
  const passesBrandFilter = (item) =>
    filterCompanies.size === 0 || filterCompanies.has(String(brandOf(item)));

  // Exactly reportEngine's document filter: period, then customer, then salesperson.
  const docs = invoices.filter(o =>
    (o.status === 'Billed' || o.status === 'CreditNote')
    && checkCustomFilter(o.date)
    && (filterCustomers.size === 0 || filterCustomers.has(String(o.customerId)))
    && (filterSalespersons.size === 0 || filterSalespersons.has(String(o.salespersonId))));

  const docMatches = (o) => {
    if (dimension === 'customer') return custKey(o) === wanted;
    if (dimension === 'salesperson') return salespersonKey(o) === wanted;
    if (dimension === 'city' || dimension === 'area' || dimension === 'type')
      return index.segmentFor(o, dimension) === wanted;
    return true;   // product and company are decided line by line
  };

  const lineMatches = (item) => {
    if (dimension === 'product') return productKey(item) === wanted;
    if (dimension === 'company') return companyKey(item) === wanted;
    return true;
  };

  const rows = [];
  docs.forEach(o => {
    if (!docMatches(o)) return;
    const isReturn = o.status === 'CreditNote';
    const sign = isReturn ? -1 : 1;
    const lines = [];
    let qty = 0, revenue = 0, cost = 0;
    (o.items || []).forEach(item => {
      if (!passesBrandFilter(item) || !lineMatches(item)) return;
      const q = num(item.quantity);
      const rev = num(item.price) * q;
      const cst = num(item.costPrice) * q;
      qty += sign * q; revenue += sign * rev; cost += sign * cst;
      lines.push({
        name: productKey(item), company: companyKey(item),
        qty: sign * q, price: num(item.price),
        revenue: sign * rev, cost: sign * cst, profit: sign * (rev - cst),
        isBonus: !!item.isBonus,
      });
    });
    // A document with nothing left after the filters contributed nothing to the figure, so
    // it does not belong in the list behind it.
    if (!lines.length) return;
    rows.push({
      id: o.id, date: o.date, isReturn,
      docType: isReturn ? 'Credit Note' : 'Invoice',
      customerId: o.customerId, customerName: index.labelFor(o),
      salespersonName: salespersonKey(o),
      reason: o.reason || '',
      qty, revenue, cost, profit: revenue - cost,
      lines,
    });
  });

  // Newest first: the question behind a drill-down is nearly always "what happened lately".
  rows.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const totals = rows.reduce((t, r) => ({
    qty: t.qty + r.qty,
    revenue: t.revenue + r.revenue,
    cost: t.cost + r.cost,
    profit: t.profit + r.profit,
    invoices: t.invoices + (r.isReturn ? 0 : 1),
    returns: t.returns + (r.isReturn ? 1 : 0),
  }), { qty: 0, revenue: 0, cost: 0, profit: 0, invoices: 0, returns: 0 });

  return { dimension, key: wanted, rows, totals };
};
