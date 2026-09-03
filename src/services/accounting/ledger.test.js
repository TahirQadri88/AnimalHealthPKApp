import { describe, it, expect } from 'vitest';
import { buildCustomerLedger, customerBalance } from './ledger';

const CUST = { id: 1, name: 'Al Shaheer Cattle', phone: '0300', openingBalance: 0 };
const data = (over = {}) => ({ customers: [CUST], invoices: [], payments: [], ...over });

const billed = (id, date, total, receivedAmount = 0) =>
  ({ id, date, customerId: 1, status: 'Billed', total, receivedAmount, items: [] });

describe('buildCustomerLedger', () => {
  it('returns null for a customer that does not exist', () => {
    expect(buildCustomerLedger(999, data())).toBeNull();
  });

  it('starts from the opening balance', () => {
    const d = data({ customers: [{ ...CUST, openingBalance: 5000 }] });
    const l = buildCustomerLedger(1, d);
    expect(l.openingBal).toBe(5000);
    expect(l.closingBal).toBe(5000);
  });

  it('an invoice increases what the customer owes', () => {
    const l = buildCustomerLedger(1, data({ invoices: [billed('INV-1', '2026-08-01', 3900)] }));
    expect(l.closingBal).toBe(3900);
    expect(l.totalDebit).toBe(3900);
  });

  it('cash taken at billing time reduces it, as a separate row', () => {
    const l = buildCustomerLedger(1, data({ invoices: [billed('INV-1', '2026-08-01', 3900, 1000)] }));
    expect(l.rows).toHaveLength(2);
    expect(l.rows[0].desc).toBe('Sales Invoice');
    expect(l.rows[1].desc).toBe('Payment (On Invoice)');
    expect(l.closingBal).toBe(2900);
  });

  it('a later receipt reduces it', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [billed('INV-1', '2026-08-01', 3900)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 2000 }],
    }));
    expect(l.closingBal).toBe(1900);
  });

  it('counts a payment discount as credit — the customer is forgiven it', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [billed('INV-1', '2026-08-01', 3900)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 3800, discount: 100 }],
    }));
    expect(l.closingBal).toBe(0);
    expect(l.rows[1].desc).toContain('Discount');
  });

  it('a credit note reduces it', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [
        billed('INV-1', '2026-08-01', 3900),
        { id: 'CN-1', date: '2026-08-03', customerId: 1, status: 'CreditNote', total: 900, items: [] },
      ],
    }));
    expect(l.closingBal).toBe(3000);
  });

  it('ignores estimates and draft orders — only billed invoices are debt', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [
        billed('INV-1', '2026-08-01', 3900),
        { id: 'EST-1', date: '2026-08-02', customerId: 1, status: 'Estimate', total: 9999, items: [] },
        { id: 'ORD-1', date: '2026-08-02', customerId: 1, status: 'Booked', total: 8888, items: [] },
      ],
    }));
    expect(l.closingBal).toBe(3900);
  });

  it('ignores other customers', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [billed('INV-1', '2026-08-01', 3900), { ...billed('INV-2', '2026-08-01', 5000), customerId: 2 }],
      payments: [{ id: 'REC-1', customerId: 2, date: '2026-08-02', amount: 1000 }],
    }));
    expect(l.closingBal).toBe(3900);
  });

  it('orders same-day entries invoice → on-invoice payment → receipt → credit note', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [
        billed('INV-1', '2026-08-01', 3900, 500),
        { id: 'CN-1', date: '2026-08-01', customerId: 1, status: 'CreditNote', total: 400, items: [] },
      ],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-01', amount: 1000 }],
    }));
    expect(l.rows.map(r => r.id)).toEqual(['INV-1', 'INV-1-PAY', 'REC-1', 'CN-1']);
  });

  // Reported 2026-09-03: two bills for one customer on one day, the first paid in full at
  // the counter, and the second still printed "Previous Balance Rs. 136,000".
  //
  // The +0/+1/+2/+3 same-day nudges are per-DAY slots, so every invoice of the day sorted
  // ahead of every on-invoice payment of the day: INV-8475, INV-8476, INV-8475-PAY. The row
  // immediately before INV-8476 was therefore the unpaid INV-8475 debit, and that row is
  // exactly what the printed Previous Balance reads. Cash taken at billing belongs to ITS
  // OWN invoice, not to a slot shared with every other invoice that day.
  it('keeps cash taken at billing directly under its own invoice, not after later bills', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [
        billed('INV-8475', '2026-09-03', 136000, 136000),
        billed('INV-8476', '2026-09-03', 27000),
      ],
    }));
    expect(l.rows.map(r => r.id)).toEqual(['INV-8475', 'INV-8475-PAY', 'INV-8476']);
    // The balance carried into the second bill is nil — the first one was settled.
    expect(l.rows.map(r => r.balance)).toEqual([136000, 0, 27000]);
    expect(l.closingBal).toBe(27000);
  });

  it('pairs each invoice with its own cash when three bills land on one day', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [
        billed('INV-3', '2026-09-03', 3000, 3000),
        billed('INV-1', '2026-09-03', 1000, 400),
        billed('INV-2', '2026-09-03', 2000),
      ],
    }));
    expect(l.rows.map(r => r.id))
      .toEqual(['INV-1', 'INV-1-PAY', 'INV-2', 'INV-3', 'INV-3-PAY']);
    expect(l.rows.map(r => r.balance)).toEqual([1000, 600, 2600, 5600, 2600]);
  });

  it('runs the balance forward across several dates', () => {
    const l = buildCustomerLedger(1, data({
      customers: [{ ...CUST, openingBalance: 1000 }],
      invoices: [billed('INV-1', '2026-08-01', 3000), billed('INV-2', '2026-08-10', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 2500 }],
    }));
    expect(l.rows.map(r => r.balance)).toEqual([4000, 1500, 3500]);
    expect(l.closingBal).toBe(3500);
    expect(l.totalDebit).toBe(5000);
    expect(l.totalCredit).toBe(2500);
  });

  it('settles to zero when everything is paid', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [billed('INV-1', '2026-08-01', 3900)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 3900 }],
    }));
    expect(l.closingBal).toBe(0);
  });

  it('goes negative when the customer is in credit', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [billed('INV-1', '2026-08-01', 1000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 1500 }],
    }));
    expect(l.closingBal).toBe(-500);
  });

  it('does not produce NaN when an amount is missing', () => {
    const l = buildCustomerLedger(1, data({
      invoices: [{ id: 'INV-1', date: '2026-08-01', customerId: 1, status: 'Billed', items: [] }],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05' }],
    }));
    expect(Number.isNaN(l.closingBal)).toBe(false);
    expect(l.closingBal).toBe(0);
  });
});

