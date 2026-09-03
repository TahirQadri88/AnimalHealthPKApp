import { describe, it, expect } from 'vitest';
import {
  inspectBackup, inspectBackupText, planWrites, backupAgeDays,
  RESTORABLE_COLLECTIONS, PROTECTED_COLLECTIONS,
} from './restore';

const good = (over = {}) => ({
  exportedAt: '2026-08-30T10:00:00.000Z',
  collections: {
    customers: [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Ghousia Farms' }],
    invoices: [{ id: 'INV-1', total: 75000 }],
    ...over,
  },
});

describe('inspectBackup — refusing what is not a backup', () => {
  it('refuses anything that is not an object', () => {
    [null, undefined, 42, 'x', [1, 2, 3]].forEach(v => {
      const r = inspectBackup(v);
      expect(r.ok).toBe(false);
      expect(r.errors[0]).toMatch(/not a backup file/);
    });
  });

  // This is the one that mattered: `{}` used to parse, write nothing, and report success.
  it('refuses an object with no collections section', () => {
    const r = inspectBackup({});
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/no "collections" section/);
  });

  it('refuses a backup that holds no records', () => {
    const r = inspectBackup({ collections: { customers: [] } });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/no records/);
  });

  it('reports invalid JSON as an error rather than throwing', () => {
    const r = inspectBackupText('{ not json');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/not valid JSON/);
  });

  it('reads a real file end to end', () => {
    const r = inspectBackupText(JSON.stringify(good()));
    expect(r.ok).toBe(true);
    expect(r.totalRecords).toBe(3);
  });
});

describe('inspectBackup — what it will and will not write to', () => {
  it('accepts every collection a backup actually contains', () => {
    const all = Object.fromEntries(RESTORABLE_COLLECTIONS.map(c => [c, [{ id: 1 }]]));
    const r = inspectBackup({ collections: all });
    expect(r.ok).toBe(true);
    expect(r.collections).toHaveLength(RESTORABLE_COLLECTIONS.length);
    expect(r.refused).toEqual([]);
  });

  it('refuses the collections a restore must never touch, and says why', () => {
    const r = inspectBackup(good({
      auditLogs: [{ id: 'a1' }], loginIndex: [{ id: 'x' }],
      userRoles: [{ id: 'u1' }], counters: [{ id: 'INV' }],
    }));
    expect(r.ok).toBe(true);
    expect(r.refused.map(x => x.name).sort()).toEqual(['auditLogs', 'counters', 'loginIndex', 'userRoles']);
    expect(r.refused.find(x => x.name === 'auditLogs').reason).toMatch(/append-only/);
    expect(r.refused.find(x => x.name === 'counters').reason).toMatch(/reissue/);
    // And none of them reach the write plan.
    expect(planWrites(r).map(w => w.collection)).not.toContain('auditLogs');
  });

  it('names every protected collection with a reason a person can read', () => {
    Object.values(PROTECTED_COLLECTIONS).forEach(reason => {
      expect(reason.length).toBeGreaterThan(20);
    });
  });

  it('refuses a collection this app does not store', () => {
    const r = inspectBackup(good({ suppliers: [{ id: 1 }] }));
    expect(r.refused[0]).toMatchObject({ name: 'suppliers', reason: 'not a collection this app stores' });
  });

  it('refuses a collection whose value is not a list', () => {
    const r = inspectBackup(good({ products: { id: 1 } }));
    expect(r.refused.find(x => x.name === 'products').reason).toMatch(/should be a list/);
  });

  it('fails outright when everything in the file is refused', () => {
    const r = inspectBackup({ collections: { auditLogs: [{ id: 1 }] } });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Nothing in this file can be restored/);
  });
});

