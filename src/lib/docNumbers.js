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
