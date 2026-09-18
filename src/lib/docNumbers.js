// Client-side document numbering. Pure on purpose: no Firebase import, so it can be
// tested. The Firestore transaction that makes numbering safe under concurrency lives in
// ./claimDocNumber.js, which cannot be imported from a test without credentials.
// Feed this the RAW collection, never the void-filtered one. A voided invoice still owns
// its number — that number is printed on paper somewhere — so hiding it from the scan would
// hand the same number to the next document. The Firestore counter in claimDocNumber only
// ever moves up and would normally absorb this, but it falls back to this guess when the
// transaction cannot run, and that is exactly when a duplicate would ship.
export const getNextSeqNum = (items, prefix) => {
  const LEGACY_THRESHOLD = 10000000;
  const nums = items.map(item => {
    const s = String(item.id || '');
    if (!s.startsWith(prefix + '-')) return 0;
    const n = parseInt(s.slice(prefix.length + 1), 10);
    return !isNaN(n) && n < LEGACY_THRESHOLD ? n : 0;
  });
  return Math.max(0, ...nums) + 1;
};

// ── Which series a document belongs to ──────────────────────────────────────
//
// An estimate, a draft order and an invoice are three series with three prefixes, and a
// document's number has to match the series it is currently in.
//
// It did not. saveInvoice claimed a number only `if (!finalInvoice.id)` — only for a
// brand-new document — so opening EST-0037 and saving it as Billed changed the status and
// kept the number. The document then printed the word INVOICE over "REF # EST-0037", and
// the estimate series had a hole in it while the invoice series never issued the number.
// Reported 2026-09-18 from a cash sale.
//
// The Issue-as-Invoice button on the billing list always got this right; the in-form path
// did not, and both now go through the same rule.

export const SERIES = { Estimate: 'EST', Booked: 'ORD', Billed: 'INV' };

export const prefixForStatus = (status) => SERIES[status] || 'INV';

/** Which known series an id belongs to, or null for a legacy or unrecognised id. */
export const seriesOf = (id) => {
  const s = String(id || '');
  return Object.values(SERIES).find(p => s.startsWith(`${p}-`)) || null;
};

/**
 * Does this document need a new number because it has changed series?
 *
 * False for an id whose series is unrecognised. Legacy ids predate the prefixes and are
 * printed on paper somewhere; renumbering one would be inventing a change nobody asked for.
 */
export const needsRenumber = (id, status) => {
  const current = seriesOf(id);
  return current !== null && current !== prefixForStatus(status);
};
