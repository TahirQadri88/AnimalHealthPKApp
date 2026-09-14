// The Packs / Loose split on a dispatch note, which is what the person loading the vehicle
// counts against.
//
// Reported 2026-09-14 from a real note: eight lines, "80 units total · 3 Packs · 35 Loose".
// The only line carrying a Packs badge was 36 vials in 3 packs of twelve, so 36 units were
// packed and 35 were loose — and 36 + 35 is 71, not 80. Nine units, two 25kg bags and some
// disposables among them, appeared in the total and in neither column.
//
// The cause is a guard in the footer: `uib > 1 ? loose : 0`, which drops every item that has
// no box size. A 25kg bag is one whole thing you carry; it belongs in the count.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';

const line = (name, quantity, unitsInBox) => ({ productId: name, name, quantity, price: 100, unitsInBox });

const dispatch = (items) => ({
  id: 'INV-8561', date: '2026-09-14', customerId: 7, customerName: 'Haris Afzal Fooder Piyala Hotel',
  driverName: 'Ibrahim', driverPhone: '+92 300 4977894', vehicle: 'Rickshaw', items,
  customerDetails: { contactPerson: 'Haris', phone: '+92 317 1067326' },
});

const render = (items, format = 'a4') => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType: 'dispatch', format, data: dispatch(items) }}
    setPrintConfig={() => {}} products={[]} customers={[]}
    getCustomerLedger={() => null} getCustomerBalance={() => 0}
    showToast={() => {}} appSettings={{}}
  />
);

// The footer badges, read back off the rendered page.
const footerTotals = (html) => {
  const foot = html.slice(html.indexOf('Total SKUs'));
  const units = foot.match(/(\d+)\s*units total/);
  const packs = foot.match(/(\d+)\s*Packs?</);
  const loose = foot.match(/(\d+)\s*Loose</);
  return {
    units: units ? Number(units[1]) : null,
    packs: packs ? Number(packs[1]) : 0,
    loose: loose ? Number(loose[1]) : 0,
  };
};

describe('dispatch note — every unit is either packed or loose', () => {
  // The reported note, rebuilt: one boxed line and a pile of things sold as single units,
  // including the two bags.
  const REPORTED = [
    line('Sailectury 250gm', 10, 1),
    line('Nitoxil 10ml Star', 36, 12),
    line('Nitoxil 100ml Star', 5, 1),
    line('Sulpha Star', 15, 1),
    line('Ivotek Super 10ml', 5, 1),
    line('Megavimix 25 Kg Bag', 2, 1),
    line('HEAVY GOLD 5 in 1 Powder 20kg', 5, 1),
    line('Disposable 18 No 3/4', 2, 1),
  ];

  it('counts the same units in the split as in the total', () => {
    const t = footerTotals(render(REPORTED));
    expect(t.units).toBe(80);
    expect(t.packs).toBe(3);
    // 3 packs of twelve is 36 units; the other 44 are loose. It reported 0 — every line
    // with no box size was dropped.
    expect(t.loose).toBe(44);
    expect(t.packs * 12 + t.loose).toBe(t.units);
  });

  it('counts a bag, which is one whole thing somebody has to carry', () => {
    const t = footerTotals(render([line('Nitoxil 10ml Star', 36, 12), line('Megavimix 25 Kg Bag', 2, 1)]));
    expect(t.units).toBe(38);
    expect(t.loose).toBe(2);
  });

  it('still counts the part-box remainder of a boxed line', () => {
    // 40 vials of twelve: three full packs and four over.
    const t = footerTotals(render([line('Nitoxil 10ml Star', 40, 12)]));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(4);
    expect(t.packs * 12 + t.loose).toBe(t.units);
  });

  it('adds a bag to that remainder rather than choosing between them', () => {
    const t = footerTotals(render([line('Nitoxil 10ml Star', 40, 12), line('Megavimix 25 Kg Bag', 2, 1)]));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(6);
    expect(t.units).toBe(42);
  });

  it('says nothing about packs when nothing is boxed', () => {
    // No Packs badge means no Loose badge either — the units line already says it all.
    const t = footerTotals(render([line('Megavimix 25 Kg Bag', 2, 1), line('HEAVY GOLD 20kg', 5, 1)]));
    expect(t.units).toBe(7);
    expect(t.packs).toBe(0);
  });

  it('holds on the thermal roll too', () => {
    const t = footerTotals(render(REPORTED, 'thermal'));
    expect(t.packs * 12 + t.loose).toBe(t.units);
  });

  it('leaks no undefined into the note', () => {
    expect(render(REPORTED)).not.toMatch(/undefined|NaN/);
  });
});
