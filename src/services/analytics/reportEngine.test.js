import { describe, it, expect } from 'vitest';
import { buildReport } from './reportEngine';
import { buildAgingReport } from './receivables';
import { getLocalDateStr } from '../../helpers';

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

  it('splits by customer, keyed by id and labelled with the name', () => {
    const r = run(data);
    expect(r.byCustomer['1'].productRevenue).toBe(75000);
    expect(r.byCustomer['1'].label).toBe('Al Shaheer');
    expect(r.byCustomer['2'].productRevenue).toBe(4000);
    expect(r.byCustomer['2'].label).toBe('Ghousia');
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

  // Found by the first test this engine ever had. A record with no items array threw and
  // took the whole Analytics screen with it — every figure on the page, not just that row.
  it('survives an invoice with no items array at all', () => {
    expect(() => run({ invoices: [{ id: 'INV-X', date: '2026-08-01', status: 'Billed', customerId: 1 }] })).not.toThrow();
  });

  it('and still counts the invoices around it correctly', () => {
    const r = run({ invoices: [
      { id: 'INV-X', date: '2026-08-01', status: 'Billed', customerId: 1 },
      billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)]),
    ] });
    expect(r.kpis.productRevenue).toBe(75000);
  });
});

// ── Receivables aging ───────────────────────────────────────────────────────
//
// This engine aged a customer's whole balance by the date of their MOST RECENT invoice,
// which is not the age of the debt but the age of the last sale. Buying anything reset the
// entire outstanding balance to "current". Measured on the same customer and the same data,
// the Receivables screen put Rs 118,500 in 90+ while Analytics put Rs 120,000 in current —
// on the screen a person uses to decide who to chase.
//
// buildAgingReport is the tested implementation: it settles each debt oldest-first with the
// same rule as payment status, and receivables.test.js asserts its totals equal the ledger.
// Analytics now uses it, so the two screens cannot disagree.
describe('buildReport — aging agrees with the Receivables screen', () => {
  const daysAgo = (n) => getLocalDateStr(new Date(Date.now() - n * 86400000));

  const world = {
    customers: [{ id: 1, name: 'Al Shaheer', phone: '0300-1234567' }],
    invoices: [
      billed('INV-OLD', daysAgo(200), [line('Antox 9', 1, 118500, 90000)], { total: 118500 }),
      billed('INV-NEW', daysAgo(2), [line('Ratava', 1, 1500, 1000)], { total: 1500 }),
    ],
    payments: [],
  };

  const engine = () => run({ ...world, getCustomerBalance: () => 120000 });
  const screen = () => buildAgingReport({ ...world, asOf: getLocalDateStr() });

  it('does not call a 200-day-old debt current because the customer bought yesterday', () => {
    const b = engine().agingBuckets;
    expect(b.days90plus.reduce((s, r) => s + r.amount, 0)).toBe(118500);
    expect(b.current.reduce((s, r) => s + r.amount, 0)).toBe(1500);
  });

  it('splits one customer across buckets instead of filing them under one', () => {
    const b = engine().agingBuckets;
    expect(b.current.map(r => r.name)).toEqual(['Al Shaheer']);
    expect(b.days90plus.map(r => r.name)).toEqual(['Al Shaheer']);
  });

  it('every bucket total equals the Receivables screen, bucket for bucket', () => {
    const b = engine().agingBuckets;
    const t = screen().totals;
    const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);
    expect(sum(b.current)).toBe(t.current);
    expect(sum(b.days30)).toBe(t.d31_60);
    expect(sum(b.days60)).toBe(t.d61_90);
    expect(sum(b.days90plus)).toBe(t.d90plus);
  });

  it('carries the phone number a reminder needs', () => {
    expect(engine().agingBuckets.days90plus[0].phone).toBe('0300-1234567');
  });

  it('ages each portion by how old THAT debt is, not by the last sale', () => {
    const b = engine().agingBuckets;
    expect(b.days90plus[0].ageDays).toBeGreaterThanOrEqual(199);
    expect(b.current[0].ageDays).toBeLessThanOrEqual(3);
  });

  it('exposes the full aging report so a screen can show the split', () => {
    const r = engine();
    expect(r.aging.grandTotal).toBe(120000);
    expect(r.aging.rows).toHaveLength(1);
  });

  it('leaves the buckets empty when nobody owes anything', () => {
    const b = run().agingBuckets;
    expect([b.current, b.days30, b.days60, b.days90plus].every(x => x.length === 0)).toBe(true);
  });
});

