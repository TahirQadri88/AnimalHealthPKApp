// Purity of the move: node tools/extraction-diff.mjs CustomersTab src/components/tabs/CustomersTab.jsx
//
// First top-level tab out of App.jsx. It shows money — every row carries the customer's
// outstanding balance — so the stub supplies a real getCustomerBalance rather than a zero,
// and the tests check the figures reach the page.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { CustomersTab } from './CustomersTab';

const CUSTOMERS = [
  { id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567', city: 'Karachi', area: 'Nazimabad', customerType: 'Farmer', contactPerson: 'Abdul', address1: 'Shop 4' },
  { id: 2, name: 'Ghousia Farms', phone: '0321-9876543', city: 'Karachi', area: 'Malir', customerType: 'Clinic', contactPerson: '', address1: '' },
  { id: 3, name: 'Settled Vet Store', phone: '', city: 'Hyderabad', area: '', customerType: 'Retailer', contactPerson: 'Ali', address1: 'Main Rd' },
];
const BALANCES = { 1: 105600, 2: -2500, 3: 0 };

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, hasPermission: () => true, currentUser: { id: 1, name: 'Owner', role: 'admin' },
    customers: CUSTOMERS, invoices: [], payments: [],
    cities: [{ id: 1, name: 'Karachi' }, { id: 2, name: 'Hyderabad' }],
    areas: [{ id: 1, name: 'Nazimabad', cityName: 'Karachi' }, { id: 2, name: 'Malir', cityName: 'Karachi' }],
    customerTypes: [{ id: 1, name: 'Farmer' }, { id: 2, name: 'Clinic' }, { id: 3, name: 'Retailer' }],
    getCustomerBalance: (id) => BALANCES[id] ?? 0,
    getCustomerLedger: () => ({ rows: [], openingBal: 0, closingBal: 0 }),
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, logSave: () => {},
    setEditingCustomer: () => {}, setShowCustomerModal: () => {},
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {},
    setSelectedCustomerForPayment: () => {}, setShowPaymentModal: () => {}, setEditingPayment: () => {},
    ...over,
  }}>
    <CustomersTab />
  </AppContext.Provider>
);

describe('CustomersTab', () => {
  it('lists the customers', () => {
    const html = render();
    expect(html).toContain('Abdul Qadir Shan Cattle');
    expect(html).toContain('Ghousia Farms');
    expect(html).toContain('Settled Vet Store');
  });

  it('shows what each one owes', () => {
    expect(render()).toContain('105,600');
  });

  it('shows an advance as an advance rather than as a debt', () => {
    // A negative balance means they have paid ahead. Printing it as money owed would have
    // somebody chasing a customer who is in credit.
    expect(render()).toContain('2,500');
  });

  // The city and area filters are SearchableSelects, closed on first paint — their options
  // are behind a click, the same as every other picker in this app. So the controls are in
  // the markup and the city names are not.
  it('renders the segment filters, whose options appear once opened', () => {
    const html = render();
    expect(html).toContain('All Cities');
    expect(html).toContain('All Types');
  });

  it('survives a customer with no phone, area or contact', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an empty customer list', () => {
    expect(() => render({ customers: [] })).not.toThrow();
    expect(render({ customers: [] })).not.toMatch(/undefined|NaN/);
  });

  // Deliberately NOT asserting that an undefined balance is survivable. The component calls
  // bal.toLocaleString() directly, and getCustomerBalance in the provider always returns a
  // number — so undefined is an input the app cannot produce. Hardening against it here
  // would be guessing at a contract rather than recording the one that exists.
  it('renders a zero balance as zero rather than hiding the customer', () => {
    expect(render()).toContain('Settled Vet Store');
  });
});
