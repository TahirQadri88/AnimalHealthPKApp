import { describe, it, expect } from 'vitest';
import {
  invoicesAffectedByCostChange,
  profitImpactOfCostChange,
  defaultEffectiveDate,
  firstSaleDate,
} from './costPriceChange';

const inv = (id, date, items) => ({ id, date, status: 'Billed', items });
const line = (productId, quantity, costPrice) => ({ productId, quantity, costPrice });

const HISTORY = [
  inv('INV-1', '2026-06-01', [line(7, 10, 600)]),
  inv('INV-2', '2026-07-15', [line(7, 5, 600), line(9, 2, 100)]),
  inv('INV-3', '2026-08-20', [line(9, 1, 100)]),
];

describe('invoicesAffectedByCostChange', () => {
  it('touches nothing when the change starts today and nothing was sold today', () => {
    expect(invoicesAffectedByCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-08-31', invoices: HISTORY,
    })).toHaveLength(0);
  });

  it('reaches back when the date is set earlier', () => {
    const hit = invoicesAffectedByCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-07-01', invoices: HISTORY,
    });
    expect(hit.map(i => i.id)).toEqual(['INV-2']);
  });

  it('reaches everything from the first sale', () => {
    const hit = invoicesAffectedByCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-06-01', invoices: HISTORY,
    });
    expect(hit.map(i => i.id)).toEqual(['INV-1', 'INV-2']);
  });

  it('ignores invoices that do not contain the product', () => {
    const hit = invoicesAffectedByCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-01-01', invoices: HISTORY,
    });
    expect(hit.map(i => i.id)).not.toContain('INV-3');
  });

  it('ignores invoices already at the new cost — no pointless writes', () => {
    expect(invoicesAffectedByCostChange({
      productId: 7, newCost: 600, effectiveDate: '2026-01-01', invoices: HISTORY,
    })).toHaveLength(0);
  });

  it('includes the effective date itself', () => {
    const hit = invoicesAffectedByCostChange({
      productId: 9, newCost: 150, effectiveDate: '2026-08-20', invoices: HISTORY,
    });
    expect(hit.map(i => i.id)).toEqual(['INV-3']);
  });
});

describe('profitImpactOfCostChange', () => {
  it('raising the cost shrinks past profit', () => {
    // 15 units of product 7 across two invoices, cost up by 100 each.
    const impact = profitImpactOfCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-06-01', invoices: HISTORY,
    });
    expect(impact.invoiceCount).toBe(2);
    expect(impact.profitDelta).toBe(-1500);
  });

  it('lowering the cost inflates past profit', () => {
    const impact = profitImpactOfCostChange({
      productId: 7, newCost: 500, effectiveDate: '2026-06-01', invoices: HISTORY,
    });
    expect(impact.profitDelta).toBe(1500);
  });

  it('is zero when the change only applies going forward', () => {
    const impact = profitImpactOfCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-08-31', invoices: HISTORY,
    });
    expect(impact.invoiceCount).toBe(0);
    expect(impact.profitDelta).toBe(0);
  });

  it('counts bonus items — they earn nothing but they still cost', () => {
    const withBonus = [inv('INV-9', '2026-06-01', [{ productId: 7, quantity: 3, costPrice: 600, isBonus: true, price: 0 }])];
    const impact = profitImpactOfCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-06-01', invoices: withBonus,
    });
    expect(impact.profitDelta).toBe(-300);
  });

  it('does not produce NaN when a line is missing its cost', () => {
    const messy = [inv('INV-9', '2026-06-01', [{ productId: 7, quantity: 2 }])];
    const impact = profitImpactOfCostChange({
      productId: 7, newCost: 700, effectiveDate: '2026-06-01', invoices: messy,
    });
    expect(Number.isNaN(impact.profitDelta)).toBe(false);
    expect(impact.profitDelta).toBe(-1400);
  });
});

describe('defaultEffectiveDate', () => {
  it('is today — a cost change must not reach into history unasked', () => {
    expect(defaultEffectiveDate('2026-08-31')).toBe('2026-08-31');
  });
});

describe('firstSaleDate', () => {
  it('finds the earliest invoice holding the product', () => {
    expect(firstSaleDate(7, HISTORY, '2026-08-31')).toBe('2026-06-01');
    expect(firstSaleDate(9, HISTORY, '2026-08-31')).toBe('2026-07-15');
  });

  it('falls back when the product has never been sold', () => {
    expect(firstSaleDate(404, HISTORY, '2026-08-31')).toBe('2026-08-31');
  });
});
