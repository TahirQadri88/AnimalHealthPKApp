import { describe, it, expect } from 'vitest';
import { buildAgingReport, customerAging, bucketFor } from './receivables';
import { customerBalance } from '../accounting/ledger';

const ASOF = '2026-08-31';
const CUST = { id: 1, name: 'Al Shaheer', phone: '0300', openingBalance: 0 };
const billed = (id, date, total, receivedAmount = 0) =>
  ({ id, date, customerId: 1, status: 'Billed', total, receivedAmount, items: [] });
const data = (over = {}) => ({ customers: [CUST], invoices: [], payments: [], asOf: ASOF, ...over });

describe('bucketFor', () => {
  it('maps ages to buckets at the boundaries', () => {
    expect(bucketFor(0).key).toBe('current');
    expect(bucketFor(30).key).toBe('current');
    expect(bucketFor(31).key).toBe('d31_60');
    expect(bucketFor(60).key).toBe('d31_60');
    expect(bucketFor(61).key).toBe('d61_90');
    expect(bucketFor(90).key).toBe('d61_90');
    expect(bucketFor(91).key).toBe('d90plus');
    expect(bucketFor(3650).key).toBe('d90plus');
  });
});

describe('customerAging', () => {
  it('is null for an unknown customer', () => {
    expect(customerAging(999, data())).toBeNull();
  });

  it('ages an unpaid invoice from its date', () => {
    const a = customerAging(1, data({ invoices: [billed('INV-1', '2026-08-25', 5000)] }));
    expect(a.totalOutstanding).toBe(5000);
    expect(a.oldestAgeDays).toBe(6);
    expect(a.buckets.current).toBe(5000);
  });

  it('puts an old invoice in the 90+ bucket', () => {
    const a = customerAging(1, data({ invoices: [billed('INV-1', '2026-01-01', 5000)] }));
    expect(a.buckets.d90plus).toBe(5000);
    expect(a.buckets.current).toBe(0);
  });

  it('splits one customer across buckets', () => {
    const a = customerAging(1, data({
      invoices: [
        billed('INV-1', '2026-08-20', 1000),  // 11 days  → current
        billed('INV-2', '2026-07-15', 2000),  // 47 days  → 31–60
        billed('INV-3', '2026-04-01', 3000),  // 152 days → 90+
      ],
    }));
    expect(a.buckets.current).toBe(1000);
    expect(a.buckets.d31_60).toBe(2000);
    expect(a.buckets.d90plus).toBe(3000);
    expect(a.totalOutstanding).toBe(6000);
    expect(a.oldestAgeDays).toBe(152);
  });

  it('a fully paid customer does not appear', () => {
    const a = customerAging(1, data({
      invoices: [billed('INV-1', '2026-08-01', 5000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-10', amount: 5000 }],
    }));
    expect(a.totalOutstanding).toBe(0);
    expect(a.open).toHaveLength(0);
  });

  it('clears the OLDEST debt first, so what remains is the newest', () => {
    const a = customerAging(1, data({
      invoices: [billed('INV-OLD', '2026-04-01', 3000), billed('INV-NEW', '2026-08-25', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-26', amount: 3000 }],
    }));
    expect(a.buckets.d90plus).toBe(0);
    expect(a.buckets.current).toBe(2000);
  });

  it('keeps cash taken at billing time with its own invoice', () => {
    // The new invoice was paid at the counter; it must not be re-opened just because an
    // older one is outstanding.
    const a = customerAging(1, data({
      invoices: [billed('INV-OLD', '2026-04-01', 3000), billed('INV-NEW', '2026-08-25', 2000, 2000)],
    }));
    expect(a.buckets.current).toBe(0);
    expect(a.buckets.d90plus).toBe(3000);
  });

  it('treats an opening balance as the oldest debt', () => {
    const a = customerAging(1, data({
      customers: [{ ...CUST, openingBalance: 4000 }],
      invoices: [billed('INV-1', '2026-01-10', 1000)],
    }));
    expect(a.totalOutstanding).toBe(5000);
    expect(a.buckets.d90plus).toBe(5000);
    expect(a.open[0].isOpening).toBe(true);
  });

  it('does not age a brand-new opening balance into 90+', () => {
    const a = customerAging(1, data({ customers: [{ ...CUST, openingBalance: 4000 }] }));
    expect(a.buckets.current).toBe(4000);
  });

  it('reports a customer in credit rather than a negative bucket', () => {
    const a = customerAging(1, data({
      invoices: [billed('INV-1', '2026-08-01', 1000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 1500 }],
    }));
    expect(a.totalOutstanding).toBe(0);
    expect(a.creditBalance).toBe(500);
  });

  it('counts credit notes and payment discounts as settlement', () => {
    const a = customerAging(1, data({
      invoices: [
        billed('INV-1', '2026-08-01', 5000),
        { id: 'CN-1', date: '2026-08-05', customerId: 1, status: 'CreditNote', total: 2000, items: [] },
      ],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-06', amount: 2900, discount: 100 }],
    }));
    expect(a.totalOutstanding).toBe(0);
  });
});

// The report is worthless if it disagrees with the ledger the user already trusts.
describe('aging total always equals the ledger balance', () => {
  const scenarios = [
    ['simple debt', data({ invoices: [billed('INV-1', '2026-08-01', 5000)] })],
    ['part paid', data({
      invoices: [billed('INV-1', '2026-08-01', 5000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-10', amount: 1800 }],
    })],
    ['opening balance plus invoices', data({
      customers: [{ ...CUST, openingBalance: 2500 }],
      invoices: [billed('INV-1', '2026-06-01', 3000), billed('INV-2', '2026-08-20', 1500)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-21', amount: 4000 }],
    })],
    ['with a credit note and an on-invoice payment', data({
      customers: [{ ...CUST, openingBalance: 1000 }],
      invoices: [
        billed('INV-1', '2026-05-01', 4000, 1000),
        billed('INV-2', '2026-08-01', 2500),
        { id: 'CN-1', date: '2026-08-10', customerId: 1, status: 'CreditNote', total: 900, items: [] },
      ],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-12', amount: 1200, discount: 50 }],
    })],
  ];

  scenarios.forEach(([name, d]) => {
    it(name, () => {
      const aging = customerAging(1, d);
      const ledger = customerBalance(1, d);
      expect(aging.totalOutstanding - aging.creditBalance).toBeCloseTo(ledger, 2);
    });
  });
});

describe('buildAgingReport', () => {
  const CUST2 = { id: 2, name: 'Ghousia Farms', openingBalance: 0 };

  it('lists only customers who owe, worst age first', () => {
    const d = {
      customers: [CUST, CUST2],
      invoices: [
        billed('INV-1', '2026-08-28', 1000),
        { ...billed('INV-2', '2026-03-01', 7000), customerId: 2 },
      ],
      payments: [],
      asOf: ASOF,
    };
    const r = buildAgingReport(d);
    expect(r.rows.map(x => x.name)).toEqual(['Ghousia Farms', 'Al Shaheer']);
    expect(r.customerCount).toBe(2);
    expect(r.grandTotal).toBe(8000);
    expect(r.totals.d90plus).toBe(7000);
    expect(r.totals.current).toBe(1000);
  });

  it('excludes settled customers entirely', () => {
    const d = {
      customers: [CUST, CUST2],
      invoices: [billed('INV-1', '2026-08-01', 1000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-02', amount: 1000 }],
      asOf: ASOF,
    };
    expect(buildAgingReport(d).customerCount).toBe(0);
    expect(buildAgingReport(d).grandTotal).toBe(0);
  });

  it('is empty rather than throwing with no data', () => {
    const r = buildAgingReport({ asOf: ASOF });
    expect(r.rows).toEqual([]);
    expect(r.grandTotal).toBe(0);
  });
});
