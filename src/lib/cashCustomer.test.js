import { describe, it, expect } from 'vitest';
import { isCashCustomer, isCashSale } from './cashCustomer';

describe('isCashCustomer', () => {
  // The record that actually exists in this business.
  it('recognises the walk-in account by the name somebody typed', () => {
    expect(isCashCustomer({ name: 'Cash Sale (Walk in Customer)' })).toBe(true);
  });

  it('recognises the ways the same thing gets written', () => {
    ['Cash Sales', 'CASH SALE', 'Walk-in', 'Walk In Customer', 'walkin', 'Counter Sale']
      .forEach(name => expect(isCashCustomer({ name })).toBe(true));
  });

  it('does not mistake a named customer for a counter sale', () => {
    ['Haris Afzal Fooder Piyala Hotel', 'Al Shaheer Cattle', 'Ghousia Farms', 'Cashmere Traders']
      .forEach(name => expect(isCashCustomer({ name })).toBe(false));
  });

  it('says no to nothing at all rather than throwing', () => {
    expect(isCashCustomer(null)).toBe(false);
    expect(isCashCustomer({})).toBe(false);
    expect(isCashCustomer({ name: null })).toBe(false);
  });
});

describe('isCashSale', () => {
  const customers = [
    { id: 1, name: 'Cash Sale (Walk in Customer)' },
    { id: 2, name: 'Haris Afzal Fooder Piyala Hotel' },
  ];

  it('reads the customer record, not the document', () => {
    expect(isCashSale({ customerId: 1 }, customers)).toBe(true);
    expect(isCashSale({ customerId: 2 }, customers)).toBe(false);
  });

  // The name on a document is a snapshot and may predate a rename; the record is current.
  it('believes the record over a stale name on the document', () => {
    expect(isCashSale({ customerId: 2, customerName: 'Cash Sale' }, customers)).toBe(false);
    expect(isCashSale({ customerId: 1, customerName: 'Some Old Name' }, customers)).toBe(true);
  });

  it('falls back to the document only when the record is gone', () => {
    expect(isCashSale({ customerId: 99, customerName: 'Cash Sale (Walk in Customer)' }, customers)).toBe(true);
    expect(isCashSale({ customerId: 99, customerName: 'Al Shaheer' }, customers)).toBe(false);
  });

  it('matches ids across types, because one side is often a string', () => {
    expect(isCashSale({ customerId: '1' }, customers)).toBe(true);
  });

  it('survives being called with nothing', () => {
    expect(isCashSale(undefined)).toBe(false);
    expect(isCashSale({ customerId: 1 })).toBe(false);
  });
});

// ── The checkbox ────────────────────────────────────────────────────────────
//
// Added 2026-09-18. The name stays as the fallback, so nothing that already worked stops
// working — but an explicit answer is an answer, in both directions.
describe('isCashCustomer — the explicit flag', () => {
  it('marks an ordinary-sounding account as a counter account when ticked', () => {
    expect(isCashCustomer({ name: 'Front Desk', isCashCustomer: true })).toBe(true);
  });

  // The direction that is easy to get wrong: a real customer whose name reads like one.
  it('un-marks a named customer whose name happens to read like a cash account', () => {
    expect(isCashCustomer({ name: 'Walk In Traders', isCashCustomer: false })).toBe(false);
  });

  it('falls back to the name when the question has never been asked', () => {
    expect(isCashCustomer({ name: 'Cash Sale (Walk in Customer)' })).toBe(true);
    expect(isCashCustomer({ name: 'Al Shaheer Cattle' })).toBe(false);
  });

  // `false` and absent are different: absent means nobody has been asked yet.
  it('tells an explicit no apart from an unanswered question', () => {
    expect(isCashCustomer({ name: 'Cash Sale', isCashCustomer: false })).toBe(false);
    expect(isCashCustomer({ name: 'Cash Sale', isCashCustomer: undefined })).toBe(true);
  });

  it('ignores a flag that is not a boolean, rather than guessing at it', () => {
    expect(isCashCustomer({ name: 'Cash Sale', isCashCustomer: 'yes' })).toBe(true);
    expect(isCashCustomer({ name: 'Al Shaheer', isCashCustomer: 1 })).toBe(false);
  });

  it('reaches the printed document through the record, flag and all', () => {
    const customers = [{ id: 5, name: 'Front Desk', isCashCustomer: true }];
    expect(isCashSale({ customerId: 5 }, customers)).toBe(true);
  });
});
