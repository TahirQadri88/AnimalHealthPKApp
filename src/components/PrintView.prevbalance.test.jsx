// The "Previous Balance" line on a printed invoice, fed by the REAL ledger.
//
// Reported 2026-09-03: two bills for one customer on one day, the first settled in full at
// the counter, and the second still printed "Previous Balance Rs. 136,000". The fault was
// in buildCustomerLedger's same-day ordering (see the comment there) but it was invisible
// until it reached paper, because PrintView derives the previous balance from the row
// immediately preceding the invoice.
//
// So this test does not stub the ledger the way PrintView.docs.test.jsx does. It builds one
// from the real service with exactly the reported figures and renders the document through
// it — the whole path, ledger to printed line.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';
import { buildCustomerLedger } from '../services/accounting/ledger';

const CUSTOMER = { id: 12, name: 'Haji Ali Cattle Saqib Sab', phone: '0300-1234567', openingBalance: 0 };

const INV_8475 = {
  id: 'INV-8475', date: '2026-09-03', customerId: 12, customerName: CUSTOMER.name,
  status: 'Billed', vehicle: 'Rickshaw', deliveryBilled: 2500, total: 136000,
  receivedAmount: 136000,
  items: [{ productId: 1, name: 'HeptaSef Liver Tonic 5 Litres', quantity: 6, price: 22250 }],
};
const INV_8476 = {
  id: 'INV-8476', date: '2026-09-03', customerId: 12, customerName: CUSTOMER.name,
  status: 'Billed', deliveryBilled: 0, total: 27000, receivedAmount: 0,
  items: [{ productId: 2, name: 'Ratava Spray', quantity: 27, price: 1000 }],
};

const world = { customers: [CUSTOMER], invoices: [INV_8475, INV_8476], payments: [] };

const render = (invoice, format = 'a4') => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType: 'invoice', format, data: invoice }}
    setPrintConfig={() => {}} products={[]} customers={[CUSTOMER]}
    getCustomerLedger={(id) => buildCustomerLedger(id, world)}
    getCustomerBalance={() => buildCustomerLedger(12, world).closingBal}
    showToast={() => {}} appSettings={{}}
  />
);

// The totals block writes "Previous Balance:" and "Net Balance" in their own cells, so the
// figure that follows a label is the one that was printed under it.
const after = (html, label) => {
  const i = html.indexOf(label);
  if (i === -1) return null;
  const m = html.slice(i, i + 400).match(/Rs\.\s*(?:<!-- -->)?\s*(−?\s*[\d,]+)/);
  return m ? m[1].replace(/\s/g, '') : null;
};

describe('two bills for one customer on one day', () => {
  ['a4', 'a5', 'thermal'].forEach(format => {
    describe(format, () => {
      it('the first bill starts from nothing and settles to nothing', () => {
        const html = render(INV_8475, format);
        expect(after(html, 'Previous Balance')).toBe('0');
        expect(after(html, 'Net Balance')).toBe('0');
      });

      it('the second bill does not inherit a balance the customer already paid', () => {
        const html = render(INV_8476, format);
        expect(after(html, 'Previous Balance')).toBe('0');
        // Not 163,000 — that was the reported symptom.
        expect(after(html, 'Net Balance')).toBe('27,000');
        expect(html).not.toContain('163,000');
      });
    });
  });
});

describe('a genuine prior balance still prints', () => {
  const withOpening = { ...world, customers: [{ ...CUSTOMER, openingBalance: 58250 }] };
  const html = renderToStaticMarkup(
    <PrintView
      printConfig={{ docType: 'invoice', format: 'a4', data: INV_8475 }}
      setPrintConfig={() => {}} products={[]} customers={[]}
      getCustomerLedger={(id) => buildCustomerLedger(id, withOpening)}
      getCustomerBalance={() => 0} showToast={() => {}} appSettings={{}}
    />
  );

  it('carries the opening balance onto the first bill of the day', () => {
    expect(after(html, 'Previous Balance')).toBe('58,250');
  });

  it('leaves what is still owed after the cash taken', () => {
    // 58,250 + 136,000 − 136,000
    expect(after(html, 'Net Balance')).toBe('58,250');
  });
});

// ── Counter sales open on Bill Only ─────────────────────────────────────────
//
// Reported 2026-09-18: a cash sale printed "Previous Balance Rs. 93,210" and a Net Balance
// carrying it forward. A walk-in account is shared, so that balance belongs to no one
// customer in particular, and the bill is settled on the spot anyway. It should open on
// Bill Only. The toggle still decides; this is only where it starts.
const CASH = { id: 99, name: 'Cash Sale (Walk in Customer)', openingBalance: 93210 };
const CASH_INV = {
  id: 'INV-8562', date: '2026-09-17', customerId: 99, customerName: CASH.name,
  status: 'Billed', vehicle: 'Rider', deliveryBilled: 500, total: 33000, receivedAmount: 33000,
  items: [{ productId: 3, name: 'IVOMEC 500 ML', quantity: 1, price: 32500 }],
};
const cashWorld = { customers: [CASH], invoices: [CASH_INV], payments: [] };

const renderFor = (customer, invoice, world, format = 'a4') => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType: 'invoice', format, data: invoice }}
    setPrintConfig={() => {}} products={[]} customers={[customer]}
    getCustomerLedger={(id) => buildCustomerLedger(id, world)}
    getCustomerBalance={() => 0}
    showToast={() => {}} appSettings={{}}
  />
);

describe('a cash sale prints the bill, not the ledger', () => {
  ['a4', 'a5', 'thermal'].forEach(format => {
    it(`withholds the previous balance on ${format}`, () => {
      const html = renderFor(CASH, CASH_INV, cashWorld, format);
      expect(html).not.toContain('Previous Balance');
      expect(html).not.toContain('93,210');
    });
  });

  it('still prints what the bill itself came to', () => {
    const html = renderFor(CASH, CASH_INV, cashWorld);
    expect(html).toContain('33,000');
    expect(after(html, 'Net Balance')).toBe('0');
  });

  // The toggle shows the mode it is IN, not the one it would switch to, so a counter sale
  // reads "Bill Only" — visible proof of the default, and one tap from the ledger.
  it('shows the toggle sitting on Bill Only', () => {
    const html = renderFor(CASH, CASH_INV, cashWorld);
    expect(html).toContain('Bill Only');
    expect(html).toContain('Toggle previous balance visibility on invoice');
  });

  // The change must not reach a named customer, who is exactly who the ledger is for.
  it('leaves a named customer on the full ledger', () => {
    const html = render(INV_8476);
    expect(html).toContain('Previous Balance');
  });
});
