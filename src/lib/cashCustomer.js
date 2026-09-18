// Is this bill a counter sale?
//
// A cash sale is settled on the spot and handed over. Printing "Previous Balance" and a
// running ledger on it is noise at best — and on a walk-in account, which everybody shares,
// the balance shown belongs to no one customer in particular. The bill should default to
// Bill Only and let the toggle do the rest.
//
// Two signals, and the order matters.
//
// `isCashCustomer` on the customer record is the answer whenever it has been set — the
// checkbox on the customer form, "Cash Sale (Walk in Customer)". It is honoured in BOTH
// directions: ticked marks an ordinary-sounding account as a counter account, and unticked
// marks a real customer whose name happens to read like one.
//
// The name is the fallback, and it is why this worked before any checkbox existed: "Cash
// Sale (Walk in Customer)" is an ordinary record somebody typed, and every bill already
// raised against it behaves correctly without anyone editing anything.
//
// The distinction that matters is `false` versus absent. Once the form saves the field,
// every customer it touches carries a boolean — so an absent field means "never asked",
// and only then does the name decide. CustomerModal seeds its checkbox from THIS function,
// so opening the walk-in account shows the box already ticked and saving preserves it
// rather than quietly demoting the one record this was built for.
export const CASH_CUSTOMER_PATTERN = /\b(cash\s*sales?|walk[\s-]?in|counter\s*sales?)\b/i;

export const isCashCustomer = (customer) => {
  if (!customer) return false;
  if (typeof customer.isCashCustomer === 'boolean') return customer.isCashCustomer;
  return CASH_CUSTOMER_PATTERN.test(String(customer.name || ''));
};

/** The same question asked from a document, which carries the id and a name snapshot. */
export const isCashSale = (doc, customers = []) => {
  if (!doc) return false;
  const record = customers.find(c => String(c.id) === String(doc.customerId));
  // The customer record wins; the name on the document is a snapshot that may predate a
  // rename. Fall back to it only when the record is gone.
  return record ? isCashCustomer(record) : isCashCustomer({ name: doc.customerName });
};
