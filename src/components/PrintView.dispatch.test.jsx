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

const line = (name, quantity, unitsInBox, unit) => ({ productId: name, name, quantity, price: 100, unitsInBox, unit });

const dispatch = (items) => ({
  id: 'INV-8561', date: '2026-09-14', customerId: 7, customerName: 'Haris Afzal Fooder Piyala Hotel',
  driverName: 'Ibrahim', driverPhone: '+92 300 4977894', vehicle: 'Rickshaw', items,
  customerDetails: { contactPerson: 'Haris', phone: '+92 317 1067326' },
});

const render = (items, format = 'a4', products = []) => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType: 'dispatch', format, data: dispatch(items) }}
    setPrintConfig={() => {}} products={products} customers={[]}
    getCustomerLedger={() => null} getCustomerBalance={() => 0}
    showToast={() => {}} appSettings={{}}
  />
);

// The footer badges, read back off the rendered page.
const footerTotals = (html) => {
  const foot = html.slice(html.indexOf('Total SKUs'));
  const units = foot.match(/(\d+)\s*units total/);
  const packs = foot.match(/(\d+)\s*Packs?</);
  const bags = foot.match(/(\d+)\s*Bags?</);
  const loose = foot.match(/(\d+)\s*Loose</);
  return {
    units: units ? Number(units[1]) : null,
    packs: packs ? Number(packs[1]) : 0,
    bags: bags ? Number(bags[1]) : 0,
    loose: loose ? Number(loose[1]) : 0,
  };
};

describe('dispatch note — every unit is either packed or loose', () => {
  // The reported note, rebuilt: one boxed line and a pile of things sold as single units,
  // including the two bags.
  const REPORTED = [
    line('Sailectury 250gm', 10, 1, '250gm packet'),
    line('Nitoxil 10ml Star', 36, 12, '10ml Vial'),
    line('Nitoxil 100ml Star', 5, 1, '100ml'),
    line('Sulpha Star', 15, 1, 'Vial'),
    line('Ivotek Super 10ml', 5, 1, '1 box of 5 vials'),
    line('Megavimix 25 Kg Bag', 2, 1, '25 Kg Bag'),
    line('HEAVY GOLD 5 in 1 Powder 20kg', 5, 1, '20KG BAG'),
    line('Disposable 18 No 3/4', 2, 1, ''),
  ];

  it('counts the same units in the split as in the total', () => {
    const t = footerTotals(render(REPORTED));
    expect(t.units).toBe(80);
    expect(t.packs).toBe(3);      // 36 vials in cartons of twelve
    expect(t.bags).toBe(7);       // two Megavimix, five HEAVY GOLD
    expect(t.loose).toBe(37);     // everything else
    expect(t.packs * 12 + t.bags + t.loose).toBe(t.units);
  });

  it('counts a bag as a bag, not as loose stock', () => {
    const t = footerTotals(render([line('Nitoxil 10ml Star', 36, 12), line('Megavimix 25 Kg Bag', 2, 1, '25 Kg Bag')]));
    expect(t.units).toBe(38);
    expect(t.bags).toBe(2);
    expect(t.loose).toBe(0);
  });

  // HEAVY GOLD's NAME says nothing about a bag; its unit does. That is why the unit is the
  // signal.
  it('recognises a bag from its unit even when the name never says so', () => {
    const t = footerTotals(render([line('HEAVY GOLD 5 in 1 Powder 20kg', 5, 1, '20KG BAG')]));
    expect(t.bags).toBe(5);
    expect(t.loose).toBe(0);
  });

  it('is not fooled into calling a vial a bag', () => {
    const t = footerTotals(render([line('Sulpha Star', 15, 1, 'Vial')]));
    expect(t.bags).toBe(0);
  });

  it('still counts the part-box remainder of a boxed line', () => {
    // 40 vials of twelve: three full packs and four over.
    const t = footerTotals(render([line('Nitoxil 10ml Star', 40, 12)]));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(4);
    expect(t.packs * 12 + t.loose).toBe(t.units);
  });

  it('keeps all three apart on one note', () => {
    const t = footerTotals(render([
      line('Nitoxil 10ml Star', 40, 12, 'Vial'),
      line('Megavimix 25 Kg Bag', 2, 1, '25 Kg Bag'),
    ]));
    expect(t.packs).toBe(3);
    expect(t.bags).toBe(2);
    expect(t.loose).toBe(4);      // the remainder of the part carton, and nothing else
    expect(t.units).toBe(42);
  });

  // A note of nothing but bags must still show the count — it used to appear only when
  // something was boxed.
  it('shows the bag count on a note with no cartons at all', () => {
    const t = footerTotals(render([
      line('Megavimix 25 Kg Bag', 2, 1, '25 Kg Bag'),
      line('HEAVY GOLD 20kg', 5, 1, '20KG BAG'),
    ]));
    expect(t.units).toBe(7);
    expect(t.packs).toBe(0);
    expect(t.bags).toBe(7);
  });

  it('holds on the thermal roll too', () => {
    const t = footerTotals(render(REPORTED, 'thermal'));
    expect(t.packs * 12 + t.bags + t.loose).toBe(t.units);
    expect(t.bags).toBe(7);
  });

  it('leaks no undefined into the note', () => {
    expect(render(REPORTED)).not.toMatch(/undefined|NaN/);
  });
});

