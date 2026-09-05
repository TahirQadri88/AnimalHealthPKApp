import { db, doc, runTransaction } from '../firebase';
import { withTimeout } from './withTimeout';

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
// Returns null if the transaction cannot run, and the caller falls back to the old
// behaviour. Degraded, not broken.
//
// That sentence used to be false in the one case that matters most. A transaction ALWAYS
// reads from the server — it deliberately bypasses the local cache, which is what makes it
// atomic — so offline it does not reject, it WAITS. `await claimDocNumber(...)` therefore
// hung, and because saveInvoice claims the number before it writes anything, an invoice
// created during an internet failure produced no record, no toast and no error at all.
// Reported 2026-09-04.
//
// Two guards now:
//   • When the browser is certain it is offline, do not start a transaction at all.
//   • Otherwise cap the wait, because navigator.onLine says true on a dead connection.
export const CLAIM_TIMEOUT_MS = 5000;

const FALLBACK_WARNING =
  'falling back to client-side numbering, which can duplicate a number if two devices bill '
  + 'at the same time. Reserved number blocks remove that risk — see docs/OFFLINE_EXECUTION.md C1.';

export const claimDocNumber = async (prefix, fallbackStart) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.warn(`[numbering] offline, so no counter transaction was attempted for ${prefix} — ${FALLBACK_WARNING}`);
    return null;
  }
  return withTimeout(
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'counters', prefix);
      const snap = await tx.get(ref);
      const stored = snap.exists() ? Number(snap.data().next) || 0 : 0;
      const next = Math.max(stored, fallbackStart);
      tx.set(ref, { prefix, next: next + 1, updatedAt: new Date().toISOString() }, { merge: true });
      return next;
    }),
    CLAIM_TIMEOUT_MS,
    null,
    (err) => console.warn(
      err === null
        ? `[numbering] the counter for ${prefix} did not answer within ${CLAIM_TIMEOUT_MS}ms — ${FALLBACK_WARNING}`
        : `[numbering] counter transaction failed for ${prefix} — ${FALLBACK_WARNING} `
          + 'If this persists while online, publish the counters rule from firestore.rules.',
      err?.code || err || '',
    ),
  );
};

