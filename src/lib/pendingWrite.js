// How a Firestore write reports back when the network is not there.
//
// `setDoc` and `deleteDoc` apply to the local cache IMMEDIATELY and queue the mutation in
// IndexedDB, where it survives closing the browser — but the promise they return settles
// only when the SERVER acknowledges. Offline it never settles at all.
//
// So `await setDoc(...)` hung, and every caller hung with it: saveInvoice never reached its
// success path, the form sat there, and the only thing that happened was a six-second
// "Still saving — check your connection" toast. The record was already safe on the device
// and the app said it was stuck. That is the same shape of lie as the restore button that
// reported success when nothing was written, pointing the other way.
//
// Three outcomes instead of two, because "not yet acknowledged" is not a failure:
//
//   SYNCED — the server has it.
//   QUEUED — the local cache has it and the durable mutation queue will send it. A success.
//   FAILED — genuinely rejected: a rules denial, a malformed document.
//
// A rejection can still arrive after we have reported QUEUED — a write the security rules
// refuse is only refused once it reaches the server, which may be hours later. onLateFailure
// is how that gets reported rather than swallowed.
//
// This module is deliberately free of any firebase import: src/firebase.js initialises Auth
// at import time and throws without credentials, so anything importing it cannot be loaded
// by a test. The timing logic is the part worth testing, so it lives here.

export const SYNCED = 'synced';
export const QUEUED = 'queued';
export const FAILED = 'failed';

/**
 * Resolve as soon as we know enough to let the caller continue. Never rejects.
 *
 * @param {Promise} ack            the promise setDoc/deleteDoc returned
 * @param {number}  [timeoutMs]    how long to wait for the server before calling it queued
 * @param {Function} [onLateFailure] called if the write is rejected AFTER we said QUEUED
 */
export const settleWrite = (ack, { timeoutMs = 1500, onLateFailure } = {}) =>
  new Promise(resolve => {
    let settled = false;
    const finish = (result) => { settled = true; resolve(result); };

    const timer = setTimeout(() => { if (!settled) finish(QUEUED); }, timeoutMs);

    Promise.resolve(ack).then(
      () => { if (!settled) { clearTimeout(timer); finish(SYNCED); } },
      (err) => {
        if (!settled) { clearTimeout(timer); finish(FAILED); return; }
        // Already reported as queued. Tell someone, but never let a reporter throw into
        // a promise nobody is awaiting.
        try { if (onLateFailure) onLateFailure(err); } catch { /* reporting must not break a write */ }
      },
    );
  });

/**
 * The predicate callers should use.
 *
 * Do NOT test the result for truthiness: all three outcomes are non-empty strings, so
 * `if (result)` is true even for FAILED. That mistake would turn a write-failure counter
 * back into a write-attempt counter, which is exactly the restore bug fixed on 2026-09-03.
 */
export const isAccepted = (result) => result !== FAILED;
