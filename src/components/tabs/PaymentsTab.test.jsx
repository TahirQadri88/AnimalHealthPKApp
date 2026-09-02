// Purity of the move: node tools/extraction-diff.mjs PaymentsTab src/components/tabs/PaymentsTab.jsx
//
// Money: the receipts register. It shows two kinds of credit — a standalone REC- payment,
// and cash taken at billing time, which is a field on the invoice rather than a record of
// its own. Both appear here, and telling them apart is what the void path depends on.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { PaymentsTab } from './PaymentsTab';

const CUSTOMERS = [{ id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' }];
const PAYMENTS = [{ id: 'REC-0114', customerId: 1, amount: 50000, discount: 250, date: '2026-09-01', note: 'Cash via rider' }];
const INVOICES = [{ id: 'INV-8457', customerId: 1, status: 'Billed', date: '2026-09-01', total: 75000, receivedAmount: 25000, items: [] }];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, hasPermission: () => true, currentUser: { id: 1, name: 'Owais', role: 'admin' },
    customers: CUSTOMERS, payments: PAYMENTS, invoices: INVOICES,
    deleteFromFirebase: () => {}, saveToFirebase: () => {}, showToast: () => {},
    setShowPaymentModal: () => {}, setSelectedCustomerForPayment: () => {}, setEditingPayment: () => {},
    showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, logSave: () => {},
    setPrintConfig: () => {}, getCustomerLedger: () => ({ rows: [] }), generateReceiptData: () => ({}),
    ...over,
  }}>
    <PaymentsTab />
  </AppContext.Provider>
);

describe('PaymentsTab', () => {
  it('lists a standalone receipt', () => {
    const html = render();
    expect(html).toContain('REC-0114');
    expect(html).toContain('Abdul Qadir Shan Cattle');
    expect(html).toContain('50,000');
  });

  // Cash taken at the counter lives on the invoice, not in `payments`. It still has to
  // appear here, or the register would understate what came in.
  it('also lists cash taken at billing time', () => {
    expect(render()).toContain('25,000');
  });

  it('offers the date filters', () => {
    const html = render();
    ['Today', 'This Week', 'This Month', 'This Year', 'All Time'].forEach(f => expect(html).toContain(f));
  });

  it('offers the client filter', () => {
    expect(render()).toContain('All Clients');
  });

  it('renders when nothing has been received', () => {
    expect(() => render({ payments: [], invoices: [] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
