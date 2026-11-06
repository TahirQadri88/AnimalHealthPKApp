// What must be true before a bill is saved. Runs before a document number is claimed, so a
// refused bill never uses one up.
import { invoiceTotal, itemsSubtotal } from '../services/accounting/invoiceTotals';

const n = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v));

export const validateInvoiceDraft = (inv = {}, { canCollect = false } = {}) => {
  const errors = [];
  const warnings = [];
  const items = Array.isArray(inv.items) ? inv.items : [];
  if (!inv.customerId) errors.push({ field: 'customer', message: 'Pick a customer' });
  if (!items.length) errors.push({ field: 'items', message: 'Add at least one product' });
  items.forEach((i, idx) => {
    const key = i?.uniqueId || i?.productId || idx;
    const q = n(i?.quantity);
    // Part quantities (half a bag) are allowed, as they always were; zero and below are not.
    if (!Number.isFinite(q) || q <= 0) errors.push({ field: 'qty', key, message: `${i?.name || 'Item'}: enter a quantity` });
    if (!i?.isBonus) {
      const r = n(i?.price);
      if (!Number.isFinite(r) || r <= 0) errors.push({ field: 'rate', key, message: `${i?.name || 'Item'}: enter a rate, or add it as Bonus` });
    }
  });
  for (const [field, label] of [['deliveryBilled', 'Delivery'], ['transportExpense', 'Driver expense'], ['discount', 'Discount']]) {
    const v = n(inv[field]);
    if (!Number.isFinite(v) || v < 0) errors.push({ field, message: `${label} cannot be negative` });
  }
  if (canCollect) {
    const r = n(inv.receivedAmount);
    if (!Number.isFinite(r) || r < 0) errors.push({ field: 'receivedAmount', message: 'Payment received cannot be negative' });
  }
  const gross = itemsSubtotal(items) + (n(inv.deliveryBilled) || 0);
  if (n(inv.discount) > gross) errors.push({ field: 'discount', message: 'Discount is more than the bill' });
  if (canCollect && n(inv.receivedAmount) > invoiceTotal(inv) && invoiceTotal(inv) >= 0 && items.length) {
    warnings.push({ field: 'receivedAmount', message: 'Payment received is more than this bill; the extra stays on account' });
  }
  return { ok: errors.length === 0, errors, warnings };
};
