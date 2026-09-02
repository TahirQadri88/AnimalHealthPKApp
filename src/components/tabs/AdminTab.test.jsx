// Purity of the move: node tools/extraction-diff.mjs AdminTab src/components/tabs/AdminTab.jsx
//
// The admin router. It renders all eleven admin views at once and shows one — so this is
// also the broadest single check in the suite that every one of those extracted files
// still imports and renders.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { AdminTab } from './AdminTab';

const ctx = (over = {}) => ({
  isAdmin: true, hasPermission: () => true, currentUser: { id: 1, name: 'Owais', role: 'admin' },
  adminView: 'analytics', setAdminView: () => {},
  analyticsView: '', setAnalyticsView: () => {},
  companies: [], products: [], customers: [], invoices: [], invoicesRaw: [],
  expenses: [], expensesRaw: [], expenseCategories: [], payments: [], paymentsRaw: [],
  appUsers: [], riders: [], transportCompanies: [], vehicleTypes: [],
  cities: [], areas: [], customerTypes: [], appSettings: { id: 'main' },
  getPaymentStatus: () => 'Pending', getCustomerBalance: () => 0, getCompanyName: () => '',
  getCustomerLedger: () => ({ rows: [] }), generateReceiptData: () => ({}),
  checkDuplicate: () => false, claimDocNumber: async () => 1, fetchAuditLog: async () => [],
  saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
  showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, restoreRecord: () => {},
  logSave: () => {}, logDelete: () => {}, setPrintConfig: () => {},
  billingView: 'list', setBillingView: () => {}, currentInvoice: null, setCurrentInvoice: () => {},
  activeTab: 'admin', setActiveTab: () => {},
  setEditingProduct: () => {}, setShowProductModal: () => {}, setProductPreFill: () => {},
  setEditingCustomer: () => {}, setShowCustomerModal: () => {},
  setShowPaymentModal: () => {}, setSelectedCustomerForPayment: () => {}, setEditingPayment: () => {},
  setShowLedgerModal: () => {}, setSelectedLedgerId: () => {},
  setShowExpenseCatModal: () => {}, setShowUserModal: () => {}, setEditingUser: () => {},
  setShowSegmentsModal: () => {}, setShowCreditNoteModal: () => {}, setEditingCreditNote: () => {},
  migrateUsersToAuth: async () => ({ ok: true }),
  ...over,
});
const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={ctx(over)}><AdminTab /></AppContext.Provider>
);

describe('AdminTab', () => {
  it('refuses a non-admin', () => {
    const html = render({ isAdmin: false });
    expect(html).toContain('Admin Access Required');
  });

  it('shows every admin tab', () => {
    const html = render();
    ['Analytics', 'Expenses', 'Masters', 'Bulk Ops', 'Segments', 'Users',
     'Settings', 'Riders', 'Transport Cos', 'Receivables', 'Activity'].forEach(t => {
      expect(html).toContain(t);
    });
  });

  // Every admin view is mounted at once and hidden with CSS, so rendering this proves all
  // eleven extracted files still import and render — the broadest check in the suite.
  it('mounts all eleven views without any of them throwing', () => {
    expect(() => render()).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
