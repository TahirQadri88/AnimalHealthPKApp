// Document numbers reserved in advance, so billing works offline without collisions.
//
// The problem this solves. `claimDocNumber` guarantees no two devices are handed the same
// number by advancing a counter inside a Firestore transaction — and a transaction always
// reads from the server, so it cannot run offline. The fallback is `getNextSeqNum`, which is
// max()+1 over whatever this browser holds, and two devices billing during the same outage
// both compute the same number. Two customers then hold papers with the same invoice number,
// which is the worst outcome available here.
//
// The fix is to move the transaction earlier rather than remove it. While online, one
// transaction advances the counter by ten and hands this device that range exclusively. The
// numbers are spent one at a time from localStorage — no transaction, no network — and the
// exclusivity still comes from the transaction that reserved them.
//
// What it costs: a block that is not fully spent leaves a gap in the sequence. That is a
// deliberate trade. A gap is a number nobody used; a duplicate is two documents claiming to
// be the same one. Gaps already happen when a claimed number is abandoned, and the counter
// has only ever moved forward.
//
// The format does not change. INV-8477 is still INV-8477.
//
// Pure: no firebase import, so this can be tested. The transaction that fills a block lives
// in claimDocNumber.js beside the one it replaces.

export const BLOCK_SIZE = 10;
const KEY = (prefix) => `docBlock:${prefix}`;

const store = (storage) => {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
};

/** `{ next, end }` — the numbers next … end-1 belong to this device. Null if none do. */
export const readBlock = (prefix, storage) => {
  const s = store(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(KEY(prefix));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const next = Number(parsed?.next);
    const end = Number(parsed?.end);
    // A block that does not parse to two sane integers is not a block. Discard it rather
    // than reasoning about half of it — the cost is one wasted claim.
    if (!Number.isInteger(next) || !Number.isInteger(end) || next < 1 || end < next) return null;
    return { next, end };
  } catch {
    return null;
  }
};

export const writeBlock = (prefix, block, storage) => {
  const s = store(storage);
  if (!s || !block) return false;
  try {
    s.setItem(KEY(prefix), JSON.stringify({ next: block.next, end: block.end }));
    return true;
  } catch {
    // Private windows and full quotas both land here. Without storage there is no block, so
    // the caller falls back to asking the server every time — which is the old behaviour.
    return false;
  }
};

export const clearBlock = (prefix, storage) => {
  const s = store(storage);
  try { s?.removeItem(KEY(prefix)); } catch { /* nothing to do */ }
};

export const blockFrom = (start, size = BLOCK_SIZE) => ({ next: start, end: start + size });

export const remaining = (block) =>
  (block && Number.isInteger(block.next) && Number.isInteger(block.end))
    ? Math.max(0, block.end - block.next)
    : 0;

/** Refill before it runs out, not when it has. */
export const needsRefill = (block, size = BLOCK_SIZE) => remaining(block) < Math.ceil(size / 2);

/**
 * Spend the next reserved number, or null if none is reserved.
 *
 * Read and write happen with no await between them, so a second tab cannot interleave —
 * localStorage is synchronous and a tab is single-threaded. Two tabs racing in the same
 * millisecond is theoretically possible and has never been observed; the alternative is a
 * lock protocol for a shop with three staff, which is not a trade worth making.
 */
export const takeFromBlock = (prefix, storage) => {
  const block = readBlock(prefix, storage);
  if (remaining(block) <= 0) return null;
  const taken = block.next;
  writeBlock(prefix, { next: taken + 1, end: block.end }, storage);
  return taken;
};

/**
 * Join a freshly claimed range onto what is already held, when they touch.
 *
 * This is what keeps an ONLINE business from seeing constant gaps. Refilling by replacing
 * the block would throw away whatever was left of the old one — up to half a block, every
 * few invoices — and a sequence that skips four numbers every Tuesday is alarming to a
 * business whose invoice numbers are read aloud.
 *
 * The normal case is contiguous: nobody else claimed in between, so the new range starts
 * exactly where the old one ended and the two are one range with no gap at all. Only when
 * another device claimed first is anything lost, and then it is at most half a block.
 */
export const mergeBlocks = (held, fresh) => {
  if (!fresh) return held || null;
  if (held && remaining(held) > 0 && fresh.next === held.end) {
    return { next: held.next, end: fresh.end };
  }
  return fresh;
};

/** Format a claimed number the way every document in this app is numbered. */
export const formatDocId = (prefix, num) => `${prefix}-${String(num).padStart(4, '0')}`;
