import { db, doc, runTransaction } from '../firebase';

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
// Returns null if the transaction cannot run — most likely the counters rule has not been
// published yet — and the caller falls back to the old behaviour. Degraded, not broken.
export const claimDocNumber = async (prefix, fallbackStart) => {
  try {
    return await runTransaction(db, async (tx) => {
      const ref = doc(db, 'counters', prefix);
      const snap = await tx.get(ref);
      const stored = snap.exists() ? Number(snap.data().next) || 0 : 0;
      const next = Math.max(stored, fallbackStart);
      tx.set(ref, { prefix, next: next + 1, updatedAt: new Date().toISOString() }, { merge: true });
      return next;
    });
  } catch (err) {
    console.warn(
      `[numbering] counter transaction failed for ${prefix} — falling back to client-side ` +
      `numbering, which can duplicate numbers if two people bill at once. ` +
      `Publish the counters rule from firestore.rules.`,
      err?.code || err
    );
    return null;
  }
};

