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
});
