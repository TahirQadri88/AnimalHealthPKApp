import { describe, it, expect } from 'vitest';
import { netBilled, productTotals, topProducts, momChangePct } from './dashboard';

const line = (name, quantity, price, costPrice) => ({ name, quantity, price, costPrice });
const billed = (total, items = []) => ({ status: 'Billed', total, items });
const cn = (total, items = []) => ({ status: 'CreditNote', total, items });

describe('netBilled', () => {
  it('is zero with nothing', () => {
    expect(netBilled()).toBe(0);
  });

  // The bug this module exists to fix.
  it('subtracts what came back', () => {
    expect(netBilled({ billedInvoices: [billed(75000), billed(25000)], creditNotes: [cn(10000)] })).toBe(90000);
  });

  it('a fully returned day nets to zero rather than showing a sale', () => {
    expect(netBilled({ billedInvoices: [billed(40000)], creditNotes: [cn(40000)] })).toBe(0);
  });

  it('keeps invoice totals, so delivery charged still counts as billed', () => {
    // 46,950 of goods + 400 delivery is what the customer was asked for.
    expect(netBilled({ billedInvoices: [billed(47350)] })).toBe(47350);
  });

  it('does not produce NaN from a missing total', () => {
    expect(netBilled({ billedInvoices: [billed(undefined), billed(100)] })).toBe(100);
  });
});

describe('productTotals', () => {
  it('nets a return against the product it came back to', () => {
    const t = productTotals({
      billedInvoices: [billed(0, [line('Antox 9', 10, 7500, 6000)])],
      creditNotes: [cn(0, [line('Antox 9', 2, 7500, 6000)])],
    });
    expect(t['Antox 9']).toEqual({ name: 'Antox 9', qty: 8, revenue: 60000, profit: 12000 });
  });

  it('a product sold and fully returned shows nothing, not a profit', () => {
    const t = productTotals({
      billedInvoices: [billed(0, [line('Ratava Spray', 5, 1000, 600)])],
      creditNotes: [cn(0, [line('Ratava Spray', 5, 1000, 600)])],
    });
    expect(t['Ratava Spray']).toEqual({ name: 'Ratava Spray', qty: 0, revenue: 0, profit: 0 });
  });

  it('a return with no matching sale in the period goes negative rather than vanishing', () => {
    // Goods billed last month, returned this month. Hiding it would overstate the period.
    const t = productTotals({ creditNotes: [cn(0, [line('Antox 9', 3, 7500, 6000)])] });
    expect(t['Antox 9'].qty).toBe(-3);
    expect(t['Antox 9'].revenue).toBe(-22500);
  });

  it('bonus stock costs on the way out and credits on the way back', () => {
    const out = productTotals({ billedInvoices: [billed(0, [line('Gripe Water', 2, 0, 500)])] });
    expect(out['Gripe Water'].profit).toBe(-1000);
    const back = productTotals({
      billedInvoices: [billed(0, [line('Gripe Water', 2, 0, 500)])],
      creditNotes: [cn(0, [line('Gripe Water', 2, 0, 500)])],
    });
    expect(back['Gripe Water'].profit).toBe(0);
  });

  it('survives a line with no price, cost or name', () => {
    const t = productTotals({ billedInvoices: [billed(0, [{ quantity: 2 }])] });
    expect(Number.isNaN(t['—'].profit)).toBe(false);
    expect(t['—'].profit).toBe(0);
  });
});

describe('topProducts', () => {
  const data = {
    billedInvoices: [billed(0, [
      line('Antox 9', 10, 7500, 6000),      // rev 75,000  profit 15,000
      line('Gripe Water', 40, 1700, 1600),  // rev 68,000  profit  4,000
      line('Liver Tonic', 2, 2750, 1000),   // rev  5,500  profit  3,500
    ])],
    creditNotes: [cn(0, [line('Antox 9', 9, 7500, 6000)])],   // most of it came back
  };

  it('ranks on what was kept, not on what was sent out', () => {
    const { topValue } = topProducts(data);
    expect(topValue[0].name).toBe('Gripe Water');   // Antox led until the return
    expect(topValue.find(p => p.name === 'Antox 9').revenue).toBe(7500);
  });

  it('ranks profit the same way', () => {
    expect(topProducts(data).topProfit[0].name).toBe('Gripe Water');
  });

  it('ranks quantity on units kept', () => {
    const { topQty } = topProducts(data);
    expect(topQty[0].name).toBe('Gripe Water');
    expect(topQty.find(p => p.name === 'Antox 9').qty).toBe(1);
  });

  it('returns the three lists even with no data', () => {
    const t = topProducts();
    expect(t).toEqual({ topValue: [], topQty: [], topProfit: [] });
  });

  it('caps each list', () => {
    const items = Array.from({ length: 9 }, (_, i) => line(`P${i}`, 1, i + 1, 0));
    expect(topProducts({ billedInvoices: [billed(0, items)] }).topValue).toHaveLength(5);
  });
});

describe('momChangePct', () => {
  it('reports the movement', () => {
    expect(momChangePct(120, 100)).toBe('20.0');
    expect(momChangePct(80, 100)).toBe('-20.0');
  });

  // Dividing by last month's zero produced Infinity on screen.
  it('is null when there is nothing to compare against', () => {
    expect(momChangePct(500, 0)).toBeNull();
    expect(momChangePct(500, undefined)).toBeNull();
  });
});
