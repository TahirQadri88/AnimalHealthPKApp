import { describe, it, expect } from 'vitest';
import { buildCollections, classifyMethod, AT_BILLING, UNRECORDED } from './collections';
import { buildCustomerLedger } from '../accounting/ledger';

const CUSTOMERS = [
  { id: 1, name: 'Al Shaheer' },
  { id: 2, name: 'Ghousia Farms' },
];
const billed = (id, date, customerId, total, receivedAmount = 0, over = {}) =>
  ({ id, date, customerId, status: 'Billed', total, receivedAmount, items: [], salespersonName: 'Owais', ...over });
const receipt = (id, date, customerId, amount, over = {}) =>
  ({ id, date, customerId, amount, ...over });

const world = {
  customers: CUSTOMERS,
  invoices: [
    billed('INV-1', '2026-08-01', 1, 136000, 136000),
    billed('INV-2', '2026-08-02', 1, 27000),
    billed('INV-3', '2026-08-03', 2, 10000, 4000, { salespersonName: 'Ghousia' }),
  ],
  payments: [
    receipt('REC-1', '2026-08-05', 1, 20000, { note: 'Cheque No. 88213', discount: 0 }),
    receipt('REC-2', '2026-08-05', 2, 6000, { note: 'Cash', discount: 500 }),
  ],
};

const run = (over = {}) => buildCollections({ ...world, ...over });

describe('buildCollections — what actually came in', () => {
  it('counts cash taken at the counter, not only the payments collection', () => {
    // A view built from `payments` alone would report 26,000 of the 166,000 collected.
    expect(run().totals.received).toBe(166000);
    expect(run().totals.atBilling).toBe(140000);
    expect(run().totals.receipts).toBe(26000);
  });

  it('keeps a round-off discount apart from money received', () => {
    const t = run().totals;
    expect(t.received).toBe(166000);
    expect(t.discount).toBe(500);
    // What the ledger moves by is the two together.
    expect(t.credited).toBe(166500);
  });

  // The figure has to be the same one the ledger uses, or the two screens disagree.
  it('agrees with the customer ledger on total credit applied', () => {
    const ledgerCredit = CUSTOMERS
      .map(c => buildCustomerLedger(c.id, world).totalCredit)
      .reduce((s, n) => s + n, 0);
    expect(run().totals.credited).toBe(ledgerCredit);
  });

  it('ignores an invoice that was never billed', () => {
    const r = run({ invoices: [...world.invoices, { id: 'EST-1', date: '2026-08-04', customerId: 1, status: 'Estimate', receivedAmount: 99999 }] });
    expect(r.totals.received).toBe(166000);
  });

  it('is all zeroes on an empty business, rather than NaN', () => {
    const t = buildCollections().totals;
    expect(t).toEqual({ received: 0, discount: 0, credited: 0, count: 0, atBilling: 0, receipts: 0 });
  });
});

describe('buildCollections — the breakdowns', () => {
  it('splits by day, chronologically, because it is drawn as a trend', () => {
    expect(run().byDay.map(d => [d.key, d.amount]))
      .toEqual([['2026-08-01', 136000], ['2026-08-03', 4000], ['2026-08-05', 26000]]);
  });

  it('splits by customer, keyed by id and named by the customer record', () => {
    const c = run().byCustomer;
    expect(c[0]).toMatchObject({ key: '1', id: 1, name: 'Al Shaheer', amount: 156000, count: 2 });
    expect(c[1]).toMatchObject({ key: '2', name: 'Ghousia Farms', amount: 10000, count: 2 });
  });

  it('splits by method, with counter cash as its own bucket so the split foots', () => {
    const m = Object.fromEntries(run().byMethod.map(x => [x.key, x.amount]));
    expect(m[AT_BILLING]).toBe(140000);
    expect(m.Cheque).toBe(20000);
    expect(m.Cash).toBe(6000);
    expect(run().byMethod.reduce((s, x) => s + x.amount, 0)).toBe(run().totals.received);
  });

  it('attributes counter cash to the salesperson, and says receipts are unattributed', () => {
    const c = Object.fromEntries(run().byCollector.map(x => [x.key, x.amount]));
    expect(c.Owais).toBe(136000);
    expect(c.Ghousia).toBe(4000);
    // Payments carry no user. Saying so is better than guessing.
    expect(c[UNRECORDED]).toBe(26000);
  });

  it('lists every collection, newest first', () => {
    expect(run().rows.map(r => r.id))
      .toEqual(['REC-2', 'REC-1', 'INV-3-PAY', 'INV-1-PAY']);
  });

  it('honours the period filter', () => {
    const r = run({ checkCustomFilter: (d) => d >= '2026-08-05' });
    expect(r.totals.received).toBe(26000);
    expect(r.rows).toHaveLength(2);
  });

  it('honours the customer filter', () => {
    const r = run({ filterCustomers: new Set(['2']) });
    expect(r.totals.received).toBe(10000);
    expect(r.byCustomer).toHaveLength(1);
  });
});

// There is no method field on a payment — only a free-text "Mode / Note" box. This is a
// guess from a string a person typed, and every screen that shows it says so.
describe('classifyMethod', () => {
  it('reads the words people actually type', () => {
    expect(classifyMethod('Cheque No. 88213')).toBe('Cheque');
    expect(classifyMethod('chq 4471')).toBe('Cheque');
    expect(classifyMethod('Cash Payment')).toBe('Cash');
    expect(classifyMethod('Bank transfer IBFT')).toBe('Bank Transfer');
    expect(classifyMethod('easypaisa')).toBe('Online');
    expect(classifyMethod('JazzCash')).toBe('Online');
  });

  it('calls a cheque deposited at a bank a cheque', () => {
    expect(classifyMethod('Cheque deposited in bank')).toBe('Cheque');
  });

  it('does not invent a method it cannot see', () => {
    expect(classifyMethod('')).toBe('Unspecified');
    expect(classifyMethod(undefined)).toBe('Unspecified');
    expect(classifyMethod('adjustment')).toBe('Other');
  });
});
