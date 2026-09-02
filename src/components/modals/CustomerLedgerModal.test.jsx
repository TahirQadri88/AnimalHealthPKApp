// Purity of the move: node tools/extraction-diff.mjs CustomerLedgerModal src/components/modals/CustomerLedgerModal.jsx
//
// The statement a customer is shown when they query their balance. The arithmetic is
// buildCustomerLedger's and is covered by ledger.test.js; these check the figures reach
// the screen and that the running balance is the one the customer will be quoted.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { CustomerLedgerModal } from './CustomerLedgerModal';

const LEDGER = {
  // The shape buildCustomerLedger actually returns — `customerName`, not `name`.
  id: 1, customerName: 'Abdul Qadir Shan Cattle', phone: '0300-1234567',
  openingBal: 58250, totalDebit: 47350, totalCredit: 0, closingBal: 105600,
  rows: [
    { id: 'INV-8457', date: '2026-08-31', desc: 'Invoice INV-8457', debit: 47350, credit: 0, balance: 105600 },
  ],
};
const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    selectedLedgerId: 1, getCustomerLedger: () => LEDGER,
    generateReceiptData: () => ({}), invoices: [], payments: [], isAdmin: true,
    setPrintConfig: () => {}, setShowPaymentModal: () => {}, setSelectedCustomerForPayment: () => {},
    setShowLedgerModal: () => {}, setEditingPayment: () => {}, deleteFromFirebase: () => {},
    saveToFirebase: () => {}, setShowCreditNoteModal: () => {}, setEditingCreditNote: () => {},
    setCurrentInvoice: () => {}, setBillingView: () => {}, setActiveTab: () => {},
    showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, logSave: () => {},
    showToast: () => {}, ...over,
  }}>
    <CustomerLedgerModal />
  </AppContext.Provider>
);

describe('CustomerLedgerModal', () => {
  it('names the account holder', () => {
    expect(render()).toContain('Abdul Qadir Shan Cattle');
  });

  it('shows the opening balance — debt that predates the system is still debt', () => {
    expect(render()).toContain('58,250');
  });

  it('shows the closing balance the customer will be quoted', () => {
    expect(render()).toContain('105,600');
  });

  it('lists the transactions', () => {
    expect(render()).toContain('INV-8457');
  });

  it('renders for a customer with no history at all', () => {
    const empty = { ...LEDGER, rows: [], openingBal: 0, totalDebit: 0, totalCredit: 0, closingBal: 0 };
    expect(() => render({ getCustomerLedger: () => empty })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
