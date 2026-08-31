// Document-layout regressions, rendered through the real PrintView.
//
// Two jobs:
//   1. Lock the THERMAL layouts. The 68mm receipt geometry was established by measurement
//      after a long run of wrong fixes (see CLAUDE.md). Anything added to a document for
//      paper must stay off the roll, because an extra column is exactly what pushed
//      right-aligned figures past the last dot before.
//   2. Cover what paper gained: rates on credit notes, a handover block on dispatch notes.
//
// useEffect does not run under SSR, so no DOM stub is needed.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';

const items = [
  { productId: 1, name: 'HeptaSef Liver Tonic 5 Litres', quantity: 3, price: 2750 },
  { productId: 2, name: 'Ratava Spray', quantity: 2, price: 1000 },
];
const LEDGER = { rows: [{ id: 'INV-8447', balance: 105600 }], openingBal: 58250, closingBal: 105600 };

const DATA = {
  invoice: { id: 'INV-8447', date: '2026-08-31', customerId: 12, customerName: 'Ahsan Nazimabad', vehicle: 'Rider', deliveryBilled: 400, total: 10250, items },
  creditnote: { id: 'CN-0009', date: '2026-08-31', customerId: 12, customerName: 'Ahsan Nazimabad', originalInvoiceId: 'INV-8447', reason: 'Damaged in transit', total: 10250, items },
  dispatch: { id: 'INV-8447', date: '2026-08-31', customerId: 12, customerName: 'Ahsan Nazimabad', driverName: 'Ali Raza', driverPhone: '0345-1112222', vehicle: 'Rider', items,
              customerDetails: { contactPerson: 'Ahsan Ali', phone: '0300-1234567', address1: 'Shop 12, Nazimabad, Karachi' } },
};

const render = (docType, format) => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType, format, data: DATA[docType] }}
    setPrintConfig={() => {}} products={[]} customers={[]}
    getCustomerLedger={() => LEDGER} getCustomerBalance={() => 105600}
    showToast={() => {}} appSettings={{}}
  />
);

// The header cells are the honest count — a `width:` style is only emitted for columns
// that actually render.
const columnHeaders = (html) => (html.match(/<th[^>]*>\s*([A-Za-z /]+?)\s*<\/th>/g) || [])
  .map(th => th.replace(/<[^>]+>/g, '').trim());

describe('credit note shows what each returned line was worth', () => {
  it('carries Rate and Amount on A4 and A5', () => {
    ['a4', 'a5'].forEach(format => {
      const heads = columnHeaders(render('creditnote', format));
      expect(heads).toContain('Rate');
      expect(heads).toContain('Amount');
    });
  });

  it('prints the line amount, not just the quantity', () => {
    // 3 × Rs.2,750 — the figure a customer checks the total against.
    expect(render('creditnote', 'a4')).toContain('Rs. 8,250');
  });

  it('leaves the thermal credit note at two columns', () => {
    const heads = columnHeaders(render('creditnote', 'thermal'));
    expect(heads).toEqual(['Description', 'Qty']);
  });
});

describe('the thermal roll keeps the column counts it was measured for', () => {
  it('invoice: Description, Qty, Rate — and no Amount column', () => {
    const heads = columnHeaders(render('invoice', 'thermal'));
    expect(heads).toEqual(['Description', 'Qty', 'Rate']);
  });

  it('invoice on paper gains the Amount column', () => {
    expect(columnHeaders(render('invoice', 'a4'))).toEqual(['Description', 'Qty', 'Rate', 'Amount']);
  });

  it('dispatch: Description and Qty / Pack only, on every size', () => {
    ['thermal', 'a5', 'a4'].forEach(format => {
      expect(columnHeaders(render('dispatch', format))).toEqual(['Description', 'Qty / Pack']);
    });
  });
});

describe('dispatch note can be signed for', () => {
  it('has a handover block on A4 and A5', () => {
    ['a4', 'a5'].forEach(format => {
      const html = render('dispatch', format);
      expect(html).toContain('Delivered By');
      expect(html).toContain('Received By');
      expect(html).toContain('Signature &amp; Date');
    });
  });

  it('pre-fills the rider the document already knows', () => {
    const html = render('dispatch', 'a4');
    expect(html).toContain('Ali Raza · 0345-1112222');
  });

  it('is absent from the thermal slip — that geometry is left alone', () => {
    expect(render('dispatch', 'thermal')).not.toContain('Received By');
  });

  it('does not appear on documents that are not handed over', () => {
    expect(render('invoice', 'a4')).not.toContain('Received By');
    expect(render('creditnote', 'a4')).not.toContain('Received By');
  });
});

// The masthead box is full-bleed, so the name has to be sized to the box. Measured fill of
// the business name against the box's inner width was 69% on thermal, 46% on A5 and 38% on
// A4 — the box was never too wide, the name was too small.
describe('masthead name is sized to the box', () => {
  const titlePx = (html) => {
    const m = html.match(/<div style="font-size:([\d.]+)px;font-weight:900;letter-spacing:1px/);
    return m ? parseFloat(m[1]) : null;
  };
  const render2 = (format, businessName) => renderToStaticMarkup(
    <PrintView printConfig={{ docType: 'invoice', format, data: DATA.invoice }}
      setPrintConfig={() => {}} products={[]} customers={[]}
      getCustomerLedger={() => LEDGER} getCustomerBalance={() => 105600}
      showToast={() => {}} appSettings={businessName ? { businessName } : {}} />
  );

  it('sets the default name large enough to fill A4 and A5', () => {
    expect(titlePx(render2('a5'))).toBe(30);
    expect(titlePx(render2('a4'))).toBe(42);
  });

  it('leaves thermal at the size that was settled by printing', () => {
    expect(titlePx(render2('thermal'))).toBe(16);
    expect(titlePx(render2('thermal', 'Khyber Traders & Sons Veterinary Distributors'))).toBe(16);
  });

  // The box has to hold whatever is in settings, and today's size is the floor — this may
  // only ever enlarge the name, never shrink it below what already ships.
  it('steps a long name back down rather than blowing the box apart', () => {
    const long = 'Khyber Traders & Sons Veterinary Distributors';
    expect(titlePx(render2('a5', long))).toBe(20);
    expect(titlePx(render2('a4', long))).toBe(24);
  });

  it('never goes below the size it had before', () => {
    const huge = 'X'.repeat(200);
    expect(titlePx(render2('a5', huge))).toBeGreaterThanOrEqual(20);
    expect(titlePx(render2('a4', huge))).toBeGreaterThanOrEqual(24);
  });
});

describe('no document leaks a missing value onto paper', () => {
  ['invoice', 'creditnote', 'dispatch'].forEach(docType => {
    ['thermal', 'a5', 'a4'].forEach(format => {
      it(`${docType} @ ${format}`, () => {
        expect(render(docType, format)).not.toMatch(/undefined|NaN/);
      });
    });
  });
});
