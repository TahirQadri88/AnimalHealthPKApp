// Purity of the move: node tools/extraction-diff.mjs BulkOpsView src/components/admin/BulkOpsView.jsx
//
// extraction-diff reported that bracket balance was unreliable here and fell back to the
// next component boundary — an apostrophe in JSX text. The fallback is the correct
// boundary; the note is the tool refusing to pretend otherwise.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { BulkOpsView } from './BulkOpsView';

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, products: [{ id: 1, name: 'Antox 9', companyId: 1, costPrice: 6000, sellingPrice: 7500, available: true }],
    companies: [{ id: 1, name: 'Selmore' }], customers: [], invoices: [], payments: [],
    expenses: [], expenseCategories: [], appUsers: [], riders: [], transportCompanies: [],
    cities: [], areas: [], customerTypes: [], vehicleTypes: [],
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, getCompanyName: () => 'Selmore', checkDuplicate: () => false, ...over,
  }}>
    <BulkOpsView />
  </AppContext.Provider>
);

describe('BulkOpsView', () => {
  it('renders', () => {
    expect(() => render()).not.toThrow();
  });

  // The editable rows come from local state that a useEffect copies out of `products`, and
  // effects do not run under SSR — so the grid is empty on first paint and fills a tick
  // later. Asserting the products were present would have been asserting a lie.
  it('renders its export controls, which do not wait for an effect', () => {
    const html = render();
    expect(html).toContain('Items');
    expect(html).toContain('CSV');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an empty catalogue', () => {
    expect(() => render({ products: [], companies: [] })).not.toThrow();
    expect(render({ products: [], companies: [] })).not.toMatch(/undefined|NaN/);
  });
});
