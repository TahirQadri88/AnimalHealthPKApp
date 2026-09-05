// Give up waiting on a promise that may never answer.
//
// Written for `claimDocNumber`, which was the reason an invoice created offline did not save
// at all. A Firestore transaction ALWAYS reads from the server — it deliberately bypasses the
// local cache, because that is what makes it atomic — so offline it does not fail, it waits.
// `await claimDocNumber(...)` therefore hung before `saveInvoice` reached a single write, and
// the whole save path stopped there: no record, no toast, no error.
//
// The comment in claimDocNumber said "Returns null if the transaction cannot run … Degraded,
// not broken." That was true of a *rejected* transaction and false of an unanswered one, and
// offline is the second case.
//
// Pure and free of any firebase import, so it can be tested.

/**
 * Resolve `fallback` if `promise` has not settled within `ms`, or if it rejects.
 * Never rejects.
 *
 * @param {Function} [onFailure] called with the error, or null when it simply timed out.
 */
export const withTimeout = (promise, ms, fallback = null, onFailure) => new Promise(resolve => {
  let settled = false;
  const done = (value) => { if (!settled) { settled = true; resolve(value); } };

  const timer = setTimeout(() => {
    if (settled) return;
    try { if (onFailure) onFailure(null); } catch { /* reporting must not break the caller */ }
    done(fallback);
  }, ms);

  Promise.resolve(promise).then(
    (value) => { clearTimeout(timer); done(value); },
    (err) => {
      clearTimeout(timer);
      if (!settled) { try { if (onFailure) onFailure(err); } catch { /* as above */ } }
      done(fallback);
    },
  );
});
