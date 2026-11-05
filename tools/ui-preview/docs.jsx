// Renders the real PrintView for any document type and paper size, with data built by the real
// ledger service, so a document can be looked at without signing in or finding the right button.
//   docs.html?type=invoice|estimate|creditnote|dispatch|receipt|ledger|report|aging&format=a4|a5|thermal&items=N
// Not part of the app build: vite only builds index.html.
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import '@fontsource/dm-sans/latin-400.css'; import '@fontsource/dm-sans/latin-500.css'; import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/eb-garamond/latin-400.css'; import '@fontsource/eb-garamond/latin-500.css';
import PrintView from '../../src/components/PrintView';
import { buildCustomerLedger } from '../../src/services/accounting/ledger';
import { AGING_BUCKETS } from '../../src/services/analytics/receivables';

const q = new URLSearchParams(location.search);
const type = q.get('type') || 'invoice', format = q.get('format') || 'a4', n = Number(q.get('items') || 4);

const NAMES = ['Trifas Suspension 1 Litre', 'Hepta Sef 1g Injection', 'Oxytetracycline 20% 100ml', 'Electrolyte Sachet 100g', 'Albendazole 10% 1 Litre', 'Tylosin 20% 100ml', 'Mineral Mixture 5kg', 'HEAVY GOLD 5 in 1 Powder 20kg Yeast Based Premix'];
const mkItems = (k) => Array.from({ length: k }, (_, i) => ({ productId: 10 + i, uniqueId: 10 + i, name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` #${i}` : ''), price: 640 + 130 * i, quantity: 2 + (i % 9), unit: 'btl', unitsInBox: 12 }));
const items = mkItems(n);
const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
const CUST_ID = Number(q.get('custid') || 1);   // ?custid=1773230565823 reproduces a real timestamp-style id
const customers = [{ id: CUST_ID, name: 'Abdul Qadir Shan Cattle', openingBalance: 58250, phone: '0300-1234567' }];
const invoices = [
  { id: 'INV-8801', date: '2026-10-20', customerId: CUST_ID, customerName: 'Abdul Qadir Shan Cattle', status: 'Billed', total: 47000, receivedAmount: 0, items: mkItems(3) },
  { id: 'INV-8812', date: '2026-11-03', customerId: CUST_ID, customerName: 'Abdul Qadir Shan Cattle', status: 'Billed', total, receivedAmount: 20000, salespersonName: 'Ghousia', deliveryBilled: 400, vehicle: 'Rider', items },
];
const payments = [{ id: 'REC-0101', date: '2026-10-28', customerId: CUST_ID, amount: 30000, method: 'Cash' }];
// ?rows=N adds N more invoices so a ledger runs to several pages
for (let k = 0; k < Number(q.get('rows') || 0); k++) invoices.push({ id: `INV-9${String(100 + k)}`, date: `2026-10-${String(1 + (k % 27)).padStart(2, '0')}`, customerId: CUST_ID, customerName: 'Abdul Qadir Shan Cattle', status: 'Billed', total: 5000 + k * 137, receivedAmount: 0, items: mkItems(2) });
const ledger = buildCustomerLedger(CUST_ID, { customers, invoices, payments });
const invoice = invoices[1];
const payRow = ledger.rows.find(r => r.credit > 0 && !r.id.endsWith('-PAY')) || ledger.rows.find(r => r.credit > 0);
const payIdx = ledger.rows.findIndex(r => r === payRow);
const DATA = {
  invoice, estimate: { ...invoice, id: 'EST-0037', status: 'Estimate' },
  creditnote: { ...invoice, id: 'CN-0042', status: 'CreditNote', originalInvoiceId: 'INV-8812', reason: 'Damaged in transit', items: mkItems(Math.min(n, 3)), total: 2850 },
  dispatch: { ...invoice, driverName: 'Ali Raza', driverPhone: '0345-1112222', customerDetails: { contactPerson: 'Abdul Qadir', phone: '0300-1234567', address1: 'Shop 12, Landhi, Karachi' } },
  receipt: payRow && { id: payRow.id, date: payRow.date, customerName: ledger.customerName, receivedAmount: payRow.credit, discount: 0, totalCredit: payRow.credit, prevBalance: payIdx > 0 ? ledger.rows[payIdx - 1].balance : ledger.openingBal, newBalance: payRow.balance, note: payRow.desc },
  ledger: { ...ledger, dateRange: { start: '2026-10-01', end: '2026-11-05' }, totalDebit: ledger.rows.reduce((s, r) => s + (r.debit || 0), 0), totalCredit: ledger.rows.reduce((s, r) => s + (r.credit || 0), 0) },
  report: { title: 'Product Sales Report', dateFilter: 'This Month', view: 'By Product', generatedOn: '2026-11-05', appliedFilters: { scope: 'All brands' },
    stats: { productRevenue: 176600, deliveryBilled: 2400, totalCOGS: 131000, grossMargin: 25.8, totalExpenses: 12000, netProfit: 33600, transportExpense: 1800 },
    rows: mkItems(Math.max(n, 6)).map((it, i) => ({ 'Product Name': it.name, Brand: ['Leads Pharma', 'Selmore', 'ALC'][i % 3], 'Qty Sold': it.quantity * 3, 'Revenue (Rs)': it.price * it.quantity * 3, 'Cost (Rs)': Math.round(it.price * it.quantity * 2.2), 'Gross Profit (Rs)': Math.round(it.price * it.quantity * 0.8), 'Margin %': 26.5 })) },
  aging: { title: 'Receivables Aging', dateFilter: 'As at 05-Nov-26', view: 'Aging', generatedOn: '2026-11-05', appliedFilters: { scope: 'All buckets' }, aging: {
    asOf: '2026-11-05', buckets: AGING_BUCKETS.map(b => ({ key: b.key, label: b.label })),
    rows: [{ name: 'Ghousia Farms', phone: '0300-1234567', oldestAgeDays: 182, buckets: { current: 0, d31_60: 0, d61_90: 0, d90plus: 118500 }, totalOutstanding: 118500 }, { name: 'Al Shaheer Poultry', phone: '', oldestAgeDays: 45, buckets: { current: 4000, d31_60: 2500, d61_90: 0, d90plus: 0 }, totalOutstanding: 6500 }],
    totals: { current: 4000, d31_60: 2500, d61_90: 0, d90plus: 118500 }, grandTotal: 125000, customerCount: 2 } },
};
const docType = type === 'aging' ? 'report' : type;
createRoot(document.getElementById('root')).render(
  <PrintView printConfig={{ docType, format, data: DATA[type] }} setPrintConfig={() => {}} products={[]} customers={customers}
    getCustomerLedger={() => ledger} getCustomerBalance={() => ledger.closingBal} showToast={() => {}}
    appSettings={{ businessName: 'Khyber Traders', businessTagline: 'Wholesale Veterinary Pharmacy', phone: '0335 2999006', address: 'Karachi', showBusinessNameOnDocs: true, showBusinessNameOnReports: true }} />
);
