// Purity of the move: node tools/extraction-diff.mjs ProductsTab src/components/tabs/ProductsTab.jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { ProductsTab } from './ProductsTab';

const PRODUCTS = [
  { id: 10, name: 'Antox 9 100ml', companyId: 1, costPrice: 6000, sellingPrice: 7500, available: true, unit: 'btl' },
  { id: 11, name: 'Old Stock', companyId: 1, costPrice: 100, sellingPrice: 150, available: false, archived: true },
];
const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, products: PRODUCTS, companies: [{ id: 1, name: 'Selmore' }],
    getCompanyName: () => 'Selmore', saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {},
    setEditingProduct: () => {}, setShowProductModal: () => {}, setProductPreFill: () => {},
    ...over,
  }}>
    <ProductsTab />
  </AppContext.Provider>
);

describe('ProductsTab', () => {
  it('lists the catalogue', () => {
    expect(render()).toContain('Antox 9 100ml');
  });

  // Archived stock is SHOWN, not hidden — dimmed, badged, and offering restore instead of
  // archive. Hiding it would leave a product nobody could find to bring back.
  it('shows archived stock, marked as such', () => {
    const html = render();
    expect(html).toContain('Old Stock');
    expect(html).toContain('opacity-75');
  });

  it('renders an empty catalogue', () => {
    expect(() => render({ products: [] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
