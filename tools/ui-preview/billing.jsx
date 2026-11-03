// Renders the real BillingTab with sample data, so a design change can be screenshotted
// without signing in. Not part of the app build: vite only builds index.html.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import '../../src/index.css';
import '@fontsource/poppins/400.css'; import '@fontsource/poppins/500.css'; import '@fontsource/poppins/600.css';
import '@fontsource/dm-sans/400.css'; import '@fontsource/dm-sans/500.css'; import '@fontsource/dm-sans/600.css';
import '@fontsource/eb-garamond/400.css'; import '@fontsource/eb-garamond/500.css';
import '@fontsource/gentium-book-plus/400.css'; import '@fontsource/gentium-book-plus/700.css';

// ?font= picks a pairing, so the options can be compared on the real screen.
const FONTS = {
  brand:    ['"Poppins"', '"Poppins"'],
  website:  ['"DM Sans"', '"Gentium Book Plus"'],
  garamond: ['"DM Sans"', '"EB Garamond"'],
  mixed:    ['"Poppins"', '"EB Garamond"'],
};
const [ui, display] = FONTS[new URLSearchParams(location.search).get('font')] || FONTS.garamond;
document.documentElement.style.setProperty('--font-ui', `${ui}, system-ui, sans-serif`);
document.documentElement.style.setProperty('--font-display', `${display}, Georgia, serif`);
import { AppContext } from '../../src/context/AppContext';
import { BillingTab } from '../../src/components/tabs/BillingTab';

const view = new URLSearchParams(location.search).get('view') || 'list';
const CUSTOMERS = [
  { id: 1, name: 'Abdul Qadir Shan Cattle', phone: '0300-1234567', city: 'Karachi' },
  { id: 2, name: 'Cash Sale (Walk in Customer)', isCashCustomer: true },
  { id: 3, name: 'Al-Madina Dairy Farm', phone: '0321-7654321', city: 'Hyderabad' },
];
const PRODUCTS = [
  { id: 10, name: 'Trifas Suspension 1 Litre', companyId: 1, sellingPrice: 2850, costPrice: 2300, available: true, unit: 'btl', unitsInBox: 12 },
  { id: 11, name: 'Hepta Sef 1g Injection', companyId: 2, sellingPrice: 640, costPrice: 480, available: true, unit: 'vial', unitsInBox: 10 },
];
const items = [
  { productId: 10, uniqueId: 10, name: 'Trifas Suspension 1 Litre', price: 2850, costPrice: 2300, quantity: 12, unit: 'btl', unitsInBox: 12 },
  { productId: 11, uniqueId: 11, name: 'Hepta Sef 1g Injection', price: 640, costPrice: 480, quantity: 20, unit: 'vial', unitsInBox: 10 },
];
const INVOICES = [
  { id: 'INV-8812', date: '2026-11-03', customerId: 1, customerName: 'Abdul Qadir Shan Cattle', status: 'Billed', total: 47000, receivedAmount: 20000, salespersonId: 2, items, vehicle: 'Rider' },
  { id: 'INV-8811', date: '2026-11-03', customerId: 2, customerName: 'Cash Sale (Walk in Customer)', status: 'Billed', total: 900, receivedAmount: 900, salespersonId: 2, items: [], vehicle: 'Self-Pickup' },
  { id: 'ORD-0214', date: '2026-11-02', customerId: 3, customerName: 'Al-Madina Dairy Farm', status: 'Booked', total: 118500, receivedAmount: 0, salespersonId: 2, items, vehicle: 'Intercity Transport' },
  { id: 'EST-0037', date: '2026-11-01', customerId: 3, customerName: 'Al-Madina Dairy Farm', status: 'Estimate', total: 28500, receivedAmount: 0, salespersonId: 2, items: [], vehicle: 'Self-Pickup' },
  { id: 'CN-0042', date: '2026-10-30', customerId: 1, customerName: 'Abdul Qadir Shan Cattle', status: 'CreditNote', total: 2850, receivedAmount: 0, salespersonId: 2, items: [] },
];
const VEHICLE_TYPES = [
  { id: 1, name: 'Rider', requiresRider: true },
  { id: 2, name: 'Intercity Transport', requiresRider: false },
  { id: 3, name: 'Self-Pickup', requiresRider: false },
];
const statusOf = { 'INV-8812': 'Partial', 'INV-8811': 'Paid' };

function Preview() {
  const [billingView, setBillingView] = useState(view);
  const [currentInvoice, setCurrentInvoice] = useState(view === 'form'
    ? { id: null, customerId: 1, customerName: 'Abdul Qadir Shan Cattle', customerDetails: {}, items, deliveryBilled: 300, transportExpense: 0, discount: 0, vehicle: 'Rider', paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' }
    : null);
  const noop = () => {};
  return (
    <AppContext.Provider value={{
      getPaymentStatus: (o) => statusOf[o.id] || 'Pending', isAdmin: true, hasPermission: () => true,
      currentUser: { id: 2, name: 'Ghousia', role: 'admin' },
      companies: [{ id: 1, name: 'Leads Pharma' }, { id: 2, name: 'Selmore' }], products: PRODUCTS, customers: CUSTOMERS,
      invoices: INVOICES, invoicesRaw: INVOICES, expenses: [], expenseCategories: [],
      payments: [], appUsers: [], riders: [{ id: 'r1', name: 'Imran', vehicleType: 'Rider' }], transportCompanies: [], vehicleTypes: VEHICLE_TYPES,
      cities: [], areas: [], customerTypes: [],
      billingView, currentInvoice, setCurrentInvoice, setBillingView,
      activeTab: 'billing', setActiveTab: noop, adminView: 'analytics', setAdminView: noop,
      getCompanyName: (id) => (id === 1 ? 'Leads Pharma' : 'Selmore'), getCustomerBalance: (id) => (id === 1 ? 86500 : 0),
      getCustomerLedger: () => ({ rows: [] }), generateReceiptData: () => ({}),
      checkDuplicate: () => false, nextDocNumber: async () => 8813,
      saveToFirebase: noop, deleteFromFirebase: noop, showToast: noop,
      showConfirm: noop, showPrompt: noop, voidRecord: noop, logSave: noop,
      logDelete: noop, setPrintConfig: noop,
      setEditingCustomer: noop, setShowCustomerModal: noop,
      setEditingProduct: noop, setShowProductModal: noop, setProductPreFill: noop,
      setEditingCreditNote: noop, setShowCreditNoteModal: noop, setSelectedLedgerId: noop, setShowLedgerModal: noop,
    }}>
      <div style={{ position: 'relative', minHeight: '100vh' }}><BillingTab /></div>
    </AppContext.Provider>
  );
}
createRoot(document.getElementById('root')).render(<Preview />);
