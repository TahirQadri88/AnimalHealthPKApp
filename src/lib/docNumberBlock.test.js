import { describe, it, expect } from 'vitest';
import {
  readBlock, writeBlock, clearBlock, blockFrom, remaining, needsRefill,
  takeFromBlock, formatDocId, mergeBlocks, BLOCK_SIZE,
} from './docNumberBlock';

// A stand-in for localStorage, so the tests do not depend on the environment having one.
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
};

describe('reading and writing a block', () => {
  it('round-trips', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477, 10), s);
    expect(readBlock('INV', s)).toEqual({ next: 8477, end: 8487 });
  });

  it('keeps each prefix apart', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477), s);
    writeBlock('REC', blockFrom(210), s);
    expect(readBlock('INV', s).next).toBe(8477);
    expect(readBlock('REC', s).next).toBe(210);
  });

  it('is null when nothing has been reserved', () => {
    expect(readBlock('INV', fakeStorage())).toBeNull();
  });

  // A half-understood block is more dangerous than none: it could hand out a number that
  // was never reserved. Discard it and pay for one more claim.
  it('discards anything it cannot read as two sane integers', () => {
    [
      'not json', '{}', '{"next":"x","end":10}', '{"next":10}',
      '{"next":10,"end":5}', '{"next":-1,"end":10}', '{"next":1.5,"end":10}', 'null',
    ].forEach(raw => {
      expect(readBlock('INV', fakeStorage({ 'docBlock:INV': raw }))).toBeNull();
    });
  });

  it('survives a storage that throws — a private window, or a full quota', () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(readBlock('INV', broken)).toBeNull();
    expect(writeBlock('INV', blockFrom(1), broken)).toBe(false);
    expect(() => clearBlock('INV', broken)).not.toThrow();
  });

  it('clears', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477), s);
    clearBlock('INV', s);
    expect(readBlock('INV', s)).toBeNull();
  });
});

describe('spending a block', () => {
  it('hands out the reserved numbers in order', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477, 3), s);
    expect([takeFromBlock('INV', s), takeFromBlock('INV', s), takeFromBlock('INV', s)])
      .toEqual([8477, 8478, 8479]);
  });

  // The whole point: once the reserved range is spent it must refuse, not guess. A guess
  // offline is how two customers end up holding the same invoice number.
  it('returns null once the block is spent, rather than carrying on', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477, 1), s);
    expect(takeFromBlock('INV', s)).toBe(8477);
    expect(takeFromBlock('INV', s)).toBeNull();
    expect(takeFromBlock('INV', s)).toBeNull();
  });

  it('returns null when nothing was ever reserved', () => {
    expect(takeFromBlock('INV', fakeStorage())).toBeNull();
  });

  it('persists the spend immediately, so a reload does not reissue it', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477, 5), s);
    takeFromBlock('INV', s);
    // Same underlying data, as a fresh read would see after a page load.
    expect(readBlock('INV', s)).toEqual({ next: 8478, end: 8482 });
  });

  it('does not spend another prefix\'s numbers', () => {
    const s = fakeStorage();
    writeBlock('INV', blockFrom(8477, 2), s);
    expect(takeFromBlock('REC', s)).toBeNull();
    expect(readBlock('INV', s).next).toBe(8477);
  });
});

// This is the property the whole design exists for.
describe('two devices offline cannot collide', () => {
  it('never issues a number from another device\'s range', () => {
    const deviceA = fakeStorage();
    const deviceB = fakeStorage();
    // One transaction each, while online: A got 8477–8486, B got 8487–8496.
    writeBlock('INV', blockFrom(8477, 10), deviceA);
    writeBlock('INV', blockFrom(8487, 10), deviceB);

    const issued = [];
    for (let i = 0; i < 10; i++) {
      issued.push(takeFromBlock('INV', deviceA));
      issued.push(takeFromBlock('INV', deviceB));
    }
    expect(issued).toHaveLength(20);
    expect(new Set(issued).size).toBe(20);      // every number distinct
    expect(issued.every(n => n !== null)).toBe(true);
    // And both refuse rather than overrun into the other's range.
    expect(takeFromBlock('INV', deviceA)).toBeNull();
    expect(takeFromBlock('INV', deviceB)).toBeNull();
  });
});

