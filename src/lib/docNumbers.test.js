import { describe, it, expect } from 'vitest';
import { getNextSeqNum } from './docNumbers';

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
