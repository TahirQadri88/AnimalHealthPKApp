// Profit and loss for a period.
//
// Extracted from the 1,000-line reportEngine in AnalyticsView, where it was untested and
// wrong about sales returns.
//
// What was wrong: revenue came only from invoices with status 'Billed'. A credit note is a
// separate document, so it never reduced that figure. The P&L then displayed
//
//     Gross Sales    = productRevenue + returns      <- inflated by the returns
//     Sales Returns  = − returns                     <- cancels the inflation
//     Gross Profit   = productRevenue − COGS         <- returns never deducted
//
// The column added up on screen while the returns line did nothing. A fully returned sale
// still reported profit, and the cost of the returned goods stayed in COGS.
//
// Corrected below: returns reduce sales, and the cost of returned goods comes back out of
// COGS, because credit-note lines carry the costPrice they were sold at. A sale that is
// fully returned nets to zero on both sides, which is the point.
//
// Amounts are item-level throughout. Invoice `total` is deliberately not used: it folds in
// delivery and discount, which are accounted for separately below. Mixing the two was part
// of how the old figures drifted.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumItems = (docs, includeItem, pick) =>
  docs.reduce((sum, doc) => sum + (doc.items || []).reduce(
    (s, item) => (includeItem(item, doc) ? s + pick(item) : s), 0), 0);

const revenueOf = (item) => num(item.price) * num(item.quantity);
const costOf = (item) => num(item.costPrice) * num(item.quantity);

/**
 * @param billedInvoices  invoices with status 'Billed', already date/customer filtered
 * @param creditNotes     invoices with status 'CreditNote', filtered the same way
 * @param expenses        operating expenses for the period
 * @param includeItem     optional line-level predicate, used by the company filter
 */
export const computePnL = ({
  billedInvoices = [],
  creditNotes = [],
  expenses = [],
  includeItem = () => true,
} = {}) => {
  const grossSales = sumItems(billedInvoices, includeItem, revenueOf);
  const salesReturns = sumItems(creditNotes, includeItem, revenueOf);
  const netSales = grossSales - salesReturns;

  const cogsSold = sumItems(billedInvoices, includeItem, costOf);
  // Returned goods are back with us, so their cost is no longer a cost of sale. Credit-note
  // lines carry the costPrice they were sold at, so this uses the historical figure rather
  // than whatever the product costs today.
  const cogsReturned = sumItems(creditNotes, includeItem, costOf);
  const cogs = cogsSold - cogsReturned;

  const grossProfit = netSales - cogs;

  // Delivery is charged to the customer and paid to a carrier; only the difference is ours.
  const deliveryBilled = billedInvoices.reduce((s, o) => s + num(o.deliveryBilled), 0);
  const transportExpense = billedInvoices.reduce((s, o) => s + num(o.transportExpense), 0);
  const deliveryNet = deliveryBilled - transportExpense;

  const operatingExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const netProfit = grossProfit + deliveryNet - operatingExpenses;

  return {
    grossSales,
    salesReturns,
    netSales,
    cogsSold,
    cogsReturned,
    cogs,
    grossProfit,
    // Margin is against NET sales — margin on revenue that came back is meaningless.
    grossMarginPct: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
    deliveryBilled,
    transportExpense,
    deliveryNet,
    operatingExpenses,
    netProfit,
    netMarginPct: netSales > 0 ? (netProfit / netSales) * 100 : 0,
    invoiceCount: billedInvoices.length,
    creditNoteCount: creditNotes.length,
    averageInvoice: billedInvoices.length ? grossSales / billedInvoices.length : 0,
  };
};
