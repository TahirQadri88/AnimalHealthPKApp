import { describe, it, expect } from 'vitest';
import { buildItemSales } from './itemSales';

const inv = (id, date, customerName, items, status = 'Billed') =>
  ({ id, date, status, customerId: 1, customerName, items });

const INVOICES = [
  inv('INV-1', '2026-08-01', 'Al Shaheer', [
    { name: 'Antox 9', quantity: 10, price: 7500 },
    { name: 'Ratava Spray', quantity: 2, price: 1000 },
    { name: 'HeptaSef', quantity: 1, price: 0, isBonus: true },
  ]),
  inv('INV-2', '2026-08-05', 'Ghousia Farms', [{ name: 'Antox 9', quantity: 4, price: 7500 }]),
  inv('EST-1', '2026-08-06', 'Al Shaheer', [{ name: 'Antox 9', quantity: 99, price: 7500 }], 'Estimate'),
  inv('INV-3', '2026-08-07', undefined, [{ name: 'Antox 9', quantity: 1, price: 7500 }]),
];

const run = (over = {}) => buildItemSales({ invoices: INVOICES, ...over });

describe('buildItemSales', () => {
  it('asks for a search rather than listing every line ever sold', () => {
    expect(run()).toEqual([]);
    expect(run({ productQuery: '  ' })).toEqual([]);
  });

  it('finds a product across invoices, newest first', () => {
    expect(run({ productQuery: 'antox' }).map(r => r.invoiceId)).toEqual(['INV-3', 'INV-2', 'INV-1']);
  });

  it('matches part of a name, case-insensitively', () => {
    expect(run({ productQuery: 'RATAVA' })).toHaveLength(1);
  });

  it('finds what one customer bought', () => {
    const rows = run({ customerQuery: 'ghousia' });
    expect(rows).toHaveLength(1);
    expect(rows[0].invoiceId).toBe('INV-2');
  });

  it('combines the two searches', () => {
    expect(run({ productQuery: 'antox', customerQuery: 'al shaheer' }).map(r => r.invoiceId))
      .toEqual(['INV-1']);
  });

  it('leaves out bonus lines — free stock was not sold', () => {
    expect(run({ productQuery: 'heptasef' })).toEqual([]);
  });

  it('ignores estimates and drafts', () => {
    expect(run({ productQuery: 'antox' }).map(r => r.invoiceId)).not.toContain('EST-1');
  });

  it('does not throw on an invoice with no customer name', () => {
    expect(() => run({ customerQuery: 'ghousia' })).not.toThrow();
    expect(run({ productQuery: 'antox' }).map(r => r.invoiceId)).toContain('INV-3');
  });

  it('honours the period filter', () => {
    expect(run({ productQuery: 'antox', checkCustomFilter: (d) => d >= '2026-08-05' }))
      .toHaveLength(2);
  });

  it('carries the line amount an export needs', () => {
    expect(run({ productQuery: 'antox', customerQuery: 'al shaheer' })[0])
      .toMatchObject({ name: 'Antox 9', qty: 10, rate: 7500, sub: 75000 });
  });
});
