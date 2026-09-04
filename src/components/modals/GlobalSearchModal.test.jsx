// The search box, rendered. The matching itself is tested in
// services/search/globalSearch.test.js; this covers what reaches the screen.
//
// useEffect does not run under SSR, so the field's autofocus is not exercised here.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { GlobalSearchModal } from './GlobalSearchModal';

const CUSTOMERS = [{ id: 1, name: 'Al Shaheer Cattle', phone: '0300-1234567', city: 'Karachi' }];
const INVOICES = [
  { id: 'INV-8475', date: '2026-09-03', status: 'Billed', customerId: 1, customerName: 'Al Shaheer Cattle', total: 136000 },
];
const PRODUCTS = [{ id: 11, name: 'Antox 9', company: 'Selmore', companyId: 100, price: 7500 }];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    customers: CUSTOMERS, invoices: INVOICES, payments: [], products: PRODUCTS,
    companies: [{ id: 100, name: 'Selmore' }],
    isAdmin: true, hasPermission: () => true,
    getCustomerBalance: () => 136000,
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {}, setPrintConfig: () => {},
    setEditingProduct: () => {}, setShowProductModal: () => {}, setActiveTab: () => {},
    ...over,
  }}>
    <GlobalSearchModal onClose={() => {}} />
  </AppContext.Provider>
);

describe('GlobalSearchModal', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  it('names what can be searched, so nobody has to guess', () => {
    const html = render();
    expect(html).toContain('Customer, phone, invoice no., receipt no., product, brand');
  });

  it('carries a label for a screen reader, not just a placeholder', () => {
    expect(render()).toContain('aria-label="Search customers, invoices, receipts, products and brands"');
  });

  it('asks for two characters rather than listing the database', () => {
    expect(render()).toContain('Type at least two characters');
  });

  // The rule people get wrong first: they type INV-8475 because they think they have to.
  it('says numbers work bare', () => {
    expect(render()).toContain('finds INV-8475');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('renders for a business with nothing in it', () => {
    expect(() => render({ customers: [], invoices: [], products: [], companies: [] })).not.toThrow();
  });
});
