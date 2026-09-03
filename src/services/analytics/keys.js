// How a transaction is filed under a breakdown row.
//
// One module, because the drill-down has to reach the SAME transactions the breakdown row
// counted. Two implementations of "which customer is this invoice for" is exactly how the
// aging report ended up disagreeing with itself, and a drill-down that lists a different
// set of invoices than the figure it was opened from is worse than no drill-down at all.
//
// Customers are keyed by id. The name is a label, never a key: two shops share a name, and
// a rename only rewrites customerName on past invoices if the cascade completes.

export const custKey = (doc) => String(doc?.customerId ?? doc?.customerName ?? 'Unknown');
export const productKey = (item) => item?.name || 'Unknown';
export const companyKey = (item) => item?.company || 'Unknown';
export const salespersonKey = (doc) => doc?.salespersonName || 'Unknown';

// Segment lookup, by customer id. `type` is stored as customerType on the customer record.
export const buildCustomerIndex = (customers = []) => {
  const segment = {};
  const name = {};
  customers.forEach(c => {
    segment[String(c.id)] = { city: c.city || '', area: c.area || '', type: c.customerType || '' };
    name[String(c.id)] = c.name;
  });
  return {
    segment,
    name,
    // Whatever the customer is called TODAY, falling back to the name on the document for a
    // customer who no longer exists.
    labelFor: (doc) => name[custKey(doc)] || doc?.customerName || 'Unknown',
    segmentFor: (doc, dimension) => (segment[custKey(doc)] || {})[dimension] || 'Unknown',
  };
};
