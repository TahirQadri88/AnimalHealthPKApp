// Purity of the move: proved in the previous commit. Testable only once document numbering
// moved to the context.
//
// Money, and the awkward kind: a credit note gives money back. Its figures are covered by
// ledger.test.js and profitAndLoss.test.js; what these check is the screen — that it opens
// against the right customer, offers what they actually bought, and prices a return at
// what was charged rather than at today's rate.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { CreditNoteModal } from './CreditNoteModal';

const CUSTOMERS = [{ id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' }];
const PRODUCTS = [
  { id: 10, name: 'Antox 9 100ml', companyId: 1, sellingPrice: 8000, costPrice: 6000 },
  { id: 11, name: 'Ratava Spray', companyId: 1, sellingPrice: 1000, costPrice: 600 },
];
// Sold at 7,500 — below today's 8,000 list price. A return must credit what was charged.
const INVOICES = [{
  id: 'INV-8457', date: '2026-08-20', customerId: 1, status: 'Billed', total: 75000,
  items: [{ productId: 10, name: 'Antox 9 100ml', quantity: 10, price: 7500, costPrice: 6000 }],
}];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    currentUser: { id: 1, name: 'Owais' }, products: PRODUCTS, customers: CUSTOMERS,
    invoices: INVOICES, invoicesRaw: INVOICES,
    editingCreditNote: { customerId: 1, id: '' },
    getCompanyName: () => 'Selmore', nextDocNumber: async () => 9,
    saveToFirebase: () => {}, showToast: () => {}, logSave: () => {},
    setShowCreditNoteModal: () => {}, setEditingCreditNote: () => {}, ...over,
  }}>
    <CreditNoteModal />
  </AppContext.Provider>
);

describe('CreditNoteModal', () => {
  it('opens against the customer it was raised for', () => {
    expect(render()).toContain('Abdul Qadir Shan Cattle');
  });

  it('offers what that customer actually bought', () => {
    expect(render()).toContain('Antox 9 100ml');
  });

  // The reason a return is priced from history and not from the product list. Note the
  // history chip prints the figure unformatted — Rs.7500, not Rs.7,500 — which is a
  // cosmetic inconsistency with the rest of the app, recorded here rather than fixed
  // inside an extraction.
  it('shows the price it was sold at, not today’s list price', () => {
    const html = render();
    expect(html).toContain('Rs.7500');
    expect(html).not.toContain('8000');
  });

  it('renders for a customer who has bought nothing', () => {
    expect(() => render({ invoices: [], invoicesRaw: [] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
