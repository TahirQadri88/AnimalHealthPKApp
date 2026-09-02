// Purity of the move: node tools/extraction-diff.mjs CompanyManager src/components/admin/CompanyManager.jsx
//
// The only extracted component so far that takes a prop: MastersView passes its search box
// down as `search`. That contract is what these mostly cover.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { CompanyManager } from './CompanyManager';

const COMPANIES = [
  { id: 1, name: 'Selmore' },
  { id: 2, name: 'Star Laboratories' },
  { id: 3, name: 'Hilton Pharma' },
];
const PRODUCTS = [
  { id: 10, name: 'Antox 9', companyId: 1 },
  { id: 11, name: 'Ratava Spray', companyId: 1 },
  { id: 12, name: 'Gripe Water', companyId: 2 },
];

const render = (props = {}, over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    companies: COMPANIES, products: PRODUCTS,
    saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, checkDuplicate: () => false, showConfirm: () => {}, ...over,
  }}>
    <CompanyManager {...props} />
  </AppContext.Provider>
);

describe('CompanyManager', () => {
  it('lists every brand when no search is passed', () => {
    const html = render();
    expect(html).toContain('Selmore');
    expect(html).toContain('Star Laboratories');
    expect(html).toContain('Hilton Pharma');
  });

  it('filters on the search term its parent hands down', () => {
    const html = render({ search: 'star' });
    expect(html).toContain('Star Laboratories');
    expect(html).not.toContain('Selmore');
    expect(html).not.toContain('Hilton Pharma');
  });

  it('matches case-insensitively', () => {
    expect(render({ search: 'HILTON' })).toContain('Hilton Pharma');
  });

  it('shows how many products hang off each brand', () => {
    // Deleting a brand with products attached is the thing this count exists to prevent.
    const html = render();
    expect(html).toMatch(/Selmore[\s\S]{0,400}2/);
  });

  it('handles a brand with no products', () => {
    expect(render()).toContain('Hilton Pharma');
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an empty registry', () => {
    expect(() => render({}, { companies: [], products: [] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render({ search: '' })).not.toMatch(/undefined|NaN/);
  });
});
