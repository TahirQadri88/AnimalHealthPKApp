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
