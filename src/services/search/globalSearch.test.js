import { describe, it, expect } from 'vitest';
import {
  globalSearch, scoreText, scoreDocId, scorePhone, normalisePhone, printDocTypeFor,
  EXACT, PREFIX, WORD, CONTAINS,
} from './globalSearch';

const CUSTOMERS = [
  { id: 1, name: 'Al Shaheer Cattle', phone: '0300-1234567', city: 'Karachi', area: 'Sohrab Goth' },
  { id: 2, name: 'Ghousia Farms', phone: '+92 321 9876543', city: 'Hyderabad' },
  { id: 3, name: 'Bakhshah Poultry', phone: '', city: 'Karachi' },
];
const INVOICES = [
  { id: 'INV-8475', date: '2026-09-03', status: 'Billed', customerId: 1, customerName: 'Al Shaheer Cattle', total: 136000 },
  { id: 'INV-8476', date: '2026-09-03', status: 'Billed', customerId: 1, customerName: 'Al Shaheer Cattle', total: 27000 },
  { id: 'INV-0012', date: '2025-02-01', status: 'Billed', customerId: 1, customerName: 'Al Shaheer Cattle', total: 5000 },
  { id: 'CN-0009', date: '2026-09-01', status: 'CreditNote', customerId: 2, customerName: 'Ghousia Farms', total: 15000 },
  { id: 'EST-0004', date: '2026-08-20', status: 'Estimate', customerId: 2, customerName: 'Ghousia Farms', total: 9000 },
];
const PAYMENTS = [
  { id: 'REC-0012', date: '2026-09-02', customerId: 1, amount: 50000, note: 'Cheque No. 88213' },
];
const PRODUCTS = [
  { id: 11, name: 'Antox 9', company: 'Selmore', companyId: 100, price: 7500, unit: 'Bottle' },
  { id: 12, name: 'Ratava Spray', company: 'Star', companyId: 200, price: 1000 },
];
const COMPANIES = [{ id: 100, name: 'Selmore' }, { id: 200, name: 'Star' }];

const DATA = { customers: CUSTOMERS, invoices: INVOICES, payments: PAYMENTS, products: PRODUCTS, companies: COMPANIES };
const run = (q, opts) => globalSearch(q, DATA, opts);
const group = (q, kind) => run(q).groups.find(g => g.kind === kind);
const titles = (q, kind) => (group(q, kind)?.results || []).map(r => r.title);

describe('scoreText — a match at the start of a word beats one inside it', () => {
  it('ranks exact, prefix, word-start and contains apart', () => {
    expect(scoreText('Antox 9', 'antox 9')).toBe(EXACT);
    expect(scoreText('Antox 9', 'ant')).toBe(PREFIX);
    expect(scoreText('Al Shaheer Cattle', 'shah')).toBe(WORD);
    expect(scoreText('Bakhshah Poultry', 'shah')).toBe(CONTAINS);
  });

  it('is zero for no match, and for an empty query', () => {
    expect(scoreText('Antox 9', 'zzz')).toBe(0);
    expect(scoreText('Antox 9', '')).toBe(0);
    expect(scoreText('', 'antox')).toBe(0);
  });

  it('does not blow up on regex characters a person might type', () => {
    expect(() => scoreText('Vitamin (B12)', '(b12')).not.toThrow();
    expect(scoreText('Vitamin (B12)', '(b12')).toBeGreaterThan(0);
  });
});

describe('scoreDocId — nobody types INV-', () => {
  it('finds an invoice by its bare number', () => {
    expect(scoreDocId('INV-8475', '8475')).toBe(EXACT);
    expect(scoreDocId('INV-8475', '84')).toBe(PREFIX);
    expect(scoreDocId('INV-0012', '12')).toBe(WORD);
  });

  it('finds it by the full id, however it is punctuated', () => {
    expect(scoreDocId('INV-8475', 'inv-8475')).toBe(EXACT);
    expect(scoreDocId('INV-8475', 'INV8475')).toBe(EXACT);
  });

  it('does not treat a digit inside a word as a number search', () => {
    // "b12" is not a bare number, so it must not match every id containing 12.
    expect(scoreDocId('INV-0012', 'b12')).toBe(0);
  });
});

describe('scorePhone — one number, several spellings', () => {
  it('treats a local, a leading-zero and a +92 number as the same', () => {
    expect(normalisePhone('0300-1234567')).toBe('3001234567');
    expect(normalisePhone('+92 300 1234567')).toBe('3001234567');
    expect(scorePhone('0300-1234567', '03001234567')).toBe(EXACT);
    expect(scorePhone('0300-1234567', '+92 300 1234567')).toBe(EXACT);
  });

  it('matches a prefix a person half-remembers', () => {
    expect(scorePhone('0300-1234567', '0300123')).toBe(PREFIX);
  });

  it('refuses to call three digits a phone number', () => {
    expect(scorePhone('0300-1234567', '12')).toBe(0);
  });

  it('is zero when the customer has no phone', () => {
    expect(scorePhone('', '03001234567')).toBe(0);
  });
});