describe('knowing when to refill', () => {
  it('counts what is left', () => {
    expect(remaining(blockFrom(8477, 10))).toBe(10);
    expect(remaining({ next: 8485, end: 8487 })).toBe(2);
    expect(remaining({ next: 8487, end: 8487 })).toBe(0);
  });

  it('is zero, not negative, for a nonsense block', () => {
    expect(remaining(null)).toBe(0);
    expect(remaining({ next: 10, end: 5 })).toBe(0);
    expect(remaining({})).toBe(0);
  });

  // Refill before it runs out, so an outage that starts mid-block is survivable.
  it('asks for a refill below half', () => {
    expect(needsRefill(blockFrom(1, 10))).toBe(false);
    expect(needsRefill({ next: 6, end: 11 })).toBe(false);   // 5 of 10 left
    expect(needsRefill({ next: 7, end: 11 })).toBe(true);    // 4 of 10 left
    expect(needsRefill(null)).toBe(true);
  });
});

describe('formatDocId', () => {
  it('pads the way every document in this app is numbered', () => {
    expect(formatDocId('INV', 8477)).toBe('INV-8477');
    expect(formatDocId('CN', 9)).toBe('CN-0009');
    expect(formatDocId('REC', 12)).toBe('REC-0012');
  });

  it('does not truncate a number that has outgrown the padding', () => {
    expect(formatDocId('INV', 123456)).toBe('INV-123456');
  });
});

describe('the default block size', () => {
  it('is small, because an unspent block is a gap in the sequence', () => {
    expect(BLOCK_SIZE).toBe(10);
  });
});

// These run under node, which has no localStorage at all — the same shape as an old browser
// or a page not served over HTTPS. Reaching for it must degrade, never throw: this is called
// on the billing path.
describe('an environment with no localStorage', () => {
  it('reads nothing, writes nothing, and throws nothing', () => {
    expect(readBlock('INV')).toBeNull();
    expect(writeBlock('INV', blockFrom(1))).toBe(false);
    expect(takeFromBlock('INV')).toBeNull();
    expect(() => clearBlock('INV')).not.toThrow();
  });
});

// Refilling must not leave a hole. An online business tops up every few invoices, and
// replacing the block instead of extending it would skip up to half a block each time.
describe('mergeBlocks', () => {
  it('joins a range that starts exactly where the last one ended', () => {
    expect(mergeBlocks({ next: 8483, end: 8487 }, { next: 8487, end: 8497 }))
      .toEqual({ next: 8483, end: 8497 });
  });

  it('leaves no gap at all in that normal case', () => {
    const s = fakeStorage();
    writeBlock('INV', mergeBlocks({ next: 8483, end: 8487 }, { next: 8487, end: 8497 }), s);
    const issued = [];
    for (let i = 0; i < 14; i++) issued.push(takeFromBlock('INV', s));
    expect(issued[0]).toBe(8483);
    expect(issued[13]).toBe(8496);
    // Consecutive, every one of them.
    expect(issued.every((n, i) => i === 0 || n === issued[i - 1] + 1)).toBe(true);
  });

  it('takes the new range when another device claimed in between', () => {
    // We held 8483–8486; someone else took 8487–8496, so ours cannot be extended.
    expect(mergeBlocks({ next: 8483, end: 8487 }, { next: 8497, end: 8507 }))
      .toEqual({ next: 8497, end: 8507 });
  });

  it('takes the new range when the old one is spent', () => {
    expect(mergeBlocks({ next: 8487, end: 8487 }, { next: 8487, end: 8497 }))
      .toEqual({ next: 8487, end: 8497 });
  });

  it('takes the new range when there was nothing held', () => {
    expect(mergeBlocks(null, { next: 1, end: 11 })).toEqual({ next: 1, end: 11 });
  });

  it('keeps what is held when the claim failed', () => {
    expect(mergeBlocks({ next: 5, end: 9 }, null)).toEqual({ next: 5, end: 9 });
    expect(mergeBlocks(null, null)).toBeNull();
  });
});
