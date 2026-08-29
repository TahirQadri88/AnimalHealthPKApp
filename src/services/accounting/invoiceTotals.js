// What an invoice comes to.
//
// This lived inline in App.jsx, written out twice — once in saveInvoice and once in the
// form's summary. Two copies of the same arithmetic is how the figure shown to the
// customer and the figure stored on the invoice drift apart, so it lives here instead,
// with tests.
//
// Amounts are coerced with num() rather than used raw. A missing or non-numeric price
// would otherwise poison the whole sum with NaN, and "Rs. NaN" on an invoice is never the
// right answer — treating it as zero is wrong too, but it is visibly wrong on one line
// rather than silently wrong everywhere.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Bonus items are given away: they carry a price for reference but contribute nothing.
export const itemsSubtotal = (items = []) =>
  items.reduce((sum, i) => sum + (i?.isBonus ? 0 : num(i?.price) * num(i?.quantity)), 0);

// Delivery is charged on top; discount comes off the whole thing.
export const invoiceTotal = ({ items = [], deliveryBilled = 0, discount = 0 } = {}) =>
  itemsSubtotal(items) + num(deliveryBilled) - num(discount);

// What the customer would have paid for the bonus items — shown as "you saved", never
// added to any total.
export const bonusSavings = (items = []) =>
  items.reduce((sum, i) => sum + (i?.isBonus ? num(i?.originalPrice) * num(i?.quantity) : 0), 0);

// Cost of the goods actually sold. Bonus items are excluded from revenue but they still
// cost the business money, so they are included here — leaving them out would overstate
// profit on exactly the orders where margin is thinnest.
export const invoiceCost = (items = []) =>
  items.reduce((sum, i) => sum + num(i?.costPrice) * num(i?.quantity), 0);
