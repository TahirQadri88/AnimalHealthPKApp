// Is this bill a counter sale?
//
// A cash sale is settled on the spot and handed over. Printing "Previous Balance" and a
// running ledger on it is noise at best — and on a walk-in account, which everybody shares,
// the balance shown belongs to no one customer in particular. The bill should default to
// Bill Only and let the toggle do the rest.
//
// There is no flag for this in the data. "Cash Sale (Walk in Customer)" is an ordinary
// customer record somebody typed, so the name is the only signal available today, and this
// deliberately matches on it rather than inventing a field nothing can set.
//
// If a real cash-customer flag is ever added to the customer record, this is the one place
// that has to learn about it — every screen asks the question here.
export const CASH_CUSTOMER_PATTERN = /\b(cash\s*sales?|walk[\s-]?in|counter\s*sales?)\b/i;

export const isCashCustomer = (customer) =>
  !!customer && CASH_CUSTOMER_PATTERN.test(String(customer.name || ''));

/** The same question asked from a document, which carries the id and a name snapshot. */
export const isCashSale = (doc, customers = []) => {
  if (!doc) return false;
  const record = customers.find(c => String(c.id) === String(doc.customerId));
  // The customer record wins; the name on the document is a snapshot that may predate a
  // rename. Fall back to it only when the record is gone.
  return record ? isCashCustomer(record) : isCashCustomer({ name: doc.customerName });
};
