import { describe, it, expect } from 'vitest';
import {
  AUDIT, auditEntry, changedFields, summariseValue, describeEntry,
  isVoided, notVoided, voidPatch, restorePatch,
} from './auditLog';

const USER = { id: 7, name: 'Owais' };
const AT = '2026-09-01T10:30:00.000Z';

describe('changedFields', () => {
  it('reports only what actually moved', () => {
    const c = changedFields({ total: 1000, date: '2026-08-01' }, { total: 1200, date: '2026-08-01' });
    expect(c).toEqual([{ field: 'total', from: '1000', to: '1200' }]);
  });

  it('treats null, undefined and empty string as the same absence', () => {
    expect(changedFields({ note: '' }, { note: null })).toEqual([]);
    expect(changedFields({}, { note: undefined })).toEqual([]);
  });

  it('sees a new field and a removed one', () => {
    expect(changedFields({}, { biltyNumber: 'BLT-9' })[0]).toEqual({ field: 'biltyNumber', from: '—', to: 'BLT-9' });
    expect(changedFields({ biltyNumber: 'BLT-9' }, {})[0]).toEqual({ field: 'biltyNumber', from: 'BLT-9', to: '—' });
  });

  // The whole point of an audit log on an invoice: someone quietly changed a rate.
  it('catches a line price edit even though the item count is unchanged', () => {
    const before = { items: [{ name: 'Antox', quantity: 10, price: 7500 }] };
    const after = { items: [{ name: 'Antox', quantity: 10, price: 6000 }] };
    const c = changedFields(before, after);
    expect(c).toHaveLength(1);
    expect(c[0].from).toBe('1 item · Rs.75,000');
    expect(c[0].to).toBe('1 item · Rs.60,000');
  });

  it('never copies a credential into the log', () => {
    const c = changedFields({ password: 'old-secret', name: 'A' }, { password: 'new-secret', name: 'B' });
    expect(c.map(x => x.field)).toEqual(['name']);
    expect(JSON.stringify(c)).not.toContain('secret');
  });

  it('survives a missing side', () => {
    expect(changedFields(undefined, undefined)).toEqual([]);
    expect(changedFields(null, { a: 1 })).toEqual([{ field: 'a', from: '—', to: '1' }]);
  });
});

describe('summariseValue', () => {
  it('keeps entries short enough to read in a list', () => {
    expect(summariseValue('x'.repeat(500))).toHaveLength(121);   // 120 + ellipsis
    expect(summariseValue({ a: 1 })).toBe('(details)');
    expect(summariseValue([{ id: 1 }, { id: 2 }])).toBe('2 entries');
    expect(summariseValue(true)).toBe('yes');
    expect(summariseValue(0)).toBe('0');
  });
});

describe('auditEntry', () => {
  it('records who, what and when', () => {
    const e = auditEntry({ action: AUDIT.VOID, collection: 'invoices', recordId: 'INV-8457',
      label: 'Abdul Qadir Shan Cattle', reason: 'Duplicate', user: USER, at: AT });
    expect(e).toMatchObject({
      action: 'void', collection: 'invoices', recordId: 'INV-8457',
      reason: 'Duplicate', userId: '7', userName: 'Owais', at: AT, dateKey: '2026-09-01',
    });
  });

  it('names an unknown actor rather than leaving the field blank', () => {
    expect(auditEntry({ at: AT }).userName).toBe('Unknown');
  });

  it('defaults to an update, so a miswired call still records something', () => {
    expect(auditEntry({ collection: 'payments', recordId: 1, at: AT }).action).toBe('update');
  });

  it('stringifies the record id — numeric payment ids must match invoice ids in the log', () => {
    expect(auditEntry({ recordId: 1756713600000, at: AT }).recordId).toBe('1756713600000');
  });
});

describe('describeEntry', () => {
  it('reads as a sentence', () => {
    expect(describeEntry(auditEntry({ action: AUDIT.VOID, collection: 'invoices', recordId: 'INV-1',
      label: 'INV-1', reason: 'Duplicate', user: USER, at: AT })))
      .toBe('Owais voided invoices INV-1 — Duplicate');
  });
  it('is empty rather than throwing on nothing', () => {
    expect(describeEntry(null)).toBe('');
  });
});

describe('void', () => {
  it('marks a record without touching its type', () => {
    const invoice = { id: 'CN-1', status: 'CreditNote', total: 900 };
    const voided = { ...invoice, ...voidPatch({ user: USER, reason: 'Entered twice', at: AT }) };
    expect(voided.status).toBe('CreditNote');   // a voided credit note is still a credit note
    expect(voided.voided).toBe(true);
    expect(voided.voidedBy).toBe('Owais');
    expect(voided.voidReason).toBe('Entered twice');
    expect(voided.voidedAt).toBe(AT);
  });

  it('reads back with one predicate across all three collections', () => {
    const rows = [{ id: 1 }, { id: 2, voided: true }, { id: 3, voided: false }];
    expect(rows.filter(notVoided).map(r => r.id)).toEqual([1, 3]);
    expect(rows.filter(isVoided).map(r => r.id)).toEqual([2]);
  });

  it('treats a record with no flag as live — every existing record predates this', () => {
    expect(isVoided({ id: 'INV-1' })).toBe(false);
    expect(notVoided({ id: 'INV-1' })).toBe(true);
  });

  it('restoring clears the flag but keeps the history', () => {
    const voided = { id: 'INV-1', ...voidPatch({ user: USER, reason: 'Mistake', at: AT }) };
    const back = { ...voided, ...restorePatch({ user: USER, at: AT }) };
    expect(back.voided).toBe(false);
    expect(back.voidReason).toBe('Mistake');     // why it was voided is still answerable
    expect(back.restoredBy).toBe('Owais');
  });
});
