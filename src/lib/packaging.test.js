import { describe, it, expect } from 'vitest';
import { isBagUnit, splitDispatchLine } from './packaging';

describe('isBagUnit', () => {
  // Both bag lines on the reported note, and the reason the unit is the signal rather than
  // the name: HEAVY GOLD's name says nothing about a bag.
  it('reads the units a real note actually carries', () => {
    expect(isBagUnit('25 Kg Bag')).toBe(true);
    expect(isBagUnit('20KG BAG')).toBe(true);
    expect(isBagUnit('Bag')).toBe(true);
    expect(isBagUnit('Sack')).toBe(true);
  });

  it('is not fooled by a word that merely contains bag', () => {
    expect(isBagUnit('Bagged Vial')).toBe(false);
    expect(isBagUnit('Baghdad Special')).toBe(false);
  });

  it('does not call a vial, a bottle or a packet a bag', () => {
    ['Vial', '10ml Vial', '250gm packet', 'Bottle', '1 box of 5 vials', ''].forEach(u => {
      expect(isBagUnit(u)).toBe(false);
    });
  });

  // Only when nothing was recorded. A unit that says something else was set deliberately.
  it('falls back to the name only when no unit was recorded', () => {
    expect(isBagUnit('', 'Megavimix 25 Kg Bag')).toBe(true);
    expect(isBagUnit('Vial', 'Megavimix 25 Kg Bag')).toBe(false);
    expect(isBagUnit('   ', 'Wheat Sack 40kg')).toBe(true);
  });

  it('says no to nothing at all rather than throwing', () => {
    expect(isBagUnit(undefined, undefined)).toBe(false);
    expect(isBagUnit(null)).toBe(false);
  });
});

describe('splitDispatchLine', () => {
  // The property the note depends on: nothing is counted twice and nothing goes missing.
  const totals = (l) => l.boxes * l.uib + l.bags + l.loose;

  it('counts a bag whole, not as loose kilos', () => {
    const l = splitDispatchLine({ quantity: 2, unit: '25 Kg Bag', unitsInBox: 1 });
    expect(l).toMatchObject({ bags: 2, loose: 0, boxes: 0 });
    expect(totals(l)).toBe(2);
  });

  // The fault that started this: a bag whose unitsInBox had been set to its weight.
  it('counts a bag whole even if someone put its weight in unitsInBox', () => {
    const l = splitDispatchLine({ quantity: 2, unit: '25 Kg Bag', unitsInBox: 25 });
    expect(l.bags).toBe(2);
    expect(l.loose).toBe(0);
    expect(totals(l)).toBe(2);
  });

  it('splits a boxed line into full cartons and the remainder', () => {
    const l = splitDispatchLine({ quantity: 40, unit: '10ml Vial', unitsInBox: 12 });
    expect(l).toMatchObject({ boxes: 3, loose: 4, bags: 0 });
    expect(totals(l)).toBe(40);
  });

  it('calls an exact number of cartons no loose at all', () => {
    expect(splitDispatchLine({ quantity: 36, unit: 'Vial', unitsInBox: 12 }))
      .toMatchObject({ boxes: 3, loose: 0, bags: 0 });
  });

  it('calls a line with no box size loose, which is what it is', () => {
    const l = splitDispatchLine({ quantity: 15, unit: 'Vial' });
    expect(l).toMatchObject({ boxes: 0, loose: 15, bags: 0 });
    expect(totals(l)).toBe(15);
  });

  it('keeps the invariant for anything malformed', () => {
    [{}, { quantity: 'x' }, { quantity: 5, unitsInBox: 0 }, { quantity: 5, unitsInBox: -3 }]
      .forEach(input => {
        const l = splitDispatchLine(input);
        expect(Number.isNaN(totals(l))).toBe(false);
        expect(totals(l)).toBe(l.qty);
      });
    expect(splitDispatchLine()).toMatchObject({ qty: 0, bags: 0, loose: 0, boxes: 0 });
  });
});
