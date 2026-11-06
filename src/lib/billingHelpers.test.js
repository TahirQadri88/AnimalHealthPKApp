import { describe, it, expect } from 'vitest';
import { billingSummary, paymentStatusFor } from './billingSummary';
import { lastPricesForCustomer } from './lastPrice';
import { rankProducts, customerMatches } from './productSearch';
import { validateInvoiceDraft } from './invoiceValidation';
import { invoiceTotal } from '../services/accounting/invoiceTotals';

const items = [
  { uniqueId: 'a', productId: 'a', name: 'Antox', price: 500, quantity: 10 },
  { uniqueId: 'b', productId: 'b', name: 'Tylo', price: 1200, quantity: 3 },
  { uniqueId: 'a_bonus', productId: 'a', name: 'Antox', price: 0, originalPrice: 500, quantity: 2, isBonus: true },
];

describe('billingSummary', () => {
  const inv = { customerId: 'c1', items, deliveryBilled: '300', discount: 100, receivedAmount: 2000 };
  it('counts SKUs, paid units and free units separately', () => {
    const s = billingSummary(inv, { canCollect: true });
    expect([s.skus, s.units, s.bonusUnits]).toEqual([3, 13, 2]);
  });
  it('total is exactly what saveInvoice stores', () => {
    const s = billingSummary(inv, { canCollect: true });
    expect(s.total).toBe(invoiceTotal(inv));
    expect(s.total).toBe(5000 + 3600 + 300 - 100);
    expect(s.bonusGiven).toBe(1000);
    expect(s.balanceDue).toBe(s.total - 2000);
  });
  it('account after issue is prior balance plus bill minus received, new documents only', () => {
    expect(billingSummary(inv, { canCollect: true, priorBalance: 10000 }).accountAfter).toBe(10000 + 8800 - 2000);
    expect(billingSummary(inv, { canCollect: true, priorBalance: 10000, isEdit: true }).accountAfter).toBeNull();
    expect(billingSummary({ ...inv, customerId: '' }, { priorBalance: 5 }).accountAfter).toBeNull();
  });
  it('received is ignored without the collect permission', () => {
    const s = billingSummary(inv, { canCollect: false });
    expect(s.received).toBe(0); expect(s.showReceived).toBe(false);
  });
  it('never yields NaN from junk', () => {
    const s = billingSummary({ items: [{ price: 'x', quantity: undefined }], deliveryBilled: 'abc' });
    expect(Object.values(s).some(v => Number.isNaN(v))).toBe(false);
    expect(billingSummary(undefined).skus).toBe(0);
  });
});

describe('paymentStatusFor', () => {
  it('derives from received against total', () => {
    expect(paymentStatusFor(100, 100)).toBe('Paid');
    expect(paymentStatusFor(150, 100)).toBe('Paid');
    expect(paymentStatusFor(50, 100)).toBe('Partial');
    expect(paymentStatusFor(0, 100)).toBe('Pending');
  });
  it('items added after "Full pay" turn a stale Paid into Partial', () => {
    expect(paymentStatusFor(1000, 1500, 'Paid')).toBe('Partial');
  });
  it('keeps a hand-set status when nothing was received', () => {
    expect(paymentStatusFor(0, 100, 'Paid')).toBe('Paid');
    expect(paymentStatusFor('', 100, undefined)).toBe('Pending');
  });
});

