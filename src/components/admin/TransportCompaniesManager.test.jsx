// Purity of the move: node tools/extraction-diff.mjs TransportCompaniesManager src/components/admin/TransportCompaniesManager.jsx
//
// Rendered in two places — its own admin tab and inline inside SegmentsAdminView, where it
// is scoped to one vehicle type by the lockedType prop. Both shapes are covered.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { TransportCompaniesManager } from './TransportCompaniesManager';

const VEHICLE_TYPES = [
  { id: 1, name: 'Rider', requiresRider: true },
  { id: 2, name: 'Intercity Transport', requiresRider: false },
  { id: 3, name: 'Self-Pickup', requiresRider: false },
];
const COMPANIES = [
  { id: 1, name: 'Daewoo Express', phone: '021-111007007', city: 'Karachi', transportType: 'Intercity Transport', defaultDriver: 'Ali' },
  { id: 2, name: 'TCS', phone: '', city: '', transportType: 'Intercity Transport', defaultDriver: '' },
];
const render = (props = {}, over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    transportCompanies: COMPANIES, vehicleTypes: VEHICLE_TYPES,
    saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {}, ...over,
  }}>
    <TransportCompaniesManager {...props} />
  </AppContext.Provider>
);

describe('TransportCompaniesManager', () => {
  it('lists the couriers with their details', () => {
    const html = render();
    expect(html).toContain('Daewoo Express');
    expect(html).toContain('021-111007007');
    expect(html).toContain('Karachi');
  });

  it('survives a courier with no phone, city or default driver', () => {
    expect(render()).toContain('TCS');
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  // A courier belongs to a transport method, never to a rider method — that distinction is
  // what stopped courier names leaking onto rider deliveries.
  it('offers only vehicle types that use an outside courier', () => {
    const html = render();
    expect(html).toContain('Intercity Transport');
    expect(html).not.toContain('>Rider<');
  });

  it('scopes to one type when its parent locks it', () => {
    expect(() => render({ lockedType: 'Intercity Transport', compact: true })).not.toThrow();
    expect(render({ lockedType: 'Intercity Transport', compact: true })).toContain('Daewoo Express');
  });

  it('survives an empty registry', () => {
    expect(() => render({}, { transportCompanies: [] })).not.toThrow();
  });
});
