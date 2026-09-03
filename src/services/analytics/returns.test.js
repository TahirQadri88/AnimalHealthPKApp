import { describe, it, expect } from 'vitest';
import { buildReturns, normaliseReason, NO_REASON } from './returns';
import { buildReport } from './reportEngine';

const PRODUCTS = [
  { id: 1, name: 'Antox 9', companyId: 10 },
  { id: 2, name: 'Ratava', companyId: 20 },
];
const CUSTOMERS = [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Ghousia Farms' }];
const it_ = (productId, name, qty, price, cost, company) =>
  ({ productId, name, quantity: qty, price, costPrice: cost, company });

const doc = (id, date, status, customerId, items, over = {}) => ({
  id, date, status, customerId,
  customerName: CUSTOMERS.find(c => c.id === customerId)?.name,
  salespersonId: 1, salespersonName: 'Owais', total: 0, items, ...over,
});

const INVOICES = [
  doc('INV-1', '2026-08-01', 'Billed', 1, [it_(1, 'Antox 9', 10, 7500, 6000, 'Selmore')]),
  doc('INV-2', '2026-08-02', 'Billed', 2, [it_(2, 'Ratava', 20, 2000, 1500, 'Star')]),
  doc('CN-1', '2026-08-20', 'CreditNote', 1, [it_(1, 'Antox 9', 2, 7500, 6000, 'Selmore')],
      { reason: 'Expired', originalInvoiceId: 'INV-1' }),
  doc('CN-2', '2026-08-21', 'CreditNote', 2, [it_(2, 'Ratava', 5, 2000, 1500, 'Star')],
      { reason: 'expired ', originalInvoiceId: 'INV-2' }),
  doc('CN-3', '2026-08-22', 'CreditNote', 1, [it_(1, 'Antox 9', 1, 7500, 6000, 'Selmore')], { reason: '' }),
];

const base = {
  invoices: INVOICES, products: PRODUCTS, customers: CUSTOMERS,
  checkCustomFilter: () => true,
  filterCompanies: new Set(), filterCustomers: new Set(), filterSalespersons: new Set(),
};
const run = (over = {}) => buildReturns({ ...base, ...over });

describe('buildReturns — the headline', () => {
  it('totals what came back, in value, cost and units', () => {
    const t = run().totals;
    expect(t.value).toBe(32500);   // 15,000 + 10,000 + 7,500
    expect(t.cost).toBe(25500);    // 12,000 + 7,500 + 6,000
    expect(t.units).toBe(8);
    expect(t.count).toBe(3);
  });

  // The one figure Analytics already had. If these disagree, one of them is wrong.
  it('agrees with the engine on total returns value', () => {
    const engine = buildReport({
      ...base, expenses: [], payments: [],
      getCustomerBalance: () => 0, getPaymentStatus: () => 'Pending',
      dateFilter: 'All Time', customStart: '', customEnd: '',
    });
    expect(run().totals.value).toBe(engine.kpis.creditNotesTotal);
  });

  // Measured against what went out, not against what is left after returns — netting the
  // denominator would flatter the number exactly when returns are worst.
  it('states the return rate against gross sales in the same period', () => {
    const t = run().totals;
    expect(t.grossSales).toBe(115000);            // 75,000 + 40,000
    expect(t.ratePct).toBe(28.26);                // 32,500 / 115,000
  });

  it('does not divide by zero in a period with returns and no sales', () => {
    const t = run({ invoices: INVOICES.filter(o => o.status === 'CreditNote') }).totals;
    expect(t.ratePct).toBe(0);
    expect(t.value).toBe(32500);
  });

  it('is all zeroes on an empty business', () => {
    const t = buildReturns().totals;
    expect(t.value).toBe(0);
    expect(t.count).toBe(0);
    expect(t.ratePct).toBe(0);
  });
});

describe('buildReturns — why it came back', () => {
  it('groups the free-text reason case- and space-insensitively', () => {
    const r = run().byReason;
    const expired = r.find(x => x.key.toLowerCase().trim() === 'expired');
    expect(expired.value).toBe(25000);
    expect(expired.count).toBe(2);
  });

  it('names the missing reason instead of dropping the row', () => {
    const none = run().byReason.find(x => x.key === NO_REASON);
    expect(none.value).toBe(7500);
    expect(run().totals.withoutReason).toBe(1);
  });

  it('normalises a reason the same way everywhere', () => {
    expect(normaliseReason(' Expired ')).toBe('Expired');
    expect(normaliseReason('')).toBe(NO_REASON);
    expect(normaliseReason(undefined)).toBe(NO_REASON);
  });
});

describe('buildReturns — who and what', () => {
  it('splits by product and by brand', () => {
    expect(run().byProduct.find(p => p.key === 'Antox 9')).toMatchObject({ value: 22500, units: 3 });
    expect(run().byCompany.find(c => c.key === 'Star')).toMatchObject({ value: 10000, units: 5 });
  });

  it('splits by customer, keyed by id', () => {
    const c = run().byCustomer;
    expect(c.find(x => x.key === '1')).toMatchObject({ name: 'Al Shaheer', value: 22500, count: 2 });
    expect(c.find(x => x.key === '2')).toMatchObject({ name: 'Ghousia Farms', value: 10000, count: 1 });
  });

  it('says how long the stock was out before it came back', () => {
    const rows = run().rows;
    expect(rows.find(r => r.id === 'CN-1').daysSinceSale).toBe(19);
    // No original invoice recorded means no answer, not a wrong one.
    expect(rows.find(r => r.id === 'CN-3').daysSinceSale).toBeNull();
  });

  it('lists the credit notes newest first', () => {
    expect(run().rows.map(r => r.id)).toEqual(['CN-3', 'CN-2', 'CN-1']);
  });
});

describe('buildReturns — filters', () => {
  it('honours the brand filter, on the rate as well as the value', () => {
    const t = run({ filterCompanies: new Set(['10']) }).totals;
    expect(t.value).toBe(22500);
    expect(t.grossSales).toBe(75000);
    expect(t.count).toBe(2);
  });

  it('drops a credit note whose every line the brand filter excluded', () => {
    expect(run({ filterCompanies: new Set(['10']) }).rows.map(r => r.id)).not.toContain('CN-2');
  });

  it('honours the period filter', () => {
    expect(run({ checkCustomFilter: (d) => d >= '2026-08-22' }).totals.count).toBe(1);
  });

  it('honours the customer filter', () => {
    const t = run({ filterCustomers: new Set(['2']) }).totals;
    expect(t.value).toBe(10000);
  });
});
