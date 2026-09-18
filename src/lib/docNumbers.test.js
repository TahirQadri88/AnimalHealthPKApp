import { describe, it, expect } from 'vitest';
import { getNextSeqNum, needsRenumber, seriesOf, prefixForStatus } from './docNumbers';

// claimDocNumber is not covered here: it is a Firestore transaction, and the behaviour that
// matters about it — that the counter only ever moves upward — is enforced by the rule in
// firestore.rules and tested by npm run test:rules.

const inv = (id) => ({ id });

describe('getNextSeqNum', () => {
  it('continues from the highest number in use', () => {
    expect(getNextSeqNum([inv('INV-0001'), inv('INV-0007'), inv('INV-0003')], 'INV')).toBe(8);
  });

  it('starts at 1 when there is nothing yet', () => {
    expect(getNextSeqNum([], 'INV')).toBe(1);
  });

  it('counts only its own prefix', () => {
    const mixed = [inv('INV-0009'), inv('EST-0031'), inv('CN-0004'), inv('REC-0114')];
    expect(getNextSeqNum(mixed, 'INV')).toBe(10);
    expect(getNextSeqNum(mixed, 'EST')).toBe(32);
    expect(getNextSeqNum(mixed, 'CN')).toBe(5);
    expect(getNextSeqNum(mixed, 'REC')).toBe(115);
    expect(getNextSeqNum(mixed, 'ORD')).toBe(1);
  });

  // Records from before the INV-0001 scheme carry a timestamp as their id. Letting one of
  // those into the max would jump numbering to 1,756,713,600,001 and never come back.
  it('ignores legacy timestamp ids', () => {
    expect(getNextSeqNum([inv('INV-1756713600000'), inv('INV-0012')], 'INV')).toBe(13);
  });

  it('ignores anything that is not a number after the prefix', () => {
    expect(getNextSeqNum([inv('INV-DRAFT'), inv('INV-0002')], 'INV')).toBe(3);
    expect(getNextSeqNum([inv(undefined), inv('INV-0002')], 'INV')).toBe(3);
    expect(getNextSeqNum([inv('INV0002')], 'INV')).toBe(1);   // no separator, not ours
  });

  // The caller must pass the RAW list. This documents what happens if it does not: a
  // voided invoice hidden from the scan hands its number to the next document.
  it('reuses a number if the record holding it is not in the list', () => {
    const all = [inv('INV-0008'), inv('INV-0009')];
    expect(getNextSeqNum(all, 'INV')).toBe(10);
    const withoutTheVoidedOne = all.filter(o => o.id !== 'INV-0009');
    expect(getNextSeqNum(withoutTheVoidedOne, 'INV')).toBe(9);   // INV-0009 issued twice
  });
});

// ── Changing series ─────────────────────────────────────────────────────────
//
// Reported 2026-09-18: an estimate converted to an invoice printed the word INVOICE over
// "REF # EST-0037". saveInvoice claimed a number only for a brand-new document, so
// converting changed the status and kept the number.
describe('needsRenumber', () => {
  it('renumbers an estimate that becomes an invoice — the reported case', () => {
    expect(needsRenumber('EST-0037', 'Billed')).toBe(true);
  });

  it('renumbers between every pair of series', () => {
    expect(needsRenumber('EST-0037', 'Booked')).toBe(true);
    expect(needsRenumber('ORD-0004', 'Billed')).toBe(true);
    expect(needsRenumber('INV-8561', 'Estimate')).toBe(true);
  });

  it('leaves a document alone when it is saved back into its own series', () => {
    expect(needsRenumber('EST-0037', 'Estimate')).toBe(false);
    expect(needsRenumber('INV-8561', 'Billed')).toBe(false);
    expect(needsRenumber('ORD-0004', 'Booked')).toBe(false);
  });

  // Legacy ids predate the prefixes and are printed on paper somewhere. Renumbering one
  // would be inventing a change nobody asked for.
  it('never renumbers an id whose series it does not recognise', () => {
    ['1693847263000', 'A-123', 'INV8561', '', null, undefined].forEach(id => {
      expect(needsRenumber(id, 'Billed')).toBe(false);
      expect(needsRenumber(id, 'Estimate')).toBe(false);
    });
  });

  it('treats an unknown status as the invoice series, which is what it saves as', () => {
    expect(prefixForStatus('Something Else')).toBe('INV');
    expect(needsRenumber('EST-0037', 'Something Else')).toBe(true);
    expect(needsRenumber('INV-8561', 'Something Else')).toBe(false);
  });
});

describe('seriesOf', () => {
  it('names the series an id belongs to', () => {
    expect(seriesOf('EST-0037')).toBe('EST');
    expect(seriesOf('ORD-0004')).toBe('ORD');
    expect(seriesOf('INV-8561')).toBe('INV');
  });

  it('is null for anything it does not recognise', () => {
    expect(seriesOf('CN-0009')).toBeNull();   // credit notes are not part of this flow
    expect(seriesOf('1693847263000')).toBeNull();
    expect(seriesOf(undefined)).toBeNull();
  });
});
