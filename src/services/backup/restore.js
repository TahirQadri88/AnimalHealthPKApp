// Reading a backup file, before anything is written.
//
// The restore button did this:
//
//   const backup = JSON.parse(await file.text()); let count = 0;
//   for (const [col, docs] of Object.entries(backup.collections || {}))
//     for (const d of (docs || [])) { await saveToFirebase(col, d.id, d); count++; }
//   showToast(`Restore complete! ${count} records written.`);
//
// Four things wrong with that, and every one of them ends in a false success message:
//
//   • Any JSON at all is accepted. `{}` parses, `collections || {}` is empty, the loop does
//     nothing, and the user is told "Restore complete! 0 records written."
//   • `d.id` is never checked. A record without one writes to a document literally named
//     "undefined", quietly, once per malformed record.
//   • Any key under `collections` is written to. A file naming `auditLogs`, `loginIndex`,
//     `userRoles` or `counters` would be aimed straight at the append-only log, the sign-in
//     index, the permission mirror the rules read, or the numbering counters.
//   • `saveToFirebase` catches its own errors and returns nothing, so `count` counts
//     ATTEMPTS. A restore in which every single write failed still reported every record
//     written. That is the worst possible failure for a safety net: it says the data is
//     back when it is not.
//
// This module is the "before". It is pure, so it can be tested; the caller writes nothing
// until it says ok, and shows the user what is in the file first.

// Exactly what buildBackupObj puts in a backup, and nothing else.
export const RESTORABLE_COLLECTIONS = [
  'app_users', 'appSettings', 'companies', 'products', 'customers', 'invoices',
  'expenses', 'expenseCategories', 'payments', 'riders', 'transportCompanies',
  'cities', 'areas', 'customerTypes', 'vehicleTypes',
];

// Named separately so the refusal can say WHY rather than "unknown collection".
export const PROTECTED_COLLECTIONS = {
  auditLogs: 'the audit log is append-only — restoring over it would rewrite history',
  loginIndex: 'the sign-in index is managed by user administration',
  userRoles: 'the permission mirror the security rules read is managed by user administration',
  counters: 'document numbering counters only move forward; restoring one could reissue an invoice number',
  backups: 'backup snapshots, not live data',
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Read a parsed backup file and say what would happen, without doing any of it.
 * Never throws.
 */
export const inspectBackup = (parsed) => {
  const result = {
    ok: false, exportedAt: null,
    collections: [], refused: [], errors: [], warnings: [],
    totalRecords: 0, skippedRecords: 0,
  };

  if (!isPlainObject(parsed)) {
    result.errors.push('That is not a backup file — the top level should be an object.');
    return result;
  }
  if (!isPlainObject(parsed.collections)) {
    result.errors.push('That is not a backup file — it has no "collections" section.');
    return result;
  }

  result.exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  if (!result.exportedAt) {
    result.warnings.push('The file does not say when it was exported, so its age cannot be checked.');
  }

  Object.entries(parsed.collections).forEach(([name, docs]) => {
    if (PROTECTED_COLLECTIONS[name]) {
      result.refused.push({ name, count: Array.isArray(docs) ? docs.length : 0, reason: PROTECTED_COLLECTIONS[name] });
      return;
    }
    if (!RESTORABLE_COLLECTIONS.includes(name)) {
      result.refused.push({ name, count: Array.isArray(docs) ? docs.length : 0, reason: 'not a collection this app stores' });
      return;
    }
    if (!Array.isArray(docs)) {
      result.refused.push({ name, count: 0, reason: 'should be a list of records and is not' });
      return;
    }

    const records = [];
    let skipped = 0;
    const seen = new Set();
    let duplicates = 0;
    docs.forEach(d => {
      // A record with no usable id would be written to a document called "undefined".
      if (!isPlainObject(d) || d.id === undefined || d.id === null || String(d.id).trim() === '') {
        skipped += 1;
        return;
      }
      const id = String(d.id);
      if (seen.has(id)) duplicates += 1;
      seen.add(id);
      records.push(d);
    });

    if (skipped > 0) {
      result.warnings.push(`${name}: ${skipped} record${skipped === 1 ? '' : 's'} skipped for having no id.`);
    }
    if (duplicates > 0) {
      result.warnings.push(`${name}: ${duplicates} duplicate id${duplicates === 1 ? '' : 's'} — the last one in the file wins.`);
    }
    result.skippedRecords += skipped;
    if (records.length > 0) {
      result.collections.push({ name, count: records.length, records });
      result.totalRecords += records.length;
    }
  });

  // Restoring accounts without the two records that make sign-in work is the
  // three-records-in-step rule in docs/SECURITY_CUTOVER.md, seen from the other side.
  if (result.collections.some(c => c.name === 'app_users')) {
    result.warnings.push(
      'Restoring app_users does not restore the sign-in index or the permission mirror, '
      + 'which are not in a backup. An account that was deleted since this backup will '
      + 'reappear in the list but will not be able to sign in until an admin re-saves it.');
  }

  if (result.totalRecords === 0) {
    result.errors.push(
      result.refused.length > 0
        ? 'Nothing in this file can be restored.'
        : 'This backup contains no records.');
    return result;
  }

  result.ok = true;
  result.collections.sort((a, b) => b.count - a.count);
  return result;
};

/** Parse text and inspect it. Returns the same shape; a parse error is just an error. */
export const inspectBackupText = (text) => {
  try {
    return inspectBackup(JSON.parse(text));
  } catch {
    return {
      ok: false, exportedAt: null, collections: [], refused: [],
      errors: ['That file is not valid JSON.'], warnings: [],
      totalRecords: 0, skippedRecords: 0,
    };
  }
};

/** The flat list of writes an approved inspection implies, in a stable order. */
export const planWrites = (inspection) => {
  if (!inspection?.ok) return [];
  const order = RESTORABLE_COLLECTIONS;
  return [...inspection.collections]
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    .flatMap(c => c.records.map(d => ({ collection: c.name, id: String(d.id), data: d })));
};

/** How old the file is, in days, or null if it does not say. */
export const backupAgeDays = (exportedAt, now = new Date()) => {
  if (!exportedAt) return null;
  const then = new Date(exportedAt);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now - then) / 86400000));
};