// The loop this replaces, copied verbatim from BillingTab.handleAddItem.
const oldLastPrice = (invoices, customerId, p) => {
  let historicalPrice = p.sellingPrice;
  const pastInvs = invoices.filter(inv => inv.customerId === customerId).sort((a,b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
  for (let inv of pastInvs) {
    const pastItem = inv.items.find(i => (i.productId === p.id || i.uniqueId === p.id) && !i.isBonus);
    if (pastItem && pastItem.price !== undefined) { historicalPrice = pastItem.price; break; }
  }
  return historicalPrice;
};

describe('lastPricesForCustomer matches the old loop', () => {
  const invs = [
    { id: 'INV-0001', customerId: 'c1', date: '2026-01-01', items: [{ productId: 'a', price: 400 }, { productId: 'b', price: 1000 }] },
    { id: 'INV-0003', customerId: 'c1', date: '2026-02-01', items: [{ productId: 'a', price: 0, isBonus: true }, { productId: 'a', price: 450 }] },
    { id: 'INV-0002', customerId: 'c1', date: '2026-02-01', items: [{ productId: 'a', price: 999 }] },
    { id: 'INV-0004', customerId: 'c1', date: '2026-03-01', items: [{ productId: 'b' }, { productId: 'b', price: 7 }] },
    { id: 'INV-0005', customerId: 'c2', date: '2026-04-01', items: [{ productId: 'a', price: 1 }] },
    { id: 'INV-0006', customerId: 'c1', date: '2026-03-05', items: [{ uniqueId: 'c', productId: 'zz', price: 33 }] },
  ];
  const prods = ['a', 'b', 'c', 'zz', 'none'].map(id => ({ id, sellingPrice: 111 }));
  for (const cid of ['c1', 'c2', 'c3']) {
    it(`customer ${cid}`, () => {
      const map = lastPricesForCustomer(invs, cid);
      for (const p of prods) expect(map.has(p.id) ? map.get(p.id) : p.sellingPrice).toBe(oldLastPrice(invs, cid, p));
    });
  }
  it('same day: higher id first, a priceless first line falls through to older invoices', () => {
    const m = lastPricesForCustomer(invs, 'c1');
    expect(m.get('a')).toBe(450);
    expect(m.get('b')).toBe(1000);
  });
});

describe('rankProducts', () => {
  const companies = { k: 'Ilyas Pharma', z: 'Zafa' };
  const cn = (id) => companies[id];
  const P = [
    { id: 1, name: 'Multivit Antox', companyId: 'z', available: true },
    { id: 2, name: 'Antox 9', companyId: 'k', available: true },
    { id: 3, name: 'Tylosin 20% Inj', companyId: 'k', available: true },
    { id: 4, name: 'Antox Old', companyId: 'k', available: true, archived: true },
    { id: 5, name: 'Antox Gone', companyId: 'k', available: false },
    { id: 6, name: 'Santoxin', companyId: 'z', available: true },
  ];
  it('every word must match name or company; prefix ranks first', () => {
    expect(rankProducts(P, 'antox', { companyName: cn }).items.map(p => p.id)).toEqual([2, 1, 6]);
    expect(rankProducts(P, 'tylo 20', { companyName: cn }).items.map(p => p.id)).toEqual([3]);
    expect(rankProducts(P, 'antox ilyas', { companyName: cn }).items.map(p => p.id)).toEqual([2]);
  });
  it('finds everything the old substring search found', () => {
    for (const q of ['an', 'tox', '20%', 'inj', 'x 9']) {
      const old = P.filter(p => p.available && !p.archived && p.name.toLowerCase().includes(q.toLowerCase())).map(p => p.id).sort();
      const now = rankProducts(P, q, { companyName: cn, limit: 99 }).items.map(p => p.id);
      expect(now.filter(id => old.includes(id)).sort()).toEqual(old);
    }
  });
  it('caps and reports the full count', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ id: i, name: `Item ${i}`, available: true }));
    const r = rankProducts(many, 'item', { limit: 30 });
    expect(r.items).toHaveLength(30); expect(r.total).toBe(80);
    expect(rankProducts(many, '   ').total).toBe(0);
  });
});

describe('customerMatches', () => {
  const C = [{ id: 1, name: 'Shan Cattle Farm' }, { id: 2, name: 'Cash Sale' }, { id: 3, name: 'Abdul Qadir Shan Cattle' }];
  it('words in any order, empty query lists all', () => {
    expect(customerMatches(C, 'cattle shan').items.map(c => c.id)).toEqual([1, 3]);
    expect(customerMatches(C, '').total).toBe(3);
    expect(customerMatches(C, 'a', 2).items).toHaveLength(2);
  });
});

describe('validateInvoiceDraft', () => {
  const good = { customerId: 'c1', items: items.slice(0, 2), deliveryBilled: 0, discount: 0 };
  it('a normal bill passes', () => expect(validateInvoiceDraft(good).ok).toBe(true));
  it('needs a customer and items', () => {
    const r = validateInvoiceDraft({ items: [] });
    expect(r.errors.map(e => e.field)).toEqual(['customer', 'items']);
  });
  it('quantity must be a whole number 1 or more', () => {
    for (const q of [0, -1, 1.5, '', NaN]) {
      const r = validateInvoiceDraft({ ...good, items: [{ ...items[0], quantity: q }] });
      expect(r.errors[0]).toMatchObject({ field: 'qty', key: 'a' });
    }
  });
  it('a paid line needs a rate; a bonus line does not', () => {
    expect(validateInvoiceDraft({ ...good, items: [{ ...items[0], price: 0 }] }).errors[0].field).toBe('rate');
    expect(validateInvoiceDraft({ ...good, items: [items[2]] }).ok).toBe(true);
  });
  it('no negatives, and discount cannot exceed the bill', () => {
    expect(validateInvoiceDraft({ ...good, deliveryBilled: -5 }).errors[0].field).toBe('deliveryBilled');
    expect(validateInvoiceDraft({ ...good, discount: 8601 }).errors[0].field).toBe('discount');
    expect(validateInvoiceDraft({ ...good, discount: 8600 }).ok).toBe(true);
    expect(validateInvoiceDraft({ ...good, receivedAmount: -1 }, { canCollect: true }).ok).toBe(false);
  });
  it('overpayment is a warning, not an error', () => {
    const r = validateInvoiceDraft({ ...good, receivedAmount: 99999 }, { canCollect: true });
    expect(r.ok).toBe(true); expect(r.warnings).toHaveLength(1);
  });
});
