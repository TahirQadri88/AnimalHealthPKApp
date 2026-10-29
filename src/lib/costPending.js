// Products a staff member registered, still waiting for an admin to price them.
//
// Cost Price is admin-only, so a staff member registers a product with no cost and
// `costPending: true`. Until an admin sets one, every sale of it counts as pure profit. A flag
// nobody sees would leave it that way, so the count drives a badge on the Items tab and a
// notice on the admin's Home screen.
//
// A cost of zero alone is not enough to count: products priced before this existed may be
// zero on purpose (free samples), and flagging them would make the badge always lit.
export const needsCost = (p) => !!p && p.costPending === true && !(Number(p.costPrice) > 0) && !p.archived;

export const productsNeedingCost = (products = []) => products.filter(needsCost);

/** How many bills include at least one of these products. */
export const billsAffected = (pending = [], invoices = []) => {
  const ids = new Set(pending.map(p => String(p.id)));
  if (ids.size === 0) return 0;
  return invoices.filter(inv => (inv.items || []).some(it => ids.has(String(it.productId ?? '')))).length;
};
