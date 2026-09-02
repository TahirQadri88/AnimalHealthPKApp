// Purity of the move: node tools/extraction-diff.mjs SegmentsAdminView src/components/admin/SegmentsAdminView.jsx
//
// Renders TransportCompaniesManager inline, scoped to one vehicle type — the second
// parent/child pair the extraction order had to get right.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { SegmentsAdminView } from './SegmentsAdminView';

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    cities: [{ id: 1, name: 'Karachi' }, { id: 2, name: 'Hyderabad' }],
    areas: [{ id: 1, name: 'Nazimabad', cityName: 'Karachi' }],
    customerTypes: [{ id: 1, name: 'Farmer' }],
    vehicleTypes: [
      { id: 1, name: 'Rider', requiresRider: true },
      { id: 2, name: 'Intercity Transport', requiresRider: false },
    ],
    riders: [], transportCompanies: [], customers: [], invoices: [],
    getCustomerBalance: () => 0, setShowSegmentsModal: () => {},
    saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {}, checkDuplicate: () => false, ...over,
  }}>
    <SegmentsAdminView />
  </AppContext.Provider>
);

describe('SegmentsAdminView', () => {
  it('renders with its child component resolved', () => {
    expect(() => render()).not.toThrow();
  });

  it('lists the cities on its default tab', () => {
    const html = render();
    expect(html).toContain('Karachi');
    expect(html).toContain('Hyderabad');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an empty registry', () => {
    expect(() => render({ cities: [], areas: [], customerTypes: [], vehicleTypes: [] })).not.toThrow();
  });
});
