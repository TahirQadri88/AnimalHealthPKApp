import { describe, it, expect } from 'vitest';
import { drillDown, DIMENSIONS, marginTrend } from './drilldown';
import { buildReport } from './reportEngine';

// A rich enough world that the dimensions genuinely differ: two brands, two cities, two
// salespeople, a customer who returns something, a bonus line, and a record with no items.
const PRODUCTS = [
  { id: 1, name: 'Antox 9', companyId: 10 },
  { id: 2, name: 'Ratava', companyId: 20 },
  { id: 3, name: 'HeptaSef', companyId: 10 },
];
const CUSTOMERS = [
  { id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' },
  { id: 2, name: 'Ghousia Farms', city: 'Hyderabad', area: 'Latifabad', customerType: 'Wholesale' },
];
const it_ = (productId, name, qty, price, cost, company, over = {}) =>
  ({ productId, name, quantity: qty, price, costPrice: cost, company, ...over });

const doc = (id, date, status, customerId, salespersonName, items, over = {}) => ({
  id, date, status, customerId,
  customerName: CUSTOMERS.find(c => c.id === customerId)?.name,
  salespersonId: salespersonName === 'Owais' ? 1 : 2, salespersonName,
  total: 0, items, ...over,
});

const INVOICES = [
  doc('INV-1', '2026-08-01', 'Billed', 1, 'Owais', [
    it_(1, 'Antox 9', 10, 7500, 6000, 'Selmore'),
    it_(2, 'Ratava', 5, 2000, 1500, 'Star'),
  ]),
  doc('INV-2', '2026-08-03', 'Billed', 2, 'Ghousia', [
    it_(1, 'Antox 9', 4, 7500, 6000, 'Selmore'),
    it_(3, 'HeptaSef', 2, 2750, 2000, 'Selmore', { isBonus: true, price: 0 }),
  ]),
  doc('INV-3', '2026-08-10', 'Billed', 1, 'Owais', [it_(3, 'HeptaSef', 6, 2750, 2000, 'Selmore')]),
  doc('CN-1', '2026-08-12', 'CreditNote', 1, 'Owais', [it_(1, 'Antox 9', 2, 7500, 6000, 'Selmore')],
      { reason: 'Damaged in transit' }),
  doc('INV-4', '2026-08-14', 'Billed', 2, 'Ghousia', undefined),
  doc('EST-1', '2026-08-15', 'Estimate', 1, 'Owais', [it_(1, 'Antox 9', 99, 7500, 6000, 'Selmore')]),
];

const base = {
  invoices: INVOICES, products: PRODUCTS, customers: CUSTOMERS,
  checkCustomFilter: () => true,
  filterCompanies: new Set(), filterCustomers: new Set(), filterSalespersons: new Set(),
};

const report = (over = {}) => buildReport({
  expenses: [], payments: [], ...base,
  getCustomerBalance: () => 0, getPaymentStatus: () => 'Pending',
  dateFilter: 'All Time', customStart: '', customEnd: '', ...over,
});

const dig = (dimension, key, over = {}) => drillDown({ dimension, key, ...base, ...over });

// ── The requirement ─────────────────────────────────────────────────────────
//
// Every breakdown row, every dimension, must reconcile to the documents behind it. This is
// the check the aging report never had, and the reason it disagreed with the Receivables
// screen for months.
describe('drillDown reconciles to the breakdown row it was opened from', () => {
  const cases = [
    ['product', 'byProduct', ['qty', 'revenue', 'cost', 'profit']],
    ['company', 'byCompany', ['qty', 'revenue', 'cost', 'profit']],
    ['customer', 'byCustomer', ['revenue', 'cost', 'profit']],
    ['salesperson', 'bySalesperson', ['revenue', 'profit']],
    ['city', 'byCity', ['revenue', 'profit']],
    ['area', 'byArea', ['revenue', 'profit']],
    ['type', 'byType', ['revenue', 'profit']],
  ];

  cases.forEach(([dimension, mapName, fields]) => {
    it(`${dimension}: every row's figures equal its transactions`, () => {
      const map = report()[mapName];
      const keys = Object.keys(map);
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach(key => {
        const row = map[key];
        const { totals } = dig(dimension, key);
        fields.forEach(f => {
          // byCustomer calls its revenue productRevenue.
          const expected = f === 'revenue' ? (row.revenue ?? row.productRevenue) : row[f];
          expect(`${dimension}/${key}/${f}=${totals[f]}`).toBe(`${dimension}/${key}/${f}=${expected}`);
        });
      });
    });
  });

  it('still reconciles under a brand filter', () => {
    const over = { filterCompanies: new Set(['10']) };
    const map = report(over).byProduct;
    Object.keys(map).forEach(key => {
      expect(dig('product', key, over).totals.revenue).toBe(map[key].revenue);
    });
    expect(Object.keys(map)).not.toContain('Ratava');
  });

  it('still reconciles under a period filter', () => {
    const over = { checkCustomFilter: (d) => d >= '2026-08-10' };
    const map = report(over).byCustomer;
    Object.keys(map).forEach(key => {
      expect(dig('customer', key, over).totals.revenue).toBe(map[key].productRevenue);
    });
  });

  it('still reconciles under a customer filter', () => {
    const over = { filterCustomers: new Set(['1']) };
    const map = report(over).bySalesperson;
    Object.keys(map).forEach(key => {
      expect(dig('salesperson', key, over).totals.revenue).toBe(map[key].revenue);
    });
  });
});

describe('drillDown — what the list actually says', () => {
  it('lists the documents behind a product, newest first', () => {
    const { rows } = dig('product', 'Antox 9');
    expect(rows.map(r => r.id)).toEqual(['CN-1', 'INV-2', 'INV-1']);
  });

  it('marks a return as one, and carries its reason', () => {
    const cn = dig('product', 'Antox 9').rows.find(r => r.id === 'CN-1');
    expect(cn.isReturn).toBe(true);
    expect(cn.docType).toBe('Credit Note');
    expect(cn.reason).toBe('Damaged in transit');
    expect(cn.revenue).toBe(-15000);
    expect(cn.qty).toBe(-2);
  });

  it('narrows a document to the lines that belong to the row', () => {
    // INV-1 sold both brands; drilling into Star must show only the Ratava line.
    const inv1 = dig('company', 'Star').rows.find(r => r.id === 'INV-1');
    expect(inv1.lines.map(l => l.name)).toEqual(['Ratava']);
    expect(inv1.revenue).toBe(10000);
  });

  it('keeps every line of a document when the row is the whole document', () => {
    const inv1 = dig('customer', '1').rows.find(r => r.id === 'INV-1');
    expect(inv1.lines.map(l => l.name)).toEqual(['Antox 9', 'Ratava']);
  });

  it('names the customer as they are called today', () => {
    const rows = drillDown({
      dimension: 'customer', key: '1', ...base,
      customers: [{ ...CUSTOMERS[0], name: 'Al Shaheer Cattle' }],
    }).rows;
    expect(rows.every(r => r.customerName === 'Al Shaheer Cattle')).toBe(true);
  });

  it('counts invoices and returns separately', () => {
    const t = dig('customer', '1').totals;
    expect(t.invoices).toBe(2);
    expect(t.returns).toBe(1);
  });

  it('shows a bonus line as free stock, at its cost', () => {
    const bonus = dig('product', 'HeptaSef').rows.find(r => r.id === 'INV-2').lines[0];
    expect(bonus.isBonus).toBe(true);
    expect(bonus.revenue).toBe(0);
    expect(bonus.cost).toBe(4000);
    expect(bonus.profit).toBe(-4000);
  });

  it('ignores estimates and drafts, as every other figure does', () => {
    expect(dig('product', 'Antox 9').rows.map(r => r.id)).not.toContain('EST-1');
  });

  it('skips a document with no items rather than listing an empty row', () => {
    expect(dig('customer', '2').rows.map(r => r.id)).not.toContain('INV-4');
  });

  it('omits a document that contributed nothing once the brand filter is on', () => {
    const rows = dig('customer', '1', { filterCompanies: new Set(['20']) }).rows;
    expect(rows.map(r => r.id)).toEqual(['INV-1']);
  });

  it('is empty, not broken, for a key nothing matches', () => {
    const r = dig('product', 'Nothing Like This');
    expect(r.rows).toEqual([]);
    expect(r.totals).toEqual({ qty: 0, revenue: 0, cost: 0, profit: 0, invoices: 0, returns: 0 });
  });

  it('survives being called with nothing at all', () => {
    expect(() => drillDown()).not.toThrow();
    expect(drillDown().rows).toEqual([]);
  });

  it('names every dimension the screen can open', () => {
    expect(Object.keys(DIMENSIONS).sort())
      .toEqual(['area', 'city', 'company', 'customer', 'product', 'salesperson', 'type']);
  });
});

describe('marginTrend', () => {
  const rows = [
    { date: '2026-06-04', revenue: 10000, cost: 7000, profit: 3000, qty: 4 },
    { date: '2026-06-20', revenue: 10000, cost: 8000, profit: 2000, qty: 4 },
    { date: '2026-07-02', revenue: 20000, cost: 17000, profit: 3000, qty: 8 },
    { date: '2026-08-02', revenue: 20000, cost: 19000, profit: 1000, qty: 8 },
  ];

  it('reports margin per month, oldest first', () => {
    expect(marginTrend(rows).map(m => [m.month, m.marginPct]))
      .toEqual([['2026-06', 25], ['2026-07', 15], ['2026-08', 5]]);
  });

  it('sums the months rather than averaging their percentages', () => {
    expect(marginTrend(rows)[0]).toMatchObject({ revenue: 20000, profit: 5000, qty: 8, docs: 2 });
  });

  it('keeps only the most recent months asked for', () => {
    expect(marginTrend(rows, 2).map(m => m.month)).toEqual(['2026-07', '2026-08']);
  });

  it('does not divide by zero in a month that was all returns', () => {
    expect(marginTrend([{ date: '2026-06-01', revenue: 0, cost: 0, profit: 0, qty: 0 }])[0].marginPct).toBe(0);
  });

  it('ignores a row with no usable date, and is empty for nothing', () => {
    expect(marginTrend([{ date: '', revenue: 1, cost: 0, profit: 1, qty: 1 }])).toEqual([]);
    expect(marginTrend()).toEqual([]);
  });
});
