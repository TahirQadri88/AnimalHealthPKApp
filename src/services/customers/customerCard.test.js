import { describe, it, expect } from 'vitest';
import { buildCustomerCard, balanceReminderText, waNumber } from './customerCard';

const billed = (id, date, total, receivedAmount = 0, customerId = 1) =>
  ({ id, date, customerId, status: 'Billed', total, receivedAmount });
const receipt = (id, date, amount, customerId = 1, over = {}) =>
  ({ id, date, customerId, amount, ...over });

const WORLD = {
  invoices: [
    billed('INV-8475', '2026-09-03', 136000, 136000),
    billed('INV-8476', '2026-09-03', 27000),
    billed('INV-0012', '2026-02-01', 5000),
    { id: 'EST-1', date: '2026-09-04', customerId: 1, status: 'Estimate', total: 99999 },
    billed('INV-9', '2026-09-04', 1000, 0, 2),
  ],
  payments: [receipt('REC-1', '2026-08-20', 20000)],
  asOf: '2026-09-05',
};

const card = (over = {}) => buildCustomerCard(1, { ...WORLD, ...over });

describe('buildCustomerCard — last invoice', () => {
  it('is the most recent bill', () => {
    expect(card().lastInvoice).toEqual({ id: 'INV-8476', date: '2026-09-03', amount: 27000 });
  });

  it('breaks a same-day tie by document number, because the higher one is later', () => {
    expect(card().lastInvoice.id).toBe('INV-8476');
  });

  it('ignores an estimate — it is not a bill', () => {
    expect(card().lastInvoice.id).not.toBe('EST-1');
  });

  it('ignores another customer\'s invoices', () => {
    expect(buildCustomerCard(2, WORLD).lastInvoice.id).toBe('INV-9');
  });

  it('is null for a customer who has never been billed', () => {
    expect(buildCustomerCard(99, WORLD).lastInvoice).toBeNull();
  });
});

describe('buildCustomerCard — last payment', () => {
  // A card built from `payments` alone would say this customer last paid in August, when
  // they settled Rs 136,000 at the counter in September.
  it('counts cash taken at the counter, not only receipts', () => {
    expect(card().lastPayment).toEqual({ id: 'INV-8475', date: '2026-09-03', amount: 136000, atBilling: true });
  });

  it('says which kind it was, so the card can label it', () => {
    expect(card().lastPayment.atBilling).toBe(true);
    expect(card({ invoices: WORLD.invoices.map(o => ({ ...o, receivedAmount: 0 })) }).lastPayment)
      .toMatchObject({ id: 'REC-1', atBilling: false });
  });

  it('counts both kinds', () => {
    expect(card().paymentCount).toBe(2);
  });

  it('is null for a customer who has never paid', () => {
    expect(card({ invoices: WORLD.invoices.map(o => ({ ...o, receivedAmount: 0 })), payments: [] }).lastPayment)
      .toBeNull();
  });
});

describe('buildCustomerCard — last transaction', () => {
  it('is the later of the two', () => {
    expect(card().lastActivityDate).toBe('2026-09-03');
  });

  it('counts the days since, so a quiet account shows as one', () => {
    expect(card().daysSinceActivity).toBe(2);
  });

  it('is null, not zero, when there has been no activity at all', () => {
    const c = buildCustomerCard(99, WORLD);
    expect(c.lastActivityDate).toBeNull();
    expect(c.daysSinceActivity).toBeNull();
  });

  it('marks a customer who has never traded as new rather than up to date', () => {
    expect(buildCustomerCard(99, WORLD).isNew).toBe(true);
    expect(card().isNew).toBe(false);
  });

  it('survives a record with an unreadable date', () => {
    const c = buildCustomerCard(1, { invoices: [billed('INV-X', 'not a date', 100)], payments: [] });
    expect(() => c).not.toThrow();
    expect(c.daysSinceActivity).toBeNull();
  });

  it('survives being called with nothing', () => {
    expect(buildCustomerCard(1)).toMatchObject({ lastInvoice: null, lastPayment: null, isNew: true });
  });
});

describe('waNumber', () => {
  it('turns the local forms into what wa.me wants', () => {
    expect(waNumber('0300-1234567')).toBe('923001234567');
    expect(waNumber('+92 300 1234567')).toBe('923001234567');
    expect(waNumber('923001234567')).toBe('923001234567');
  });

  it('is empty when there is no number, so the caller can hide the button', () => {
    expect(waNumber('')).toBe('');
    expect(waNumber(undefined)).toBe('');
  });
});

describe('balanceReminderText', () => {
  it('names the customer, the business and the figure', () => {
    const t = balanceReminderText({ name: 'Al Shaheer' }, 136000, 'AnimalHealth.PK');
    expect(t).toContain('Al Shaheer');
    expect(t).toContain('AnimalHealth.PK');
    expect(t).toContain('Rs. 136,000');
  });

  it('does not print a raw undefined for a customer without a name', () => {
    expect(balanceReminderText(null, 0, 'X')).not.toMatch(/undefined|NaN/);
  });
});
