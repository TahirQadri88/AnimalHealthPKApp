// Purity of the move: node tools/extraction-diff.mjs MastersView src/components/admin/MastersView.jsx
//
// First extracted component that renders another extracted one (CompanyManager). That is
// the pairing the extraction order exists to protect: had this moved first, it would have
// needed an import back into App.jsx, which is a cycle and a blank page.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { MastersView } from './MastersView';

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    companies: [{ id: 1, name: 'Selmore' }],
    products: [{ id: 10, name: 'Antox 9', companyId: 1, available: true }],
    expenseCategories: [{ id: 1, name: 'Transport', group: 'Transportation' }],
    isAdmin: true, saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {}, checkDuplicate: () => false,
    setShowExpenseCatModal: () => {}, setEditingProduct: () => {}, setShowProductModal: () => {},
    getCompanyName: () => 'Selmore', ...over,
  }}>
    <MastersView />
  </AppContext.Provider>
);

describe('MastersView', () => {
  it('renders without its child needing anything from App.jsx', () => {
    expect(() => render()).not.toThrow();
  });

  it('renders the brand manager it owns', () => {
    // CompanyManager is the default tab; its content proves the child import resolved.
    expect(render()).toContain('Selmore');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives empty master data', () => {
    expect(() => render({ companies: [], products: [], expenseCategories: [] })).not.toThrow();
  });
});
