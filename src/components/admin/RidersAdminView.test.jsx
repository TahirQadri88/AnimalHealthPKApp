// Purity of the move: node tools/extraction-diff.mjs RidersAdminView src/components/admin/RidersAdminView.jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { RidersAdminView } from './RidersAdminView';

const VEHICLE_TYPES = [
  { id: 1, name: 'Rider', requiresRider: true },
  { id: 2, name: 'Rickshaw', requiresRider: true },
  { id: 3, name: 'Suzuki', requiresRider: true },
  { id: 4, name: 'Intercity Transport', requiresRider: false },
  { id: 5, name: 'Self-Pickup', requiresRider: false },
];
const RIDERS = [
  { id: 1, name: 'Ali Raza', phone: '0345-1112222', vehicleType: 'Rider', vehicleNumber: 'ABC-123' },
  { id: 2, name: 'Bilal', phone: '', vehicleType: 'Suzuki', vehicleNumber: '' },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    riders: RIDERS, vehicleTypes: VEHICLE_TYPES,
    saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {}, ...over,
  }}>
    <RidersAdminView />
  </AppContext.Provider>
);

describe('RidersAdminView', () => {
  it('lists the registered riders with their vehicle and number', () => {
    const html = render();
    expect(html).toContain('Ali Raza');
    expect(html).toContain('0345-1112222');
    expect(html).toContain('ABC-123');
    expect(html).toContain('Bilal');
  });

  it('says so when a rider has no phone rather than leaving a gap', () => {
    expect(render()).toContain('No phone');
  });

  it('counts them', () => {
    expect(render()).toContain('Registered Riders');
    expect(render()).toContain('>2<');
  });

  it('offers only the vehicle types that carry a rider', () => {
    const html = render();
    expect(html).toContain('Rider');
    expect(html).toContain('Rickshaw');
    expect(html).toContain('Suzuki');
    // A courier or a self-collection is not something you register a rider against.
    expect(html).not.toContain('Intercity Transport');
    expect(html).not.toContain('Self-Pickup');
  });

  // The registry can be empty on first load, before the seeding effect has run.
  it('falls back to the three built-in types when the registry is empty', () => {
    const html = render({ vehicleTypes: [] });
    expect(html).toContain('Rider');
    expect(html).toContain('Rickshaw');
    expect(html).toContain('Suzuki');
  });

  it('invites the first rider when there are none', () => {
    expect(render({ riders: [] })).toContain('No riders registered yet');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
    expect(render({ riders: [{ id: 9, name: 'Partial' }] })).not.toMatch(/undefined|NaN/);
  });
});
