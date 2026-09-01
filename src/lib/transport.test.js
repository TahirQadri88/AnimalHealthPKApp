import { describe, it, expect } from 'vitest';
import { isTransportMethod, isKnownVehicleType, usesCarrierPerson } from './transport';

// The registry as it is actually seeded.
const TYPES = [
  { name: 'Rider', requiresRider: true },
  { name: 'Rickshaw', requiresRider: true },
  { name: 'Suzuki', requiresRider: true },
  { name: 'Intercity Transport', requiresRider: false },
  { name: 'Self-Pickup', requiresRider: false },
];

describe('isTransportMethod', () => {
  it('is true only where an outside courier takes the goods', () => {
    expect(isTransportMethod(TYPES, 'Intercity Transport')).toBe(true);
    expect(isTransportMethod(TYPES, 'Rider')).toBe(false);
    expect(isTransportMethod(TYPES, 'Suzuki')).toBe(false);
  });

  it('is false for Self-Pickup even though it needs no rider', () => {
    // requiresRider is false here, so the registry alone would say "courier". It is not.
    expect(isTransportMethod(TYPES, 'Self-Pickup')).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isTransportMethod(TYPES, '')).toBe(false);
    expect(isTransportMethod(TYPES, undefined)).toBe(false);
  });

  it('falls back to the one known name when the registry has not loaded', () => {
    expect(isTransportMethod([], 'Intercity Transport')).toBe(true);
    expect(isTransportMethod(undefined, 'Intercity Transport')).toBe(true);
    expect(isTransportMethod([], 'Rider')).toBe(false);
  });

  // This is the distinction that destroyed consignment numbers once. A renamed vehicle
  // type makes every invoice on it "unknown", and unknown returns false — the same answer
  // as "no courier". Code that DELETES must ask isKnownVehicleType first.
  it('returns false for a method it has never heard of, which is not the same as "no courier"', () => {
    expect(isTransportMethod(TYPES, 'TCS Overnight')).toBe(false);
    expect(isKnownVehicleType(TYPES, 'TCS Overnight')).toBe(false);
  });
});

describe('isKnownVehicleType', () => {
  it('tells a renamed or deleted method apart from a current one', () => {
    expect(isKnownVehicleType(TYPES, 'Rider')).toBe(true);
    expect(isKnownVehicleType(TYPES, 'Daewoo Express')).toBe(false);
  });

  it('is false rather than throwing on missing input', () => {
    expect(isKnownVehicleType(undefined, 'Rider')).toBe(false);
    expect(isKnownVehicleType(TYPES, '')).toBe(false);
    expect(isKnownVehicleType(TYPES, undefined)).toBe(false);
  });
});

describe('usesCarrierPerson', () => {
  it('is true wherever somebody carries the goods for us', () => {
    expect(usesCarrierPerson('Rider')).toBe(true);
    expect(usesCarrierPerson('Intercity Transport')).toBe(true);   // the person who books it
    expect(usesCarrierPerson('TCS Overnight')).toBe(true);          // unknown, but still carried
  });

  it('is false only for Self-Pickup and for nothing', () => {
    expect(usesCarrierPerson('Self-Pickup')).toBe(false);
    expect(usesCarrierPerson('')).toBe(false);
    expect(usesCarrierPerson(undefined)).toBe(false);
  });
});