describe('globalSearch — what a person actually types', () => {
  it('says nothing for one character', () => {
    expect(run('a').groups).toEqual([]);
    expect(run('').total).toBe(0);
  });

  it('finds a customer by name', () => {
    expect(titles('shaheer', 'customer')).toEqual(['Al Shaheer Cattle']);
  });

  it('finds a customer by phone, however it was typed', () => {
    expect(titles('03001234567', 'customer')).toEqual(['Al Shaheer Cattle']);
    expect(titles('0321 987', 'customer')).toEqual(['Ghousia Farms']);
  });

  it('finds an invoice by its bare number, and puts it first', () => {
    const r = run('8475');
    expect(r.groups[0].kind).toBe('invoice');
    expect(r.groups[0].results[0].title).toBe('INV-8475');
  });

  it('finds a credit note and an estimate too', () => {
    expect(titles('CN-0009', 'invoice')).toEqual(['CN-0009']);
    expect(titles('EST-0004', 'invoice')).toEqual(['EST-0004']);
  });

  it('finds a receipt by number', () => {
    expect(titles('REC-0012', 'payment')).toEqual(['REC-0012']);
  });

  it('finds a receipt by what was written on it', () => {
    expect(titles('88213', 'payment')).toEqual(['REC-0012']);
  });

  it('finds a product, and its brand', () => {
    expect(titles('antox', 'product')).toEqual(['Antox 9']);
    expect(titles('selmore', 'company')).toEqual(['Selmore']);
  });

  it('lists a customer\'s invoices newest first when searching their name', () => {
    expect(titles('shaheer', 'invoice')).toEqual(['INV-8476', 'INV-8475', 'INV-0012']);
  });

  it('puts the customer above their invoices when the name is what matched', () => {
    expect(run('shaheer').groups[0].kind).toBe('customer');
  });

  it('finds nothing, cleanly, for a search that matches nothing', () => {
    const r = run('zzzzz');
    expect(r.groups).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('caps each group and says how many more there are', () => {
    const r = globalSearch('shaheer', DATA, { perGroup: 2 });
    const inv = r.groups.find(g => g.kind === 'invoice');
    expect(inv.results).toHaveLength(2);
    expect(inv.more).toBe(1);
    expect(r.total).toBe(4);   // 1 customer + 3 invoices
  });

  it('carries the record itself, so the caller can act on it', () => {
    const hit = titles('8475', 'invoice') && group('8475', 'invoice').results[0];
    expect(hit.entity.total).toBe(136000);
    expect(hit.amount).toBe(136000);
  });

  it('survives being called with nothing', () => {
    expect(() => globalSearch('antox')).not.toThrow();
    expect(globalSearch('antox').groups).toEqual([]);
  });

  it('survives records with missing fields', () => {
    const r = globalSearch('test', {
      customers: [{ id: 1 }], invoices: [{ id: 'test-1' }], products: [{ id: 2 }],
      payments: [{ id: 3 }], companies: [{ id: 4 }],
    });
    expect(() => r).not.toThrow();
    expect(r.groups.find(g => g.kind === 'invoice').results[0].title).toBe('test-1');
  });
});

describe('printDocTypeFor — open the right document', () => {
  it('maps a record to the document the billing list would print', () => {
    expect(printDocTypeFor({ status: 'Billed' })).toBe('invoice');
    expect(printDocTypeFor({ status: 'CreditNote' })).toBe('creditnote');
    expect(printDocTypeFor({ status: 'Estimate' })).toBe('estimate');
    expect(printDocTypeFor({ status: 'Booked' })).toBe('estimate');
    expect(printDocTypeFor(undefined)).toBe('invoice');
  });
});

// The shell exposes this on Alt+S and on a magnifier in both headers. These are the
// behaviours that make the box worth opening at all.
describe('globalSearch — the questions it exists to answer', () => {
  it('"what is Al Shaheer\'s balance" — the customer comes first', () => {
    expect(run('al shaheer').groups[0].kind).toBe('customer');
  });

  it('"what was on 8475" — the invoice comes first', () => {
    expect(run('8475').groups[0].results[0].title).toBe('INV-8475');
  });

  it('"did receipt 12 go through" — finds the receipt', () => {
    expect(titles('REC-12', 'payment')).toEqual(['REC-0012']);
  });

  it('"who is on 0300 1234567" — finds the customer', () => {
    expect(titles('0300 1234567', 'customer')).toEqual(['Al Shaheer Cattle']);
  });

  it('"who buys Antox" — finds the product', () => {
    expect(titles('antox', 'product')).toEqual(['Antox 9']);
  });
});

describe('scoreDocId — zero padding is on the paper, not in anyone\'s head', () => {
  it('matches a prefixed number without its padding', () => {
    expect(scoreDocId('REC-0012', 'REC-12')).toBe(EXACT);
    expect(scoreDocId('INV-0012', 'inv 12')).toBe(EXACT);
    expect(scoreDocId('CN-0009', 'cn-9')).toBe(EXACT);
  });

  it('does not match a different number that shares a prefix', () => {
    expect(scoreDocId('REC-0012', 'REC-13')).toBe(0);
  });

  it('does not match the same number under a different prefix', () => {
    expect(scoreDocId('REC-0012', 'INV-12')).toBe(0);
  });
});