// ── Correcting a product reaches the notes already raised ───────────────────
//
// Reported 2026-09-26: "when i change a product's units per carton it doesn't reflect in
// the dispatch note same day."
//
// saveInvoice snapshots unit and unitsInBox onto every line, and getDispatchParts preferred
// that snapshot — so a line billed at ten per carton stayed at ten however the product was
// corrected afterwards. Neither the render-time enrichment nor the Fix Invoice Units button
// helped: both only fill in a MISSING unit, never a stale one. There was no route at all.
//
// These two fields are display-only. They decide the Packs / Bags / Loose split and the
// label beside a quantity, and nothing else — no price, no total, no ledger, no P&L. And a
// dispatch note is a picking document: it tells whoever is loading the vehicle what to put
// on it now, so the carton size the product has NOW is the right answer, every time. Price
// stays snapshotted, as it must.
describe('a corrected carton size reaches an invoice already raised', () => {
  // Billed when the product said ten per carton; the product says twelve now.
  const BILLED_AT_TEN = [{ productId: 'nitoxil', name: 'Nitoxil 10ml Star', quantity: 36, price: 100, unitsInBox: 10, unit: '10ml Vial' }];
  const PRODUCT_NOW = [{ id: 'nitoxil', name: 'Nitoxil 10ml Star', unitsInBox: 12, unit: '10ml Vial' }];

  it('splits by the carton size the product has now', () => {
    const t = footerTotals(render(BILLED_AT_TEN, 'a4', PRODUCT_NOW));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(0);          // 36 / 12, not 36 / 10 with six over
    expect(t.packs * 12 + t.loose).toBe(t.units);
  });

  it('used the stale snapshot before, which is the reported fault', () => {
    // With no product to read, the line's own frozen ten is all there is: 3 packs, 6 loose.
    const t = footerTotals(render(BILLED_AT_TEN, 'a4', []));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(6);
  });

  // The unit decides bag classification, so correcting it has to land too.
  it('picks up a unit corrected to say Bag', () => {
    const line = [{ productId: 'mega', name: 'Megavimix 25 Kg', quantity: 2, price: 100, unitsInBox: 1, unit: 'Kg' }];
    const now = [{ id: 'mega', name: 'Megavimix 25 Kg', unitsInBox: 1, unit: '25 Kg Bag' }];
    const t = footerTotals(render(line, 'a4', now));
    expect(t.bags).toBe(2);
    expect(t.loose).toBe(0);
  });

  // A product that has been deleted or renamed beyond matching still has to print.
  it('falls back to what the invoice recorded when the product is gone', () => {
    const t = footerTotals(render(BILLED_AT_TEN, 'a4', [{ id: 'something-else', name: 'Other', unitsInBox: 99 }]));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(6);
    expect(t.units).toBe(36);
  });

  it('holds on the thermal roll too', () => {
    const t = footerTotals(render(BILLED_AT_TEN, 'thermal', PRODUCT_NOW));
    expect(t.packs).toBe(3);
    expect(t.loose).toBe(0);
  });
});

describe('the unit label beside the quantity', () => {
  it('shows what the product says now, not what the invoice recorded', () => {
    const line = [{ productId: 'nitoxil', name: 'Nitoxil 10ml Star', quantity: 5, price: 100, unitsInBox: 1, unit: 'Botal' }];
    const html = render(line, 'a4', [{ id: 'nitoxil', name: 'Nitoxil 10ml Star', unitsInBox: 1, unit: '10ml Vial' }]);
    expect(html).toContain('10ml Vial');
    expect(html).not.toContain('Botal');
  });

  it('keeps what the invoice recorded when the product is gone', () => {
    const line = [{ productId: 'gone', name: 'Discontinued Tonic', quantity: 5, price: 100, unitsInBox: 1, unit: 'Botal' }];
    expect(render(line, 'a4', [])).toContain('Botal');
  });
});
