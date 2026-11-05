// A golden-master lock on the 80mm thermal documents.
//
// The thermal geometry was found by measurement over many rounds of printing (see CLAUDE.md), and
// the redesign of A4/A5 shares one component with it. Column-count tests catch some changes; this
// catches ALL of them: the markup of every document type at format 'thermal' must equal, byte for
// byte, the files in __thermal_lock__/. Those files were generated from the version that printed
// correctly, and proven identical to the pre-redesign output.
//
// If this fails, a change reached the receipt. Do NOT run `vitest -u` to make it pass. Either the
// change should not touch thermal (gate it behind `!isThermal`, as `BLK` / `sz()` do), or it is a
// deliberate receipt change: print it on the real printer first, then update the files.
//
// The date is frozen because the footer prints today's date. It covers the document element and
// the print/PDF style block that follows it; the preview bar is app chrome and is not part of it.
import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import { expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintView from './PrintView';

const items = [
  { productId: 1, name: 'HeptaSef Liver Tonic 5 Litres', quantity: 3, price: 2750 },
  { productId: 2, name: 'Ratava Spray', quantity: 2, price: 1000 },
];
const base = { id: 'INV-8447', date: '2026-08-31', customerId: 12, customerName: 'Ahsan Nazimabad', vehicle: 'Rider', deliveryBilled: 400, total: 10250, items };
const LEDGER = { rows: [{ id: 'INV-8447', balance: 105600 }], openingBal: 58250, closingBal: 105600 };

const CASES = {
  invoice: { docType: 'invoice', data: base },
  'invoice-paid-delivery-discount': { docType: 'invoice', data: { ...base, receivedAmount: 5000, discount: 250, deliveryBilled: 400, salespersonName: 'Ghousia' } },
  estimate: { docType: 'estimate', data: { ...base, status: 'Estimate' } },
  creditnote: { docType: 'creditnote', data: { ...base, id: 'CN-0009', originalInvoiceId: 'INV-8447', reason: 'Damaged' } },
  dispatch: { docType: 'dispatch', data: { ...base, driverName: 'Ali', driverPhone: '0345', customerDetails: { phone: '0300', address1: 'Shop 12' } } },
  receipt: { docType: 'receipt', data: { id: 'REC-1', date: '2026-08-31', customerName: 'Ahsan', amount: 5000, method: 'Cash', balanceAfter: 100600, prevBalance: 105600 } },
  ledger: { docType: 'ledger', data: { customerName: 'Ahsan', rows: [{ id: 'INV-8447', date: '2026-08-31', desc: 'Invoice', debit: 10250, credit: 0, balance: 105600 }], openingBal: 58250, closingBal: 105600, dateRange: 'All' } },
  report: { docType: 'report', data: { title: 'Analytics', dateFilter: 'This Month', view: 'By Product', generatedOn: '2026-08-30', appliedFilters: {}, rows: [{ name: 'A', qty: 1, revenue: 100, profit: 10 }] } },
  'invoice-long-business-name': { docType: 'invoice', data: base, appSettings: { businessName: 'Al Khyber Veterinary Medical Traders Karachi', phone: '0335 2999006', address: 'Shop 4, Saddar, Karachi' } },
};

const render = ({ docType, data, appSettings = {} }) => renderToStaticMarkup(
  <PrintView
    printConfig={{ docType, format: 'thermal', data }}
    setPrintConfig={() => {}} products={[]} customers={[]}
    getCustomerLedger={() => LEDGER} getCustomerBalance={() => 105600}
    showToast={() => {}} appSettings={appSettings}
  />
);

describe('80mm thermal documents are byte-for-byte unchanged', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T09:00:00')); });
  afterAll(() => { vi.useRealTimers(); });

  Object.entries(CASES).forEach(([name, c]) => {
    it(name, async () => {
      const html = render(c);
      const doc = html.slice(html.indexOf('id="print-document"'));
      await expect(doc).toMatchFileSnapshot(`./__thermal_lock__/${name}.html`);
    });
  });
});
