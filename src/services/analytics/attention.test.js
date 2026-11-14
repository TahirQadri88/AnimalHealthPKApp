import { describe, it, expect } from 'vitest';
import { debtWatch, salesByKey, movers, marginAlerts, lapsedCustomers } from './attention';
import { buildReport } from './reportEngine';
import { buildAgingReport } from './receivables';
import { buildCustomerLedger } from '../accounting/ledger';

const MILK = 'MILK POWDER 20KG (26-28% Milk Fat with 34% Protein) Imported Calf Milk Replacer';
const customers = [
  { id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' },
  { id: 2, name: 'Al-Madina Dairy Farm', phone: '0321-7654321', openingBalance: 5000 },
  { id: 3, name: 'Cash Sale' },
];
const products = [{ id: 10, name: MILK, companyId: 4 }, { id: 11, name: 'Antox 9', companyId: 1 }];
const line = (productId, name, quantity, price, costPrice, company, extra = {}) => ({ productId, name, quantity, price, costPrice, company, ...extra });
const bill = (id, date, customerId, total, items, extra = {}) => ({ id, date, customerId, status: 'Billed', total, items, salespersonId: 1, salespersonName: 'Owais', ...extra });
const invoices = [
  bill('INV-1', '2026-08-01', 1, 10000, [line(10, MILK, 4, 2500, 1900, 'Star')]),
  bill('INV-2', '2026-08-15', 1, 10000, [line(10, MILK, 4, 2500, 1900, 'Star')]),
  bill('INV-3', '2026-09-01', 1, 10000, [line(10, MILK, 4, 2500, 1900, 'Star')]),
  bill('INV-4', '2026-10-03', 2, 9000, [line(11, 'Antox 9', 10, 800, 700, 'Leads'), line(10, MILK, 1, 1000, 1900, 'Star')]),
  bill('INV-5', '2026-11-04', 2, 12000, [line(11, 'Antox 9', 15, 800, 790, 'Leads')]),
  bill('INV-6', '2026-11-06', 3, 2500, [line(10, MILK, 1, 2500, 1900, 'Star'), line(11, 'Antox 9', 2, 0, 700, 'Leads', { isBonus: true })], { receivedAmount: 2500 }),
  { id: 'CN-1', date: '2026-11-08', customerId: 2, status: 'CreditNote', total: 800, items: [line(11, 'Antox 9', 1, 800, 790, 'Leads')], salespersonId: 1 },
];
const payments = [{ id: 'REC-1', date: '2026-09-10', customerId: 1, amount: 20000 }, { id: 'REC-2', date: '2026-10-20', customerId: 2, amount: 3000 }];
const asOf = '2026-11-14';

describe('debtWatch', () => {
  const d = debtWatch({ customers, invoices, payments, asOf, periodStart: '2026-11-01' });
  it('growing debt is the ledger now minus the ledger at the start of the period', () => {
    const g = d.growing.find(r => r.id === 2);
    const ledger = buildCustomerLedger(2, { customers, invoices, payments });
    expect(g.balance).toBe(ledger.closingBal);
    expect(g.then).toBe(5000 + 9000 - 3000);
    expect(g.change).toBe(12000 - 800);
    expect(d.growing.some(r => r.id === 1)).toBe(false);
  });
  it('late reconciles with the aging report: same customers, same overdue money', () => {
    const aging = buildAgingReport({ customers, invoices, payments, asOf });
    const expected = aging.rows.filter(r => r.oldestAgeDays > 30);
    expect(d.late.map(r => r.id).sort()).toEqual(expected.map(r => r.customerId).sort());
    const overdue = expected.reduce((s, r) => s + r.open.filter(o => o.ageDays > 30).reduce((x, o) => x + o.outstanding, 0), 0);
    expect(d.late.reduce((s, r) => s + r.overdue, 0)).toBeCloseTo(overdue, 6);
  });
  it('quiet: owes money and nothing paid for 30 days', () => {
    // Customer 1 owes Rs 10,000 and last paid on 10 Sep (65 days). Customer 2 owes more but
    // paid on 20 Oct (25 days), so is not quiet. Cash Sale paid on the bill.
    expect(d.quiet.map(r => r.id)).toEqual([1]);
    expect(d.quiet[0]).toMatchObject({ balance: 10000, lastPayment: '2026-09-10', daysSincePayment: 65 });
  });
  it('no period, no growing list; a client filter narrows every list', () => {
    expect(debtWatch({ customers, invoices, payments, asOf }).growing).toEqual([]);
    const only = debtWatch({ customers, invoices, payments, asOf, periodStart: '2026-11-01', onlyCustomers: new Set(['1']) });
    [...only.growing, ...only.late, ...only.quiet].forEach(r => expect(r.id).toBe(1));
  });
});

describe('salesByKey reconciles with the breakdown tables', () => {
  const window = { start: '2026-11-01', end: '2026-11-14' };
  const inWin = (dt) => dt >= window.start && dt <= window.end;
  const engine = (over = {}) => buildReport({
    invoices, expenses: [], payments, products, customers,
    filterCompanies: new Set(), filterCustomers: new Set(), filterSalespersons: new Set(),
    checkCustomFilter: inWin, getCustomerBalance: () => 0, getPaymentStatus: () => 'Pending',
    dateFilter: 'Custom', customStart: window.start, customEnd: window.end, ...over,
  });
  for (const [name, over] of [['no filter', {}], ['brand filter', { filterCompanies: new Set(['1']) }], ['client filter', { filterCustomers: new Set(['2']) }]]) {
    it(`product and brand rows equal the engine's (${name})`, () => {
      const r = engine(over);
      const p = salesByKey({ invoices, products, window, dimension: 'product', ...over });
      const c = salesByKey({ invoices, products, window, dimension: 'company', ...over });
      Object.entries(r.byProduct).forEach(([k, v]) => { expect(p[k].revenue).toBeCloseTo(v.revenue, 6); expect(p[k].profit).toBeCloseTo(v.profit, 6); });
      Object.entries(r.byCompany).forEach(([k, v]) => { expect(c[k].revenue).toBeCloseTo(v.revenue, 6); expect(c[k].profit).toBeCloseTo(v.profit, 6); });
      expect(Object.keys(p).sort()).toEqual(Object.keys(r.byProduct).sort());
    });
  }
});

describe('movers', () => {
  it('ranks by change in gross profit, rising and falling', () => {
    const m = movers({ current: { A: { revenue: 100, profit: 50 }, B: { revenue: 10, profit: 2 } }, previous: { A: { revenue: 80, profit: 20 }, B: { revenue: 90, profit: 40 }, C: { revenue: 5, profit: 3 } } });
    expect(m.rising.map(r => r.key)).toEqual(['A']);
    expect(m.falling.map(r => r.key)).toEqual(['B', 'C']);
    expect(m.rising[0].changePct).toBe(150);
    expect(m.falling.find(r => r.key === 'C').profit).toBe(0);
  });
});

describe('marginAlerts', () => {
  const window = { start: '2026-10-01', end: '2026-11-14' };
  const m = marginAlerts({ invoices, products, customers, window });
  it('finds the line sold below cost, with the loss, and thin lines under 5%', () => {
    expect(m.below).toHaveLength(1);
    expect(m.below[0]).toMatchObject({ invoiceId: 'INV-4', name: MILK, price: 1000, cost: 1900, gap: -900, customer: 'Al-Madina Dairy Farm' });
    expect(m.belowLoss).toBe(-900);
    expect(m.thin.map(r => r.invoiceId)).toEqual(['INV-5']);
  });
  it('ignores bonus lines, lines with no cost, and the window', () => {
    expect([...m.below, ...m.thin].some(r => r.invoiceId === 'INV-6')).toBe(false);
    expect(marginAlerts({ invoices, products, customers, window: { start: '2026-11-01', end: '2026-11-14' } }).below).toHaveLength(0);
  });
});

describe('lapsedCustomers', () => {
  it('flags a regular whose silence is past twice their usual gap', () => {
    const l = lapsedCustomers({ customers, invoices, asOf });
    expect(l.map(r => r.id)).toEqual([1]);
    expect(l[0]).toMatchObject({ lastBill: '2026-09-01', lastBillId: 'INV-3', usualGap: 16, daysSince: 74, bills: 3, phone: '0300-1234567' });
  });
  it('not flagged before the threshold, nor with too few bills', () => {
    expect(lapsedCustomers({ customers, invoices, asOf: '2026-09-30' })).toEqual([]);
    expect(lapsedCustomers({ customers, invoices, asOf, minBills: 4 })).toEqual([]);
  });
});
