// "If the internet dies right now, am I covered?"
//
// Everything the offline work built is invisible until it fails. The service worker either
// cached the app or it did not; the browser either granted durable storage or refused; the
// device either holds reserved invoice numbers or will refuse to bill. None of that is
// discoverable, and every one of them is only noticed at the worst possible moment.
//
// This turns the four into an answer. It is diagnostic rather than functional — but the
// A3 storage request is a REQUEST, which browsers refuse on their own criteria, and finding
// that out during an outage is finding out too late.
//
// Pure, so it can be tested: the caller gathers the facts, this judges them.

// A check that fails means something will not work; a warning means it might stop working.
export const CRITICAL = 'critical';
export const WARNING = 'warning';
export const INFO = 'info';

export const formatBytes = (n) => {
  const bytes = Number(n);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const assessReadiness = ({
  serviceWorker = null,
  persistentStorage = null,
  estimate = null,
  collections = {},
  blocks = {},
  syncState = 'live',
  pending = 0,
  lastSyncedAt = null,
} = {}) => {
  const checks = [];

  // 1. Can the app itself open with no network?
  checks.push({
    key: 'shell',
    label: 'App saved on this device',
    ok: serviceWorker === true,
    severity: CRITICAL,
    detail: serviceWorker === true
      ? 'The app will open with no connection.'
      : serviceWorker === false
        ? 'Not registered — the app will not open offline. Reload once while connected.'
        : 'Could not be checked in this browser.',
  });

  // 2. Is there any data to work from?
  const totals = Object.entries(collections).map(([name, n]) => ({ name, count: Number(n) || 0 }));
  const totalDocs = totals.reduce((s, c) => s + c.count, 0);
  const empty = totals.filter(c => c.count === 0).map(c => c.name);
  checks.push({
    key: 'data',
    label: 'Business data on this device',
    ok: totalDocs > 0,
    severity: CRITICAL,
    detail: totalDocs > 0
      ? `${plural(totalDocs, 'record', 'records')} cached${empty.length ? ` · nothing yet for ${empty.join(', ')}` : ''}.`
      : 'Nothing cached yet. Stay connected for a moment so the app can save a copy.',
  });

  // 3. Will the browser keep it? A refusal is not an error, but it is worth knowing.
  checks.push({
    key: 'storage',
    label: 'Storage kept when space runs low',
    ok: persistentStorage === true,
    severity: WARNING,
    detail: persistentStorage === true
      ? `Granted.${estimate ? ` Using ${formatBytes(estimate.usage)} of ${formatBytes(estimate.quota)}.` : ''}`
      : persistentStorage === false
        ? 'The browser refused. Your cached data could be cleared if the device runs low on space — installing the app to the home screen usually earns this.'
        : 'Could not be checked in this browser.',
  });

  // 4. The one that actually stops work: numbering refuses rather than risk a duplicate.
  const reserved = Object.entries(blocks).map(([prefix, b]) => ({
    prefix,
    left: b && Number.isInteger(b.end) && Number.isInteger(b.next) ? Math.max(0, b.end - b.next) : 0,
  }));
  const invoicesLeft = reserved.find(r => r.prefix === 'INV')?.left ?? 0;
  const anyReserved = reserved.some(r => r.left > 0);
  checks.push({
    key: 'numbers',
    label: 'Document numbers reserved',
    ok: invoicesLeft > 0,
    severity: CRITICAL,
    detail: anyReserved
      ? `${plural(invoicesLeft, 'invoice', 'invoices')} can still be billed offline`
        + ` · ${reserved.filter(r => r.prefix !== 'INV').map(r => `${r.prefix} ${r.left}`).join(', ')}.`
      : 'None reserved. Billing offline will be refused rather than risk two devices issuing the same number — connect once to reserve some.',
  });

  // 5. Anything still on its way out.
  checks.push({
    key: 'pending',
    label: 'Changes waiting to sync',
    ok: true,
    severity: INFO,
    detail: pending > 0
      ? `${plural(pending, 'change', 'changes')} saved here and not yet on the server. They send themselves; do not clear the browser's data until they have.`
      : (syncState === 'live' ? 'Nothing waiting — everything is on the server.' : 'Nothing waiting.'),
  });

  const failed = checks.filter(c => !c.ok && c.severity === CRITICAL);
  const warned = checks.filter(c => !c.ok && c.severity === WARNING);

  return {
    checks,
    failed: failed.length,
    warned: warned.length,
    level: failed.length > 0 ? 'not-ready' : warned.length > 0 ? 'partial' : 'ready',
    summary: failed.length > 0
      ? 'Not ready to work offline'
      : warned.length > 0
        ? 'Ready, with one thing worth fixing'
        : 'Ready to work offline',
    totalDocs,
    invoicesLeft,
    lastSyncedAt,
  };
};

