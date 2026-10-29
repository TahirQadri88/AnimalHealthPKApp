import { describe, it, expect } from 'vitest';
import { needsCost, productsNeedingCost, billsAffected } from './costPending';

describe('products waiting for a cost', () => {
  it('counts a staff-registered product with no cost', () => {
    expect(needsCost({ id: 1, costPrice: 0, costPending: true })).toBe(true);
  });
  it('stops counting once an admin prices it', () => {
    expect(needsCost({ id: 1, costPrice: 120, costPending: false })).toBe(false);
    // Even if the flag were somehow left behind, a real cost settles it.
    expect(needsCost({ id: 1, costPrice: 120, costPending: true })).toBe(false);
  });
  it('does not flag older products that are zero on purpose', () => {
    expect(needsCost({ id: 1, costPrice: 0 })).toBe(false);
  });
  it('ignores archived products', () => {
    expect(needsCost({ id: 1, costPrice: 0, costPending: true, archived: true })).toBe(false);
  });
  it('counts the bills that sold one', () => {
    const pending = productsNeedingCost([{ id: 7, costPrice: 0, costPending: true }, { id: 8, costPrice: 50 }]);
    const invoices = [
      { id: 'INV-1', items: [{ productId: 7 }, { productId: 8 }] },
      { id: 'INV-2', items: [{ productId: 8 }] },
      { id: 'INV-3', items: [{ productId: '7' }] },
    ];
    expect(billsAffected(pending, invoices)).toBe(2);
  });
});
