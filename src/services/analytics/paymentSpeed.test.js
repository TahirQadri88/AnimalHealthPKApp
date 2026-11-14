import { describe, it, expect } from 'vitest';
import { settlementDates, paymentSpeed } from './paymentSpeed';
import { allocateCredits, statusFromSettled } from '../accounting/ledger';

const inv = (id, date, total, extra = {}) => ({ id, date, total, customerId: 'c1', status: 'Billed', ...extra });
const pay = (date, amount, extra = {}) => ({ date, amount, customerId: 'c1', ...extra });

describe('settlementDates', () => {
  it('a small receipt the next day does not settle a large bill (the old measure said 1 day)', () => {
    const data = { invoices: [inv('A', '2026-10-01', 200000)], payments: [pay('2026-10-02', 500), pay('2026-10-31', 199500)] };
    expect(settlementDates('c1', data).get('A')).toBe('2026-10-31');
  });
  it('oldest bill first; cash at billing settles its own bill that day', () => {
    const data = {
      invoices: [inv('A', '2026-10-01', 1000), inv('B', '2026-10-05', 500, { receivedAmount: 500 }), inv('C', '2026-10-10', 800)],
      payments: [pay('2026-10-20', 1200)],
    };
    const d = settlementDates('c1', data);
    expect([d.get('A'), d.get('B'), d.get('C')]).toEqual(['2026-10-20', '2026-10-05', null]);
  });
  it('an advance or a return counts, and a credit before the bill settles it on its own date', () => {
    const data = {
      invoices: [inv('A', '2026-10-10', 1000), { id: 'CN1', customerId: 'c1', status: 'CreditNote', date: '2026-10-12', total: 400 }],
      payments: [pay('2026-10-01', 600)],
    };
    expect(settlementDates('c1', data).get('A')).toBe('2026-10-12');
  });
  it('agrees with the ledger on which bills are paid', () => {
    const data = {
      invoices: [inv('A', '2026-09-01', 5000), inv('B', '2026-09-15', 3000, { receivedAmount: 1000 }), inv('C', '2026-10-01', 7000), inv('D', '2026-10-20', 900, { receivedAmount: 1200 })],
      payments: [pay('2026-09-20', 4000), pay('2026-10-05', 3500, { discount: 100 }), pay('2026-10-25', 2000)],
    };
    const dates = settlementDates('c1', data);
    const alloc = allocateCredits('c1', data);
    data.invoices.forEach(i => expect(dates.get(i.id) !== null).toBe(statusFromSettled(i.total, alloc.get(i.id)) === 'Paid'));
  });
});

describe('paymentSpeed', () => {
  const data = {
    invoices: [inv('A', '2026-10-01', 1000), inv('B', '2026-10-20', 1000), inv('C', '2026-11-01', 1000)],
    payments: [pay('2026-10-11', 1000), pay('2026-11-05', 1000)],
  };
  it('averages days to settle for bills settled in the window, and reports what is still open', () => {
    const r = paymentSpeed({ ...data, window: { start: '2026-11-01', end: '2026-11-14' }, today: '2026-11-14' });
    expect(r).toEqual({ avgDays: 16, settledCount: 1, openCount: 1, oldestOpenDays: 13 });
    expect(paymentSpeed({ ...data, today: '2026-11-14' }).avgDays).toBe(13);
  });
  it('nothing settled: null, not 0', () => {
    expect(paymentSpeed({ invoices: [inv('A', '2026-10-01', 1000)], payments: [], today: '2026-11-14' }).avgDays).toBeNull();
  });
});
