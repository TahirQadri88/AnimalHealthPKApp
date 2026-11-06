// The rate this customer was last charged for each product, as a Map keyed by product id.
//
// Replaces a loop that ran on every add: sort every invoice of the customer, then walk them
// until one carried the product. Same answer, worked out once per customer: newest first
// (date, then id descending), bonus lines ignored, and within one invoice only the FIRST line
// that matches a product counts. If that line has no price, an older invoice is consulted.
export const lastPricesForCustomer = (invoices = [], customerId) => {
  const map = new Map();
  if (!customerId) return map;
  const past = invoices
    .filter(inv => inv && inv.customerId === customerId)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
  for (const inv of past) {
    const seen = new Set();
    for (const i of inv.items || []) {
      if (!i || i.isBonus) continue;
      for (const k of [i.productId, i.uniqueId]) {
        if (k === undefined || seen.has(k)) continue;
        seen.add(k);
        if (!map.has(k) && i.price !== undefined) map.set(k, i.price);
      }
    }
  }
  return map;
};
