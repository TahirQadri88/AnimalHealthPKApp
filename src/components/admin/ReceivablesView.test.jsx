// Purity of the move: node tools/extraction-diff.mjs ReceivablesView src/components/admin/ReceivablesView.jsx
//
// This one is money. The aging arithmetic itself is covered by receivables.test.js; what
// these check is that the figures survive the trip onto the screen, and that the export
// controls the user reaches for are actually there.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { ReceivablesView } from './ReceivablesView';

const CUSTOMERS = [
  { id: 1, name: 'Ghousia Farms', phone: '0300-1234567', openingBalance: 0 },
  { id: 2, name: 'Al Shaheer Poultry', phone: '', openingBalance: 0 },
  { id: 3, name: 'Settled Vet Store', phone: '', openingBalance: 0 },
];
// Dates are relative to today so the buckets stay stable whenever this is run.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const INVOICES = [
  { id: 'INV-1', date: daysAgo(200), customerId: 1, status: 'Billed', total: 118500, receivedAmount: 0, items: [] },
  { id: 'INV-2', date: daysAgo(10),  customerId: 2, status: 'Billed', total: 6500,   receivedAmount: 0, items: [] },
  { id: 'INV-3', date: daysAgo(5),   customerId: 3, status: 'Billed', total: 1000,   receivedAmount: 1000, items: [] },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    customers: CUSTOMERS, invoices: INVOICES, payments: [], isAdmin: true,
    setSelectedLedgerId: () => {}, setShowLedgerModal: () => {},
    setSelectedCustomerForPayment: () => {}, setShowPaymentModal: () => {},
    setEditingPayment: () => {}, setPrintConfig: () => {}, showToast: () => {}, ...over,
  }}>
    <ReceivablesView />
  </AppContext.Provider>
);

describe('ReceivablesView', () => {
  it('names everyone who owes, worst age first', () => {
    const html = render();
    expect(html.indexOf('Ghousia Farms')).toBeLessThan(html.indexOf('Al Shaheer Poultry'));
  });

  it('leaves out a customer who has settled', () => {
    expect(render()).not.toContain('Settled Vet Store');
  });

  it('shows the amounts owed', () => {
    const html = render();
    expect(html).toContain('118,500');
    expect(html).toContain('6,500');
  });

  it('totals them', () => {
    expect(render()).toContain('125,000');
  });

  it('offers every aging bucket as a filter', () => {
    const html = render();
    ['Current (0–30)', '31–60 days', '61–90 days', '90+ days'].forEach(b => expect(html).toContain(b));
  });

  it('offers both exports', () => {
    const html = render();
    expect(html).toContain('CSV');
    expect(html).toContain('PDF / Print');
  });

  it('says so plainly when everyone is settled', () => {
    expect(render({ invoices: [] })).toContain('Everyone is settled');
  });

  it('leaks no undefined into the markup, including for a customer with no phone', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
