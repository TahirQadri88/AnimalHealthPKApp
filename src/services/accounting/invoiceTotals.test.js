import { describe, it, expect } from 'vitest';
import { itemsSubtotal, invoiceTotal, bonusSavings, invoiceCost } from './invoiceTotals';

describe('itemsSubtotal', () => {
  it('sums price x quantity', () => {
    expect(itemsSubtotal([
      { price: 780, quantity: 5 },
      { price: 1900, quantity: 2 },
    ])).toBe(7700);
  });

  it('excludes bonus items — they are given away', () => {
    expect(itemsSubtotal([
      { price: 780, quantity: 5 },
      { price: 500, quantity: 3, isBonus: true },
    ])).toBe(3900);
  });

  it('is zero for no items', () => {
    expect(itemsSubtotal([])).toBe(0);
    expect(itemsSubtotal()).toBe(0);
  });

  it('coerces numeric strings, as the form produces', () => {
    expect(itemsSubtotal([{ price: '780', quantity: '5' }])).toBe(3900);
  });

  it('never returns NaN when a field is missing or junk', () => {
    expect(itemsSubtotal([{ quantity: 5 }])).toBe(0);
    expect(itemsSubtotal([{ price: 780 }])).toBe(0);
    expect(itemsSubtotal([{ price: 'abc', quantity: 5 }])).toBe(0);
    expect(itemsSubtotal([null, undefined, { price: 100, quantity: 1 }])).toBe(100);
  });
});

describe('invoiceTotal', () => {
  const items = [{ price: 780, quantity: 5 }]; // 3900

  it('adds delivery and subtracts discount', () => {
    expect(invoiceTotal({ items, deliveryBilled: 500, discount: 400 })).toBe(4000);
  });

  it('handles each independently', () => {
    expect(invoiceTotal({ items })).toBe(3900);
    expect(invoiceTotal({ items, deliveryBilled: 500 })).toBe(4400);
    expect(invoiceTotal({ items, discount: 900 })).toBe(3000);
  });

  it('can go negative — an over-discounted invoice is a data problem, not a clamp', () => {
    expect(invoiceTotal({ items, discount: 5000 })).toBe(-1100);
  });

  it('survives an empty invoice', () => {
    expect(invoiceTotal({})).toBe(0);
    expect(invoiceTotal()).toBe(0);
  });

  it('matches the arithmetic it replaced', () => {
    // The old inline version, kept here as the reference:
    //   items.reduce((s,i) => s + (i.isBonus ? 0 : i.price * i.quantity), 0)
    //     + Number(deliveryBilled || 0) - Number(discount || 0)
    const inv = {
      items: [
        { price: 2100, quantity: 2 },
        { price: 950, quantity: 2 },
        { price: 300, quantity: 1, isBonus: true },
      ],
      deliveryBilled: 400,
      discount: 100,
    };
    const old = inv.items.reduce((s, i) => s + (i.isBonus ? 0 : i.price * i.quantity), 0)
      + Number(inv.deliveryBilled || 0) - Number(inv.discount || 0);
    expect(invoiceTotal(inv)).toBe(old);
    expect(invoiceTotal(inv)).toBe(6400);
  });
});

describe('bonusSavings', () => {
  it('values bonus items at their original price', () => {
    expect(bonusSavings([
      { price: 780, quantity: 5 },
      { originalPrice: 500, quantity: 3, isBonus: true },
    ])).toBe(1500);
  });

  it('is zero when nothing was given away', () => {
    expect(bonusSavings([{ price: 780, quantity: 5 }])).toBe(0);
  });

  it('is zero when a bonus item has no original price recorded', () => {
    expect(bonusSavings([{ quantity: 3, isBonus: true }])).toBe(0);
  });
});

describe('invoiceCost', () => {
  it('counts bonus items — given away, but still bought', () => {
    expect(invoiceCost([
      { costPrice: 600, quantity: 5 },
      { costPrice: 400, quantity: 3, isBonus: true },
    ])).toBe(4200);
  });

  it('is zero when cost price is not recorded', () => {
    expect(invoiceCost([{ price: 780, quantity: 5 }])).toBe(0);
  });
});
