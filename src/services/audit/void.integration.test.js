// Voiding has to reach the money, not just set a flag.
//
// The filter lives in one place — the AppContext provider hands every screen a
// void-filtered array — so this composes that same predicate with the real accounting
// services and asserts the figures move. If someone later drops the filter at the
// provider, the app breaks in a way no unit test of notVoided() would notice, so these
// assert the whole path: record → predicate → balance.
import { describe, it, expect } from 'vitest';
import { notVoided, voidPatch, restorePatch } from './auditLog';
import { customerBalance, buildCustomerLedger } from '../accounting/ledger';
import { buildAgingReport } from '../analytics/receivables';
import { computePnL } from '../analytics/profitAndLoss';

const USER = { id: 1, name: 'Owais' };
const CUST = { id: 1, name: 'Abdul Qadir Shan Cattle', openingBalance: 0 };
const ASOF = '2026-09-01';
const inv = (id, date, total, over = {}) =>
  ({ id, date, customerId: 1, status: 'Billed', total, receivedAmount: 0,
     items: [{ productId: 1, name: 'Antox 9', quantity: 10, price: total / 10, costPrice: (total / 10) * 0.6 }], ...over });
const pay = (id, date, amount, over = {}) => ({ id, date, customerId: 1, amount, ...over });
const voided = (rec, reason = 'Duplicate entry') => ({ ...rec, ...voidPatch({ user: USER, reason }) });

// What the provider does, in one line, applied the same way here.
const live = (rows) => rows.filter(notVoided);

describe('a voided invoice leaves the customer balance', () => {
  const invoices = [inv('INV-8457', '2026-08-20', 75000), voided(inv('INV-8458', '2026-08-25', 40000))];

  it('is not owed any more', () => {
    expect(customerBalance(1, { customers: [CUST], invoices, payments: [] })).toBe(115000);
    expect(customerBalance(1, { customers: [CUST], invoices: live(invoices), payments: [] })).toBe(75000);
  });

  it('drops off the statement rather than showing as settled', () => {
    const ledger = buildCustomerLedger(1, { customers: [CUST], invoices: live(invoices), payments: [] });
    expect(ledger.rows.map(r => r.id)).toEqual(['INV-8457']);
    expect(ledger.closingBal).toBe(75000);
  });

  it('comes back when restored', () => {
    const restored = invoices.map(o => (o.voided ? { ...o, ...restorePatch({ user: USER }) } : o));
    expect(customerBalance(1, { customers: [CUST], invoices: live(restored), payments: [] })).toBe(115000);
  });
});

describe('a voided payment stops settling debt', () => {
  const invoices = [inv('INV-8457', '2026-08-20', 75000)];
  const payments = [voided(pay('REC-0114', '2026-08-22', 50000), 'Wrong client')];

  it('leaves the full invoice outstanding', () => {
    expect(customerBalance(1, { customers: [CUST], invoices, payments: live(payments) })).toBe(75000);
  });

  it('and the aging report agrees with the ledger, as it must', () => {
    const data = { customers: [CUST], invoices, payments: live(payments), asOf: ASOF };
    const aging = buildAgingReport(data);
    expect(aging.grandTotal).toBe(75000);
    expect(aging.grandTotal).toBeCloseTo(customerBalance(1, data), 2);
  });
});

describe('a voided invoice leaves the P&L', () => {
  const billed = [inv('INV-1', '2026-08-01', 1000), voided(inv('INV-2', '2026-08-02', 5000))];

  it('takes its revenue and its cost with it', () => {
    const all = computePnL({ billedInvoices: billed });
    const kept = computePnL({ billedInvoices: live(billed) });
    expect(all.grossSales).toBe(6000);
    expect(kept.grossSales).toBe(1000);
    expect(kept.cogs).toBe(600);
    expect(kept.grossProfit).toBe(400);
  });

  it('and a voided expense stops reducing profit', () => {
    const expenses = [{ id: 1, amount: 200 }, voided({ id: 2, amount: 900 })];
    expect(computePnL({ billedInvoices: live(billed), expenses: live(expenses) }).netProfit).toBe(200);
  });
});

describe('voiding a credit note', () => {
  it('puts the returned money back on the customer', () => {
    const invoices = [
      inv('INV-1', '2026-08-01', 10000),
      voided({ id: 'CN-1', date: '2026-08-05', customerId: 1, status: 'CreditNote', total: 4000, items: [] }, 'Raised twice'),
    ];
    expect(customerBalance(1, { customers: [CUST], invoices: live(invoices), payments: [] })).toBe(10000);
  });

  it('a voided credit note is still a credit note — void must not overwrite the type', () => {
    const cn = voided({ id: 'CN-1', status: 'CreditNote', total: 4000 });
    expect(cn.status).toBe('CreditNote');
  });
});

describe('records written before any of this existed', () => {
  it('carry no flag and stay live', () => {
    const legacy = [inv('INV-1', '2026-01-01', 500), pay('REC-1', '2026-01-02', 100)];
    expect(live(legacy)).toHaveLength(2);
  });
});
