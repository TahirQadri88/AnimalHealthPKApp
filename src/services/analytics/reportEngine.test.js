import { describe, it, expect } from 'vitest';
import { buildReport } from './reportEngine';

// The engine behind the Analytics screen. Extracted with its body byte-identical, so these
// tests describe the behaviour that has always been there rather than behaviour just
// written — which is the point: this was the largest piece of untested money code left.

const line = (name, qty, price, cost, over = {}) =>
  ({ productId: 1, name, quantity: qty, price, costPrice: cost, company: 'Selmore', ...over });

const billed = (id, date, items, over = {}) => ({
  id, date, status: 'Billed', customerId: 1, customerName: 'Al Shaheer',
  salespersonId: 1, salespersonName: 'Owais', total: 0, items, ...over,
});
const creditNote = (id, date, items, over = {}) => ({
  id, date, status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer',
  salespersonId: 1, salespersonName: 'Owais', total: 0, items, ...over,
});

const run = (over = {}) => buildReport({
  invoices: [], expenses: [], payments: [], products: [], customers: [{ id: 1, name: 'Al Shaheer' }],
  filterCompanies: new Set(), filterCustomers: new Set(), filterSalespersons: new Set(),
  checkCustomFilter: () => true,
  getCustomerBalance: () => 0,
  getPaymentStatus: () => 'Pending',
  dateFilter: 'All Time', customStart: '', customEnd: '',
  ...over,
});

describe('buildReport — the headline figures', () => {
  it('is all zeroes with no data, rather than NaN', () => {
    const r = run();
    expect(r.kpis.productRevenue).toBe(0);
    expect(r.kpis.netProfit).toBe(0);
    expect(Number.isNaN(r.kpis.grossMargin)).toBe(false);
  });

  it('computes revenue, cost and margin from line items', () => {
    const r = run({ invoices: [billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)])] });
    expect(r.kpis.productRevenue).toBe(75000);
    expect(r.kpis.totalCOGS).toBe(60000);
    expect(r.kpis.grossMargin).toBe(15000);
  });

  it('subtracts operating expenses to reach net profit', () => {
    const r = run({
      invoices: [billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)])],
      expenses: [{ id: 1, date: '2026-08-02', amount: 5000, category: 'Transport' }],
    });
    expect(r.kpis.totalExpenses).toBe(5000);
    expect(r.kpis.netProfit).toBe(10000);
  });
});

// The reason this file exists. A credit note must reduce the figures, everywhere.
describe('buildReport — sales returns', () => {
  const data = {
    invoices: [
      billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)]),
      creditNote('CN-1', '2026-08-05', [line('Antox 9', 2, 7500, 6000)]),
    ],
  };

  it('nets returns out of the headline', () => {
    const r = run(data);
    expect(r.kpis.productRevenue).toBe(60000);   // 75,000 less 15,000 returned
    expect(r.kpis.creditNotesTotal).toBe(15000);
    expect(r.kpis.grossMargin).toBe(12000);
  });

  it('nets them out of the per-product breakdown too, so it agrees with the headline', () => {
    const r = run(data);
    expect(r.byProduct['Antox 9'].qty).toBe(8);
    expect(r.byProduct['Antox 9'].revenue).toBe(60000);
    expect(r.byProduct['Antox 9'].profit).toBe(12000);
  });

  it('a fully returned sale nets to nothing, not to a profit', () => {
    const r = run({ invoices: [
      billed('INV-1', '2026-08-01', [line('Antox 9', 5, 7500, 6000)]),
      creditNote('CN-1', '2026-08-02', [line('Antox 9', 5, 7500, 6000)]),
    ] });
    expect(r.kpis.productRevenue).toBe(0);
    expect(r.kpis.grossMargin).toBe(0);
    expect(r.kpis.netProfit).toBe(0);
  });

  // The bug fixed on 2026-09-01: bonus lines were skipped when subtracting credit notes,
  // so free stock that came back stayed expensed forever.
  it('gives back the cost of returned bonus stock', () => {
    const bonus = { ...line('Gripe Water', 2, 0, 500), isBonus: true };
    const out = run({ invoices: [billed('INV-1', '2026-08-01', [bonus])] });
    expect(out.byProduct['Gripe Water'].profit).toBe(-1000);
    const back = run({ invoices: [
      billed('INV-1', '2026-08-01', [bonus]),
      creditNote('CN-1', '2026-08-02', [bonus]),
    ] });
    expect(back.byProduct['Gripe Water'].profit).toBe(0);
  });
});

describe('buildReport — breakdowns', () => {
  const data = {
    invoices: [
      billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)]),
      billed('INV-2', '2026-08-02', [line('Ratava', 4, 1000, 600)], { customerId: 2, customerName: 'Ghousia', salespersonName: 'Ghousia' }),
    ],
    customers: [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Ghousia' }],
  };

  it('splits by product', () => {
    const r = run(data);
    expect(Object.keys(r.byProduct).sort()).toEqual(['Antox 9', 'Ratava']);
  });

  it('splits by customer', () => {
    const r = run(data);
    expect(r.byCustomer['Al Shaheer'].productRevenue).toBe(75000);
    expect(r.byCustomer['Ghousia'].productRevenue).toBe(4000);
  });

  it('splits by salesperson', () => {
    const r = run(data);
    expect(r.bySalesperson['Owais'].revenue).toBe(75000);
    expect(r.bySalesperson['Ghousia'].revenue).toBe(4000);
  });
});

describe('buildReport — filters', () => {
  const data = {
    invoices: [
      billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)]),
      billed('INV-2', '2026-08-02', [line('Ratava', 4, 1000, 600)], { customerId: 2, customerName: 'Ghousia' }),
    ],
    customers: [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Ghousia' }],
  };

  it('narrows to one customer', () => {
    const r = run({ ...data, filterCustomers: new Set(['1']) });
    expect(r.kpis.productRevenue).toBe(75000);
  });

  it('the date filter it is handed is the one it obeys', () => {
    const r = run({ ...data, checkCustomFilter: (d) => d === '2026-08-02' });
    expect(r.kpis.productRevenue).toBe(4000);
  });
});

describe('buildReport — nothing reaches the screen as NaN', () => {
  it('survives lines with missing price, cost or quantity', () => {
    const r = run({ invoices: [billed('INV-1', '2026-08-01', [
      { productId: 9, name: 'Broken', quantity: 3 },
      { productId: 8, name: 'AlsoBroken', price: 100 },
    ])] });
    expect(Number.isNaN(r.kpis.productRevenue)).toBe(false);
    expect(Number.isNaN(r.kpis.netProfit)).toBe(false);
  });

  // Found by the first test this engine has ever had, and deliberately NOT fixed in the
  // same commit as the extraction — a guard would have broken the byte-identical proof
  // that the figures cannot have moved. Documented here, fixed in the commit that follows.
  it('currently THROWS on an invoice with no items array', () => {
    expect(() => run({ invoices: [{ id: 'INV-X', date: '2026-08-01', status: 'Billed', customerId: 1 }] })).toThrow();
  });
});
