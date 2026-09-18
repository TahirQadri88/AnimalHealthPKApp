// Purity of the move: node tools/extraction-diff.mjs CustomerModal src/components/modals/CustomerModal.jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { CustomerModal } from './CustomerModal';

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    editingCustomer: null, customers: [], invoices: [],
    cities: [{ id: 1, name: 'Karachi' }], areas: [{ id: 1, name: 'Nazimabad', cityName: 'Karachi' }],
    customerTypes: [{ id: 1, name: 'Farmer' }],
    billingView: 'list', currentInvoice: null, setCurrentInvoice: () => {},
    isAdmin: true, checkDuplicate: () => false, saveToFirebase: () => {},
    showToast: () => {}, setShowCustomerModal: () => {}, setEditingCustomer: () => {}, ...over,
  }}>
    <CustomerModal />
  </AppContext.Provider>
);

describe('CustomerModal', () => {
  it('renders a blank form for a new client', () => {
    expect(render()).toContain('Add');
  });

  it('offers both addresses — a client can take delivery in two places', () => {
    const html = render();
    expect(html.match(/Address/g).length).toBeGreaterThan(1);
  });

  it('carries the opening balance field, which is real debt with no invoice behind it', () => {
    expect(render().toLowerCase()).toContain('opening');
  });

  it('renders when editing an existing client', () => {
    const existing = { id: 9, name: 'Ghousia Farms', phone: '0300', city: 'Karachi', area: 'Nazimabad', openingBalance: 4000 };
    expect(render({ editingCustomer: existing })).toContain('Ghousia Farms');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});

// ── Cash Sale (Walk in Customer) ────────────────────────────────────────────
//
// Added 2026-09-18. Bills for a counter account open on Bill Only; the checkbox is what
// makes that an answer rather than a guess at the name.
describe('CustomerModal — the cash customer checkbox', () => {
  it('offers it, named the way the business names it', () => {
    const html = render();
    expect(html).toContain('Cash Sale (Walk in Customer)');
    expect(html).toContain('type="checkbox"');
  });

  it('says what ticking it does, and that the document can still override', () => {
    const html = render();
    expect(html).toContain('Bill Only');
    expect(html).toContain('still overrides');
  });

  it('is clear for a new customer', () => {
    expect(render()).not.toContain('checked=""');
  });

  it('is ticked for a customer already marked', () => {
    expect(render({ editingCustomer: { id: 5, name: 'Front Desk', isCashCustomer: true } }))
      .toContain('checked=""');
  });

  // The hazard this seeding exists for. Before the checkbox, the walk-in account was
  // recognised by its name alone — opening it here and saving must not write `false` over
  // that and demote the one record the feature was built for.
  it('is ticked for the walk-in account that predates the checkbox', () => {
    expect(render({ editingCustomer: { id: 1, name: 'Cash Sale (Walk in Customer)' } }))
      .toContain('checked=""');
  });

  it('stays clear for a named customer who has never been asked', () => {
    expect(render({ editingCustomer: { id: 2, name: 'Al Shaheer Cattle' } }))
      .not.toContain('checked=""');
  });

  // And an explicit no is honoured over a name that reads like a counter account.
  it('stays clear for a real customer explicitly marked as not one', () => {
    expect(render({ editingCustomer: { id: 3, name: 'Walk In Traders', isCashCustomer: false } }))
      .not.toContain('checked=""');
  });
});
