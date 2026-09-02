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