describe('inspectBackup — records it will not write', () => {
  // These used to be written to a document literally named "undefined".
  it('skips a record with no id, and says how many', () => {
    const r = inspectBackup(good({
      products: [{ id: 5, name: 'Antox 9' }, { name: 'No id' }, { id: '', name: 'Blank id' }, { id: null }],
    }));
    expect(r.collections.find(c => c.name === 'products').count).toBe(1);
    expect(r.skippedRecords).toBe(3);
    expect(r.warnings.some(w => /products: 3 records skipped for having no id/.test(w))).toBe(true);
    expect(planWrites(r).every(w => w.id && w.id !== 'undefined')).toBe(true);
  });

  it('skips a record that is not an object at all', () => {
    const r = inspectBackup(good({ products: [{ id: 1 }, 'nonsense', null] }));
    expect(r.skippedRecords).toBe(2);
  });

  it('warns about duplicate ids rather than silently letting the last one win', () => {
    const r = inspectBackup(good({ products: [{ id: 1, v: 'a' }, { id: 1, v: 'b' }] }));
    expect(r.warnings.some(w => /1 duplicate id/.test(w))).toBe(true);
  });

  it('drops a collection entirely when every record in it was skipped', () => {
    const r = inspectBackup(good({ products: [{ name: 'no id' }] }));
    expect(r.collections.map(c => c.name)).not.toContain('products');
    expect(r.ok).toBe(true);
  });
});

describe('inspectBackup — what it tells the person about to press the button', () => {
  it('reports when the file was exported', () => {
    expect(inspectBackup(good()).exportedAt).toBe('2026-08-30T10:00:00.000Z');
  });

  it('warns when the file does not say', () => {
    const r = inspectBackup({ collections: good().collections });
    expect(r.warnings.some(w => /does not say when it was exported/.test(w))).toBe(true);
  });

  it('counts the records per collection, biggest first', () => {
    expect(inspectBackup(good()).collections.map(c => [c.name, c.count]))
      .toEqual([['customers', 2], ['invoices', 1]]);
  });

  // The other side of the three-records-in-step rule in docs/SECURITY_CUTOVER.md.
  it('warns that restoring accounts does not restore the ability to sign in', () => {
    const r = inspectBackup(good({ app_users: [{ id: 1, name: 'Ghousia' }] }));
    expect(r.warnings.some(w => /will not be able to sign in/.test(w))).toBe(true);
  });

  it('says nothing about sign-in when no accounts are being restored', () => {
    expect(inspectBackup(good()).warnings.some(w => /sign in/.test(w))).toBe(false);
  });
});

describe('planWrites', () => {
  it('is empty for anything not approved', () => {
    expect(planWrites(inspectBackup({}))).toEqual([]);
    expect(planWrites(null)).toEqual([]);
  });

  it('carries the collection, a string id and the record itself', () => {
    expect(planWrites(inspectBackup(good()))).toContainEqual(
      { collection: 'invoices', id: 'INV-1', data: { id: 'INV-1', total: 75000 } });
  });

  // Masters before the records that reference them, so a half-finished restore leaves the
  // more useful half behind.
  it('writes in a stable order, masters before transactions', () => {
    const r = inspectBackup(good({ products: [{ id: 9 }], payments: [{ id: 'REC-1' }] }));
    const order = planWrites(r).map(w => w.collection);
    expect(order.indexOf('products')).toBeLessThan(order.indexOf('invoices'));
    expect(order.indexOf('customers')).toBeLessThan(order.indexOf('invoices'));
    expect(order.indexOf('invoices')).toBeLessThan(order.indexOf('payments'));
  });

  it('plans exactly the number of records reported', () => {
    const r = inspectBackup(good());
    expect(planWrites(r)).toHaveLength(r.totalRecords);
  });
});

describe('backupAgeDays', () => {
  it('measures the age of the file in whole days', () => {
    expect(backupAgeDays('2026-08-30T10:00:00.000Z', new Date('2026-09-03T10:00:00.000Z'))).toBe(4);
  });

  it('is null when the file does not say, or says something unreadable', () => {
    expect(backupAgeDays(null)).toBeNull();
    expect(backupAgeDays('not a date')).toBeNull();
  });

  it('never goes negative for a file stamped in the future', () => {
    expect(backupAgeDays('2027-01-01T00:00:00.000Z', new Date('2026-09-03T00:00:00.000Z'))).toBe(0);
  });
});
