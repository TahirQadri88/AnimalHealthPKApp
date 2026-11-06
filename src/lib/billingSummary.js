// What the billing form's pinned bar shows. Built on the same functions saveInvoice uses
// (services/accounting/invoiceTotals), so the figure on the bar and the figure saved on the
// invoice cannot drift apart.
import { itemsSubtotal, invoiceTotal, bonusSavings } from '../services/accounting/invoiceTotals';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const billingSummary = (invoice = {}, { canCollect = false, priorBalance = 0, isEdit = false } = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  let units = 0, bonusUnits = 0;
  for (const i of items) {
    const q = num(i?.quantity);
    if (i?.isBonus) bonusUnits += q; else units += q;
  }
  const total = invoiceTotal({ ...invoice, items });
  const received = canCollect ? num(invoice.receivedAmount) : 0;
  return {
    skus: items.length,
    units,
    bonusUnits,
    subtotal: itemsSubtotal(items),
    delivery: num(invoice.deliveryBilled),
    discount: num(invoice.discount),
    bonusGiven: bonusSavings(items),
    total,
    received,
    showReceived: canCollect && received > 0,
    balanceDue: total - received,
    // An edited invoice is already inside the customer's balance, so "after" would count it twice.
    accountAfter: isEdit || !invoice.customerId ? null : num(priorBalance) + total - received,
  };
};

// The stored paymentStatus is only a fallback (App derives the real one), but it was set when
// "received" was typed and never again, so adding items afterwards saved a stale 'Paid'.
// With nothing received, an existing status is kept: older invoices were marked by hand.
export const paymentStatusFor = (received, total, previous) => {
  const r = num(received);
  if (r <= 0) return previous || 'Pending';
  return r >= num(total) ? 'Paid' : 'Partial';
};
