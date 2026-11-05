// The control bar around a document, and the rule that it never becomes part of one.
// The bar is app chrome; the document, the print path and the PDF/Image captures read only
// #print-document, so these tests pin both halves: the bar offers what it should, and the
// document element carries no scaling of its own (a zoom on it would travel into the captures).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';

const items = [{ productId: 1, name: 'Ratava Spray', quantity: 2, price: 1000 }];
const render = (docType, format) => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType, format, data: { id: 'INV-1', date: '2026-08-31', customerId: 1, customerName: 'Ahsan', total: 2000, items } }}
    setPrintConfig={() => {}} products={[]} customers={[]}
    getCustomerLedger={() => ({ rows: [], openingBal: 0, closingBal: 0 })} getCustomerBalance={() => 0}
    showToast={() => {}} appSettings={{}}
  />
);

describe('preview bar', () => {
  it('offers the paper sizes, marking the current one', () => {
    const html = render('invoice', 'a4');
    expect(html).toMatch(/aria-pressed="true"[^>]*>A4</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>A5</);
    expect(html).toContain('>Thermal<');
  });

  it('offers Save / Share, Print, Image and WhatsApp, and a labelled Close', () => {
    const html = render('invoice', 'a5');
    ['Save / Share', 'Print', 'Image', 'WhatsApp'].forEach(t => expect(html).toContain(t));
    expect(html).toContain('aria-label="Close"');
  });

  it('offers a colour PDF on A4 and A5, never on the thermal roll', () => {
    expect(render('invoice', 'a4')).toMatch(/>PDF</);
    expect(render('invoice', 'a5')).toMatch(/>PDF</);
    expect(render('invoice', 'thermal')).not.toMatch(/>PDF</);
  });

  it('leaves out A4 for a receipt, as before', () => {
    expect(render('receipt', 'a5')).not.toMatch(/>A4</);
  });

  it('keeps the bar out of the document element', () => {
    const html = render('invoice', 'a4');
    const doc = html.slice(html.indexOf('id="print-document"'));
    expect(doc).not.toContain('Save / Share');
    expect(doc).not.toContain('zoom');
  });
});

// The document typeface (DM Sans) is for the A4/A5 document on screen, PDF and image. The thermal
// roll stays as it was measured, and paper is reset by buildHtmlDoc, which drops the class the
// font rule keys on. Pinning where the class is, and is not, is what keeps those apart.
describe('document typeface', () => {
  it('sets A4 and A5 in DM Sans, marked so the app-wide Inter rule leaves it alone', () => {
    ['a4', 'a5'].forEach(f => {
      const html = render('invoice', f);
      const doc = html.slice(html.indexOf('id="print-document"'));
      expect(doc.slice(0, 400)).toContain('font-doc');
      expect(doc.slice(0, 500)).toContain('DM Sans');
    });
  });

  it('leaves the thermal roll in Inter, untouched', () => {
    const html = render('invoice', 'thermal');
    const doc = html.slice(html.indexOf('id="print-document"'));
    expect(doc.slice(0, 400)).not.toContain('font-doc');
    expect(doc.slice(0, 500)).not.toContain('DM Sans');
  });
});
