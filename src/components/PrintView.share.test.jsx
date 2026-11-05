// The WhatsApp message, for every document type. It is read by customers, so it must be clean text:
// no rule lines, no emoji clutter, no leftover URL codes (it was once encoded twice), nothing undefined.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';
import { AGING_BUCKETS } from '../services/analytics/receivables';

const items = [
  { productId: 1, name: 'Trifas Suspension 1 Litre', quantity: 2, price: 640 },
  { productId: 2, name: 'Hepta Sef 1g Injection', quantity: 3, price: 770, isBonus: false },
  { productId: 3, name: 'Free sample', quantity: 1, price: 0, isBonus: true, originalPrice: 100 },
];
const base = { id: 'INV-8812', date: '2026-11-03', customerId: 1, customerName: 'Abdul Qadir Shan Cattle', total: 12340, receivedAmount: 20000, deliveryBilled: 400, items };
const LEDGER = { rows: [{ id: 'INV-8812', balance: 87590 }], openingBal: 75250, closingBal: 87590 };
const AGING = { asOf: '2026-11-05', buckets: AGING_BUCKETS.map(b => ({ key: b.key, label: b.label })),
  rows: [{ name: 'Ghousia Farms', phone: '0300-1234567', oldestAgeDays: 182, buckets: { current: 0, d31_60: 0, d61_90: 0, d90plus: 118500 }, totalOutstanding: 118500 }],
  totals: { current: 0, d31_60: 0, d61_90: 0, d90plus: 118500 }, grandTotal: 118500, customerCount: 1 };
const CASES = {
  invoice: base,
  estimate: { ...base, id: 'EST-1', status: 'Estimate' },
  creditnote: { ...base, id: 'CN-1', originalInvoiceId: 'INV-8812', reason: 'Damaged', total: 2850 },
  dispatch: { ...base, vehicle: 'Rider', driverName: 'Ali', driverPhone: '0345', customerDetails: { contactPerson: 'Abdul', phone: '0300', address1: 'Shop 12, Landhi' } },
  receipt: { id: 'REC-1', date: '2026-10-28', customerName: 'Abdul', receivedAmount: 30000, prevBalance: 105250, newBalance: 75250, note: 'Cash' },
  ledger: { customerName: 'Abdul', phone: '0300', dateRange: { start: '2026-10-01', end: '2026-11-05' }, openingBal: 58250, totalDebit: 59340, totalCredit: 50000, rows: [] },
  report: { title: 'Product Sales', dateFilter: 'This Month', view: 'By Product', rows: [{ 'Product Name': 'Trifas', Brand: 'Leads', 'Qty Sold': 6, 'Revenue (Rs)': 3840, 'Gross Profit (Rs)': 1024 }] },
  overview: { title: 'Overview', dateFilter: 'This Month', view: 'Overview', stats: { productRevenue: 176600, totalCOGS: 131000, grossMargin: 45600, deliveryBilled: 2400, transportExpense: 1800, totalExpenses: 12000, netProfit: 34200 } },
  aging: { title: 'Receivables Aging', dateFilter: 'As at 05-Nov-26', view: 'Aging', aging: AGING },
};
const text = (key) => {
  const docType = key === 'aging' || key === 'overview' ? 'report' : key;
  const html = renderToStaticMarkup(
    <PrintView printConfig={{ docType, format: 'a4', data: CASES[key] }} setPrintConfig={() => {}} products={[]} customers={[]}
      getCustomerLedger={() => LEDGER} getCustomerBalance={() => 0} showToast={() => {}}
      appSettings={{ businessName: 'Khyber Traders', phone: '0335 2999006' }} />);
  const href = (html.match(/href="(https:\/\/wa\.me\/\?text=[^"]+)"/) || [])[1] || '';
  return decodeURIComponent(href.split('text=')[1] || '');
};

describe('WhatsApp message', () => {
  Object.keys(CASES).forEach((key) => {
    it(`${key}: clean, complete text`, () => {
      const t = text(key);
      expect(t.length).toBeGreaterThan(20);
      expect(t).not.toMatch(/[─━═_]{4,}/);          // no rule lines
      expect(t).not.toMatch(/%[0-9A-Fa-f]{2}/);     // not encoded twice
      expect(t).not.toMatch(/undefined|NaN|\[object/);
      expect(t.startsWith('*Khyber Traders*')).toBe(true);   // the business, not the app
      expect(t.split('\n').length).toBeGreaterThan(4);
    });
  });

  it('invoice: the figures a customer checks', () => {
    const t = text('invoice');
    expect(t).toContain('*Invoice INV-8812*');
    expect(t).toContain('1. Trifas Suspension 1 Litre – 2 × Rs. 640 = Rs. 1,280');
    expect(t).toContain('3. Free sample – 1 (free)');
    expect(t).toContain('*Current bill: Rs. 12,340*');
    expect(t).toContain('Payment received: Rs. 20,000');
    expect(t).toContain('*Balance due:');
  });

  it('report rows carry real names and figures (they used to come out empty)', () => {
    const t = text('report');
    expect(t).toContain('1. *Trifas* (Leads)');
    expect(t).toContain('Qty 6 · Revenue Rs. 3,840 · Profit Rs. 1,024');
  });
});
