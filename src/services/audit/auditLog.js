// Audit log and void — who did what, to which record, and when.
//
// These two belong together. `auditLogs` has been append-only in firestore.rules since the
// security cutover and nothing ever wrote to it, while invoices, payments and expenses were
// removed with `deleteDoc`. A financial record could vanish with no trace of its existence,
// its author, or who removed it. Logging a deletion you cannot recover is only half an
// answer, so records are now voided instead: they stay in Firestore, drop out of every
// balance, and can be read back.
//
// ── Why `voided` and not `status: 'void'` ────────────────────────────────────
// The improvement brief asked for `{status:'void'}`. Invoices already use `status` for the
// document TYPE — Billed, Booked, CreditNote, Estimate — and nineteen places branch on it.
// Overwriting that would void a credit note by erasing the fact that it ever was one, and
// the record could never be read back correctly. Void is therefore its own flag, and the
// same flag is used on payments and expenses so one predicate covers all three.
//
// ── What is deliberately NOT stored ──────────────────────────────────────────
// Not whole documents. An entry holds the fields that changed and a short summary of each
// side, which keeps the log small and readable and means an accidental password field can
// never be copied into a collection three people can read. Anything in REDACTED is dropped
// before it reaches an entry.

export const AUDIT = {
  CREATE: 'create',
  UPDATE: 'update',
  VOID: 'void',
  RESTORE: 'restore',
  DELETE: 'delete',   // hard deletes that remain, e.g. a customer with no financial history
};

// Never log a credential, however it arrives.
const REDACTED = new Set(['password', 'passwordHash', 'pass', 'pin', 'token', 'secret', 'apiKey']);
const MAX_LEN = 120;

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export const summariseValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) {
    // Line items: a bare count hides the edit that matters most. "4 items · Rs.47,350"
    // moves when a rate is changed, which is exactly what someone reads a log to find.
    const looksLikeLines = v.length > 0 && v.every(i => i && typeof i === 'object' && 'quantity' in i);
    if (looksLikeLines) {
      const sum = v.reduce((s, i) => s + num(i.price) * num(i.quantity), 0);
      return `${v.length} item${v.length === 1 ? '' : 's'} · Rs.${Math.round(sum).toLocaleString('en-US')}`;
    }
    return `${v.length} entr${v.length === 1 ? 'y' : 'ies'}`;
  }
  if (typeof v === 'object') return '(details)';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  const s = String(v);
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN)}…` : s;
};

const sameValue = (a, b) => {
  if (a === b) return true;
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return String(a) === String(b);
};

/** Field-level diff, redacted and summarised. Deep-compares so a changed line price counts. */
export const changedFields = (before, after) => {
  const a = before || {};
  const b = after || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(k => !REDACTED.has(k))
    .sort()
    .filter(k => !sameValue(a[k], b[k]))
    .map(k => ({ field: k, from: summariseValue(a[k]), to: summariseValue(b[k]) }));
};

/**
 * One append-only log entry. `at` is injectable so this stays a pure function.
 * The caller supplies the id — Firestore document ids are a side effect, not a decision.
 */
export const auditEntry = ({
  action, collection, recordId, label = '', reason = '',
  changes = [], user = null, at = null,
} = {}) => {
  const when = at || new Date().toISOString();
  return {
    action: action || AUDIT.UPDATE,
    collection: collection || '',
    recordId: String(recordId ?? ''),
    label: String(label || ''),
    reason: String(reason || ''),
    changes,
    userId: user?.id != null ? String(user.id) : '',
    userName: user?.name || 'Unknown',
    at: when,
    // Written so the log can be date-bounded later without reading it all — the collection
    // only grows, and it is the one place a `where` clause is certain to be wanted.
    dateKey: when.slice(0, 10),
  };
};

/** Human sentence for the log viewer. */
export const describeEntry = (e) => {
  if (!e) return '';
  const who = e.userName || 'Unknown';
  const what = `${e.collection || 'record'} ${e.label || e.recordId || ''}`.trim();
  const verb = {
    [AUDIT.CREATE]: 'created',
    [AUDIT.UPDATE]: 'edited',
    [AUDIT.VOID]: 'voided',
    [AUDIT.RESTORE]: 'restored',
    [AUDIT.DELETE]: 'deleted',
  }[e.action] || 'changed';
  return `${who} ${verb} ${what}${e.reason ? ` — ${e.reason}` : ''}`;
};

// ── Void ────────────────────────────────────────────────────────────────────

export const isVoided = (record) => !!(record && record.voided);
export const notVoided = (record) => !isVoided(record);

/** Fields to merge onto a record being voided. Reason is required by the caller, not here. */
export const voidPatch = ({ user = null, reason = '', at = null } = {}) => ({
  voided: true,
  voidedAt: at || new Date().toISOString(),
  voidedBy: user?.name || 'Unknown',
  voidedById: user?.id != null ? String(user.id) : '',
  voidReason: String(reason || ''),
});

/** Restoring keeps the void history rather than erasing it — the log must stay answerable. */
export const restorePatch = ({ user = null, at = null } = {}) => ({
  voided: false,
  restoredAt: at || new Date().toISOString(),
  restoredBy: user?.name || 'Unknown',
});
