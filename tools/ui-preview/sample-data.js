// Plausible sample data for the full-app preview: a few months of a wholesale veterinary
// pharmacy in and around Karachi. Deterministic, so screenshots are comparable run to run.
// Not real customers. Every invoice total is computed the way the app computes it.
import { invoiceTotal } from '../../src/services/accounting/invoiceTotals';

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };

export const companies = [
  { id: 1, name: 'Leads Pharma' }, { id: 2, name: 'Selmore' }, { id: 3, name: 'Prix Pharmaceutica' },
  { id: 4, name: 'Star Laboratories' }, { id: 5, name: 'ICI Animal Health' },
];
export const products = [
  ['Trifas Suspension 1 Litre', 1, 2850, 2300, 'btl', 12], ['Hepta Sef 1g Injection', 2, 640, 480, 'vial', 10],
  ['Oxytetracycline 20% 100ml', 3, 520, 390, 'vial', 24], ['Multivit Plus Powder 1kg', 4, 1150, 860, 'pkt', 20],
  ['Ivermectin 1% 50ml', 5, 460, 330, 'vial', 30], ['Calcium Borogluconate 450ml', 3, 380, 270, 'btl', 24],
  ['Albendazole 10% 1 Litre', 1, 1950, 1500, 'btl', 12], ['Tylosin 20% 100ml', 2, 890, 690, 'vial', 20],
  ['MILK POWDER 20KG (26-28% Milk Fat with 34% Protein) Imported Calf Milk Replacer', 4, 2400, 1900, 'bag', 4], ['Meloxicam 2% 50ml', 5, 610, 450, 'vial', 30],
].map(([name, companyId, sellingPrice, costPrice, unit, unitsInBox], i) => ({ id: 101 + i, name, companyId, sellingPrice, costPrice, unit, unitsInBox, available: true }));
// One product registered by staff, still waiting for an admin to price it.
products.push({ id: 120, name: 'Electrolyte Sachet 100g', companyId: 4, sellingPrice: 120, costPrice: 0, costPending: true, unit: 'pkt', unitsInBox: 50, available: true });

export const cities = [{ id: 1, name: 'Karachi' }, { id: 2, name: 'Hyderabad' }, { id: 3, name: 'Thatta' }];
export const areas = [{ id: 1, name: 'Landhi', cityName: 'Karachi' }, { id: 2, name: 'Bhains Colony', cityName: 'Karachi' }, { id: 3, name: 'Latifabad', cityName: 'Hyderabad' }];
export const customerTypes = [{ id: 1, name: 'Dairy farm' }, { id: 2, name: 'Retail pharmacy' }, { id: 3, name: 'Veterinary doctor' }];
const names = ['Abdul Qadir Shan Cattle', 'Al-Madina Dairy Farm', 'Alpha Farm Thatta', 'Bismillah Cattle Farm', 'Haji Rafiq Dairy',
  'Karachi Vet Clinic', 'Memon Goat Farm', 'New Sindh Vet Store', 'Noor Dairy & Cattle', 'Shah Livestock Traders', 'Zam Zam Medical Store'];
export const customers = names.map((name, i) => ({
  id: 1001 + i, name, phone: `03${String(21 + i).padStart(2, '0')}-${String(1234567 + i * 7919).slice(0, 7)}`,
  city: pick(cities).name, area: pick(areas).name, customerType: pick(customerTypes).name,
  address1: `${10 + i} Main Road`, openingBalance: i % 4 === 0 ? 25000 + i * 1000 : 0, registrationDate: daysAgo(200 - i),
}));
customers.push({ id: 1099, name: 'Cash Sale (Walk in Customer)', isCashCustomer: true, openingBalance: 0 });

