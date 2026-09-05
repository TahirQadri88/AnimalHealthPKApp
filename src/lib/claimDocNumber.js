import { db, doc, runTransaction } from '../firebase';
import { withTimeout } from './withTimeout';
import {
  BLOCK_SIZE, blockFrom, readBlock, writeBlock, takeFromBlock, needsRefill, mergeBlocks,
} from './docNumberBlock';

// Kept apart from getNextSeqNum deliberately. That one is pure and is unit-tested; this one
// imports ../firebase, which initialises Auth on import and throws without credentials.
// Put the two in one module and the pure half becomes untestable — which is exactly what
// happened when they were first extracted together.
// Claim the next document number atomically.
//
// getNextSeqNum below takes max()+1 over the records this browser happens to hold, so two
// people billing in the same moment both compute the same number and one invoice
// overwrites the other. A Firestore transaction is the fix: the read and the increment
// happen as one operation, and a second caller retries against the updated value.
//
// fallbackStart is the client-side guess, used two ways. It seeds the counter the first
// time, so numbering continues from existing records rather than restarting at 1. And it
// is a floor on every subsequent claim, so if anything was ever numbered while the counter
// was unavailable, the counter catches up instead of reissuing numbers already in use.
//
// Numbers come from a reserved block now — see the section below. The single-claim
// `claimDocNumber` that used to live here was replaced by it and then read by nothing, so it
// is gone: dead code that reads like live code is what made an earlier audit count sixteen
// listeners where there were fifteen.
//
// What it taught, and what the block claim inherits: a transaction ALWAYS reads from the
// server — it deliberately bypasses the local cache, which is what makes it atomic — so
// offline it does not reject, it WAITS. Awaiting one on the billing path meant an invoice
// created during an outage produced no record, no toast and no error at all. Every
// transaction here is therefore both skipped when the browser is certain it is offline and
// capped by withTimeout, because navigator.onLine still says true on a dead connection.
export const CLAIM_TIMEOUT_MS = 5000;

// ── Reserved blocks ─────────────────────────────────────────────────────────
//
// claimDocNumber above is exact and cannot run offline. That was fine while the app needed
// the network to bill at all; it is not fine now, because the offline fallback is a
// client-side guess and two devices billing during the same outage both produce it.
//
// So the transaction moves earlier. One transaction, while online, advances the counter by
// ten and reserves that range for this device; the numbers are then spent one at a time from
// localStorage with no transaction and no network. The exclusivity still comes from the
// transaction — it just happened before the outage instead of during it.
//
// The cost is a gap when a block is not fully spent. That is the trade: a gap is a number
// nobody used, a duplicate is two documents claiming to be the same one.

/** Reserve `size` numbers. Returns `{ next, end }`, or null if the transaction cannot run. */
export const claimDocBlock = async (prefix, size = BLOCK_SIZE, floor = 0) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  return withTimeout(
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'counters', prefix);
      const snap = await tx.get(ref);
      const stored = snap.exists() ? Number(snap.data().next) || 0 : 0;
      // The client-side guess is the seed and the floor, exactly as for a single claim: if
      // records exist that the counter has never seen, start above them.
      const start = Math.max(stored, floor);
      tx.set(ref, { prefix, next: start + size, updatedAt: new Date().toISOString() }, { merge: true });
      return blockFrom(start, size);
    }),
    CLAIM_TIMEOUT_MS,
    null,
    (err) => console.warn(
      `[numbering] could not reserve a block of ${prefix} numbers`,
      err === null ? '(no answer in time)' : (err?.code || err),
    ),
  );
};

/** Top a block up if it is running low. Safe to call often; does nothing when it should. */
export const refillBlock = async (prefix, floor = 0, size = BLOCK_SIZE) => {
  const held = readBlock(prefix);
  if (!needsRefill(held, size)) return held;
  const fresh = await claimDocBlock(prefix, size, Math.max(floor, held?.end || 0));
  if (!fresh) return held;
  // Joined onto what is left rather than replacing it — see mergeBlocks. Replacing would
  // discard up to half a block on every top-up, which for an online business is a visible
  // gap in the invoice sequence every few days.
  const merged = mergeBlocks(held, fresh);
  writeBlock(prefix, merged);
  return merged;
};

/**
 * The number to put on the next document — the one callers should use.
 *
 * Returns null ONLY when offline with nothing reserved. That is a refusal, not a failure,
 * and the caller must show it rather than substituting a guess: a guess is the duplicate
 * this whole module exists to prevent.
 */
export const nextDocNumber = async (prefix, clientGuess = 1) => {
  const fromBlock = takeFromBlock(prefix);
  if (fromBlock !== null) {
    // Top up in the background — the number in hand is already reserved, so nothing waits.
    refillBlock(prefix, clientGuess).catch(() => {});
    return fromBlock;
  }

  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!online) return null;

  const fresh = await claimDocBlock(prefix, BLOCK_SIZE, clientGuess);
  if (fresh) {
    writeBlock(prefix, { next: fresh.next + 1, end: fresh.end });
    return fresh.next;
  }

  // Online but the counter is unreachable — the rules may not be published, or the
  // connection is dead while the browser thinks otherwise. Degraded exactly as before.
  console.warn(`[numbering] no block available for ${prefix} and the counter did not answer — using the client-side guess`);
  return clientGuess;
};

/** Reserve for every document type, so an outage that starts now is survivable. */
export const PREFIXES = ['INV', 'EST', 'ORD', 'REC', 'CN'];

export const ensureBlocks = async (floors = {}) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  for (const prefix of PREFIXES) {
    // Sequential on purpose: five transactions at once against one counter each is fine,
    // but sequential keeps the write burst small on a slow connection.
    await refillBlock(prefix, floors[prefix] || 0).catch(() => {});
  }
};
