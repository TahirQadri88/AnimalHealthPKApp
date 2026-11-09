// Purity of the move: node tools/extraction-diff.mjs BillingTab src/components/tabs/BillingTab.jsx
//
// The screen that bills every invoice. Testable only once document numbering came through the
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
    checkDuplicate: () => false, nextDocNumber: async () => 8458,
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

// Converting a saved document (estimate → order → invoice) deletes the original, and the rules
// give that delete to Issue / Convert Docs alone. Offered without it, the new document saved
// and the old one stayed: an estimate and its invoice, both on the books.
describe('BillingTab — converting needs Issue / Convert Docs', () => {
  const estimate = { ...INVOICES[1], items: [], vehicle: 'Self-Pickup' };
  const staff = (perms) => ({
    isAdmin: false, hasPermission: (k) => !!perms[k],
    currentUser: { id: 1, name: 'Ghousia', role: 'staff', permissions: perms },
    billingView: 'form', currentInvoice: estimate,
  });

  it('a staff member who may only edit sees no way to convert their estimate', () => {
    const html = render(staff({ editOwnInvoices: true }));
    expect(html).toContain('Save as Estimate');
    expect(html).not.toContain('Draft Order');
    expect(html).not.toContain('Issue Invoice');
  });

  it('with the permission, both conversions are offered', () => {
    const html = render(staff({ editOwnInvoices: true, issueInvoices: true }));
    expect(html).toContain('Draft Order');
    expect(html).toContain('Issue Invoice');
  });

  it('a new document offers every status to anyone', () => {
    const html = render({ ...staff({}), currentInvoice: { ...estimate, id: null, status: undefined } });
    expect(html).toContain('Draft Order');
    expect(html).toContain('Issue Invoice');
  });
});

// The pinned bar: the bill's figures stay on screen while products are added.
describe('BillingTab — pinned summary bar', () => {
  const lines = [
    { uniqueId: 10, productId: 10, name: 'Antox 9 100ml', price: 7500, quantity: 3 },
    { uniqueId: '10_bonus', productId: 10, name: 'Antox 9 100ml', price: 0, originalPrice: 7500, quantity: 1, isBonus: true },
  ];
  const base = { id: null, customerId: 1, customerName: 'Abdul Qadir Shan Cattle', customerDetails: {}, items: lines,
    deliveryBilled: 500, transportExpense: 0, discount: 1000, receivedAmount: 0, vehicle: 'Self-Pickup', date: '2026-09-02' };
  const fig = (html, k) => (html.match(new RegExp(`data-summary="${k}"[^>]*>([^<]*)<`)) || [])[1];
  const form = (inv = {}, over = {}) => render({ billingView: 'form', currentInvoice: { ...base, ...inv }, getCustomerBalance: () => 20000, ...over });

  it('shows SKUs, paid units, free units and the total that will be saved', () => {
    const html = form();
    expect([fig(html, 'skus'), fig(html, 'units'), fig(html, 'bonusUnits')]).toEqual(['2', '3', '1']);
    expect(fig(html, 'total')).toBe('Rs. 22,000');
    expect(fig(html, 'discount')).toBe('− Rs. 1,000');
    expect(fig(html, 'bonusGiven')).toBe('Rs. 7,500');
    expect(html).toContain('Issue Invoice');
    expect(html).not.toMatch(/undefined|NaN/);
  });

  it('received and balance due appear only once something is received', () => {
    expect(fig(form(), 'received')).toBeUndefined();
    const html = form({ receivedAmount: 5000 });
    expect(fig(html, 'received')).toBe('Rs. 5,000');
    expect(fig(html, 'balanceDue')).toBe('Rs. 17,000');
    expect(fig(form({ receivedAmount: 5000 }, { hasPermission: (k) => k !== 'collectOnBill' }), 'received')).toBeUndefined();
  });

  it('account after this bill: new documents only, and never counted twice', () => {
    expect(fig(form(), 'accountAfter')).toBe('Rs. 42,000');
    expect(fig(form({ id: 'INV-8457', status: 'Billed' }), 'accountAfter')).toBeUndefined();
  });

  it('an empty bill renders zeros, not blanks', () => {
    const html = form({ items: [], deliveryBilled: 0, discount: 0 });
    expect([fig(html, 'skus'), fig(html, 'units'), fig(html, 'total')]).toEqual(['0', '0', 'Rs. 0']);
  });

  it('the old totals card is gone: one total on screen', () => {
    expect((form().match(/Grand total/g) || []).length).toBe(1);
  });
});

// Newest line on top, next to the search box, on screen only. The stored order, which is what
// prints, is the order the products were added.
describe('BillingTab — newest line first on screen', () => {
  const items = [
    { uniqueId: 'a', productId: 'a', name: 'First Added', price: 100, quantity: 1 },
    { uniqueId: 'b', productId: 'b', name: 'Second Added', price: 200, quantity: 2 },
    { uniqueId: 'c', productId: 'c', name: 'Third Added', price: 300, quantity: 3 },
  ];
  const inv = { id: null, customerId: 1, customerName: 'X', customerDetails: {}, items, deliveryBilled: 0, transportExpense: 0, discount: 0, receivedAmount: 0, vehicle: 'Self-Pickup', date: '2026-11-09' };
  it('renders the last added first and says so', () => {
    const html = render({ billingView: 'form', currentInvoice: inv });
    const keys = [...html.matchAll(/data-item-row="1" data-key="([^"]+)"/g)].map(m => m[1]);
    expect(keys).toEqual(['c', 'b', 'a']);
    expect(html).toContain('Newest first');
    expect(items.map(i => i.uniqueId)).toEqual(['a', 'b', 'c']);
  });
  it('quantity and rate open the decimal keypad as text fields, so the figure can be selected', () => {
    const html = render({ billingView: 'form', currentInvoice: inv });
    expect(html).toMatch(/data-item-qty="1" type="text" inputMode="decimal"/);
    expect(html).not.toMatch(/data-item-qty="1" type="number"/);
  });
});
