// Purity of the move: proved in the previous commit. This file became possible only once
// nextDocNumber comes through the context — importing it pulls in ../firebase, which
// initialises Auth on import and stops the test file loading at all.
//
// Money: this is where a receipt is recorded against a customer.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { PaymentModal } from './PaymentModal';

const CUSTOMERS = [
  { id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567' },
  { id: 2, name: 'Ghousia Farms', phone: '' },
];
const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    customers: CUSTOMERS, payments: [], paymentsRaw: [],
    selectedCustomerForPayment: 1, editingPayment: null,
    getCustomerBalance: () => 105600, nextDocNumber: async () => 115,
    saveToFirebase: () => {}, showToast: () => {}, logSave: () => {},
    setShowPaymentModal: () => {}, setEditingPayment: () => {}, ...over,
  }}>
    <PaymentModal />
  </AppContext.Provider>
);

describe('PaymentModal', () => {
  it('renders for a new receipt', () => {
    expect(() => render()).not.toThrow();
  });

  it('shows the outstanding balance before anything is entered', () => {
    expect(render()).toContain('105,600');
  });

  it('offers the discount field — a discount settles debt exactly as cash does', () => {
    expect(render().toLowerCase()).toContain('discount');
  });

  it('renders when editing an existing receipt', () => {
    const editing = { id: 'REC-0114', customerId: 1, amount: 50000, discount: 250, date: '2026-09-01', note: 'Cash' };
    expect(render({ editingPayment: editing })).toContain('50000');
  });

  it('renders with no customer preselected', () => {
    expect(() => render({ selectedCustomerForPayment: null })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
