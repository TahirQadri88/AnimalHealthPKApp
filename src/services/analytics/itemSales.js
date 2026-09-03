// Invoice-level line search: "what did we sell of X", or "what did Y buy".
//
// This lived inside the view's own IIFE, which meant an export could not reach it: the tab
// kept its CSV and WhatsApp buttons while getSortedExportData returned null for it, so both
// threw on `null.some` / `null.forEach` the moment either was pressed.
//
// Bonus lines are excluded. The question this answers is what was SOLD, and free stock has
// no price; it is counted in the P&L as a cost, which is where it belongs.
export const buildItemSales = ({
  invoices = [], productQuery = '', customerQuery = '', checkCustomFilter = () => true,
} = {}) => {
  const prodQ = String(productQuery).toLowerCase().trim();
  const custQ = String(customerQuery).toLowerCase().trim();
  // No search, no list. Scanning every line of every invoice for an empty query is both
  // slow and useless — the screen asks for a filter first.
  if (!prodQ && !custQ) return [];

  const out = [];
  invoices.filter(o => o.status === 'Billed' && checkCustomFilter(o.date)).forEach(inv => {
    if (custQ && !(inv.customerName || '').toLowerCase().includes(custQ)) return;
    (inv.items || []).filter(i => !i.isBonus).forEach(item => {
      if (prodQ && !(item.name || '').toLowerCase().includes(prodQ)) return;
      out.push({
        date: inv.date, customerId: inv.customerId, customerName: inv.customerName,
        invoiceId: inv.id, inv, name: item.name,
        qty: item.quantity || 0, rate: item.price || 0,
        sub: (item.price || 0) * (item.quantity || 0),
      });
    });
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
};