export const app_users = [
  { id: '1', name: 'Tahir', role: 'admin', permissions: {}, authUid: 'uid-admin', active: true },
  { id: '2', name: 'Ghousia', role: 'staff', authUid: 'uid-staff', active: true,
    permissions: { viewDashboard: true, viewCustomers: true, receivePayments: true, collectOnBill: true, editOwnInvoices: true, salesReturns: true, addCustomers: true, addEditProducts: true } },
];
export const vehicleTypes = [
  { id: 'vt_Rider', name: 'Rider', requiresRider: true }, { id: 'vt_Suzuki', name: 'Suzuki', requiresRider: true },
  { id: 'vt_Intercity_Transport', name: 'Intercity Transport', requiresRider: false }, { id: 'vt_Self-Pickup', name: 'Self-Pickup', requiresRider: false },
];
export const riders = [{ id: 'r1', name: 'Imran', vehicleType: 'Rider', phone: '0300-5551234' }, { id: 'r2', name: 'Shakeel', vehicleType: 'Suzuki', phone: '0301-5559876' }];
export const transportCompanies = [{ id: 't1', name: 'Daewoo Express', transportType: 'Intercity Transport', city: 'Hyderabad' }];
export const expenseCategories = ['Transport', 'Utility Bill', 'Staff Food/Tea', 'Maintenance', 'Other'].map((name, i) => ({ id: i + 1, name }));
export const appSettings = [{ id: 'main', businessName: 'Khyber Traders', phone: '0335 2999006', address: 'Karachi', showBusinessNameOnDocs: true, showBusinessNameOnReports: true }];

const invoices = [], payments = [], expenses = [];
let inv = 8700, est = 30, ord = 200, cn = 40, rec = 300;
for (let day = 95; day >= 0; day--) {
  const n = day % 7 === 5 ? 0 : 1 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const c = pick(customers.slice(0, -1).concat(rnd() < 0.15 ? [customers.at(-1)] : []));
    const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => {
      const p = pick(products.slice(0, 10));
      return { productId: p.id, uniqueId: p.id, name: p.name, price: p.sellingPrice, costPrice: p.costPrice, quantity: 2 + Math.floor(rnd() * 20), unit: p.unit, unitsInBox: p.unitsInBox, company: companies.find(x => x.id === p.companyId).name };
    });
    const doc = { date: daysAgo(day), customerId: c.id, customerName: c.name, items, deliveryBilled: rnd() < 0.4 ? 300 : 0, discount: rnd() < 0.2 ? 500 : 0,
      vehicle: pick(vehicleTypes).name, salespersonId: rnd() < 0.6 ? '2' : '1', salespersonName: '', transportExpense: 0, notes: '' };
    doc.salespersonName = doc.salespersonId === '2' ? 'Ghousia' : 'Tahir';
    doc.total = invoiceTotal(doc);
    const roll = rnd();
    if (day < 6 && roll < 0.12) invoices.push({ ...doc, id: `EST-${String(++est).padStart(4, '0')}`, status: 'Estimate', receivedAmount: 0 });
    else if (day < 4 && roll < 0.22) invoices.push({ ...doc, id: `ORD-${String(++ord).padStart(4, '0')}`, status: 'Booked', receivedAmount: 0 });
    else {
      const paid = c.isCashCustomer ? doc.total : (rnd() < 0.25 ? doc.total : rnd() < 0.3 ? Math.round(doc.total / 2) : 0);
      invoices.push({ ...doc, id: `INV-${++inv}`, status: 'Billed', receivedAmount: paid, paymentStatus: paid >= doc.total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending' });
    }
  }
  if (day % 3 === 0) { const c = pick(customers.slice(0, -1)); payments.push({ id: `REC-${String(++rec).padStart(4, '0')}`, customerId: c.id, amount: 5000 + Math.floor(rnd() * 30) * 1000, discount: 0, date: daysAgo(day), note: pick(['Cash Payment', 'Bank transfer', 'Cash via rider']) }); }
  if (day % 4 === 1) expenses.push({ id: 5000 + day, date: daysAgo(day), amount: 500 + Math.floor(rnd() * 40) * 100, category: pick(expenseCategories).name, note: '' });
  if (day % 23 === 2) { const src = invoices.filter(o => o.status === 'Billed').at(-1); if (src) { const items = [{ ...src.items[0], quantity: 1 }]; const d = { ...src, id: `CN-${String(++cn).padStart(4, '0')}`, status: 'CreditNote', items, deliveryBilled: 0, discount: 0, receivedAmount: 0, originalInvoiceId: src.id, reason: 'Short expiry', date: daysAgo(day) }; d.total = invoiceTotal(d); invoices.push(d); } }
}
export { invoices, payments, expenses };
export const userRoles = app_users.map(u => ({ id: u.authUid, uid: u.authUid, appUserId: u.id, name: u.name, role: u.role, permissions: u.permissions, active: true }));
