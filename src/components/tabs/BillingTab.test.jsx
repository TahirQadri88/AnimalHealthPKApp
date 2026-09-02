// Purity of the move: node tools/extraction-diff.mjs BillingTab src/components/tabs/BillingTab.jsx
//
// The screen that bills every invoice. Testable only once claimDocNumber came through the
// context. The list view is what SSR paints; the form is behind billingView === 'form'.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { BillingTab } from './BillingTab';

const CUSTOMERS = [{ id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' }];
const PRODUCTS = [{ id: 10, name: 'Antox 9 100ml', companyId: 1, sellingPrice: 7500, costPrice: 6000, available: true, unit: 'btl' }];
const INVOICES = [
  { id: 'INV-8457', date: '2026-09-01', customerId: 1, customerName: 'Abdul Qadir Shan Cattle', status: 'Billed',  total: 75000, receivedAmount: 0, salespersonId: 1, items: [] },
  { id: 'EST-0031', date: '2026-09-01', customerId: 1, customerName: 'Abdul Qadir Shan Cattle', status: 'Estimate', total: 5000,  receivedAmount: 0, salespersonId: 1, items: [] },
];
const VEHICLE_TYPES = [
  { id: 1, name: 'Rider', requiresRider: true },
  { id: 2, name: 'Intercity Transport', requiresRider: false },
  { id: 3, name: 'Self-Pickup', requiresRider: false },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    getPaymentStatus: () => 'Pending', isAdmin: true, hasPermission: () => true,
    currentUser: { id: 1, name: 'Owais', role: 'admin' },
    companies: [{ id: 1, name: 'Selmore' }], products: PRODUCTS, customers: CUSTOMERS,
    invoices: INVOICES, invoicesRaw: INVOICES, expenses: [], expenseCategories: [],
    payments: [], appUsers: [], riders: [], transportCompanies: [], vehicleTypes: VEHICLE_TYPES,
    cities: [], areas: [], customerTypes: [],
    billingView: 'list', currentInvoice: null, setCurrentInvoice: () => {}, setBillingView: () => {},
    activeTab: 'billing', setActiveTab: () => {}, adminView: 'analytics', setAdminView: () => {},
    getCompanyName: () => 'Selmore', getCustomerBalance: () => 0,
    getCustomerLedger: () => ({ rows: [] }), generateReceiptData: () => ({}),
    checkDuplicate: () => false, claimDocNumber: async () => 8458,
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, logSave: () => {},
    logDelete: () => {}, setPrintConfig: () => {},
    setEditingCustomer: () => {}, setShowCustomerModal: () => {},
    setEditingProduct: () => {}, setShowProductModal: () => {}, setProductPreFill: () => {},
    ...over,
  }}>
    <BillingTab />
  </AppContext.Provider>
);

describe('BillingTab — list', () => {
  it('lists the documents', () => {
    const html = render();
    expect(html).toContain('INV-8457');
    expect(html).toContain('EST-0031');
  });

  it('names the customer on each', () => {
    expect(render()).toContain('Abdul Qadir Shan Cattle');
  });

  it('offers the status filters', () => {
    const html = render();
    ['Estimate', 'Booked', 'Billed', 'CreditNote'].forEach(s => expect(html).toContain(s));
  });

  it('renders with no documents at all', () => {
    expect(() => render({ invoices: [], invoicesRaw: [] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});

describe('BillingTab — form', () => {
  const draft = {
    id: null, customerId: 1, customerName: 'Abdul Qadir Shan Cattle', customerDetails: {},
    items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, receivedAmount: 0,
    vehicle: 'Rider', date: '2026-09-02', status: 'Billed',
  };
  const form = (inv = {}) => render({ billingView: 'form', currentInvoice: { ...draft, ...inv } });

  it('opens on a new invoice', () => {
    expect(() => form()).not.toThrow();
  });

  // A rider delivery must not offer courier fields, and vice versa. Getting this wrong is
  // how a courier name once ended up on a rider delivery.
  it('asks for a rider on a rider delivery, not a consignment number', () => {
    const html = form({ vehicle: 'Rider' });
    expect(html).toContain('Rider / Driver Name');
    expect(html).not.toContain('No. on the transport receipt');
  });

  it('asks for the transport company and consignment number on an intercity booking', () => {
    const html = form({ vehicle: 'Intercity Transport' });
    expect(html).toContain('No. on the transport receipt');
  });

  // A vehicle type can be renamed while invoices keep the old name. The block must stay
  // open for an unknown method that still carries courier details, or the record becomes
  // uneditable and the consignment number is stranded.
  it('keeps the courier block open for an unknown method that still has details', () => {
    const html = form({ vehicle: 'Daewoo Overnight', transportCompany: 'Daewoo', biltyNumber: 'BLT-9' });
    expect(html).toContain('BLT-9');
  });

  it('leaks no undefined into the form', () => {
    expect(form()).not.toMatch(/undefined|NaN/);
  });
});
