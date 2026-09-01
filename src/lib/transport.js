// How a consignment leaves the building.
//
// A "transport method" hands the consignment to an outside courier (Intercity Transport
// and friends) instead of it being carried by one of our own riders. Kept in one place
// because the invoice form, the prefill and the save path must all agree: if they don't,
// a courier name can survive onto a rider delivery and print on the dispatch note.
export const isTransportMethod = (vehicleTypes, name) => {
  if (!name || name === 'Self-Pickup') return false;
  const vt = (vehicleTypes || []).find(v => v.name === name);
  return vt ? !vt.requiresRider : name === 'Intercity Transport';
};

// Is this method still in the registry? A vehicle type can be renamed or deleted while
// invoices keep the old name on purpose (they record the method used at the time), so an
// unknown name means "we cannot classify this", not "this carries no courier". Anything
// that ERASES data must check this first - see saveInvoice.
export const isKnownVehicleType = (vehicleTypes, name) =>
  !!name && (vehicleTypes || []).some(v => v.name === name);

// Self-Pickup is the only method where nobody carries the goods for us, so it is the only
// one where the booking person is meaningless.
export const usesCarrierPerson = (name) => !!name && name !== 'Self-Pickup';
