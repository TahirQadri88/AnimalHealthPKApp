import { describe, it, expect } from 'vitest';
import { assessReadiness, formatBytes, CRITICAL, WARNING } from './readiness';

const ready = (over = {}) => assessReadiness({
  serviceWorker: true,
  persistentStorage: true,
  estimate: { usage: 5_000_000, quota: 100_000_000, percentUsed: 5 },
  collections: { invoices: 1200, customers: 340, products: 210, payments: 800 },
  blocks: { INV: { next: 8477, end: 8487 }, REC: { next: 210, end: 220 }, CN: { next: 9, end: 19 } },
  syncState: 'live',
  pending: 0,
  ...over,
});
const check = (result, key) => result.checks.find(c => c.key === key);

describe('assessReadiness — the verdict', () => {
  it('is ready when everything is in place', () => {
    const r = ready();
    expect(r.level).toBe('ready');
    expect(r.summary).toBe('Ready to work offline');
    expect(r.failed).toBe(0);
  });

  it('is not ready when the app itself is not cached', () => {
    const r = ready({ serviceWorker: false });
    expect(r.level).toBe('not-ready');
    expect(check(r, 'shell').ok).toBe(false);
    expect(check(r, 'shell').detail).toMatch(/will not open offline/);
  });

  it('is not ready with no data on the device', () => {
    const r = ready({ collections: {} });
    expect(r.level).toBe('not-ready');
    expect(check(r, 'data').detail).toMatch(/Nothing cached yet/);
  });

  // The one that actually stops work: numbering refuses rather than risk a duplicate.
  it('is not ready when no invoice numbers are reserved', () => {
    const r = ready({ blocks: { INV: { next: 8487, end: 8487 } } });
    expect(r.level).toBe('not-ready');
    expect(check(r, 'numbers').detail).toMatch(/refused rather than risk/);
  });

  // A refusal is not a breakage, but it is exactly the thing nobody would otherwise discover.
  it('is only partial when the browser refused to keep the storage', () => {
    const r = ready({ persistentStorage: false });
    expect(r.level).toBe('partial');
    expect(r.summary).toMatch(/one thing worth fixing/);
    expect(check(r, 'storage').severity).toBe(WARNING);
    expect(check(r, 'storage').detail).toMatch(/could be cleared/);
  });

  it('a failure outranks a warning', () => {
    expect(ready({ persistentStorage: false, serviceWorker: false }).level).toBe('not-ready');
  });

  it('says a check could not be run rather than calling it a failure', () => {
    const r = ready({ persistentStorage: null, serviceWorker: null });
    expect(check(r, 'storage').detail).toMatch(/Could not be checked/);
    expect(check(r, 'shell').detail).toMatch(/Could not be checked/);
  });
});

describe('assessReadiness — what it actually tells you', () => {
  it('counts how many more invoices can be billed offline', () => {
    const r = ready();
    expect(r.invoicesLeft).toBe(10);
    expect(check(r, 'numbers').detail).toMatch(/10 invoices can still be billed offline/);
  });

  it('gets the singular right, because one is the number that matters', () => {
    expect(check(ready({ blocks: { INV: { next: 8486, end: 8487 } } }), 'numbers').detail)
      .toMatch(/1 invoice can still be billed/);
  });

  it('counts the records on the device', () => {
    expect(ready().totalDocs).toBe(2550);
    expect(check(ready(), 'data').detail).toMatch(/2550 records cached/);
  });

  it('names a collection that has nothing yet', () => {
    expect(check(ready({ collections: { invoices: 5, customers: 0 } }), 'data').detail)
      .toMatch(/nothing yet for customers/);
  });

  it('warns not to clear the browser while changes are still waiting', () => {
    const r = ready({ pending: 3, syncState: 'offline' });
    expect(check(r, 'pending').detail).toMatch(/3 changes saved here/);
    expect(check(r, 'pending').detail).toMatch(/do not clear/);
  });

  // Informational: unsent work is not a reason to call the device unready.
  it('does not fail the verdict just because something is unsent', () => {
    expect(ready({ pending: 3 }).level).toBe('ready');
  });

  it('reports how much space is in use when it knows', () => {
    expect(check(ready(), 'storage').detail).toMatch(/Using 4\.8 MB of 95\.4 MB/);
  });

  it('survives being called with nothing at all', () => {
    const r = assessReadiness();
    expect(() => r).not.toThrow();
    expect(r.level).toBe('not-ready');
    expect(r.checks).toHaveLength(5);
  });

  it('marks the three checks that stop work as critical', () => {
    const r = ready();
    ['shell', 'data', 'numbers'].forEach(k => expect(check(r, k).severity).toBe(CRITICAL));
  });
});

describe('formatBytes', () => {
  it('scales to something a person reads', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(5_000)).toBe('5 KB');
    expect(formatBytes(5_000_000)).toBe('4.8 MB');
    expect(formatBytes(5_000_000_000)).toBe('4.66 GB');
  });

  it('does not print NaN for something that is not a number', () => {
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });
});
