// What counts as a bag on a dispatch note.
//
// A dispatch note exists so the person loading the vehicle can count what they are carrying.
// Until now it had two columns, Packs and Loose, and a 25kg bag fell into "Loose" — which
// reads as broken-open stock when it is a sealed thing you put on your shoulder. One bag is
// one pack, not thirty-odd loose kilos.
//
// The signal is the product's UNIT, not its name. On a real note the two bag lines were
// "Megavimix 25 Kg Bag" with unit "25 Kg Bag", and "HEAVY GOLD 5 in 1 Powder 20kg" with unit
// "20KG BAG" — whose NAME says nothing about a bag. The unit field's whole job is to say what
// one of these is, and it is already what the note prints beside the quantity.
//
// The name is consulted only when no unit was recorded at all. A product whose unit says
// something else was described deliberately and should be believed.

// Word-bounded, so "Bag" matches and "Bagged" or a product called "Baghdad" does not.
export const BAG_PATTERN = /\b(bags?|sacks?|boris?)\b/i;

export const isBagUnit = (unit, name = '') => {
  const u = String(unit || '').trim();
  if (u) return BAG_PATTERN.test(u);
  return BAG_PATTERN.test(String(name || ''));
};

/**
 * Split a line into what the loader actually counts.
 *
 * Three kinds, and every unit lands in exactly one:
 *   bags   — sealed sacks, counted whole
 *   boxes  — full cartons, at `uib` units each
 *   loose  — everything else, including the remainder of a part-used carton
 *
 * The invariant the dispatch note depends on: boxes × uib + bags + loose === qty.
 */
export const splitDispatchLine = ({ quantity, unitsInBox, unit, name } = {}) => {
  const qty = Number(quantity) || 0;
  if (isBagUnit(unit, name)) return { qty, uib: 1, boxes: 0, loose: 0, bags: qty };
  const uib = Number(unitsInBox) || 1;
  return {
    qty,
    uib,
    boxes: uib > 1 ? Math.floor(qty / uib) : 0,
    loose: uib > 1 ? qty % uib : qty,
    bags: 0,
  };
};
