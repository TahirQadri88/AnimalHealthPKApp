// Every Firestore write must be able to give up waiting.
//
// This is a source check, not a behaviour test, because the fault it guards against cannot
// be reached any other way: a hang is the absence of an event, SSR render tests never click
// anything, and the smoke test stops at the login screen.
//
// It was written after an invoice created offline produced no record, no toast and no error
// (2026-09-04). Two separate `await`s on the save path never settled:
//
//   • `await runTransaction(...)` in claimDocNumber — a transaction always reads from the
//     server, so offline it does not reject, it waits. saveInvoice claims the number before
//     it writes anything, so the whole save stopped there.
//   • `await setDoc(...)` in writeAudit — reached later on the same path, so fixing only
//     the first would have moved the hang rather than removed it.
//
// The rule: never `await` a Firestore write directly. Hand it to settleWrite (which reports
// SYNCED / QUEUED / FAILED) or withTimeout (which falls back). Both resolve without the
// network; a bare await does not.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('..', import.meta.url).pathname;

const sourceFiles = (dir) => readdirSync(dir).flatMap(name => {
  const full = join(dir, name);
  if (statSync(full).isDirectory()) return sourceFiles(full);
  if (!/\.jsx?$/.test(name) || /\.test\.jsx?$/.test(name)) return [];
  return [full];
});

// firebase.js re-exports the raw SDK functions; it calls none of them.
const FILES = sourceFiles(SRC).filter(f => !f.endsWith('/firebase.js'));

// Comments have to go first, or this reports itself: the modules that explain the rule all
// quote `await setDoc(...)` in prose. extraction-diff.mjs learned the same thing.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const BARE_AWAIT = /await\s+(setDoc|deleteDoc|runTransaction)\s*\(/g;

describe('no Firestore write is awaited directly', () => {
  it('finds source files to check at all', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  FILES.forEach(file => {
    const rel = file.slice(SRC.length);
    it(rel, () => {
      const offenders = [...stripComments(readFileSync(file, 'utf8')).matchAll(BARE_AWAIT)].map(m => m[1]);
      expect(
        offenders.length ? `${rel} awaits ${offenders.join(', ')} directly — offline that never settles. Use settleWrite or withTimeout.` : 'ok',
      ).toBe('ok');
    });
  });
});

// The two helpers that make the rule keepable have to exist and mean what the rule assumes.
describe('the helpers the rule points at', () => {
  it('settleWrite resolves without the network', async () => {
    const { settleWrite, QUEUED } = await import('./pendingWrite');
    const result = settleWrite(new Promise(() => {}), { timeoutMs: 1 });
    await new Promise(r => setTimeout(r, 5));
    expect(await result).toBe(QUEUED);
  });

  it('withTimeout resolves without the network', async () => {
    const { withTimeout } = await import('./withTimeout');
    const result = withTimeout(new Promise(() => {}), 1, 'fallback');
    await new Promise(r => setTimeout(r, 5));
    expect(await result).toBe('fallback');
  });
});