// ── Keyed by id, not by name ────────────────────────────────────────────────
//
// byCustomer and the city/area/type segments were keyed by customerName. Two customers with
// the same name — common enough in a market where several shops are "Al Shaheer" — merged
// into one row. And a rename relies on a cascade that rewrites customerName on every past
// invoice; if that ever partially fails, one customer's history splits in two.
describe('buildReport — customer breakdowns are keyed by id', () => {
  const twoOfTheSameName = {
    customers: [
      { id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' },
      { id: 2, name: 'Al Shaheer', city: 'Hyderabad', area: 'Latifabad', customerType: 'Wholesale' },
    ],
    invoices: [
      billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)], { customerId: 1, customerName: 'Al Shaheer' }),
      billed('INV-2', '2026-08-02', [line('Ratava', 2, 2000, 1500)], { customerId: 2, customerName: 'Al Shaheer' }),
    ],
  };

  it('does not merge two customers who share a name', () => {
    const r = run(twoOfTheSameName);
    expect(Object.keys(r.byCustomer).sort()).toEqual(['1', '2']);
    expect(r.byCustomer['1'].productRevenue).toBe(75000);
    expect(r.byCustomer['2'].productRevenue).toBe(4000);
  });

  it('keeps their cities apart, which a name key could not', () => {
    const r = run(twoOfTheSameName);
    expect(r.byCity.Karachi.revenue).toBe(75000);
    expect(r.byCity.Hyderabad.revenue).toBe(4000);
  });

  it('carries the id so a row can open that customer\'s ledger', () => {
    const r = run(twoOfTheSameName);
    expect(r.byCustomer['1'].id).toBe(1);
    expect(r.byCustomer['2'].id).toBe(2);
  });

  // The cascade that rewrites customerName on past invoices is the thing being distrusted.
  it('holds a renamed customer together even when old invoices carry the old name', () => {
    const r = run({
      customers: [{ id: 1, name: 'Al Shaheer Cattle', city: 'Karachi' }],
      invoices: [
        billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)], { customerName: 'Al Shaheer' }),
        billed('INV-2', '2026-08-02', [line('Ratava', 2, 2000, 1500)], { customerName: 'Al Shaheer Cattle' }),
      ],
    });
    expect(Object.keys(r.byCustomer)).toEqual(['1']);
    expect(r.byCustomer['1'].productRevenue).toBe(79000);
    // And the label is the customer's CURRENT name, not whichever invoice was seen first.
    expect(r.byCustomer['1'].label).toBe('Al Shaheer Cattle');
    expect(r.byCity.Karachi.revenue).toBe(79000);
  });

  it('files an invoice with no customer id under Unknown rather than dropping it', () => {
    const r = run({
      customers: [],
      invoices: [billed('INV-1', '2026-08-01', [line('Antox 9', 1, 100, 60)], { customerId: undefined, customerName: 'Walk-in' })],
    });
    expect(Object.values(r.byCustomer)[0].productRevenue).toBe(100);
    expect(Object.values(r.byCustomer)[0].label).toBe('Walk-in');
  });

  it('nets a credit note off the same customer the invoice was billed to', () => {
    const r = run({
      customers: [{ id: 1, name: 'Al Shaheer Cattle' }],
      invoices: [
        billed('INV-1', '2026-08-01', [line('Antox 9', 10, 7500, 6000)], { customerName: 'Al Shaheer' }),
        creditNote('CN-1', '2026-08-05', [line('Antox 9', 2, 7500, 6000)], { customerName: 'Al Shaheer Cattle' }),
      ],
    });
    expect(Object.keys(r.byCustomer)).toEqual(['1']);
    expect(r.byCustomer['1'].productRevenue).toBe(60000);
  });
});

// ── The brand filter and returns ────────────────────────────────────────────
//
// The billed loop gates each line on filterCompanies; the credit-note loop did not. With a
// brand filter on, a return of some OTHER brand was still subtracted from the breakdowns —
// and it invented a row for the brand that was filtered out. computePnL got this right via
// includeItem, so the headline P&L and the tables underneath it disagreed.
describe('buildReport — a brand filter applies to returns too', () => {
  const PRODUCTS = [
    { id: 1, name: 'Antox 9', companyId: 10 },
    { id: 2, name: 'Ratava', companyId: 20 },
  ];
  const selmore = (n, qty, price, cost) => ({ productId: 1, name: n, quantity: qty, price, costPrice: cost, company: 'Selmore' });
  const other = (n, qty, price, cost) => ({ productId: 2, name: n, quantity: qty, price, costPrice: cost, company: 'Star' });

  const r = () => run({
    products: PRODUCTS,
    filterCompanies: new Set(['10']),
    invoices: [
      billed('INV-1', '2026-08-01', [selmore('Antox 9', 10, 7500, 6000), other('Ratava', 5, 2000, 1500)]),
      creditNote('CN-1', '2026-08-05', [other('Ratava', 5, 2000, 1500)]),
    ],
  });

  it('does not subtract another brand\'s return from the filtered totals', () => {
    expect(r().byCompany.Selmore.revenue).toBe(75000);
    expect(r().byCustomer['1'].productRevenue).toBe(75000);
    expect(r().bySalesperson.Owais.revenue).toBe(75000);
  });

  it('does not invent a row for a brand the filter excluded', () => {
    expect(Object.keys(r().byCompany)).toEqual(['Selmore']);
    expect(Object.keys(r().byProduct)).toEqual(['Antox 9']);
  });

  it('agrees with the headline P&L, which always filtered returns correctly', () => {
    expect(r().kpis.creditNotesTotal).toBe(0);
    expect(r().kpis.productRevenue).toBe(75000);
  });

  it('still subtracts the return when no brand filter is applied', () => {
    const all = run({
      products: PRODUCTS,
      invoices: [
        billed('INV-1', '2026-08-01', [selmore('Antox 9', 10, 7500, 6000), other('Ratava', 5, 2000, 1500)]),
        creditNote('CN-1', '2026-08-05', [other('Ratava', 5, 2000, 1500)]),
      ],
    });
    expect(all.byCompany.Star.revenue).toBe(0);
    expect(all.kpis.productRevenue).toBe(75000);
  });
});
