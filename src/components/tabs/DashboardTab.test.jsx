// Purity of the move: node tools/extraction-diff.mjs DashboardTab src/components/tabs/DashboardTab.jsx
//
// The first screen anyone sees, and it shows money. The arithmetic lives in
// services/analytics/dashboard.js and is tested there; these check it reaches the screen —
// in particular that Sales is NET of returns, which it was not until two days ago.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { DashboardTab } from './DashboardTab';

const today = new Date().toISOString().slice(0, 10);
const CUSTOMERS = [{ id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' }];
const line = (qty, price, cost) => ({ productId: 1, name: 'Antox 9', quantity: qty, price, costPrice: cost });
const INVOICES = [
  { id: 'INV-1', date: today, customerId: 1, status: 'Billed', total: 75000, receivedAmount: 0, salespersonId: 1, items: [line(10, 7500, 6000)] },
  { id: 'CN-1',  date: today, customerId: 1, status: 'CreditNote', total: 15000, salespersonId: 1, items: [line(2, 7500, 6000)] },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, hasPermission: () => true, currentUser: { id: 1, name: 'Owais', role: 'admin' },
    customers: CUSTOMERS, invoices: INVOICES, payments: [], expenses: [],
    companies: [], products: [], expenseCategories: [], appUsers: [],
    getPaymentStatus: () => 'Pending', getCustomerBalance: () => 60000,
    getCustomerLedger: () => ({ rows: [] }), generateReceiptData: () => ({}),
    getCompanyName: () => 'Selmore', checkDuplicate: () => false,
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    setActiveTab: () => {}, setAdminView: () => {}, setAnalyticsView: () => {},
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {},
    setCurrentInvoice: () => {}, setBillingView: () => {}, setPrintConfig: () => {},
    ...over,
  }}>
    <DashboardTab />
  </AppContext.Provider>
);

describe('DashboardTab', () => {
  // 75,000 billed less 15,000 returned. The Sales card showing 75,000 is the bug fixed on
  // 2026-09-01. Anchored to that card specifically: 75,000 legitimately appears further
  // down in Recent Activity, where each document is listed at its own value.
  it('shows Sales NET of returns', () => {
    const html = render();
    expect(html).toMatch(/This Month Sales[\s\S]{0,200}Rs\. 60,000/);
  });

  it('still lists each document at its own value in Recent Activity', () => {
    const html = render();
    expect(html).toMatch(/INV-1[\s\S]{0,300}Rs\. 75,000/);
    expect(html).toMatch(/CN-1[\s\S]{0,300}Rs\. 15,000/);
  });

  it('shows what is owed across every customer', () => {
    expect(render()).toContain('Receivables');
  });

  it('names a customer with an outstanding balance', () => {
    expect(render()).toContain('Abdul Qadir Shan Cattle');
  });

  it('offers the date filters', () => {
    const html = render();
    ['Today', 'This Week', 'This Month', 'This Year', 'All Time'].forEach(f => expect(html).toContain(f));
  });

  it('renders for a business with no data at all', () => {
    expect(() => render({ invoices: [], customers: [], getCustomerBalance: () => 0 })).not.toThrow();
  });

  // A staff member without viewAllInvoices sees only their own — the label changes to say so.
  it('says "My Sales" for a staff member who only sees their own', () => {
    const staff = { id: 2, name: 'Ghousia', role: 'staff', permissions: {} };
    expect(render({ isAdmin: false, currentUser: staff })).toContain('My Sales');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
