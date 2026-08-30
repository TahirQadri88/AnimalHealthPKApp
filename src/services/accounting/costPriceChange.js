// What happens to history when a product's cost price changes.
//
// Editing a cost price can rewrite `costPrice` on invoices that have already been issued.
// That is sometimes right and sometimes destructive, and the two cases are opposites:
//
//   • The cost genuinely CHANGED — you bought the next lot at a different price. Last
//     month's margin was what it was. Rewriting it destroys the record of what you actually
//     made, and reported profit for closed months silently moves.
//
//   • The cost was WRONG — mistyped when the product was created. Then rewriting history is
//     exactly the fix, because the old figure was never true.
//
// The app cannot tell these apart, so it must ask. What it must not do is assume, which is
// what it did: the effective date defaulted to the product's first ever sale, quietly
// rewriting every invoice ever raised for it.
//
// These functions exist so the consequence can be shown BEFORE saving rather than reported
// in a toast afterwards.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Invoices dated on or after `effectiveDate` that hold this product at a different cost.
// Dates are ISO (YYYY-MM-DD), so string comparison is chronological.
export const invoicesAffectedByCostChange = ({ productId, newCost, effectiveDate, invoices = [] }) =>
  invoices.filter(inv =>
    String(inv.date) >= String(effectiveDate) &&
    (inv.items || []).some(it => it.productId === productId && num(it.costPrice) !== num(newCost)));

// How much reported profit moves if the change is applied.
//
// Profit is revenue minus cost, so raising a cost lowers profit. Returned from the
// business's point of view: negative means past profit shrinks. Bonus items are included —
// they earn nothing but they still cost, which is precisely when a cost change bites.
export const profitImpactOfCostChange = ({ productId, newCost, effectiveDate, invoices = [] }) => {
  const affected = invoicesAffectedByCostChange({ productId, newCost, effectiveDate, invoices });
  let delta = 0;
  affected.forEach(inv => {
    (inv.items || []).forEach(it => {
      if (it.productId !== productId) return;
      const qty = num(it.quantity);
      delta += (num(it.costPrice) - num(newCost)) * qty;
    });
  });
  return { invoiceCount: affected.length, profitDelta: delta, invoices: affected };
};

// The date from which a cost change should apply by default.
//
// Today, deliberately. The common case is a real price change, which must not touch
// history; the correction case is rarer and is now an explicit choice. This used to return
// the first sale date, so the destructive reading was the default and a single edit could
// silently rewrite years of margin.
export const defaultEffectiveDate = (todayStr) => todayStr;

// The earliest date a change could reach — offered when correcting a mistake, so the user
// does not have to hunt for it.
export const firstSaleDate = (productId, invoices = [], fallback) => {
  const dates = invoices
    .filter(inv => (inv.items || []).some(it => it.productId === productId))
    .map(inv => inv.date)
    .filter(Boolean)
    .sort();
  return dates[0] || fallback;
};
