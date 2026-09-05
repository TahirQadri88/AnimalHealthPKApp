import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  deriveStatus, countPending, publishCollectionMeta, publishOnline,
  getSyncSnapshot, subscribeSyncStatus, __resetSyncStatus,
} from './syncStatus';

beforeEach(() => __resetSyncStatus());

describe('deriveStatus', () => {
  const cols = (o) => ({ collections: o });

  it('is live when everything is in touch with the server', () => {
    expect(deriveStatus({ online: true, ...cols({ invoices: { fromCache: false, pending: 0 } }) }).state)
      .toBe('live');
  });

  it('is offline whenever the browser says so, whatever else is true', () => {
    expect(deriveStatus({ online: false, ...cols({ invoices: { fromCache: false, pending: 0 } }) }).state)
      .toBe('offline');
  });

  it('is syncing while writes are outstanding', () => {
    expect(deriveStatus({ online: true, ...cols({ invoices: { fromCache: false, pending: 3 } }) }).state)
      .toBe('syncing');
  });

  // The failure navigator.onLine cannot see, and the common one here: a signal that is up
  // and carrying nothing.
  it('is stale when the browser claims to be online but Firestore is serving cache', () => {
    expect(deriveStatus({ online: true, ...cols({ invoices: { fromCache: true, pending: 0 } }) }).state)
      .toBe('stale');
  });

  it('reports offline ahead of stale, because offline is the more useful thing to say', () => {
    expect(deriveStatus({ online: false, ...cols({ invoices: { fromCache: true, pending: 2 } }) }).state)
      .toBe('offline');
  });

  it('adds the pending writes across every collection', () => {
    const s = deriveStatus({ online: true, ...cols({
      invoices: { fromCache: false, pending: 2 },
      payments: { fromCache: false, pending: 1 },
      customers: { fromCache: false, pending: 0 },
    }) });
    expect(s.pending).toBe(3);
    expect(s.state).toBe('syncing');
  });

  // Listeners do not all reconnect in the same millisecond.
  it('is not live while any one collection is still on cache', () => {
    expect(deriveStatus({ online: true, ...cols({
      invoices: { fromCache: false, pending: 0 },
      payments: { fromCache: true, pending: 0 },
    }) }).state).toBe('stale');
  });

  it('is live, not stale, before any listener has reported', () => {
    expect(deriveStatus({ online: true, collections: {} }).state).toBe('live');
  });

  it('survives being called with nothing', () => {
    expect(() => deriveStatus()).not.toThrow();
    expect(deriveStatus().state).toBe('live');
  });
});

describe('countPending', () => {
  const snap = (docs, hasPendingWrites) => ({
    metadata: { hasPendingWrites },
    forEach: (fn) => docs.forEach(fn),
  });

  it('counts the documents the server has not acknowledged', () => {
    expect(countPending(snap([
      { metadata: { hasPendingWrites: true } },
      { metadata: { hasPendingWrites: false } },
      { metadata: { hasPendingWrites: true } },
    ], true))).toBe(2);
  });

  // Walking thousands of invoices on every metadata event would be the expensive way to
  // learn nothing.
  it('does not walk the collection when the snapshot says nothing is pending', () => {
    const forEach = vi.fn();
    expect(countPending({ metadata: { hasPendingWrites: false }, forEach })).toBe(0);
    expect(forEach).not.toHaveBeenCalled();
  });

  it('is zero for anything malformed rather than throwing', () => {
    expect(countPending(undefined)).toBe(0);
    expect(countPending({})).toBe(0);
  });
});

describe('the store', () => {
  it('starts live', () => {
    expect(getSyncSnapshot().state).toBe('live');
  });

  it('tells subscribers when the picture changes', () => {
    const fn = vi.fn();
    subscribeSyncStatus(fn);
    publishCollectionMeta('invoices', { fromCache: true, pending: 0 });
    expect(fn).toHaveBeenCalled();
    expect(getSyncSnapshot().state).toBe('stale');
  });

  // useSyncExternalStore compares by reference, so an unchanged status must return the very
  // same object or React re-renders forever.
  it('returns the identical object when nothing changed', () => {
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    const first = getSyncSnapshot();
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    publishCollectionMeta('payments', { fromCache: false, pending: 0 });
    expect(getSyncSnapshot()).toBe(first);
  });

  it('does not tell subscribers about a repeat of the same news', () => {
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    const fn = vi.fn();
    subscribeSyncStatus(fn);
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('follows the browser going offline and back', () => {
    publishOnline(false);
    expect(getSyncSnapshot().state).toBe('offline');
    publishOnline(true);
    expect(getSyncSnapshot().state).toBe('live');
  });

  it('remembers when it was last in touch with the server', () => {
    expect(getSyncSnapshot().lastSyncedAt).toBeNull();
    publishCollectionMeta('invoices', { fromCache: false, pending: 0 });
    expect(typeof getSyncSnapshot().lastSyncedAt).toBe('number');
  });

  it('unsubscribes', () => {
    const fn = vi.fn();
    subscribeSyncStatus(fn)();
    publishCollectionMeta('invoices', { fromCache: true, pending: 0 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('is not stopped by one subscriber that throws', () => {
    const good = vi.fn();
    subscribeSyncStatus(() => { throw new Error('bad listener'); });
    subscribeSyncStatus(good);
    expect(() => publishCollectionMeta('invoices', { fromCache: true, pending: 0 })).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});
