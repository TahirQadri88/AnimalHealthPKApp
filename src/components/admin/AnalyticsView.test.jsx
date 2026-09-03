// Purity of the move: node tools/extraction-diff.mjs AnalyticsView src/components/admin/AnalyticsView.jsx
//
// The report engine behind this screen is tested separately in
// services/analytics/reportEngine.test.js — 15 tests on the arithmetic. These cover the
// screen: that the figures reach it, and that the exports are offered.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { AnalyticsView } from './AnalyticsView';

const today = new Date().toISOString().slice(0, 10);
const line = (name, qty, price, cost) => ({ productId: 1, name, quantity: qty, price, costPrice: cost, company: 'Selmore' });
const INVOICES = [
  { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer',
    salespersonId: 1, salespersonName: 'Owais', total: 75000, items: [line('Antox 9', 10, 7500, 6000)] },
  { id: 'CN-1', date: today, status: 'CreditNote', customerId: 1, customerName: 'Al Shaheer',
    salespersonId: 1, salespersonName: 'Owais', total: 15000, items: [line('Antox 9', 2, 7500, 6000)] },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    getPaymentStatus: () => 'Pending', isAdmin: true, currentUser: { id: 1, name: 'Owais', role: 'admin' },
    companies: [{ id: 1, name: 'Selmore' }], products: [], customers: [{ id: 1, name: 'Al Shaheer' }],
    invoices: INVOICES, expenses: [], expenseCategories: [], payments: [], appUsers: [],
    cities: [], areas: [], customerTypes: [],
    analyticsView: '', setAnalyticsView: () => {},
    getCustomerBalance: () => 60000, getCompanyName: () => 'Selmore',
    setPrintConfig: () => {}, showToast: () => {}, setActiveTab: () => {}, setAdminView: () => {},
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {},
    ...over,
  }}>
    <AnalyticsView />
  </AppContext.Provider>
);

describe('AnalyticsView', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  // 75,000 billed less 15,000 returned. Both this and the Home dashboard net returns now;
  // they disagreed until 2026-09-01.
  it('shows product sales net of returns', () => {
    expect(render()).toContain('60,000');
  });

  it('offers the period filters', () => {
    const html = render();
    ['Today', 'This Week', 'This Month', 'This Year', 'All Time'].forEach(f => expect(html).toContain(f));
  });

  // The export buttons are icon-only, identified by their title. CSV is deliberately absent
  // on Overview — there is nothing tabular to export there, and the handler says so with a
  // toast if it is ever reached.
  it('offers WhatsApp and PDF export, and withholds CSV on the Overview tab', () => {
    const html = render();
    expect(html).toContain('title="WhatsApp"');
    expect(html).toContain('title="PDF"');
    expect(html).not.toContain('title="CSV"');
  });

  it('renders for a business with no data', () => {
    expect(() => render({ invoices: [], customers: [], getCustomerBalance: () => 0 })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  // byCustomer is keyed by customer ID now, so the screen must print the label. Getting this
  // wrong shows a bare "1" where the customer's name belongs.
  it('names the customer on the By Customer table rather than printing its id', () => {
    const html = render({ analyticsView: 'By Customer' });
    expect(html).toContain('Al Shaheer');
    expect(html).not.toMatch(/>\s*1\s*<\/button>/);
  });

  it('does not merge two customers who happen to share a name', () => {
    const html = render({
      analyticsView: 'By Customer',
      customers: [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Al Shaheer' }],
      invoices: [
        { id: 'INV-1', date: today, status: 'Billed', customerId: 1, customerName: 'Al Shaheer', total: 75000, items: [line('Antox 9', 10, 7500, 6000)] },
        { id: 'INV-2', date: today, status: 'Billed', customerId: 2, customerName: 'Al Shaheer', total: 4000, items: [line('Ratava', 2, 2000, 1500)] },
      ],
    });
    expect(html).toContain('2 Customers');
  });
});

// Aging was computed twice and the Analytics copy aged a balance by the last SALE. It is
// buildAgingReport now, so a fresh purchase can no longer pull an old debt into "Current".
describe('AnalyticsView — Receivables', () => {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const OLD_AND_NEW = {
    analyticsView: 'Receivables',
    customers: [{ id: 1, name: 'Ghousia Farms', phone: '0300-1234567' }],
    getCustomerBalance: () => 120000,
    invoices: [
      { id: 'INV-OLD', date: daysAgo(200), status: 'Billed', customerId: 1, customerName: 'Ghousia Farms', total: 118500, items: [line('Antox 9', 1, 118500, 90000)] },
      { id: 'INV-NEW', date: daysAgo(2), status: 'Billed', customerId: 1, customerName: 'Ghousia Farms', total: 1500, items: [line('Ratava', 1, 1500, 1000)] },
    ],
  };

  it('leaves a 200-day-old debt in the 90+ bucket after a purchase yesterday', () => {
    const html = render(OLD_AND_NEW);
    const bucket = html.slice(html.indexOf('90+ days'));
    expect(bucket).toContain('118,500');
  });

  it('splits the same customer across buckets rather than filing them under one', () => {
    const html = render(OLD_AND_NEW);
    expect(html).toContain('0–30 days');
    expect(html).toContain('90+ days');
    expect(html).toContain('1,500');
  });

  it('says how old the debt is, not how long since the last invoice', () => {
    expect(render(OLD_AND_NEW)).not.toContain('since last invoice');
  });

  it('still offers a WhatsApp reminder against the balance', () => {
    expect(render(OLD_AND_NEW)).toContain('wa.me/923001234567');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(OLD_AND_NEW)).not.toMatch(/undefined|NaN/);
  });
});

// Every breakdown row is a button now. The row's figure and the documents behind it should
// be one click apart, in every dimension — before this, only the customer rows led anywhere
// and only to the ledger.
describe('AnalyticsView — drill-down', () => {
  ['By Product', 'By Company', 'By Customer', 'By City', 'By Area', 'By Type'].forEach(v => {
    it(`offers a drill-down from the ${v} table`, () => {
      const html = render({
        analyticsView: v,
        customers: [{ id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' }],
      });
      expect(html).toContain('Show the transactions behind');
    });
  });

  it('leaks no undefined into a segment table', () => {
    const html = render({
      analyticsView: 'By City',
      customers: [{ id: 1, name: 'Al Shaheer', city: 'Karachi', area: 'Sohrab Goth', customerType: 'Retail' }],
    });
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