describe('customerBalance', () => {
  it('is the ledger closing balance', () => {
    const d = data({ invoices: [billed('INV-1', '2026-08-01', 3900)] });
    expect(customerBalance(1, d)).toBe(3900);
  });

  it('is zero for an unknown customer rather than throwing', () => {
    expect(customerBalance(999, data())).toBe(0);
  });
});

import { allocateCredits, statusFromSettled, invoicePaymentStatus, PAID, PARTIAL, PENDING } from './ledger';

describe('statusFromSettled', () => {
  it('classifies the three states', () => {
    expect(statusFromSettled(3900, 3900)).toBe(PAID);
    expect(statusFromSettled(3900, 1000)).toBe(PARTIAL);
    expect(statusFromSettled(3900, 0)).toBe(PENDING);
  });

  it('treats a rounding shortfall as paid', () => {
    expect(statusFromSettled(3900, 3899.6)).toBe(PAID);
    expect(statusFromSettled(3900, 3890)).toBe(PARTIAL);
  });

  it('a zero-value invoice is paid, not pending', () => {
    expect(statusFromSettled(0, 0)).toBe(PAID);
  });
});

describe('allocateCredits — oldest invoice first', () => {
  it('settles an invoice from cash taken at billing time', () => {
    const d = data({ invoices: [billed('INV-1', '2026-08-01', 3900, 3900)] });
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PAID);
  });

  it('THE BUG: a later receipt now marks the invoice paid', () => {
    // Previously this invoice kept saying Pending, on screen and on the printed document,
    // because the receipt was recorded against the customer and nothing updated the flag.
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 3900)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 3900 }],
    });
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PAID);
  });

  it('pays the oldest invoice off before touching the next', () => {
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 3000), billed('INV-2', '2026-08-10', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-12', amount: 3500 }],
    });
    const settled = allocateCredits(1, d);
    expect(settled.get('INV-1')).toBe(3000);
    expect(settled.get('INV-2')).toBe(500);
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PAID);
    expect(invoicePaymentStatus(d.invoices[1], d)).toBe(PARTIAL);
  });

  it('leaves later invoices pending when credit runs out', () => {
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 3000), billed('INV-2', '2026-08-10', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-12', amount: 3000 }],
    });
    expect(invoicePaymentStatus(d.invoices[1], d)).toBe(PENDING);
  });

  it('counts a credit note as credit', () => {
    const d = data({
      invoices: [
        billed('INV-1', '2026-08-01', 3900),
        { id: 'CN-1', date: '2026-08-03', customerId: 1, status: 'CreditNote', total: 3900, items: [] },
      ],
    });
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PAID);
  });

  it('counts a payment discount as credit', () => {
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 3900)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-05', amount: 3800, discount: 100 }],
    });
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PAID);
  });

  it('keeps cash collected on an invoice with that invoice, not the oldest', () => {
    // INV-2 was paid in full at the counter. It must not be re-opened just because an
    // older invoice is still outstanding.
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 3000), billed('INV-2', '2026-08-10', 2000, 2000)],
    });
    const settled = allocateCredits(1, d);
    expect(settled.get('INV-2')).toBe(2000);
    expect(settled.get('INV-1')).toBe(0);
    expect(invoicePaymentStatus(d.invoices[1], d)).toBe(PAID);
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PENDING);
  });

  it('lets an overpayment flow on to other invoices', () => {
    const d = data({
      invoices: [billed('INV-1', '2026-08-01', 1000), billed('INV-2', '2026-08-10', 2000, 2500)],
    });
    const settled = allocateCredits(1, d);
    expect(settled.get('INV-2')).toBe(2000);
    expect(settled.get('INV-1')).toBe(500); // the 500 excess
  });

  it('back-dating an older invoice re-opens a newer one', () => {
    // Documents the trade-off of oldest-first: correct, and the reason status must be
    // derived rather than stored.
    const before = data({
      invoices: [billed('INV-2', '2026-08-10', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-12', amount: 2000 }],
    });
    expect(invoicePaymentStatus(before.invoices[0], before)).toBe(PAID);

    const after = data({
      invoices: [billed('INV-1', '2026-08-01', 2000), billed('INV-2', '2026-08-10', 2000)],
      payments: [{ id: 'REC-1', customerId: 1, date: '2026-08-12', amount: 2000 }],
    });
    expect(invoicePaymentStatus(after.invoices[1], after)).toBe(PENDING);
    expect(invoicePaymentStatus(after.invoices[0], after)).toBe(PAID);
  });

  it('ignores estimates, drafts and other customers', () => {
    const d = data({
      invoices: [
        billed('INV-1', '2026-08-01', 3000),
        { id: 'EST-1', date: '2026-08-02', customerId: 1, status: 'Estimate', total: 9999, items: [] },
        { ...billed('INV-9', '2026-08-01', 5000), customerId: 2 },
      ],
      payments: [{ id: 'REC-9', customerId: 2, date: '2026-08-05', amount: 5000 }],
    });
    expect(allocateCredits(1, d).has('EST-1')).toBe(false);
    expect(invoicePaymentStatus(d.invoices[0], d)).toBe(PENDING);
  });

  it('returns null for anything that is not a billed invoice', () => {
    const d = data();
    expect(invoicePaymentStatus({ id: 'EST-1', status: 'Estimate' }, d)).toBeNull();
    expect(invoicePaymentStatus(null, d)).toBeNull();
  });
});
