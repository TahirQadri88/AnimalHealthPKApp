import React, { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react';
import {
LayoutDashboard, Package, ReceiptText, BarChart3, Settings,
Plus, Search, Truck, CheckCircle2, AlertCircle, Users,
Share2, Printer, Trash2, Edit, X, Lock, DollarSign,
TrendingUp, Receipt, FileSpreadsheet, Calendar, Save, ChevronRight,
Wallet, Download, Upload, TrendingDown, Filter, ArrowUpDown, Award, CreditCard,
FileDown, BookOpen, ShoppingCart, Tag, Building2, BarChart2, PieChart, Activity,
Percent, Hash, Zap, Archive, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp,
AlignLeft, Bell, Star, Layers, Globe, PhoneCall, MapPin, Briefcase, ClipboardList, Copy
} from 'lucide-react';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc } from './firebase';
import { APP_NAME, VEHICLES, getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV } from './helpers';
import PrintView from './components/PrintView';

const AppContext = createContext(null);

// ─── TOP-LEVEL MODAL COMPONENTS (outside App to prevent focus-loss on re-render) ───

const ModalWrapper = ({ title, children, onClose }) => {
useEffect(() => {
const prev = document.body.style.overflow;
document.body.style.overflow = 'hidden';
return () => { document.body.style.overflow = prev; };
}, []);
return (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center" onMouseDown={(e) => { if(e.target === e.currentTarget) onClose(); }}>
<div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl h-[85vh] sm:h-auto max-h-[90vh] flex flex-col animate-slide-up shadow-2xl" onMouseDown={e => e.stopPropagation()}>
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-3xl sm:rounded-t-3xl">
<h2 className="text-lg font-bold text-slate-800">{title}</h2>
<button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"><X size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">{children}</div>
</div>
</div>
);
};

const UserModal = () => {
const { editingUser, appUsers, checkDuplicate, saveToFirebase, showToast, setShowUserModal } = useContext(AppContext);
const isEdit = !!editingUser;
const [form, setForm] = useState(isEdit ? editingUser : { name: '', password: '', role: 'staff' });
const save = async () => {
if (!form.name || !form.password) return showToast("Name and Password are required", "error");
if (checkDuplicate(appUsers, form.name, form.id)) return showToast("Username already exists", "error");
const id = isEdit ? form.id : Date.now().toString();
await saveToFirebase('app_users', id, { ...form, id });
showToast(isEdit ? "User Updated" : "User Added");
setShowUserModal(false);
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Team Member" : "Add Team Member"} onClose={() => setShowUserModal(false)}>
<div className="space-y-4">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Full Name / Username</label><input className={inputClass} value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="e.g. Ali Raza" /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Login Password</label><input type="text" className={inputClass} value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Set Password" /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">System Permissions</label><select className={inputClass} value={form.role} onChange={e=>setForm({...form, role: e.target.value})}><option value="staff">Sales Staff (Hidden Costs & Profits)</option><option value="admin">Administrator (Full Access)</option></select></div>
<button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save User Record</button>
</div>
</ModalWrapper>
);
};

const ProductModal = () => {
const { editingProduct, products, companies, invoices, isAdmin, checkDuplicate, saveToFirebase, showToast, setShowProductModal } = useContext(AppContext);
const isEdit = !!editingProduct;
const [form, setForm] = useState(isEdit ? editingProduct : { name: '', companyId: '', unit: '', unitsInBox: '', costPrice: '', sellingPrice: '', available: true });
const originalCost = isEdit ? editingProduct.costPrice : '';
const costChanged = isEdit && form.costPrice !== originalCost;
const [effectiveDate, setEffectiveDate] = useState(getLocalDateStr());
const [newCompany, setNewCompany] = useState('');
const [isAddingCompany, setIsAddingCompany] = useState(false);
const save = async () => {
if(!form.name || !form.sellingPrice || !form.costPrice || !form.unit || !form.unitsInBox || (!form.companyId && !newCompany)) {
return showToast("All fields (Name, Company, Unit, Qty, Cost, Selling) are compulsory.", "error");
}
if(checkDuplicate(products, form.name, form.id)) return showToast("Product Name must be unique", "error");
let finalCompanyId = form.companyId;
if (isAddingCompany) {
if(checkDuplicate(companies, newCompany)) return showToast("Company Name already exists", "error");
const newComp = { id: Date.now(), name: newCompany };
await saveToFirebase('companies', newComp.id, newComp);
finalCompanyId = newComp.id;
}
const newCost = Number(form.costPrice||0);
const formatted = { ...form, companyId: Number(finalCompanyId), costPrice: newCost, sellingPrice: Number(form.sellingPrice), unitsInBox: Number(form.unitsInBox) };
if (isEdit) {
await saveToFirebase('products', form.id, formatted);
if (costChanged) {
invoices.forEach(async inv => {
if (inv.date >= effectiveDate) {
let updated = false;
const updatedItems = inv.items.map(item => {
if (item.productId === form.id) { updated = true; return { ...item, costPrice: newCost }; }
return item;
});
if (updated) await saveToFirebase('invoices', inv.id, { ...inv, items: updatedItems });
}
});
showToast(`Product Updated. Cost applied from ${effectiveDate}`);
} else { showToast("Product Updated"); }
} else {
const newId = Date.now();
await saveToFirebase('products', newId, { ...formatted, id: newId });
showToast("Product Registered");
}
setShowProductModal(false);
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Product" : "Register Product"} onClose={() => setShowProductModal(false)}>
<div className="space-y-4 pb-10">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Product Name *</label><input placeholder="Unique Product Name" className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-center mb-3"><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Manufacturer / Company *</label><button onClick={() => setIsAddingCompany(!isAddingCompany)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors">{isAddingCompany ? 'Select Existing' : '+ Add New'}</button></div>
{isAddingCompany ? (<input placeholder="Enter New Company Name..." className={inputClass} value={newCompany} onChange={e => setNewCompany(e.target.value)} />) : (
<select className={inputClass} value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})}><option value="">– Select Company –</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
)}
</div>
<div className="grid grid-cols-2 gap-4">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Unit Type *</label><input placeholder="e.g. Vial" className={inputClass} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Units per Box *</label><input type="number" placeholder="Qty" className={inputClass} value={form.unitsInBox} onChange={e => setForm({...form, unitsInBox: e.target.value})} /></div>
</div>
<div className="grid grid-cols-2 gap-4 pt-2">
{isAdmin && (<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Cost Price *</label><input type="number" placeholder="Cost" className={`${inputClass} !border-indigo-200 !bg-indigo-50/50 focus:!border-indigo-500`} value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} /></div>)}
<div className={isAdmin ? 'col-span-2 sm:col-span-1' : 'col-span-2'}><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Selling Price *</label><input type="number" placeholder="Selling" className={`${inputClass} !border-emerald-200 !bg-emerald-50/50 focus:!border-emerald-500 text-emerald-700 font-bold`} value={form.sellingPrice} onChange={e => setForm({...form, sellingPrice: e.target.value})} /></div>
</div>
{costChanged && isAdmin && (
<div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-slide-up mt-2">
<label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-2 flex items-center gap-1"><AlertCircle size={14}/> Effective From Date</label>
<input type="date" className={`${inputClass} !bg-white !border-amber-300 !text-amber-900`} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
<p className="text-[10px] text-amber-600 font-medium mt-2 leading-tight">This will retroactively update profitability on past invoices from this date onward.</p>
</div>
)}
<button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-6 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save Product</button>
</div>
</ModalWrapper>
);
};

const CustomerModal = () => {
const { editingCustomer, customers, invoices, billingView, currentInvoice, isAdmin, checkDuplicate, saveToFirebase, showToast, setShowCustomerModal, setCurrentInvoice, cities, areas, customerTypes, setShowSegmentsModal } = useContext(AppContext);
const isEdit = !!editingCustomer;
const [form, setForm] = useState(isEdit ? editingCustomer : { name: '', contactPerson: '', phone: '', address1: '', map1: '', address2: '', map2: '', openingBalance: 0, city: '', area: '', customerType: '' });
useEffect(() => { if (isEdit && editingCustomer.address && !editingCustomer.address1) { setForm(prev => ({...prev, address1: editingCustomer.address})); } }, [isEdit, editingCustomer]);
const save = async () => {
if(!form.name) return showToast("Customer Name required", "error");
if(checkDuplicate(customers, form.name, form.id)) return showToast("Customer Name must be unique", "error");
if(isEdit) {
const updatedCustomer = {...form, openingBalance: Number(form.openingBalance)};
if(updatedCustomer.address) delete updatedCustomer.address;
await saveToFirebase('customers', form.id, updatedCustomer);
if(form.name !== editingCustomer.name) { invoices.forEach(async o => { if (o.customerId === form.id) await saveToFirebase('invoices', o.id, {...o, customerName: form.name}); }); }
showToast("Customer Updated");
} else {
const newId = Date.now();
const newCust = { ...form, openingBalance: Number(form.openingBalance), id: newId };
await saveToFirebase('customers', newId, newCust);
if (billingView === 'form' && currentInvoice) { setCurrentInvoice({...currentInvoice, customerId: newCust.id, customerName: newCust.name}); }
showToast("Customer Added");
}
setShowCustomerModal(false);
};
const inputClass = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Customer Profile" : "Add New Customer"} onClose={() => setShowCustomerModal(false)}>
<div className="space-y-5 pb-8">
<div className="space-y-3">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1">Basic Details</h3>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Customer / Business Name *</label><input placeholder="e.g. Karachi Vet Clinic" className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
<div className="grid grid-cols-2 gap-3">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Contact Person</label><input placeholder="Name" className={inputClass} value={form.contactPerson || ''} onChange={e => setForm({...form, contactPerson: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Phone Number</label><input placeholder="03XXXXXXXXX" className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
</div>
</div>
<div className="space-y-3 bg-slate-100 p-3 rounded-xl border border-slate-200">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1"><MapPin size={14}/> Primary Location</h3>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Address 1</label><textarea placeholder="Complete Delivery Address..." rows="2" className={inputClass} value={form.address1} onChange={e => setForm({...form, address1: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Google Maps Link 1</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map1 || ''} onChange={e => setForm({...form, map1: e.target.value})} /></div>
</div>
<div className="space-y-3 p-3 rounded-xl border border-slate-200 border-dashed">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin size={14}/> Secondary Location (Optional)</h3>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Address 2</label><textarea placeholder="Alternative Address..." rows="2" className={inputClass} value={form.address2 || ''} onChange={e => setForm({...form, address2: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Google Maps Link 2</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map2 || ''} onChange={e => setForm({...form, map2: e.target.value})} /></div>
</div>
<div className="space-y-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
<div className="flex justify-between items-center"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1"><Globe size={14}/> Segment / Classification</h3><button type="button" onClick={()=>setShowSegmentsModal(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-2 py-1 rounded-md transition-colors">+ Manage</button></div>
<div className="grid grid-cols-3 gap-2">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">City</label><select className={inputClass} value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}><option value="">–</option>{cities.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Area</label><select className={inputClass} value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})}><option value="">–</option>{areas.map(a=><option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Type</label><select className={inputClass} value={form.customerType||''} onChange={e=>setForm({...form,customerType:e.target.value})}><option value="">–</option>{customerTypes.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div>
</div>
</div>
{isAdmin && (
<div className="bg-rose-50 p-3 rounded-xl border border-rose-100 mt-2 space-y-3">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Opening Balance (Dr)</label><input type="number" placeholder="0.00" className={`${inputClass} !border-rose-200 focus:!border-rose-500`} value={form.openingBalance} onChange={e => setForm({...form, openingBalance: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider ml-1 mb-1 block">Credit Limit (Rs) — 0 = no limit</label><input type="number" placeholder="0 = unlimited" className={`${inputClass} !border-amber-200 !bg-amber-50/50 focus:!border-amber-500`} value={form.creditLimit||0} onChange={e => setForm({...form, creditLimit: e.target.value})} /></div>
</div>
)}
<button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save Customer Profile</button>
</div>
</ModalWrapper>
);
};

const PaymentModal = () => {
const { selectedCustomerForPayment, customers, getCustomerBalance, saveToFirebase, showToast, setShowPaymentModal, editingPayment, setEditingPayment } = useContext(AppContext);
const isEdit = !!editingPayment;
const [form, setForm] = useState(
  isEdit
    ? { customerId: editingPayment.customerId, amount: editingPayment.amount, date: editingPayment.date, note: editingPayment.note || 'Cash Payment' }
    : { customerId: selectedCustomerForPayment || '', amount: '', date: getLocalDateStr(), note: 'Cash Payment' }
);
const handleClose = () => { setEditingPayment(null); setShowPaymentModal(false); };
const save = async () => {
if(!form.customerId || !form.amount) return showToast("Customer and Amount are required", "error");
if (isEdit) {
  const updated = { ...editingPayment, customerId: Number(form.customerId), amount: Number(form.amount), date: form.date, note: form.note };
  await saveToFirebase('payments', updated.id, updated);
  showToast("Payment Receipt Updated!");
} else {
  const newPayment = { id: `REC-${Math.floor(Math.random()*100000)}`, customerId: Number(form.customerId), amount: Number(form.amount), date: form.date, note: form.note };
  await saveToFirebase('payments', newPayment.id, newPayment);
  showToast("Payment Received & Ledger Updated!");
}
handleClose();
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Payment Receipt" : "Receive Payment"} onClose={handleClose}>
<div className="space-y-4 pb-10">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Select Client</label><select className={inputClass} value={form.customerId} onChange={e=>setForm({...form, customerId: e.target.value})} disabled={isEdit}><option value="">– Choose Client –</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
{form.customerId && (<div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center"><p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Current Outstanding Balance</p><p className="text-xl font-black text-rose-600 mt-1">Rs. {getCustomerBalance(Number(form.customerId)).toLocaleString()}</p></div>)}
<div className="grid grid-cols-2 gap-3">
<div className="col-span-2"><label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider ml-1 mb-1 block">Amount Received (Cr)</label><input type="number" placeholder="0.00" className={`${inputClass} !border-emerald-200 !text-emerald-700 !font-extrabold text-lg`} value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Date</label><input type="date" className={inputClass} value={form.date} onChange={e=>setForm({...form, date: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Mode / Note</label><input type="text" placeholder="e.g. Cash / Cheque No." className={inputClass} value={form.note} onChange={e=>setForm({...form, note: e.target.value})} /></div>
</div>
<button onClick={save} className={`w-full text-white font-bold py-4 rounded-xl mt-6 shadow-md active:scale-[0.98] transition-all ${isEdit ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}>{isEdit ? 'Update Payment' : 'Process Payment'}</button>
</div>
</ModalWrapper>
);
};

const CustomerLedgerModal = () => {
const { selectedLedgerId, getCustomerLedger, generateReceiptData, setPrintConfig, setShowPaymentModal, setSelectedCustomerForPayment, setShowLedgerModal, deleteFromFirebase, saveToFirebase, invoices, isAdmin, setEditingPayment, payments } = useContext(AppContext);
const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return getLocalDateStr(d); });
const [endDate, setEndDate] = useState(getLocalDateStr());
const fullLedger = getCustomerLedger(selectedLedgerId);
if(!fullLedger) return null;
const preRows = fullLedger.rows.filter(r => r.date < startDate);
const periodOpeningBal = fullLedger.openingBal + preRows.reduce((sum, r) => sum + r.debit - r.credit, 0);
const filteredRows = fullLedger.rows.filter(r => r.date >= startDate && r.date <= endDate);
const periodTotalDebit = filteredRows.reduce((sum, r) => sum + r.debit, 0);
const periodTotalCredit = filteredRows.reduce((sum, r) => sum + r.credit, 0);
const printData = { ...fullLedger, dateRange: { start: startDate, end: endDate }, openingBal: periodOpeningBal, rows: filteredRows, totalDebit: periodTotalDebit, totalCredit: periodTotalCredit };
return (
<ModalWrapper title={`${fullLedger.customerName} - Account Ledger`} onClose={() => setShowLedgerModal(false)}>
<div className="space-y-4 pb-10">
<div className="flex items-center gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
<div className="flex-1"><label className="text-[9px] font-bold uppercase text-slate-500 block mb-1 tracking-wider">Start Date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-indigo-500 bg-white" /></div>
<div className="flex-1"><label className="text-[9px] font-bold uppercase text-slate-500 block mb-1 tracking-wider">End Date</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-indigo-500 bg-white" /></div>
<div className="ml-2 text-right bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 shadow-sm shrink-0"><p className="text-[9px] font-bold uppercase text-rose-600 tracking-widest">Current Balance</p><p className="text-base font-black text-rose-700 mt-0.5">Rs. {fullLedger.closingBal.toLocaleString()}</p></div>
</div>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setEditingPayment(null); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs"><Wallet size={16} /> Receive Payment</button>}
<button onClick={() => setPrintConfig({docType: 'ledger', format: 'a5', data: printData})} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 shadow-sm active:scale-[0.98] transition-all text-xs"><FileSpreadsheet size={16} /> Print Ledger</button>
</div>
<div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
<div className="overflow-x-auto">
<table className="w-full text-left text-[11px] sm:text-xs min-w-[500px]">
<thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="py-3 px-3 font-bold uppercase tracking-wider">Date</th><th className="py-3 px-3 font-bold uppercase tracking-wider">Particulars</th><th className="py-3 px-3 text-right font-bold uppercase tracking-wider">Debit (Dr)</th><th className="py-3 px-3 text-right font-bold uppercase tracking-wider">Credit (Cr)</th><th className="py-3 px-3 text-right font-bold uppercase tracking-wider">Balance</th><th className="py-3 px-2 text-center"></th></tr></thead>
<tbody className="divide-y divide-slate-100 text-slate-800">
<tr className="bg-slate-50/30"><td className="py-3 px-3 text-slate-500 font-medium" colSpan={4}>Opening Balance <span className="text-[9px]">(as of {formatDateDisp(startDate)})</span></td><td className="py-3 px-3 text-right font-bold text-slate-700">Rs. {periodOpeningBal.toLocaleString()}</td><td></td></tr>
{filteredRows.map(row => (
<tr key={row.id} className="hover:bg-slate-50 transition-colors">
<td className="py-3 px-3 font-medium text-slate-600">{formatDateDisp(row.date)}</td>
<td className="py-3 px-3"><span className="font-bold text-slate-800 block">{row.desc}</span><span className="block text-[9px] text-slate-400 mt-0.5">{row.ref}</span></td>
<td className="py-3 px-3 text-right font-extrabold text-indigo-600">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
<td className="py-3 px-3 text-right font-extrabold text-emerald-600">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
<td className="py-3 px-3 text-right font-extrabold text-slate-800">{row.balance.toLocaleString()}</td>
<td className="py-3 px-2 text-center">
<div className="flex gap-1 justify-center">
{row.credit > 0 && (<button onClick={() => setPrintConfig({docType: 'receipt', format: 'thermal', data: generateReceiptData(fullLedger, row.id)})} title="Print Receipt" className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"><Receipt size={14}/></button>)}
{isAdmin && row.credit > 0 && row.id.startsWith('REC-') && (
<button title="Edit Payment" onClick={() => { const pay = payments.find(p => p.id === row.id); if(pay){ setEditingPayment(pay); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }}} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors"><Edit size={14}/></button>
)}
{isAdmin && row.credit > 0 && (
<button title="Delete Payment" onClick={async () => {
  if (!window.confirm('Delete this payment record?')) return;
  if (row.id.startsWith('REC-')) {
    await deleteFromFirebase('payments', row.id);
  } else if (row.id.endsWith('-PAY')) {
    const inv = invoices.find(i => i.id === row.ref);
    if (inv) await saveToFirebase('invoices', inv.id, { ...inv, receivedAmount: 0, paymentStatus: 'Pending' });
  }
}} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg transition-colors"><Trash2 size={14}/></button>
)}
</div>
</td>
</tr>
))}
{filteredRows.length === 0 && (<tr><td colSpan={6} className="text-center py-6 text-slate-400 font-medium">No transactions in this period.</td></tr>)}
</tbody>
<tfoot className="bg-slate-50 border-t border-slate-200">
<tr><td colSpan={2} className="py-3 px-3 font-bold text-right uppercase tracking-wider text-slate-500">Period Totals:</td><td className="py-3 px-3 text-right font-black text-indigo-700">Rs. {periodTotalDebit.toLocaleString()}</td><td className="py-3 px-3 text-right font-black text-emerald-600">Rs. {periodTotalCredit.toLocaleString()}</td><td colSpan={2}></td></tr>
</tfoot>
</table>
</div>
</div>
</div>
</ModalWrapper>
);
};

const ExpenseCategoryModal = () => {
const { expenseCategories, saveToFirebase, deleteFromFirebase, showToast, setShowExpenseCatModal } = useContext(AppContext);
const [newCat, setNewCat] = useState('');
const addCat = async () => {
if(!newCat) return;
if(expenseCategories.some(c => c.name.toLowerCase() === newCat.toLowerCase())) return showToast("Category exists", "error");
const catObj = { id: Date.now(), name: newCat };
await saveToFirebase('expenseCategories', catObj.id, catObj);
setNewCat('');
showToast("Category Added");
};
return (
<ModalWrapper title="Manage Expense Labels" onClose={() => setShowExpenseCatModal(false)}>
<div className="space-y-4 pb-10">
<div className="flex gap-2"><input type="text" placeholder="New category name..." className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500" value={newCat} onChange={e=>setNewCat(e.target.value)} /><button onClick={addCat} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Add</button></div>
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
<ul className="divide-y divide-slate-100">
{expenseCategories.map(c => (
<li key={c.id} className="flex justify-between items-center p-3 hover:bg-slate-50">
<span className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Tag size={14} className="text-slate-400"/> {c.name}</span>
<button onClick={async () => await deleteFromFirebase('expenseCategories', c.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
</li>
))}
</ul>
</div>
</div>
</ModalWrapper>
);
};

// ─────────────────────────────────────────────────────────────────────────────

function useLiveCollection(collectionName) {
const [data, setData] = React.useState([]);
useEffect(() => {
const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
const items = [];
snapshot.forEach((d) => items.push(d.data()));
setData(items.sort((a, b) => (a.id > b.id ? 1 : -1)));
}, (error) => { console.error('Error fetching ' + collectionName + ':', error); });
return () => unsubscribe();
}, [collectionName]);
return data;
}


const SegmentsModal = () => {
const { cities, areas, customerTypes, saveToFirebase, deleteFromFirebase, showToast, setShowSegmentsModal } = useContext(AppContext);
const [tab, setTab] = useState('cities');
const [newVal, setNewVal] = useState('');
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const colMap = { cities: cities, areas: areas, customerTypes: customerTypes };
const fireMap = { cities: 'cities', areas: 'areas', customerTypes: 'customerTypes' };
const labelMap = { cities: 'City', areas: 'Area', customerTypes: 'Customer Type' };
const list = colMap[tab];
const col = fireMap[tab];
const add = async () => {
  if (!newVal.trim()) return;
  if (list.some(i => i.name.toLowerCase() === newVal.toLowerCase())) return showToast(`${labelMap[tab]} already exists`, 'error');
  const id = Date.now();
  await saveToFirebase(col, id, { id, name: newVal.trim() });
  setNewVal('');
};
const save = async (item) => {
  if (!editVal.trim()) return;
  if (list.some(i => i.id !== item.id && i.name.toLowerCase() === editVal.toLowerCase())) return showToast('Name already exists', 'error');
  await saveToFirebase(col, item.id, { ...item, name: editVal.trim() });
  setEditingId(null);
};
return (
<ModalWrapper title="Manage Segments" onClose={() => setShowSegmentsModal(false)}>
<div className="space-y-4 pb-10">
<div className="flex bg-slate-100 p-1 rounded-xl gap-1">
{['cities','areas','customerTypes'].map(t => (
<button key={t} onClick={() => { setTab(t); setNewVal(''); setEditingId(null); }} className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs transition-colors ${tab===t?'bg-white text-indigo-700 shadow-sm':'text-slate-500'}`}>{labelMap[t]}s</button>
))}
</div>
<div className="flex gap-2">
<input type="text" placeholder={`New ${labelMap[tab]}...`} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 text-sm" value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} />
<button onClick={add} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Add</button>
</div>
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
{list.length === 0 && <p className="text-center py-6 text-sm text-slate-400">No {labelMap[tab]}s yet. Add one above.</p>}
<ul className="divide-y divide-slate-100">
{list.map(item => (
<li key={item.id} className="flex items-center gap-2 p-3 hover:bg-slate-50">
{editingId === item.id ? (
<>
<input autoFocus className="flex-1 p-2 text-sm font-semibold border border-indigo-300 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save(item);if(e.key==='Escape')setEditingId(null);}} />
<button onClick={()=>save(item)} className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100">Save</button>
<button onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">Cancel</button>
</>
) : (
<>
<span className="flex-1 font-semibold text-slate-700 text-sm">{item.name}</span>
<button onClick={()=>{setEditingId(item.id);setEditVal(item.name);}} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={14}/></button>
<button onClick={async()=>{if(window.confirm(`Delete "${item.name}"?`))await deleteFromFirebase(col,item.id);}} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
</>
)}
</li>
))}
</ul>
</div>
</div>
</ModalWrapper>
);
};

// — Tabs —
const DashboardTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [dateFilter, setDateFilter] = useState('This Month');
const filteredInvoices = invoices.filter(o => o.status === 'Billed' && checkDateFilter(o.date, dateFilter));
const filteredExpenses = expenses.filter(e => checkDateFilter(e.date, dateFilter));
const revenue = filteredInvoices.reduce((sum, o) => sum + o.total, 0);
const totalReceivables = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
const topStats = useMemo(() => {
const byProduct = {};
filteredInvoices.forEach(o => {
o.items.forEach(item => {
if(!byProduct[item.name]) byProduct[item.name] = { qty: 0, revenue: 0, profit: 0 };
const rev = item.price * item.quantity;
const cost = item.costPrice * item.quantity;
byProduct[item.name].qty += item.quantity;
byProduct[item.name].revenue += rev;
byProduct[item.name].profit += (rev - cost);
});
});
const arr = Object.entries(byProduct).map(([name, data]) => ({name, ...data}));
return { topValue: [...arr].sort((a,b)=>b.revenue - a.revenue).slice(0,5), topQty: [...arr].sort((a,b)=>b.qty - a.qty).slice(0,5), topProfit: [...arr].sort((a,b)=>b.profit - a.profit).slice(0,5) };
}, [filteredInvoices]);
return (
<div className="h-full overflow-y-auto">
<div className="p-5 space-y-6 pb-24">
<div className="flex justify-between items-center">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Overview</h2>
<div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
<Calendar size={14} className="text-indigo-500" />
<select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent font-bold text-xs text-slate-700 outline-none cursor-pointer"><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option></select>
</div>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 rounded-2xl shadow-lg shadow-indigo-600/20">
<p className="text-[10px] uppercase font-bold text-indigo-100 flex items-center gap-1.5 tracking-wider"><TrendingUp size={14}/> {dateFilter} Sales</p>
<p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Rs. {revenue.toLocaleString()}</p>
</div>
<div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-5 rounded-2xl shadow-lg shadow-rose-500/20">
<p className="text-[10px] uppercase font-bold text-rose-100 flex items-center gap-1.5 tracking-wider"><DollarSign size={14}/> Receivables</p>
<p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Rs. {totalReceivables.toLocaleString()}</p>
</div>
</div>
{isAdmin && (
<div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-indigo-200 transition-colors cursor-pointer" onClick={() => {setActiveTab('admin'); setAdminView('expenses');}}>
<div><p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider"><TrendingDown size={14}/> Operational Expenses</p><p className="text-xl font-black text-slate-800 mt-1">Rs. {totalExpenses.toLocaleString()}</p></div>
<button className="p-3 bg-slate-50 text-slate-400 rounded-xl"><ChevronRight size={20}/></button>
</div>
)}
{isAdmin && (
<div className="space-y-4">
<h3 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">Top 5 Products ({dateFilter})</h3>
<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
<h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-1.5"><Award size={14}/> By Sales Value</h4>
<div className="space-y-2.5">
{topStats.topValue.map((item, i) => (<div key={i} className="flex justify-between items-center"><span className="text-sm font-semibold text-slate-700 truncate mr-2">{i+1}. {item.name}</span><span className="font-bold text-slate-800 text-sm shrink-0">Rs. {item.revenue.toLocaleString()}</span></div>))}
{topStats.topValue.length === 0 && <p className="text-xs text-slate-400">No data.</p>}
</div>
</div>
</div>
)}
<div>
<div className="flex justify-between items-end mb-4 mt-6">
<h3 className="text-base font-bold text-slate-800">Recent Activity</h3>
<button onClick={() => setActiveTab('billing')} className="text-xs font-bold text-indigo-600 flex items-center gap-0.5">View All <ChevronRight size={14}/></button>
</div>
<div className="space-y-3">
{invoices.filter(o => checkDateFilter(o.date, dateFilter)).slice(-5).reverse().map(invoice => (
<div key={invoice.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
<div>
<p className="font-bold text-slate-800 text-sm">{invoice.customerName}</p>
<p className="text-[11px] text-slate-500 font-medium mt-0.5">{invoice.id} \u2022 {formatDateDisp(invoice.date)} \u2022 <span className={`font-bold ${invoice.status === 'Billed' ? 'text-indigo-600' : 'text-amber-500'}`}>{invoice.status}</span></p>
</div>
<div className="text-right">
<p className="font-extrabold text-slate-800 text-sm">Rs. {invoice.total.toLocaleString()}</p>
<span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block ${invoice.paymentStatus==='Paid'?'bg-emerald-100 text-emerald-700':invoice.paymentStatus==='Partial'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>{invoice.paymentStatus}</span>
</div>
</div>
))}
</div>
</div>
</div>
</div>
);
};

const BillingTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [search, setSearch] = useState('');
const [dateFilter, setDateFilter] = useState('All Time');
const [prodSearch, setProdSearch] = useState('');
const startNewInvoice = () => {
setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', notes: '' });
setBillingView('form');
};
const saveInvoice = async (status) => {
if(!currentInvoice.customerId || currentInvoice.items.length === 0) return showToast("Customer and items are required", "error");
const totalItems = currentInvoice.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
const grandTotal = totalItems + Number(currentInvoice.deliveryBilled);
const activeCustomer = customers.find(c => c.id === currentInvoice.customerId);
const finalInvoice = { ...currentInvoice, total: grandTotal, status: status, salespersonId: currentUser.id, salespersonName: currentUser.name, customerDetails: activeCustomer ? { contactPerson: activeCustomer.contactPerson || '', phone: activeCustomer.phone || '', address1: activeCustomer.address1 || activeCustomer.address || '', map1: activeCustomer.map1 || '', address2: activeCustomer.address2 || '', map2: activeCustomer.map2 || '' } : {} };
if (!finalInvoice.id) { finalInvoice.id = `INV-${Math.floor(Math.random()*10000)}`; finalInvoice.date = getLocalDateStr(); }
await saveToFirebase('invoices', finalInvoice.id, finalInvoice);
showToast(currentInvoice.id ? "Invoice Updated" : `Invoice ${status}`);
setBillingView('list');
};
const inputClass = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
const handleAddItem = (p, isBonus) => {
const uniqueId = isBonus ? `${p.id}_bonus` : p.id;
const existing = currentInvoice.items.find(i => (i.uniqueId || i.productId) === uniqueId);
let historicalPrice = p.sellingPrice;
if (!isBonus && currentInvoice.customerId) {
const pastInvs = invoices.filter(inv => inv.customerId === currentInvoice.customerId).sort((a,b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
for (let inv of pastInvs) {
const pastItem = inv.items.find(i => (i.productId === p.id || i.uniqueId === p.id) && !i.isBonus);
if (pastItem && pastItem.price !== undefined) { historicalPrice = pastItem.price; break; }
}
}
if(existing) { setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === uniqueId ? {...i, quantity: i.quantity + 1} : i)}); }
else { setCurrentInvoice({...currentInvoice, items: [...currentInvoice.items, { uniqueId: uniqueId, productId: p.id, name: p.name, price: isBonus ? 0 : historicalPrice, originalPrice: p.sellingPrice, costPrice: p.costPrice, company: getCompanyName(p.companyId), quantity: 1, unitsInBox: p.unitsInBox, unit: p.unit, isBonus: isBonus }]}); }
setProdSearch('');
};
if (billingView === 'form') {
const isEdit = !!currentInvoice.id;
const grandTotal = currentInvoice.items.reduce((s,i)=>s+(i.price*i.quantity),0) + Number(currentInvoice.deliveryBilled);
return (
<div className="h-full flex flex-col bg-slate-50 absolute inset-0 z-20 animate-slide-up">
<div className="bg-white/80 backdrop-blur-md p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
<div><h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{isEdit ? `Edit ${currentInvoice.id}` : 'New Invoice'}</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDateDisp(currentInvoice.date || getLocalDateStr())}</p></div>
<button onClick={() => setBillingView('list')} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><X size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto p-4 space-y-5 pb-32">
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Users size={12}/> Select Customer</h3>
<div className="flex gap-2 items-center">
<select className={inputClass} value={currentInvoice.customerId} onChange={e => {
const cid = Number(e.target.value);
const cName = customers.find(c=>c.id === cid)?.name || '';
const pastInvs = invoices.filter(inv => inv.customerId === cid).sort((a,b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
const lastInv = pastInvs[0];
setCurrentInvoice({ ...currentInvoice, customerId: cid, customerName: cName, vehicle: lastInv ? (lastInv.vehicle || VEHICLES[0]) : VEHICLES[0], transportCompany: lastInv ? (lastInv.transportCompany || '') : '', biltyNumber: lastInv ? (lastInv.biltyNumber || '') : '', driverName: lastInv ? (lastInv.driverName || '') : '', driverPhone: lastInv ? (lastInv.driverPhone || '') : '', deliveryBilled: lastInv ? (lastInv.deliveryBilled || 0) : 0, transportExpense: lastInv ? (lastInv.transportExpense || 0) : 0 });
}}><option value="">– Select Client –</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
<button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-black shrink-0 transition-colors"><Plus size={18}/></button>
</div>
{currentInvoice.customerId && (() => {
  const cust = customers.find(c => c.id === currentInvoice.customerId);
  const bal = getCustomerBalance(currentInvoice.customerId);
  const limit = Number(cust?.creditLimit || 0);
  if (bal > 0 || (limit > 0 && bal >= limit * 0.8)) {
    const overLimit = limit > 0 && bal >= limit;
    return (
      <div className={`mt-2 p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${overLimit ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
        <AlertCircle size={14} className="shrink-0"/>
        <span>{overLimit ? `⚠ Credit limit exceeded! Balance Rs.${bal.toLocaleString()} ≥ limit Rs.${limit.toLocaleString()}` : `Outstanding balance: Rs.${bal.toLocaleString()}${limit > 0 ? ` (limit: Rs.${limit.toLocaleString()})` : ''}`}</span>
      </div>
    );
  }
  return null;
})()}
</div>
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Package size={12}/> Products</h3>
<div className="flex gap-2 items-center mb-4"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-400"/><input placeholder="Search to add..." className={`pl-10 ${inputClass}`} value={prodSearch} onChange={e=>setProdSearch(e.target.value)} /></div></div>
{prodSearch && (
<div className="border border-indigo-200 bg-indigo-50/50 rounded-xl mb-4 max-h-48 overflow-y-auto p-2 space-y-1 shadow-inner">
{products.filter(p => p.available && p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p => (
<div key={p.id} className="p-2 bg-white rounded-lg shadow-sm border border-indigo-100 flex justify-between items-center group">
<div className="flex-1 font-semibold text-sm text-slate-800 cursor-pointer" onClick={() => handleAddItem(p, false)}><span>{p.name}</span><span className="text-indigo-600 font-bold ml-2">Rs.{p.sellingPrice}</span></div>
<button onClick={() => handleAddItem(p, true)} className="px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded font-bold hover:bg-emerald-100 transition-colors ml-2">\ud83c\udf81 Bonus</button>
</div>
))}
</div>
)}
<div className="space-y-3">
{currentInvoice.items.map(item => {
const itemKey = item.uniqueId || item.productId;
return (
<div key={itemKey} className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-start mb-2">
<p className="font-bold text-sm text-slate-800 leading-tight">{item.name}{item.isBonus && <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-200">Bonus</span>}</p>
<button onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.filter(i => (i.uniqueId || i.productId) !== itemKey)})} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
</div>
<div className="flex items-center justify-between">
<div className="flex flex-col">
<label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">Rate (Rs)</label>
<input type="number" className="w-24 p-1.5 text-sm font-extrabold text-indigo-700 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" value={item.price} disabled={item.isBonus} onChange={(e) => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, price: Number(e.target.value)} : i)})} />
{item.isBonus && <span className="text-[9px] text-slate-400 font-medium line-through mt-0.5">Rs. {item.originalPrice}</span>}
</div>
<div className="flex flex-col items-center">
<label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Quantity</label>
<div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
<button onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: i.quantity - 1} : i).filter(i=>i.quantity>0)})} className="w-8 h-8 rounded-md bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors">-</button>
<input type="number" className="w-12 text-center text-sm font-bold bg-transparent outline-none appearance-none" value={item.quantity} onChange={(e) => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: Number(e.target.value)} : i)})} />
<button onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: i.quantity + 1} : i)})} className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">+</button>
</div>
</div>
</div>
</div>
)})}
</div>
</div>
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Truck size={12}/> Logistics</h3>
<div className="mb-3"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Vehicle / Transport Method</label><select className={inputClass} value={currentInvoice.vehicle} onChange={e => setCurrentInvoice({...currentInvoice, vehicle: e.target.value})}>{VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
{currentInvoice.vehicle === 'Intercity Transport' && (
<div className="grid grid-cols-2 gap-3 mb-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
<div className="col-span-2"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Transport Company</label><input placeholder="e.g. Daewoo Express" className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.transportCompany || ''} onChange={e => setCurrentInvoice({...currentInvoice, transportCompany: e.target.value})} /></div>
<div className="col-span-2"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Bilty / Bill-T Number</label><input placeholder="Enter Bilty #" className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.biltyNumber || ''} onChange={e => setCurrentInvoice({...currentInvoice, biltyNumber: e.target.value})} /></div>
</div>
)}
{['Rider', 'Rickshaw', 'Suzuki'].includes(currentInvoice.vehicle) && (
<div className="grid grid-cols-2 gap-3 mb-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider ml-1 mb-1 block">Driver Name</label><input placeholder="Name" className={`${inputClass} !bg-white !border-indigo-200`} value={currentInvoice.driverName || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverName: e.target.value})} /></div>
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider ml-1 mb-1 block">Driver Phone</label><input placeholder="03XX..." className={`${inputClass} !bg-white !border-indigo-200`} value={currentInvoice.driverPhone || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverPhone: e.target.value})} /></div>
</div>
)}
<div className="grid grid-cols-2 gap-3 mb-2">
<div><label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider ml-1 mb-1 block">Delivery Billed (+)</label><input type="number" className={inputClass} value={currentInvoice.deliveryBilled} onChange={e => setCurrentInvoice({...currentInvoice, deliveryBilled: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Driver Exp (-)</label><input type="number" className={inputClass} value={currentInvoice.transportExpense} onChange={e => setCurrentInvoice({...currentInvoice, transportExpense: e.target.value})} /></div>
</div>
<div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block mb-2">Payment Received</label>
<div className="flex items-center gap-2">
<input type="number" className="w-full p-3 bg-white border border-slate-300 rounded-xl font-extrabold text-emerald-600 text-lg outline-none" value={currentInvoice.receivedAmount || ''} onChange={e => setCurrentInvoice({...currentInvoice, receivedAmount: Number(e.target.value), paymentStatus: Number(e.target.value) >= grandTotal ? 'Paid' : (Number(e.target.value)>0 ? 'Partial' : 'Pending')})} placeholder="0.00" />
<button onClick={() => setCurrentInvoice({...currentInvoice, receivedAmount: grandTotal, paymentStatus: 'Paid'})} className="px-4 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs whitespace-nowrap border border-indigo-100">Full Pay</button>
</div>
</div>
</div>
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlignLeft size={12}/> Notes / Remarks</h3>
<textarea rows={3} placeholder="e.g. Special instructions, delivery notes, payment terms..." className={`${inputClass} resize-none`} value={currentInvoice.notes || ''} onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})} />
</div>
<div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100 text-center shadow-sm">
<p className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest mb-1">Grand Total</p>
<p className="text-4xl font-black text-emerald-800 tracking-tight">Rs. {grandTotal.toLocaleString()}</p>
</div>
{isEdit && isAdmin && (<button onClick={async () => { if(window.confirm("Permanently delete?")) { await deleteFromFirebase('invoices', currentInvoice.id); setBillingView('list'); } }} className="w-full bg-white text-rose-600 font-bold p-4 rounded-xl flex justify-center items-center gap-2 border border-rose-200 hover:bg-rose-50 shadow-sm mt-4"><Trash2 size={18}/> Delete Invoice</button>)}
</div>
<div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 fixed bottom-0 w-full max-w-md flex gap-3 z-30">
<button onClick={() => saveInvoice('Booked')} className="flex-1 bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2 active:scale-95 transition-all hover:bg-slate-50"><Save size={18}/> Draft</button>
<button onClick={() => saveInvoice('Billed')} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-md flex justify-center items-center gap-2 active:scale-95 transition-all"><ReceiptText size={18}/> Issue Bill</button>
</div>
</div>
);
}
const filtered = invoices.filter(o => (o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search)) && checkDateFilter(o.date, dateFilter));
return (
<div className="p-4 flex flex-col h-full">
<div className="flex gap-2 mb-4">
<div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Invoices..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
<button onClick={startNewInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl shadow-md font-bold flex items-center gap-1.5 active:scale-95"><Plus size={18}/> New</button>
</div>
<div className="flex items-center gap-2 mb-4"><Calendar size={18} className="text-slate-400" /><select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold text-sm text-slate-700 outline-none flex-1"><option>All Time</option><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option></select></div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{filtered.slice().reverse().map(o => (
<div key={o.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200">
<div className={`absolute top-0 left-0 w-1.5 h-full ${o.status==='Billed' ? (o.paymentStatus==='Paid'?'bg-emerald-500':'bg-amber-500') : 'bg-slate-300'}`}></div>
<div className="flex justify-between border-b border-slate-100 pb-3 mb-3 pl-3">
<div><h4 className="font-bold text-slate-800 text-sm">{o.customerName}</h4><p className="text-[11px] text-slate-500 font-medium mt-0.5">{o.id} \u2022 {formatDateDisp(o.date)} \u2022 <span className={`font-bold ${o.status === 'Billed' ? 'text-indigo-600' : 'text-amber-500'}`}>{o.status}</span></p></div>
<div className="text-right"><p className="font-extrabold text-indigo-700 text-base">Rs. {o.total.toLocaleString()}</p><p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${o.status==='Billed'?'text-indigo-500':'text-slate-400'}`}>{o.status}</p></div>
</div>
<div className="flex justify-between items-center pl-3">
<div className="flex items-center gap-2"><span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${o.paymentStatus==='Paid'?'bg-emerald-100 text-emerald-700':o.paymentStatus==='Partial'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>{o.paymentStatus}</span></div>
<div className="flex gap-1.5">
{isAdmin && <button onClick={() => { setCurrentInvoice(o); setBillingView('form'); }} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg"><Edit size={16}/></button>}
{isAdmin && <button onClick={async () => { if(window.confirm(`Delete ${o.id}?`)) await deleteFromFirebase('invoices', o.id); }} title="Delete" className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg"><Trash2 size={16}/></button>}
<button onClick={() => setPrintConfig({docType: 'dispatch', format: 'thermal', data: o})} title="Dispatch" className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Truck size={16}/></button>
<button onClick={() => setPrintConfig({docType: 'invoice', format: 'thermal', data: o})} title="Print" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ReceiptText size={16}/></button>
</div>
</div>
</div>
))}
</div>
</div>
);
};

const ProductsTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [search, setSearch] = useState('');
return (
<div className="p-4 flex flex-col h-full">
<div className="flex gap-2 mb-4">
<div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Inventory..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
<button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="bg-indigo-600 text-white p-3 rounded-xl shadow-md"><Plus size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
<div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-start mb-3">
<div><h4 className="font-bold text-slate-800 text-base leading-tight">{p.name}</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{getCompanyName(p.companyId)} \u2022 {p.unit} ({p.unitsInBox})</p></div>
{isAdmin && (<div className="flex gap-1.5"><button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button><button onClick={async () => { if(window.confirm(`Permanently delete ${p.name}?`)) await deleteFromFirebase('products', p.id); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button></div>)}
</div>
<div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-1">
<div className="flex flex-col"><span className="text-indigo-700 font-extrabold text-lg">Rs. {p.sellingPrice.toLocaleString()}</span>{isAdmin && <span className="text-slate-400 text-[9px] font-bold uppercase mt-0.5">Cost: Rs. {p.costPrice}</span>}</div>
{isAdmin ? (<button onClick={async () => { await saveToFirebase('products', p.id, {...p, available: !p.available}) }} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase ${p.available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{p.available ? 'In Stock' : 'Out Stock'}</button>) : (<span className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase ${p.available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{p.available ? 'In Stock' : 'Out Stock'}</span>)}
</div>
</div>
))}
</div>
</div>
);
};

const CustomersTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [search, setSearch] = useState('');
return (
<div className="p-4 flex flex-col h-full">
<div className="flex justify-between items-center mb-4">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Ledgers</h2>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="bg-emerald-500 text-white p-2 px-3 rounded-xl shadow-md flex items-center gap-1 text-xs font-bold"><Wallet size={16}/> Pay</button>}
{isAdmin && <button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} className="bg-indigo-600 text-white p-2 rounded-xl shadow-md"><Plus size={18}/></button>}
</div>
</div>
<div className="relative mb-4"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Clients..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => {
const bal = getCustomerBalance(c.id);
return (
<div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm hover:border-indigo-200 transition-colors">
<div className="flex-1 cursor-pointer" onClick={() => { setSelectedLedgerId(c.id); setShowLedgerModal(true); }}>
<h4 className="font-bold text-slate-800 text-sm hover:text-indigo-600">{c.name}</h4>
<p className="text-[11px] font-medium text-slate-500 mt-0.5">{c.contactPerson ? `${c.contactPerson} - ` : ''}{c.phone}</p>
<div className="mt-2.5">
<span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${bal > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : bal < 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
Bal: Rs. {bal.toLocaleString()} {bal > 0 ? '(Dr)' : bal < 0 ? '(Cr)' : ''}
</span>
</div>
</div>
{isAdmin && (<div className="flex flex-col gap-2 ml-3"><button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setShowCustomerModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button><button onClick={async (e) => { e.stopPropagation(); if(window.confirm(`Permanently delete ${c.name}? All ledger records will be orphaned.`)) await deleteFromFirebase('customers', c.id); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button></div>)}
</div>
);
})}
</div>
</div>
);
};

// ─── Payments / Receipts Tab ───
const PaymentsTab = () => {
const { isAdmin, customers, payments, invoices, deleteFromFirebase, showToast, setShowPaymentModal, setSelectedCustomerForPayment, setEditingPayment } = useContext(AppContext);
const [search, setSearch] = useState('');
const [dateFilter, setDateFilter] = useState('This Month');
const [customerFilter, setCustomerFilter] = useState('');
const allPayments = useMemo(() => {
  const standalone = payments.map(p => ({
    id: p.id, date: p.date, customerId: p.customerId,
    customerName: customers.find(c => c.id === p.customerId)?.name || 'Unknown',
    amount: Number(p.amount), note: p.note || 'Payment', type: 'receipt', raw: p
  }));
  const invPays = invoices.filter(inv => Number(inv.receivedAmount) > 0).map(inv => ({
    id: `${inv.id}-PAY`, date: inv.date, customerId: inv.customerId,
    customerName: inv.customerName, amount: Number(inv.receivedAmount),
    note: `On Invoice ${inv.id}`, type: 'invoice', raw: inv
  }));
  return [...standalone, ...invPays].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}, [payments, invoices, customers]);
const filtered = allPayments.filter(p => {
  const matchSearch = !search || p.customerName.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase());
  const matchCustomer = !customerFilter || String(p.customerId) === customerFilter;
  const matchDate = checkDateFilter(p.date, dateFilter);
  return matchSearch && matchCustomer && matchDate;
});
const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);
return (
<div className="p-4 flex flex-col h-full">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Receipts</h2>
    {isAdmin && (
      <button onClick={() => { setEditingPayment(null); setSelectedCustomerForPayment(null); setShowPaymentModal(true); }}
        className="bg-emerald-500 text-white px-3 py-2.5 rounded-xl shadow-md font-bold flex items-center gap-1.5 text-xs active:scale-95 transition-all">
        <Plus size={16}/> New Receipt
      </button>
    )}
  </div>
  <div className="space-y-2 mb-3">
    <div className="relative"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={16}/><input placeholder="Search client or receipt ID..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e=>setSearch(e.target.value)} /></div>
    <div className="flex gap-2">
      <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold text-sm text-slate-700 outline-none shadow-sm">
        <option>All Time</option><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option>
      </select>
      <select value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg font-semibold text-sm text-slate-700 outline-none shadow-sm">
        <option value="">All Clients</option>
        {customers.map(c=><option key={c.id} value={String(c.id)}>{c.name}</option>)}
      </select>
    </div>
  </div>
  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center">
    <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">{filtered.length} Receipts</span>
    <span className="font-black text-emerald-800 text-sm">Total: Rs. {totalAmount.toLocaleString()}</span>
  </div>
  <div className="flex-1 overflow-y-auto space-y-2.5 pb-24 pr-1">
    {filtered.map(p => (
      <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{p.customerName}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{p.id} &bull; {formatDateDisp(p.date)}</p>
            {p.note && <p className="text-[11px] text-slate-400 mt-0.5 italic truncate">{p.note}</p>}
          </div>
          <div className="text-right ml-3 shrink-0">
            <p className="font-extrabold text-emerald-600 text-base">Rs. {p.amount.toLocaleString()}</p>
            {isAdmin && (
              <div className="flex gap-1 mt-1.5 justify-end">
                {p.type === 'receipt' && (
                  <button onClick={() => { setEditingPayment(p.raw); setSelectedCustomerForPayment(p.customerId); setShowPaymentModal(true); }} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors"><Edit size={13}/></button>
                )}
                {p.type === 'receipt' && (
                  <button onClick={async()=>{if(window.confirm('Delete this payment receipt?')){await deleteFromFirebase('payments',p.id);showToast('Payment deleted');}}} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100 transition-colors"><Trash2 size={13}/></button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    ))}
    {filtered.length === 0 && (
      <div className="text-center py-16">
        <Receipt size={40} className="text-slate-200 mx-auto mb-3"/>
        <p className="text-slate-400 font-medium text-sm">No receipts found for this period.</p>
      </div>
    )}
  </div>
</div>
);
};

// ─── Company Manager sub-component ───
const CompanyManager = () => {
const { companies, saveToFirebase, deleteFromFirebase, showToast, checkDuplicate } = useContext(AppContext);
const [newName, setNewName] = useState('');
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const add = async () => {
  if (!newName.trim()) return;
  if (checkDuplicate(companies, newName)) return showToast("Company already exists", "error");
  const id = Date.now();
  await saveToFirebase('companies', id, { id, name: newName.trim() });
  setNewName(''); showToast("Company added");
};
const saveEdit = async (item) => {
  if (!editVal.trim()) return;
  await saveToFirebase('companies', item.id, { ...item, name: editVal.trim() });
  setEditingId(null); showToast("Company updated");
};
return (
<div className="space-y-2">
  <div className="flex gap-2">
    <input type="text" placeholder="New company name..." className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 text-sm shadow-sm" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} />
    <button onClick={add} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">Add</button>
  </div>
  {companies.map(c=>(
    <div key={c.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
      {editingId===c.id ? (
        <>
          <input autoFocus className="flex-1 p-2 text-sm font-semibold border border-indigo-300 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(c);if(e.key==='Escape')setEditingId(null);}} />
          <button onClick={()=>saveEdit(c)} className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100">Save</button>
          <button onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">✕</button>
        </>
      ) : (
        <>
          <span className="flex-1 font-semibold text-slate-700 text-sm flex items-center gap-2"><Building2 size={14} className="text-slate-400"/> {c.name}</span>
          <button onClick={()=>{setEditingId(c.id);setEditVal(c.name);}} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={14}/></button>
          <button onClick={async()=>{if(window.confirm(`Delete "${c.name}"?`))await deleteFromFirebase('companies',c.id);}} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
        </>
      )}
    </div>
  ))}
</div>
);
};

// ─── Master Records View ───
const MastersView = () => {
const { products, customers, expenseCategories, getCompanyName, deleteFromFirebase, showToast, setEditingProduct, setShowProductModal, setEditingCustomer, setShowCustomerModal, setShowExpenseCatModal } = useContext(AppContext);
const [tab, setTab] = useState('products');
const [search, setSearch] = useState('');
const tabConfig = [
  { id: 'products', label: 'Items' },
  { id: 'customers', label: 'Clients' },
  { id: 'companies', label: 'Companies' },
  { id: 'categories', label: 'Exp. Labels' },
];
return (
<div className="h-full flex flex-col p-4 pb-6 overflow-y-auto space-y-4">
  <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto scrollbar-hide">
    {tabConfig.map(t=>(
      <button key={t.id} onClick={()=>{setTab(t.id);setSearch('');}} className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs whitespace-nowrap transition-colors ${tab===t.id?'bg-white text-teal-700 shadow-sm':'text-slate-500'}`}>{t.label}</button>
    ))}
  </div>
  <div className="flex gap-2">
    <div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={14}/><input placeholder="Search..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold outline-none text-sm shadow-sm focus:border-indigo-400" value={search} onChange={e=>setSearch(e.target.value)} /></div>
    {tab !== 'companies' && tab !== 'categories' && (
      <button onClick={() => {
        if (tab === 'products') { setEditingProduct(null); setShowProductModal(true); }
        else if (tab === 'customers') { setEditingCustomer(null); setShowCustomerModal(true); }
      }} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
        <Plus size={16}/> Add
      </button>
    )}
    {tab === 'categories' && (
      <button onClick={()=>setShowExpenseCatModal(true)} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors flex items-center gap-1.5"><Plus size={16}/> Add</button>
    )}
  </div>

  {tab === 'products' && (
    <div className="space-y-2 pb-10">
      {products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=>(
        <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-2">
            <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">{getCompanyName(p.companyId)} &bull; {p.unit} &bull; Cost: {p.costPrice} &bull; Sell: {p.sellingPrice}</p>
            <span className={`text-[9px] font-bold mt-1 inline-block px-1.5 py-0.5 rounded uppercase ${p.available?'bg-emerald-50 text-emerald-600 border border-emerald-100':'bg-rose-50 text-rose-500 border border-rose-100'}`}>{p.available?'In Stock':'Out of Stock'}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={()=>{setEditingProduct(p);setShowProductModal(true);}} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Edit size={14}/></button>
            <button onClick={async()=>{if(window.confirm(`Delete ${p.name}?`))await deleteFromFirebase('products',p.id);}} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  )}

  {tab === 'customers' && (
    <div className="space-y-2 pb-10">
      {customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=>(
        <div key={c.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-2">
            <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">{[c.contactPerson, c.phone, c.city].filter(Boolean).join(' • ')}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={()=>{setEditingCustomer(c);setShowCustomerModal(true);}} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Edit size={14}/></button>
            <button onClick={async()=>{if(window.confirm(`Permanently delete ${c.name}?`))await deleteFromFirebase('customers',c.id);}} className="p-2 bg-rose-50 text-rosese-500 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  )}

  {tab === 'companies' && <CompanyManager />}

  {tab === 'categories' && (
    <div className="space-y-2 pb-10">
      {expenseCategories.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=>(
        <div key={c.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <span className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Tag size={14} className="text-slate-400"/> {c.name}</span>
          <button onClick={async()=>await deleteFromFirebase('expenseCategories',c.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={14}/></button>
        </div>
      ))}
    </div>
  )}
</div>
);
};

const AdminTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
if(!isAdmin) return <div className="p-10 text-center font-bold text-slate-400 flex flex-col items-center mt-20"><Lock className="mb-4 text-slate-300" size={48}/> <p className="text-sm uppercase tracking-widest">Admin Access Required</p></div>;
return (
<div className="h-full flex flex-col">
<div className="px-4 pt-4 pb-2">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-4">Admin Hub</h2>
<div className="flex bg-slate-200 p-1 rounded-xl overflow-x-auto scrollbar-hide">
<button onClick={()=>setAdminView('analytics')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='analytics'?'bg-white text-indigo-700 shadow-sm':'text-slate-500'}`}><BarChart3 size={14}/> Analytics</button>
<button onClick={()=>setAdminView('expenses')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='expenses'?'bg-white text-rose-600 shadow-sm':'text-slate-500'}`}><Wallet size={14}/> Expenses</button>
<button onClick={()=>setAdminView('masters')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='masters'?'bg-white text-teal-600 shadow-sm':'text-slate-500'}`}><Archive size={14}/> Masters</button>
<button onClick={()=>setAdminView('bulk')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='bulk'?'bg-white text-emerald-600 shadow-sm':'text-slate-500'}`}><Upload size={14}/> Bulk Ops</button>
<button onClick={()=>setAdminView('segments')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='segments'?'bg-white text-purple-600 shadow-sm':'text-slate-500'}`}><Globe size={14}/> Segments</button>
<button onClick={()=>setAdminView('users')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView==='users'?'bg-white text-amber-600 shadow-sm':'text-slate-500'}`}><Users size={14}/> Users</button>
</div>
</div>
<div className="flex-1 overflow-hidden">
<div style={{display: adminView === 'analytics' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AnalyticsView /></div>
<div style={{display: adminView === 'expenses' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><ExpensesView /></div>
<div style={{display: adminView === 'masters' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><MastersView /></div>
<div style={{display: adminView === 'bulk' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><BulkOpsView /></div>
<div style={{display: adminView === 'segments' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><SegmentsAdminView /></div>
<div style={{display: adminView === 'users' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><UserManagementView /></div>
</div>
</div>
)
};

const UserManagementView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [userDateFilter, setUserDateFilter] = useState('This Month');
return (
<div className="h-full flex flex-col p-4 pb-24 overflow-y-auto">
<div className="flex justify-between items-center mb-4">
<div>
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Team Management</h3>
<p className="text-[10px] text-slate-400 mt-0.5">{appUsers.length} users registered</p>
</div>
<button onClick={() => { setEditingUser(null); setShowUserModal(true); }} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 hover:bg-indigo-700 transition-colors"><Plus size={14}/> Add User</button>
</div>
<div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm mb-4 w-fit">
<Calendar size={13} className="text-indigo-500"/>
<select value={userDateFilter} onChange={e=>setUserDateFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
<option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option>
</select>
</div>
<div className="space-y-3">
{appUsers.map(u => {
const userInvoices = invoices.filter(inv => inv.salespersonId === u.id && inv.status === 'Billed' && checkDateFilter(inv.date, userDateFilter));
const totalSales = userInvoices.reduce((sum, inv) => sum + inv.total, 0);
const totalProfit = userInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + ((item.price - item.costPrice) * item.quantity), 0), 0);
const avgOrder = userInvoices.length > 0 ? Math.round(totalSales / userInvoices.length) : 0;
return (
<div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-start mb-3">
<div>
<h4 className="font-bold text-slate-800 text-base">{u.name}</h4>
<span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-1 inline-block border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{u.role}</span>
</div>
<div className="flex gap-1.5">
<button onClick={() => { setEditingUser(u); setShowUserModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button>
<button onClick={async () => { if(u.id === currentUser.id) return showToast("Cannot delete yourself","error"); if(window.confirm(`Permanently delete user ${u.name}?`)) await deleteFromFirebase('app_users', u.id); }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
</div>
</div>
<div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Orders</p><p className="font-extrabold text-slate-700 text-lg">{userInvoices.length}</p></div>
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Revenue</p><p className="font-extrabold text-emerald-600 text-sm">Rs.{totalSales.toLocaleString()}</p></div>
<div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">GP</p><p className={`font-extrabold text-sm ${totalProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>Rs.{totalProfit.toLocaleString()}</p></div>
</div>
{userInvoices.length > 0 && (
<div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500">
<span>Avg order: <span className="font-bold text-slate-700">Rs.{avgOrder.toLocaleString()}</span></span>
<span>Last sale: <span className="font-bold text-slate-700">{formatDateDisp(userInvoices.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date)}</span></span>
</div>
)}
</div>
);
})}
</div>
<div className="mt-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-indigo-600"/> Export Users</h3>
<button onClick={() => { const data = appUsers.map(u => ({ ID: u.id, Name: u.name, Role: u.role, Password: u.password || '' })); exportToCSV(data, 'Users_Export.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export Users CSV</button>
</div>
</div>
);
};

const SegmentsAdminView = () => {
const { cities, areas, customerTypes, customers, invoices, saveToFirebase, deleteFromFirebase, showToast, getCustomerBalance, setShowSegmentsModal } = useContext(AppContext);
const [tab, setTab] = useState('cities');
const [newVal, setNewVal] = useState('');
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const colMap = { cities: cities, areas: areas, customerTypes: customerTypes };
const fireMap = { cities: 'cities', areas: 'areas', customerTypes: 'customerTypes' };
const labelMap = { cities: 'City', areas: 'Area', customerTypes: 'Type' };
const list = colMap[tab]; const col = fireMap[tab];
const add = async () => {
  if (!newVal.trim()) return;
  if (list.some(i => i.name.toLowerCase() === newVal.toLowerCase())) return showToast('Already exists', 'error');
  const id = Date.now();
  await saveToFirebase(col, id, { id, name: newVal.trim() });
  setNewVal('');
};
const saveEdit = async (item) => {
  if (!editVal.trim()) return;
  await saveToFirebase(col, item.id, { ...item, name: editVal.trim() });
  setEditingId(null);
};
// Compute sales per segment value
const segKey = tab === 'cities' ? 'city' : tab === 'areas' ? 'area' : 'customerType';
const custMap = {}; customers.forEach(c => { custMap[c.name] = c[segKey] || ''; });
const segStats = {};
invoices.filter(o => o.status === 'Billed').forEach(o => {
  const seg = custMap[o.customerName] || '';
  if (!seg) return;
  if (!segStats[seg]) segStats[seg] = { orders: 0, revenue: 0, customers: new Set() };
  segStats[seg].orders += 1;
  segStats[seg].revenue += o.total;
  segStats[seg].customers.add(o.customerName);
});
return (
<div className="h-full flex flex-col p-4 pb-24 overflow-y-auto space-y-4">
<div className="flex justify-between items-center">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Customer Segments</h3>
</div>
<div className="flex bg-slate-200 p-1 rounded-xl gap-1">
{['cities','areas','customerTypes'].map(t => (
<button key={t} onClick={() => { setTab(t); setNewVal(''); setEditingId(null); }} className={`flex-1 py-2 px-2 rounded-lg font-bold text-xs transition-colors ${tab===t?'bg-white text-purple-700 shadow-sm':'text-slate-500'}`}>{labelMap[t]}s</button>
))}
</div>
<div className="flex gap-2">
<input type="text" placeholder={`New ${labelMap[tab]}...`} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500 text-sm" value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} />
<button onClick={add} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Add</button>
</div>
<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
{list.length === 0 && <p className="text-center py-6 text-sm text-slate-400">No {labelMap[tab]}s yet.</p>}
<ul className="divide-y divide-slate-100">
{list.map(item => {
  const stats = segStats[item.name] || { orders: 0, revenue: 0, customers: new Set() };
  return (
  <li key={item.id} className="p-3 hover:bg-slate-50">
  {editingId === item.id ? (
  <div className="flex gap-2 items-center">
  <input autoFocus className="flex-1 p-2 text-sm font-semibold border border-indigo-300 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(item);if(e.key==='Escape')setEditingId(null);}} />
  <button onClick={()=>saveEdit(item)} className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-lg">Save</button>
  <button onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">Cancel</button>
  </div>
  ) : (
  <div className="flex items-center gap-2">
  <div className="flex-1">
  <div className="flex items-center gap-2"><span className="font-bold text-slate-800 text-sm">{item.name}</span>{stats.orders > 0 && <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{stats.orders} orders</span>}</div>
  {stats.orders > 0 && <p className="text-[10px] text-slate-400 mt-0.5">{stats.customers.size} clients · Rs.{stats.revenue.toLocaleString()} revenue</p>}
  </div>
  <button onClick={()=>{setEditingId(item.id);setEditVal(item.name);}} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={14}/></button>
  <button onClick={async()=>{if(window.confirm(`Delete "${item.name}"?`))await deleteFromFirebase(col,item.id);}} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
  </div>
  )}
  </li>
  );
})}
</ul>
</div>
</div>
);
};

const AnalyticsView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, cities, areas, customerTypes, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [view, setView] = useState('Overview');
const [dateFilter, setDateFilter] = useState('This Month');
const [customStart, setCustomStart] = useState('');
const [customEnd, setCustomEnd] = useState(getLocalDateStr());
const [filterCompany, setFilterCompany] = useState('');
const [filterCustomer, setFilterCustomer] = useState('');
const [filterSalesperson, setFilterSalesperson] = useState('');
const [sortBy, setSortBy] = useState('profit');

const checkCustomFilter = (dateStr) => {
  if (dateFilter !== 'Custom') return checkDateFilter(dateStr, dateFilter);
  if (!customStart) return dateStr <= customEnd;
  return dateStr >= customStart && dateStr <= customEnd;
};

const reportEngine = useMemo(() => {
  let billedForPnL = invoices.filter(o => o.status === 'Billed' && checkCustomFilter(o.date));
  if(filterCustomer) billedForPnL = billedForPnL.filter(o => o.customerId === Number(filterCustomer));
  if(filterSalesperson) billedForPnL = billedForPnL.filter(o => o.salespersonId === Number(filterSalesperson));
  const kpis = { productRevenue: 0, totalCOGS: 0, grossMargin: 0, deliveryBilled: 0, transportExpense: 0, totalReceivables: 0 };
  const byProduct = {}; const byCompany = {}; const byCustomer = {}; const receivablesList = [];
  const bySalesperson = {};
  const byCity = {}; const byArea = {}; const byType = {};
  // Build customer segment lookup
  const custSegment = {};
  customers.forEach(c => { custSegment[c.name] = { city: c.city || '', area: c.area || '', type: c.customerType || '' }; });
  customers.forEach(c => { const bal = getCustomerBalance(c.id); if(bal > 0) { kpis.totalReceivables += bal; receivablesList.push({ name: c.name, id: c.id, amount: bal }); } });
  billedForPnL.forEach(o => {
    kpis.deliveryBilled += Number(o.deliveryBilled || 0);
    kpis.transportExpense += Number(o.transportExpense || 0);
    if(!byCustomer[o.customerName]) byCustomer[o.customerName] = { productRevenue: 0, cost: 0, profit: 0, orders: 0 };
    byCustomer[o.customerName].orders += 1;
    const spName = o.salespersonName || 'Unknown';
    if(!bySalesperson[spName]) bySalesperson[spName] = { revenue: 0, profit: 0, orders: 0 };
    bySalesperson[spName].orders += 1;
    let orderItemRevenue = 0; let orderItemCost = 0;
    o.items.forEach(item => {
      const itemCompanyId = products.find(p=>p.id===item.productId)?.companyId;
      if(filterCompany && String(itemCompanyId) !== String(filterCompany)) return;
      const itemRev = item.price * item.quantity;
      const itemCost = (item.costPrice || 0) * item.quantity;
      orderItemRevenue += itemRev; orderItemCost += itemCost;
      if(!byProduct[item.name]) byProduct[item.name] = { qty: 0, revenue: 0, cost: 0, profit: 0, company: item.company || '' };
      byProduct[item.name].qty += item.quantity; byProduct[item.name].revenue += itemRev; byProduct[item.name].cost += itemCost; byProduct[item.name].profit += (itemRev - itemCost);
      if(!byCompany[item.company || 'Unknown']) byCompany[item.company || 'Unknown'] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
      byCompany[item.company || 'Unknown'].qty += item.quantity; byCompany[item.company || 'Unknown'].revenue += itemRev; byCompany[item.company || 'Unknown'].cost += itemCost; byCompany[item.company || 'Unknown'].profit += (itemRev - itemCost);
    });
    kpis.productRevenue += orderItemRevenue; kpis.totalCOGS += orderItemCost;
    byCustomer[o.customerName].productRevenue += orderItemRevenue; byCustomer[o.customerName].cost += orderItemCost; byCustomer[o.customerName].profit += (orderItemRevenue - orderItemCost);
    bySalesperson[spName].revenue += orderItemRevenue; bySalesperson[spName].profit += (orderItemRevenue - orderItemCost);
    const seg = custSegment[o.customerName] || {};
    const gp = orderItemRevenue - orderItemCost;
    ['city','area','type'].forEach(k => {
      const val = seg[k] || 'Unknown';
      const map = k === 'city' ? byCity : k === 'area' ? byArea : byType;
      if (!map[val]) map[val] = { revenue: 0, profit: 0, orders: 0 };
      map[val].revenue += orderItemRevenue; map[val].profit += gp; map[val].orders += 1;
    });
  });
  kpis.grossMargin = kpis.productRevenue - kpis.totalCOGS;
  const filteredExpenses = expenses.filter(e => checkCustomFilter(e.date));
  kpis.totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  kpis.netProfit = kpis.grossMargin + (kpis.deliveryBilled - kpis.transportExpense) - kpis.totalExpenses;
  // Expense breakdown by category
  const byExpenseCategory = {};
  filteredExpenses.forEach(e => { if(!byExpenseCategory[e.category]) byExpenseCategory[e.category] = 0; byExpenseCategory[e.category] += Number(e.amount); });
  // Previous period for comparison
  const getPrevDates = () => {
    const now = getPKTDate(); let days = 30;
    if (dateFilter === 'Today') days = 1; else if (dateFilter === 'This Week') days = 7; else if (dateFilter === 'This Month') days = 30; else if (dateFilter === 'This Year') days = 365;
    else if (dateFilter === 'Custom' && customStart) { const ms = new Date(customEnd) - new Date(customStart); days = Math.ceil(ms / 86400000) + 1; }
    const end = new Date(now); end.setDate(end.getDate() - days);
    const start = new Date(end); start.setDate(start.getDate() - days);
    return { start: getLocalDateStr(start), end: getLocalDateStr(end) };
  };
  const prevPeriod = getPrevDates();
  let prevRevenue = 0, prevProfit = 0;
  invoices.filter(o => o.status === 'Billed' && o.date >= prevPeriod.start && o.date <= prevPeriod.end).forEach(o => {
    o.items.forEach(item => { prevRevenue += item.price * item.quantity; prevProfit += (item.price - (item.costPrice||0)) * item.quantity; });
  });
  const trends = {
    revenue: prevRevenue > 0 ? ((kpis.productRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null,
    profit: prevProfit > 0 ? ((kpis.grossMargin - prevProfit) / prevProfit * 100).toFixed(1) : null
  };
  // Daily breakdown with both revenue and profit
  const dailyBreakdown = {};
  billedForPnL.forEach(o => {
    if (!dailyBreakdown[o.date]) dailyBreakdown[o.date] = { revenue: 0, profit: 0, orders: 0 };
    let dayRevenue = 0, dayCost = 0;
    o.items.forEach(item => { dayRevenue += item.price * item.quantity; dayCost += (item.costPrice||0) * item.quantity; });
    dailyBreakdown[o.date].revenue += dayRevenue; dailyBreakdown[o.date].profit += (dayRevenue - dayCost); dailyBreakdown[o.date].orders += 1;
  });
  // Receivables aging
  const today = getLocalDateStr();
  const agingBuckets = { current: [], days30: [], days60: [], days90plus: [] };
  receivablesList.forEach(r => {
    const lastInv = invoices.filter(o => o.customerId === r.id && o.status === 'Billed').sort((a,b) => b.date.localeCompare(a.date))[0];
    const daysDiff = lastInv ? Math.floor((new Date(today) - new Date(lastInv.date)) / 86400000) : 999;
    r.daysSince = daysDiff;
    r.lastInvDate = lastInv?.date;
    r.phone = customers.find(c => c.id === r.id)?.phone || '';
    if (daysDiff <= 30) agingBuckets.current.push(r);
    else if (daysDiff <= 60) agingBuckets.days30.push(r);
    else if (daysDiff <= 90) agingBuckets.days60.push(r);
    else agingBuckets.days90plus.push(r);
  });
  // All-time monthly breakdown (last 24 months, ignores current date filter)
  const monthlyData = {};
  invoices.filter(o => o.status === 'Billed').forEach(o => {
    const month = o.date.slice(0, 7);
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, profit: 0, orders: 0, cost: 0 };
    o.items.forEach(item => { monthlyData[month].revenue += item.price * item.quantity; monthlyData[month].cost += (item.costPrice||0) * item.quantity; monthlyData[month].profit += (item.price - (item.costPrice||0)) * item.quantity; });
    monthlyData[month].orders += 1;
  });
  // Payment collection rate for filtered period
  const totalBilledAmt = billedForPnL.reduce((s, o) => s + o.total, 0);
  const invoiceCollected = billedForPnL.reduce((s, o) => s + Number(o.receivedAmount||0), 0);
  const standaloneCollectedAmt = payments.filter(p => checkCustomFilter(p.date)).reduce((s, p) => s + Number(p.amount), 0);
  const collectionRate = totalBilledAmt > 0 ? Math.min(((invoiceCollected + standaloneCollectedAmt) / totalBilledAmt) * 100, 100).toFixed(1) : '0.0';
  // New vs repeat customers in period
  const custFirstOrderDate = {};
  invoices.filter(o => o.status === 'Billed').sort((a,b)=>a.date.localeCompare(b.date)).forEach(o => { if (!custFirstOrderDate[o.customerId]) custFirstOrderDate[o.customerId] = o.date; });
  const periodCustIds = [...new Set(billedForPnL.map(o => o.customerId))];
  let newCustCount = 0, repeatCustCount = 0;
  periodCustIds.forEach(id => { if (billedForPnL.some(o => o.customerId === id && o.date === custFirstOrderDate[id])) newCustCount++; else repeatCustCount++; });
  return { kpis, byProduct, byCompany, byCustomer, bySalesperson, byCity, byArea, byType, receivablesList: receivablesList.sort((a,b)=>b.amount-a.amount), trends, dailyBreakdown, byExpenseCategory, agingBuckets, monthlyData, collectionRate, newCustCount, repeatCustCount, totalBilledAmt };
}, [invoices, expenses, payments, dateFilter, customStart, customEnd, filterCompany, filterCustomer, filterSalesperson, products, customers]);

const getSortedExportData = () => {
   if (view === 'Overview') return null;
   if (view === 'Receivables') return reportEngine.receivablesList.map(r => ({ Name: r.name, Balance: r.amount, DaysSinceLastInvoice: r.daysSince || 0, LastInvoiceDate: r.lastInvDate || '' }));
   if (view === 'By Salesperson') return Object.entries(reportEngine.bySalesperson).map(([key,val]) => ({ Name: key, Orders: val.orders, Revenue: val.revenue, GrossProfit: val.profit })).sort((a,b)=>b.Revenue-a.Revenue);
   const dataObj = view === 'By Product' ? reportEngine.byProduct : view === 'By Company' ? reportEngine.byCompany : reportEngine.byCustomer;
   let arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => b[sortBy] - a[sortBy]);
   return arr.map(r => ({ Name: r.key, Company: r.company || '', Qty: r.qty || 0, Revenue: r.revenue || r.productRevenue || 0, GrossProfit: r.profit || 0 }));
};

const handleExport = (format) => {
    const title = `Analytics - ${view}`;
    const exportData = getSortedExportData();
    if (format === 'csv') {
        if(view === 'Overview') return showToast("Cannot export Overview as CSV", "error");
        exportToCSV(exportData, `${title.replace(/ /g, '_')}_${dateFilter}.csv`);
    } else if (format === 'pdf') {
        setPrintConfig({ docType: 'report', format: 'a5', data: { title, dateFilter, view, stats: reportEngine.kpis, rows: exportData } });
    } else if (format === 'text') {
        const kpis = reportEngine.kpis;
        const margin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : 0;
        let text = `📊 *${APP_NAME}*\n*${title}* | Period: ${filterLabel}\n${'─'.repeat(30)}\n`;
        if (view === 'Overview') {
          text += `💰 *Sales & Profitability*\n`;
          text += `Product Sales: Rs. ${kpis.productRevenue.toLocaleString()}\n`;
          text += `Total COGS:    Rs. ${kpis.totalCOGS.toLocaleString()}\n`;
          text += `Gross Margin:  Rs. ${kpis.grossMargin.toLocaleString()} (${margin}%)\n`;
          text += `\n🚛 *Delivery*\n`;
          text += `Billed: Rs. ${kpis.deliveryBilled.toLocaleString()} | Expense: Rs. ${kpis.transportExpense.toLocaleString()}\n`;
          text += `\n💸 *Expenses*\n`;
          text += `Operational: Rs. ${kpis.totalExpenses.toLocaleString()}\n`;
          text += `\n${'─'.repeat(30)}\n`;
          text += `✅ *Net Profit: Rs. ${kpis.netProfit.toLocaleString()}*\n`;
          text += `📌 Receivables: Rs. ${kpis.totalReceivables.toLocaleString()}\n`;
          if (reportEngine.trends.revenue !== null) text += `📈 Revenue trend: ${Number(reportEngine.trends.revenue) >= 0 ? '+' : ''}${reportEngine.trends.revenue}% vs prev period\n`;
        } else {
          exportData.forEach((r, i) => {
            const gp = r.GrossProfit || r.Amount || 0;
            const rev = r.Revenue || 0;
            const gpMargin = rev > 0 ? ` (${((gp/rev)*100).toFixed(1)}%)` : '';
            text += `${i+1}. *${r.Name}*${r.Company ? ` — ${r.Company}` : ''}\n`;
            if (r.Qty) text += `   Qty: ${(r.Qty||0).toLocaleString()} | `;
            if (r.Orders) text += `   Orders: ${r.Orders} | `;
            text += `Rev: Rs.${rev.toLocaleString()} | GP: Rs.${gp.toLocaleString()}${gpMargin}\n`;
          });
          if (exportData.length > 0) {
            const totalRev = exportData.reduce((s,r)=>s+(r.Revenue||0),0);
            const totalGP = exportData.reduce((s,r)=>s+(r.GrossProfit||0),0);
            text += `${'─'.repeat(30)}\nTotal Rev: Rs.${totalRev.toLocaleString()} | Total GP: Rs.${totalGP.toLocaleString()}\n`;
          }
        }
        navigator.clipboard.writeText(text).catch(()=>{});
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
        showToast("Report shared to WhatsApp!");
    }
};

const renderTable = (dataObj, type) => {
  let arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => {
    if (sortBy === 'qty') return b.qty - a.qty;
    if (sortBy === 'revenue') return (b.revenue||b.productRevenue||0) - (a.revenue||a.productRevenue||0);
    return b.profit - a.profit;
  });
  // ABC classification by cumulative revenue share
  const totalRevAll = arr.reduce((s, r) => s + (r.revenue || r.productRevenue || 0), 0);
  let cumRev = 0;
  const arrWithABC = arr.map(r => {
    const rev = r.revenue || r.productRevenue || 0;
    cumRev += rev;
    const pct = totalRevAll > 0 ? cumRev / totalRevAll : 1;
    const tier = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
    return { ...r, abcTier: tier };
  });
  const maxProfit = arrWithABC[0]?.profit || 1;
  const totalRev = arrWithABC.reduce((s, r) => s + (r.revenue || r.productRevenue || 0), 0);
  const totalGP = arrWithABC.reduce((s, r) => s + (r.profit || 0), 0);
  const totalQtyOrOrders = arrWithABC.reduce((s, r) => s + (r.qty || r.orders || 0), 0);
  const tierColors = { A: 'bg-emerald-100 text-emerald-700 border-emerald-200', B: 'bg-amber-100 text-amber-700 border-amber-200', C: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-3">
       <div className="bg-slate-50 border-b border-slate-200 p-2 flex justify-between items-center">
         <div className="flex items-center gap-2 ml-1">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{arrWithABC.length} {type}s</span>
           <span className="text-[9px] text-slate-400 font-medium">| ABC = revenue tier</span>
         </div>
         <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-600 outline-none">
           <option value="profit">Sort: Highest GP</option>
           <option value="revenue">Sort: Highest Revenue</option>
           {type !== 'Customer' && <option value="qty">Sort: Highest Qty</option>}
         </select>
       </div>
       <div className="overflow-x-auto">
         <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">{type}</th>
                {type !== 'Customer' && <th className="p-3 text-center">Qty</th>}
                {type === 'Customer' && <th className="p-3 text-center">Orders</th>}
                <th className="p-3 text-right">Revenue</th>
                <th className="p-3 text-right">Rev%</th>
                <th className="p-3 text-right text-emerald-600">GP</th>
                <th className="p-3 text-right text-indigo-500">Margin%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {arrWithABC.map((row, i) => {
                const rev = row.revenue || row.productRevenue || 0;
                const gp = row.profit || 0;
                const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0;
                const revShare = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : 0;
                const barW = maxProfit > 0 ? Math.max((gp / maxProfit) * 100, 0) : 0;
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1 py-0.5 rounded border ${tierColors[row.abcTier]}`}>{row.abcTier}</span>
                        <div className="font-bold text-slate-800">{row.key}</div>
                      </div>
                      {row.company && <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{row.company}</div>}
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 max-w-[100px]"><div className="bg-emerald-400 h-1 rounded-full" style={{width:`${barW}%`}}></div></div>
                    </td>
                    {type !== 'Customer' && <td className="p-3 text-center bg-slate-50/50 font-bold">{(row.qty||0).toLocaleString()}</td>}
                    {type === 'Customer' && <td className="p-3 text-center bg-slate-50/50 font-bold">{row.orders||0}</td>}
                    <td className="p-3 text-right text-slate-800 font-bold">Rs.{rev.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-500">{revShare}%</td>
                    <td className="p-3 text-right font-bold" style={{color: gp >= 0 ? '#059669' : '#e11d48'}}>Rs.{gp.toLocaleString()}</td>
                    <td className="p-3 text-right text-indigo-600 font-bold">{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-slate-800 text-xs">
              <tr>
                <td className="p-3 uppercase tracking-wider text-slate-600">Totals</td>
                <td className="p-3 text-center">{totalQtyOrOrders.toLocaleString()}</td>
                <td className="p-3 text-right">Rs.{totalRev.toLocaleString()}</td>
                <td className="p-3 text-right text-slate-500">100%</td>
                <td className="p-3 text-right text-emerald-700">Rs.{totalGP.toLocaleString()}</td>
                <td className="p-3 text-right text-indigo-700">{totalRev > 0 ? ((totalGP/totalRev)*100).toFixed(1) : 0}%</td>
              </tr>
            </tfoot>
         </table>
       </div>
    </div>
  );
};

const renderSegmentTable = (dataObj, label) => {
  const arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => b.revenue - a.revenue);
  const maxRev = arr[0]?.revenue || 1;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-3">
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex justify-between items-center">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">{arr.length} {label}s</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
            <tr><th className="p-3">{label}</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right text-emerald-600">GP</th><th className="p-3 text-right text-indigo-500">Margin%</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {arr.map((row, i) => {
              const rev = row.revenue || 0;
              const gp = row.profit || 0;
              const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0;
              const barW = maxRev > 0 ? Math.max((rev / maxRev) * 100, 0) : 0;
              return (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold text-slate-800">{row.key || '—'}</div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 max-w-[100px]"><div className="bg-indigo-400 h-1 rounded-full" style={{width:`${barW}%`}}></div></div>
                  </td>
                  <td className="p-3 text-center bg-slate-50/50 font-bold">{row.orders||0}</td>
                  <td className="p-3 text-right font-bold text-slate-800">Rs.{rev.toLocaleString()}</td>
                  <td className="p-3 text-right font-bold" style={{color: gp >= 0 ? '#059669' : '#e11d48'}}>Rs.{gp.toLocaleString()}</td>
                  <td className="p-3 text-right text-indigo-600 font-bold">{margin}%</td>
                </tr>
              );
            })}
            {arr.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No data. Add city/area/type to customers first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const filterLabel = dateFilter === 'Custom' ? `${customStart||'...'} - ${customEnd}` : dateFilter;

return (
  <div className="h-full flex flex-col p-4 overflow-hidden">
    {/* Filter Bar */}
    <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide shrink-0 pb-1">
       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
         <Calendar size={13} className="text-indigo-500"/>
         <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
           <option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option><option>Custom</option>
         </select>
       </div>
       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
         <Filter size={13} className="text-slate-400"/>
         <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer max-w-[90px]">
           <option value="">All Brands</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select>
       </div>
       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
         <Users size={13} className="text-slate-400"/>
         <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer max-w-[90px]">
           <option value="">All Clients</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select>
       </div>
       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
         <Award size={13} className="text-slate-400"/>
         <select value={filterSalesperson} onChange={e => setFilterSalesperson(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer max-w-[90px]">
           <option value="">All Staff</option>{appUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
         </select>
       </div>
    </div>

    {/* Custom date inputs */}
    {dateFilter === 'Custom' && (
      <div className="flex gap-2 mb-3 shrink-0">
        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"/></div>
        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"/></div>
      </div>
    )}

    {/* View Tabs */}
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0">
       {['Overview','Insights','Monthly Trend','By Product','By Company','By Customer','By City','By Area','By Type','By Salesperson','Receivables'].map(v => (
         <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap shadow-sm transition-colors ${view === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{v}</button>
       ))}
    </div>

    {/* Export bar */}
    <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 p-2 rounded-xl my-2 shrink-0">
        <span className="text-[10px] font-bold text-indigo-700 ml-1 uppercase tracking-widest truncate">{filterLabel}</span>
        <div className="flex gap-1.5">
           <button onClick={()=>handleExport('text')} title="WhatsApp" className="p-2 bg-green-500 text-white rounded-lg shadow-sm"><Share2 size={15}/></button>
           {view !== 'Overview' && <button onClick={()=>handleExport('csv')} title="CSV" className="p-2 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200"><Download size={15}/></button>}
           <button onClick={()=>handleExport('pdf')} title="PDF" className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm"><Printer size={15}/></button>
        </div>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto pr-1 pb-24 space-y-3">
      {view === 'Overview' && (
        <div className="space-y-3">
           {/* Trend cards */}
           <div className="grid grid-cols-2 gap-3">
             {[
               { label: 'Revenue Trend', val: reportEngine.trends.revenue, icon: TrendingUp },
               { label: 'Profit Trend', val: reportEngine.trends.profit, icon: TrendingUp }
             ].map(({label, val, icon: Icon}) => (
               <div key={label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                 <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
                 {val !== null ? (
                   <div className="flex items-center gap-1 mt-1">
                     <span className={`text-lg font-black ${Number(val) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Number(val) >= 0 ? '+' : ''}{val}%</span>
                     <span className="text-[10px] text-slate-400">vs prev</span>
                   </div>
                 ) : <p className="text-xs text-slate-400 mt-1">No prior data</p>}
               </div>
             ))}
           </div>

           {/* New vs Repeat + Collection Rate quick stats */}
           <div className="grid grid-cols-3 gap-2">
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">New Clients</p>
               <p className="text-xl font-black text-indigo-600 mt-0.5">{reportEngine.newCustCount}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Repeat</p>
               <p className="text-xl font-black text-emerald-600 mt-0.5">{reportEngine.repeatCustCount}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Collected</p>
               <p className={`text-xl font-black mt-0.5 ${Number(reportEngine.collectionRate) >= 80 ? 'text-emerald-600' : Number(reportEngine.collectionRate) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{reportEngine.collectionRate}%</p>
             </div>
           </div>

           {/* Daily chart - revenue + profit bars */}
           {Object.keys(reportEngine.dailyBreakdown).length > 0 && (
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-center mb-3">
                 <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Daily Sales</p>
                 <div className="flex gap-2 text-[9px] font-bold"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block"></span>Revenue</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"></span>Profit</span></div>
               </div>
               <div className="flex items-end gap-1 h-28 overflow-x-auto">
                 {Object.entries(reportEngine.dailyBreakdown).sort((a,b) => a[0].localeCompare(b[0])).slice(-21).map(([date, data]) => {
                   const maxRevenue = Math.max(...Object.values(reportEngine.dailyBreakdown).map(d => d.revenue), 1);
                   const rH = Math.max((data.revenue / maxRevenue) * 100, 4);
                   const pH = Math.max((Math.max(data.profit,0) / maxRevenue) * 100, 0);
                   return (
                     <div key={date} className="flex flex-col items-center min-w-[22px] group relative">
                       <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                         {date.slice(5)}<br/>Rev: {data.revenue.toLocaleString()}<br/>GP: {data.profit.toLocaleString()}
                       </div>
                       <div className="flex gap-0.5 items-end" style={{height:'96px'}}>
                         <div className="w-2 bg-indigo-400 rounded-t" style={{height:`${rH}%`}}></div>
                         <div className="w-2 bg-emerald-400 rounded-t" style={{height:`${pH}%`}}></div>
                       </div>
                       <span className="text-[8px] text-slate-400 mt-1">{date.slice(-2)}</span>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* Top 5 products */}
           <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
             <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-3">Top 5 Products by GP</p>
             <div className="space-y-2">
               {Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit).slice(0, 5).map(([name, data], i) => {
                 const maxP = Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit)[0]?.[1].profit || 1;
                 return (
                   <div key={name} className="flex items-center gap-3">
                     <span className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i+1}</span>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700 truncate">{name}</span><span className="font-bold text-emerald-600 ml-2 shrink-0">Rs.{data.profit.toLocaleString()}</span></div>
                       <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className="bg-emerald-500 h-1.5 rounded-full" style={{width:`${Math.min((data.profit/maxP)*100,100)}%`}}></div></div>
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>

           {/* Expense breakdown by category */}
           {Object.keys(reportEngine.byExpenseCategory).length > 0 && (
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
               <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-3">Expenses by Category</p>
               <div className="space-y-2">
                 {Object.entries(reportEngine.byExpenseCategory).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => {
                   const maxAmt = Math.max(...Object.values(reportEngine.byExpenseCategory), 1);
                   return (
                     <div key={cat} className="flex items-center gap-3">
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between text-xs"><span className="font-semibold text-slate-600 truncate">{cat}</span><span className="font-bold text-rose-500 ml-2 shrink-0">Rs.{amt.toLocaleString()}</span></div>
                         <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className="bg-rose-400 h-1.5 rounded-full" style={{width:`${Math.min((amt/maxAmt)*100,100)}%`}}></div></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* P&L Card */}
           <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-5 tracking-widest flex justify-between"><span>P&L Dashboard</span><span className="text-indigo-300">{filterLabel}</span></p>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center text-sm font-medium"><span className="text-slate-300">Gross Product Sales</span><span className="font-bold text-white">Rs.{reportEngine.kpis.productRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between items-center text-sm font-medium"><span className="text-rose-300">Total COGS</span><span className="font-bold text-rose-300">- Rs.{reportEngine.kpis.totalCOGS.toLocaleString()}</span></div>
                <div className="flex justify-between items-center text-sm font-medium"><span className="text-indigo-300">Product Margin</span><span className="font-bold text-indigo-300">Rs.{reportEngine.kpis.grossMargin.toLocaleString()}</span></div>
                <div className="h-px bg-slate-700"></div>
                <div className="flex justify-between items-center text-xs"><span className="text-slate-400">Delivery Billed</span><span className="font-bold text-slate-300">+ Rs.{reportEngine.kpis.deliveryBilled.toLocaleString()}</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-rose-400">Transport Expenses</span><span className="font-bold text-rose-400">- Rs.{reportEngine.kpis.transportExpense.toLocaleString()}</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-rose-400">Operational Expenses</span><span className="font-bold text-rose-400">- Rs.{reportEngine.kpis.totalExpenses.toLocaleString()}</span></div>
                <div className="h-px bg-slate-700"></div>
                <div className="flex justify-between items-center"><span className="font-bold uppercase tracking-widest text-emerald-400 text-xs">Net Profit</span><span className={`font-black text-3xl tracking-tight ${reportEngine.kpis.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Rs.{reportEngine.kpis.netProfit.toLocaleString()}</span></div>
              </div>
           </div>

           {/* Total receivables */}
           <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-rose-600 flex items-center gap-1.5 tracking-wider"><AlertCircle size={14}/> All-Time Receivables</p>
              <p className="text-2xl font-black text-rose-700 mt-2 tracking-tight">Rs.{reportEngine.kpis.totalReceivables.toLocaleString()}</p>
           </div>
        </div>
      )}

      {view === 'By Product' && renderTable(reportEngine.byProduct, 'Product')}
      {view === 'By Company' && renderTable(reportEngine.byCompany, 'Company')}
      {view === 'By Customer' && renderTable(reportEngine.byCustomer, 'Customer')}
      {view === 'By City' && renderSegmentTable(reportEngine.byCity, 'City')}
      {view === 'By Area' && renderSegmentTable(reportEngine.byArea, 'Area')}
      {view === 'By Type' && renderSegmentTable(reportEngine.byType, 'Type')}

      {view === 'By Salesperson' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-3">
          <div className="bg-slate-50 border-b border-slate-200 p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{Object.keys(reportEngine.bySalesperson).length} Staff Members</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
                <tr><th className="p-3">Staff</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right text-emerald-600">GP</th><th className="p-3 text-right text-indigo-500">Margin%</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(reportEngine.bySalesperson).sort((a,b)=>b[1].revenue-a[1].revenue).map(([name, data], i) => {
                  const margin = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{name}</td>
                      <td className="p-3 text-center font-bold">{data.orders}</td>
                      <td className="p-3 text-right font-bold text-slate-800">Rs.{data.revenue.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">Rs.{data.profit.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-indigo-600">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                {(() => { const totalRev = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.revenue,0); const totalGP = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.profit,0); const totalOrders = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.orders,0); return (<tr><td className="p-3 text-slate-600 uppercase tracking-wider">Totals</td><td className="p-3 text-center">{totalOrders}</td><td className="p-3 text-right">Rs.{totalRev.toLocaleString()}</td><td className="p-3 text-right text-emerald-700">Rs.{totalGP.toLocaleString()}</td><td className="p-3 text-right text-indigo-700">{totalRev > 0 ? ((totalGP/totalRev)*100).toFixed(1) : 0}%</td></tr>); })()}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {view === 'Receivables' && (
        <div className="space-y-3 mt-3">
          {/* Collection rate summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collection Rate</p>
              <p className={`text-2xl font-black mt-1 ${Number(reportEngine.collectionRate) >= 80 ? 'text-emerald-600' : Number(reportEngine.collectionRate) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{reportEngine.collectionRate}%</p>
              <p className="text-[10px] text-slate-400 mt-1">of billed amount collected</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
              <p className="text-2xl font-black mt-1 text-rose-600">Rs.{reportEngine.kpis.totalReceivables.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400 mt-1">{reportEngine.receivablesList.length} customers with balance</p>
            </div>
          </div>
          {[
            { label: '0–30 days', key: 'current', color: 'emerald' },
            { label: '31–60 days', key: 'days30', color: 'amber' },
            { label: '61–90 days', key: 'days60', color: 'orange' },
            { label: '90+ days (overdue)', key: 'days90plus', color: 'rose' }
          ].map(({ label, key, color }) => {
            const bucket = reportEngine.agingBuckets[key];
            if (!bucket.length) return null;
            const total = bucket.reduce((s,r)=>s+r.amount,0);
            return (
              <div key={key} className={`bg-white rounded-2xl shadow-sm border border-${color}-100 overflow-hidden`}>
                <div className={`bg-${color}-50 border-b border-${color}-100 p-3 flex justify-between items-center`}>
                  <span className={`text-xs font-bold text-${color}-700 uppercase tracking-widest`}>{label} ({bucket.length})</span>
                  <span className={`text-xs font-black text-${color}-700`}>Rs.{total.toLocaleString()}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {bucket.map((r,i) => {
                    const waMsg = `Assalam o Alaikum ${r.name},\n\nYour outstanding balance with ${APP_NAME} is *Rs. ${r.amount.toLocaleString()}*.\n\nKindly process the payment at your earliest convenience.\n\nJazakAllah Khair`;
                    return (
                      <div key={i} className="flex justify-between items-center p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{r.name}</p>
                          <p className="text-[10px] text-slate-400">{r.daysSince} days since last invoice {r.lastInvDate ? `(${formatDateDisp(r.lastInvDate)})` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="font-extrabold text-rose-600 text-sm">Rs.{r.amount.toLocaleString()}</span>
                          {r.phone && (
                            <a href={`https://wa.me/92${r.phone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors border border-green-100" title="Send WhatsApp reminder">
                              <PhoneCall size={13}/>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {reportEngine.receivablesList.length === 0 && (
            <div className="bg-emerald-50 p-6 rounded-2xl text-center border border-emerald-100">
              <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32}/>
              <p className="font-bold text-emerald-700">All accounts are clear!</p>
            </div>
          )}
        </div>
      )}

      {/* ── Insights View ── */}
      {view === 'Insights' && (() => {
        const kpis = reportEngine.kpis;
        const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
        const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
        const topProduct = Object.entries(reportEngine.byProduct).sort((a,b)=>b[1].profit-a[1].profit)[0];
        const topCustomer = Object.entries(reportEngine.byCustomer).sort((a,b)=>b[1].productRevenue-a[1].productRevenue)[0];
        const aProducts = Object.entries(reportEngine.byProduct).filter(([,v]) => {
          let cum = 0; const total = Object.values(reportEngine.byProduct).reduce((s,r)=>s+r.revenue,0);
          return (Object.entries(reportEngine.byProduct).sort((a,b)=>b[1].revenue-a[1].revenue).every(([k,d]) => { cum += d.revenue; return cum / total <= 0.8 || k === Object.keys(reportEngine.byProduct)[0]; }));
        }).length || Math.max(1, Math.ceil(Object.keys(reportEngine.byProduct).length * 0.2));
        const insightCards = [
          { label: 'Gross Margin', value: `${gpMargin}%`, sub: `Rs.${kpis.grossMargin.toLocaleString()} on Rs.${kpis.productRevenue.toLocaleString()} sales`, color: Number(gpMargin) >= 25 ? 'emerald' : Number(gpMargin) >= 15 ? 'amber' : 'rose', icon: TrendingUp },
          { label: 'Net Profit Margin', value: `${netMargin}%`, sub: `Rs.${kpis.netProfit.toLocaleString()} after all expenses`, color: Number(netMargin) >= 15 ? 'emerald' : Number(netMargin) >= 5 ? 'amber' : 'rose', icon: DollarSign },
          { label: 'Collection Rate', value: `${reportEngine.collectionRate}%`, sub: `of billed amount recovered`, color: Number(reportEngine.collectionRate) >= 80 ? 'emerald' : Number(reportEngine.collectionRate) >= 50 ? 'amber' : 'rose', icon: Wallet },
          { label: 'Active Customers', value: `${reportEngine.newCustCount + reportEngine.repeatCustCount}`, sub: `${reportEngine.newCustCount} new · ${reportEngine.repeatCustCount} repeat`, color: 'indigo', icon: Users },
        ];
        return (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              {insightCards.map(card => (
                <div key={card.label} className={`bg-${card.color}-50 p-4 rounded-2xl border border-${card.color}-100 shadow-sm`}>
                  <p className={`text-[10px] font-bold text-${card.color}-600 uppercase tracking-wider mb-1 flex items-center gap-1`}><card.icon size={11}/> {card.label}</p>
                  <p className={`text-2xl font-black text-${card.color}-700`}>{card.value}</p>
                  <p className={`text-[10px] text-${card.color}-500 mt-1`}>{card.sub}</p>
                </div>
              ))}
            </div>
            {/* Key callouts */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Zap size={12} className="text-amber-500"/> Smart Callouts</p>
              {topProduct && <div className="flex items-start gap-2 text-sm"><span className="text-emerald-600 font-black shrink-0">★</span><p className="text-slate-700"><span className="font-bold">{topProduct[0]}</span> is your most profitable product — Rs.{topProduct[1].profit.toLocaleString()} GP ({topProduct[1].qty} units sold)</p></div>}
              {topCustomer && <div className="flex items-start gap-2 text-sm"><span className="text-indigo-600 font-black shrink-0">★</span><p className="text-slate-700"><span className="font-bold">{topCustomer[0]}</span> is your top customer — Rs.{(topCustomer[1].productRevenue||0).toLocaleString()} revenue in {topCustomer[1].orders} orders</p></div>}
              {reportEngine.agingBuckets.days90plus.length > 0 && <div className="flex items-start gap-2 text-sm"><span className="text-rose-600 font-black shrink-0">!</span><p className="text-slate-700"><span className="font-bold text-rose-600">{reportEngine.agingBuckets.days90plus.length} customer{reportEngine.agingBuckets.days90plus.length>1?'s':''}</span> overdue 90+ days — Rs.{reportEngine.agingBuckets.days90plus.reduce((s,r)=>s+r.amount,0).toLocaleString()} at risk</p></div>}
              {reportEngine.trends.revenue !== null && <div className="flex items-start gap-2 text-sm"><span className={`font-black shrink-0 ${Number(reportEngine.trends.revenue)>=0?'text-emerald-600':'text-rose-600'}`}>{Number(reportEngine.trends.revenue)>=0?'↑':'↓'}</span><p className="text-slate-700">Revenue is <span className="font-bold">{Number(reportEngine.trends.revenue)>=0?'up':'down'} {Math.abs(reportEngine.trends.revenue)}%</span> vs previous period</p></div>}
              {kpis.deliveryBilled > kpis.transportExpense && <div className="flex items-start gap-2 text-sm"><span className="text-emerald-600 font-black shrink-0">+</span><p className="text-slate-700">Delivery net contribution: <span className="font-bold text-emerald-700">Rs.{(kpis.deliveryBilled - kpis.transportExpense).toLocaleString()}</span></p></div>}
            </div>
            {/* P&L summary */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-xl">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-4 tracking-widest">P&L Summary · {filterLabel}</p>
              {[
                ['Gross Sales', `Rs.${kpis.productRevenue.toLocaleString()}`, 'text-white'],
                ['COGS', `- Rs.${kpis.totalCOGS.toLocaleString()}`, 'text-rose-300'],
                ['Gross Profit', `Rs.${kpis.grossMargin.toLocaleString()} (${gpMargin}%)`, 'text-indigo-300'],
                ['Delivery Net', `+ Rs.${(kpis.deliveryBilled-kpis.transportExpense).toLocaleString()}`, 'text-slate-300'],
                ['Operational Expenses', `- Rs.${kpis.totalExpenses.toLocaleString()}`, 'text-rose-300'],
                ['Net Profit', `Rs.${kpis.netProfit.toLocaleString()} (${netMargin}%)`, kpis.netProfit >= 0 ? 'text-emerald-400 text-lg font-black' : 'text-rose-400 text-lg font-black'],
              ].map(([label, val, cls]) => (
                <div key={label} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-700 last:border-0">
                  <span className="text-slate-400">{label}</span>
                  <span className={`font-bold ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Monthly Trend View ── */}
      {view === 'Monthly Trend' && (() => {
        const months = Object.keys(reportEngine.monthlyData).sort().slice(-18);
        if (months.length === 0) return <div className="text-center py-16 text-slate-400">No billing data yet.</div>;
        const maxRev = Math.max(...months.map(m => reportEngine.monthlyData[m].revenue), 1);
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return (
          <div className="space-y-4 mt-2">
            {/* Chart */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Monthly Revenue & Profit</p>
                <div className="flex gap-2 text-[9px] font-bold"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block"></span>Revenue</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"></span>Profit</span></div>
              </div>
              <div className="flex items-end gap-1.5 overflow-x-auto pb-2" style={{height:'130px'}}>
                {months.map(m => {
                  const d = reportEngine.monthlyData[m];
                  const rH = Math.max((d.revenue / maxRev) * 100, 3);
                  const pH = Math.max((Math.max(d.profit,0) / maxRev) * 100, 0);
                  const [yr, mo] = m.split('-');
                  return (
                    <div key={m} className="flex flex-col items-center min-w-[28px] group relative flex-1">
                      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
                        {monthNames[parseInt(mo)-1]} {yr.slice(2)}<br/>Rev: Rs.{d.revenue.toLocaleString()}<br/>GP: Rs.{d.profit.toLocaleString()}<br/>Orders: {d.orders}
                      </div>
                      <div className="flex gap-0.5 items-end" style={{height:'100px'}}>
                        <div className="w-3 bg-indigo-400 rounded-t-sm" style={{height:`${rH}%`}}></div>
                        <div className="w-3 bg-emerald-400 rounded-t-sm" style={{height:`${pH}%`}}></div>
                      </div>
                      <span className="text-[8px] text-slate-400 mt-1 font-semibold">{monthNames[parseInt(mo)-1].slice(0,3)}</span>
                      <span className="text-[7px] text-slate-300">{yr.slice(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Monthly table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Month-by-Month Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
                    <tr><th className="p-3">Month</th><th className="p-3 text-center">Orders</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right text-emerald-600">GP</th><th className="p-3 text-right text-indigo-500">Margin%</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {months.slice().reverse().map(m => {
                      const d = reportEngine.monthlyData[m];
                      const margin = d.revenue > 0 ? ((d.profit / d.revenue) * 100).toFixed(1) : 0;
                      const [yr, mo] = m.split('-');
                      return (
                        <tr key={m} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{monthNames[parseInt(mo)-1]} {yr}</td>
                          <td className="p-3 text-center">{d.orders}</td>
                          <td className="p-3 text-right">Rs.{d.revenue.toLocaleString()}</td>
                          <td className="p-3 text-right text-rose-500">Rs.{d.cost.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">Rs.{d.profit.toLocaleString()}</td>
                          <td className="p-3 text-right text-indigo-600">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                    {(() => { const totRev = months.reduce((s,m)=>s+reportEngine.monthlyData[m].revenue,0); const totGP = months.reduce((s,m)=>s+reportEngine.monthlyData[m].profit,0); const totOrd = months.reduce((s,m)=>s+reportEngine.monthlyData[m].orders,0); const totCost = months.reduce((s,m)=>s+reportEngine.monthlyData[m].cost,0); return (<tr><td className="p-3 text-slate-600 uppercase tracking-wider">Totals ({months.length}mo)</td><td className="p-3 text-center">{totOrd}</td><td className="p-3 text-right">Rs.{totRev.toLocaleString()}</td><td className="p-3 text-right text-rose-600">Rs.{totCost.toLocaleString()}</td><td className="p-3 text-right text-emerald-700">Rs.{totGP.toLocaleString()}</td><td className="p-3 text-right text-indigo-700">{totRev > 0 ? ((totGP/totRev)*100).toFixed(1) : 0}%</td></tr>); })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  </div>
);

};

const ExpensesView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [date, setDate] = useState(getLocalDateStr());
const [amount, setAmount] = useState('');
const [category, setCategory] = useState(expenseCategories[0]?.name || '');
const [note, setNote] = useState('');
const [editingExpense, setEditingExpense] = useState(null);
const [expFilter, setExpFilter] = useState('This Month');
const saveExpense = async () => {
if(!amount || !category) return showToast("Amount & Category required", "error");
if (editingExpense) {
await saveToFirebase('expenses', editingExpense.id, {...editingExpense, date, category, amount: Number(amount), note});
setEditingExpense(null);
showToast("Expense Updated");
} else {
const newExp = {id: Date.now(), date, category, amount: Number(amount), note};
await saveToFirebase('expenses', newExp.id, newExp);
showToast("Expense Recorded");
}
setAmount(''); setNote(''); setDate(getLocalDateStr()); setCategory(expenseCategories[0]?.name || '');
};
const startEdit = (exp) => { setEditingExpense(exp); setDate(exp.date); setAmount(String(exp.amount)); setCategory(exp.category); setNote(exp.note || ''); };
const cancelEdit = () => { setEditingExpense(null); setAmount(''); setNote(''); setDate(getLocalDateStr()); setCategory(expenseCategories[0]?.name || ''); };
const filteredExpenses = expenses.filter(e => checkDateFilter(e.date, expFilter)).slice().reverse();
const filteredTotal = filteredExpenses.reduce((s,e)=>s+Number(e.amount),0);
return (
<div className="h-full flex flex-col p-4 pb-24 overflow-y-auto">
<div className={`bg-white p-4 rounded-2xl border shadow-sm mb-4 ${editingExpense ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
<div className="flex justify-between items-center mb-3">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{editingExpense ? '– Edit Expense' : 'Record New Expense'}</h3>
<div className="flex gap-2">
{editingExpense && <button onClick={cancelEdit} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Cancel</button>}
<button onClick={() => setShowExpenseCatModal(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">Manage Labels</button>
</div>
</div>
<div className="grid grid-cols-2 gap-3 mb-3">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Date</label><input type="date" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={date} onChange={e=>setDate(e.target.value)}/></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Category</label><select className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={category} onChange={e=>setCategory(e.target.value)}><option value="">– Select –</option>{expenseCategories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
</div>
<div className="mb-3"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Amount</label><input type="number" placeholder="0.00" className="w-full p-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-lg font-extrabold outline-none focus:border-rose-400" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
<div className="mb-4"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Short Note</label><input type="text" placeholder="e.g. Paid to Ali for DHA drop" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold outline-none" value={note} onChange={e=>setNote(e.target.value)}/></div>
<button onClick={saveExpense} className={`w-full font-bold py-3.5 rounded-xl shadow-md text-white ${editingExpense ? 'bg-amber-500 hover:bg-amber-600' : 'bg-rose-500 hover:bg-rose-600'}`}>{editingExpense ? 'Update Expense' : 'Record Expense'}</button>
</div>
<div className="flex justify-between items-center mb-3">
<div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
<Calendar size={13} className="text-rose-500"/>
<select value={expFilter} onChange={e=>setExpFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
<option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option>
</select>
</div>
<div className="text-right">
<p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total</p>
<p className="font-extrabold text-rose-600 text-base">Rs.{filteredTotal.toLocaleString()}</p>
</div>
</div>
<div className="space-y-2.5">
{filteredExpenses.map(exp => (
<div key={exp.id} className={`bg-white p-3.5 rounded-2xl border shadow-sm flex justify-between items-center ${editingExpense?.id === exp.id ? 'border-amber-300 ring-2 ring-amber-200' : 'border-slate-200'}`}>
<div><p className="font-bold text-slate-800 text-sm flex items-center gap-1.5"><Tag size={12} className="text-slate-400"/> {exp.category}</p><p className="text-[11px] text-slate-500 font-medium mt-0.5">{formatDateDisp(exp.date)} {exp.note ? `- ${exp.note}` : ''}</p></div>
<div className="text-right ml-3">
<p className="font-extrabold text-rose-600 text-base">Rs.{exp.amount.toLocaleString()}</p>
<div className="flex gap-2 mt-1 justify-end">
<button onClick={() => startEdit(exp)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold uppercase">Edit</button>
<button onClick={async ()=>{ if(window.confirm("Delete expense?")) await deleteFromFirebase('expenses', exp.id) }} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase">Del</button>
</div>
</div>
</div>
))}
{filteredExpenses.length === 0 && <div className="text-center py-8 text-slate-400 text-sm font-medium">No expenses for this period</div>}
</div>
<div className="mt-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-rose-500"/> Export Expenses</h3>
<button onClick={() => { const data = expenses.map(e => ({ ID: e.id, Date: e.date, Category: e.category, Amount: e.amount, Note: e.note || '' })); exportToCSV(data, 'Expenses_Export.csv'); }} className="w-full bg-rose-50 border border-rose-100 text-rose-700 py-2.5 rounded-xl font-bold text-xs">Export All Expenses CSV</button>
</div>
</div>
);
};

const BulkOpsView = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig } = useContext(AppContext);
const [bulkProducts, setBulkProducts] = useState([]);
const [bulkSearch, setBulkSearch] = useState('');
const [activeExportTab, setActiveExportTab] = useState('items');
useEffect(() => { setBulkProducts(products); }, [products]);
const handleBulkSave = async () => {
let updatedCount = 0;
for (const bp of bulkProducts) {
const orig = products.find(p => p.id === bp.id);
if (orig && (orig.costPrice !== bp.costPrice || orig.sellingPrice !== bp.sellingPrice || orig.available !== bp.available || orig.name !== bp.name || orig.unit !== bp.unit || orig.unitsInBox !== bp.unitsInBox)) {
await saveToFirebase('products', bp.id, {...orig, ...bp});
updatedCount++;
}
}
showToast(`Updated ${updatedCount} items`);
};
const downloadImportTemplate = () => {
const templateData = [{ Name: "Sample Product A", Company: "Pharma Co", Unit: "Vial", BoxQty: 1, Cost: 100, Selling: 150 }, { Name: "Sample Product B", Company: "AgriMed", Unit: "Strip", BoxQty: 10, Cost: 500, Selling: 650 }];
exportToCSV(templateData, 'Item_Import_Template.csv');
};
const handleImportCSV = (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = async (event) => {
const text = event.target.result;
const rows = text.split(/\r?\n/).filter(r => r.trim());
if(!rows || rows.length < 2) return showToast("File is empty or invalid", "error");
const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
const reqHeaders = ['name', 'company', 'unit', 'boxqty', 'cost', 'selling'];
const missing = reqHeaders.filter(h => !headers.includes(h));
if(missing.length > 0) return showToast(`Missing columns: ${missing.join(', ')}`, "error");
let addedCount = 0; let updatedCount = 0;
// Build local map to prevent duplicate companies during batch import
const localCompanyMap = {};
companies.forEach(c => { localCompanyMap[c.name.toLowerCase()] = c.id; });
for (let i = 1; i < rows.length; i++) {
const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
if(cols.length < reqHeaders.length) continue;
const rowData = {};
reqHeaders.forEach(h => { rowData[h] = cols[headers.indexOf(h)]; });
if(!rowData.name || !rowData.selling || !rowData.cost) continue;
let compId;
const compName = rowData.company || 'Unknown';
const compNameLower = compName.toLowerCase();
if (localCompanyMap[compNameLower]) { compId = localCompanyMap[compNameLower]; } else {
compId = Date.now() + Math.random();
await saveToFirebase('companies', compId, { id: compId, name: compName });
localCompanyMap[compNameLower] = compId;
}
const existingProd = products.find(p => p.name.toLowerCase() === rowData.name.toLowerCase());
const prodObj = { name: rowData.name, companyId: compId, unit: rowData.unit || 'Unit', unitsInBox: Number(rowData.boxqty) || 1, costPrice: Number(rowData.cost) || 0, sellingPrice: Number(rowData.selling) || 0, available: true };
if (existingProd) { await saveToFirebase('products', existingProd.id, { ...existingProd, ...prodObj }); updatedCount++; }
else { const newId = Date.now() + Math.random(); await saveToFirebase('products', newId, { ...prodObj, id: newId }); addedCount++; }
}
showToast(`Done! ${addedCount} added, ${updatedCount} updated.`);
};
reader.readAsText(file);
e.target.value = '';
};
const handleImportCustomers = (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = async (event) => {
const text = event.target.result;
const rows = text.split(/\r?\n/).filter(r => r.trim());
if(!rows || rows.length < 2) return showToast("File is empty or invalid", "error");
const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
let addedCount = 0; let updatedCount = 0;
for (let i = 1; i < rows.length; i++) {
const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
const get = (field) => cols[headers.indexOf(field)] || '';
const name = get('name');
if (!name) continue;
const custObj = { name, contactPerson: get('contact'), phone: get('phone'), address1: get('address1'), map1: get('map1'), address2: get('address2'), map2: get('map2'), openingBalance: Number(get('openingbalance')) || 0 };
const existing = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
if (existing) { await saveToFirebase('customers', existing.id, {...existing, ...custObj}); updatedCount++; }
else { const newId = Date.now() + Math.random(); await saveToFirebase('customers', newId, {...custObj, id: newId}); addedCount++; }
}
showToast(`Done! ${addedCount} added, ${updatedCount} updated.`);
};
reader.readAsText(file);
e.target.value = '';
};
const exportAll = () => {
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const wb = [];
wb.push('=== ITEMS ===');
wb.push(['ID','Name','Company','Unit','BoxQty','Cost','Selling','Status'].join(','));
products.forEach(p => wb.push([p.id, q(p.name), q(getCompanyName(p.companyId)), q(p.unit), p.unitsInBox, p.costPrice, p.sellingPrice, p.available?'Active':'Inactive'].join(',')));
wb.push(''); wb.push('=== CUSTOMERS ===');
wb.push(['ID','Name','Contact','Phone','Address1','Map1','Address2','Map2','OpeningBalance'].join(','));
customers.forEach(c => wb.push([c.id, q(c.name), q(c.contactPerson||''), q(c.phone||''), q(c.address1||''), q(c.map1||''), q(c.address2||''), q(c.map2||''), c.openingBalance||0].join(',')));
wb.push(''); wb.push('=== INVOICES ===');
wb.push(['ID','Date','Customer','Status','Total','Delivery','Transport','Received','Salesperson','Payment','Notes'].join(','));
invoices.forEach(o => wb.push([q(o.id), o.date, q(o.customerName), o.status, o.total, o.deliveryBilled||0, o.transportExpense||0, o.receivedAmount||0, q(o.salespersonName||''), o.paymentStatus||'', q(o.notes||'')].join(',')));
const blob = new Blob([wb.join('\n')], {type:'text/csv'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'AnimalHealthPK_MasterData.csv'; a.click(); URL.revokeObjectURL(url);
showToast('Master data exported!');
};
const visibleProducts = bulkProducts.filter(p => !bulkSearch || p.name.toLowerCase().includes(bulkSearch.toLowerCase()));
return (
<div className="h-full flex flex-col p-4 pb-24 overflow-y-auto">
{/* Export Section */}
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Download size={14} className="text-indigo-600"/> Export Master Data</h3>
<div className="flex gap-2 mb-2">
<button onClick={() => setActiveExportTab('items')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='items'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Items</button>
<button onClick={() => setActiveExportTab('clients')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='clients'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Clients</button>
<button onClick={() => setActiveExportTab('invoices')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='invoices'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>Invoices</button>
<button onClick={() => setActiveExportTab('all')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${activeExportTab==='all'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600'}`}>All</button>
</div>
{activeExportTab === 'items' && <button onClick={() => { const data = products.map(p => ({ ID: p.id, Name: p.name, Company: getCompanyName(p.companyId), Unit: p.unit, BoxQty: p.unitsInBox, Cost: p.costPrice, Selling: p.sellingPrice, Status: p.available ? 'Active' : 'Inactive' })); exportToCSV(data, 'Items_Master.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {products.length} Items as CSV</button>}
{activeExportTab === 'clients' && <button onClick={() => { const data = customers.map(c => ({ ID: c.id, Name: c.name, Contact: c.contactPerson||'', Phone: c.phone||'', Address1: c.address1||'', Map1: c.map1||'', Address2: c.address2||'', Map2: c.map2||'', OpeningBalance: c.openingBalance||0 })); exportToCSV(data, 'Customers_Master.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {customers.length} Clients as CSV</button>}
{activeExportTab === 'invoices' && <button onClick={() => { const data = invoices.map(o => ({ ID: o.id, Date: o.date, Customer: o.customerName, Status: o.status, Total: o.total, Delivery: o.deliveryBilled||0, Transport: o.transportExpense||0, ReceivedAmt: o.receivedAmount||0, Salesperson: o.salespersonName||'', PaymentStatus: o.paymentStatus||'' })); exportToCSV(data, 'Invoices_Export.csv'); }} className="w-full bg-indigo-50 border border-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold text-xs">Export {invoices.length} Invoices as CSV</button>}
{activeExportTab === 'all' && <button onClick={exportAll} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-sm">Export Full Master Data (CSV)</button>}
</div>

     {/* Fix Duplicate Companies */}
     {isAdmin && (() => {
       const seen = {}; const dupes = [];
       companies.forEach(c => {
         const k = c.name.trim().toLowerCase();
         if (seen[k]) dupes.push(c); else seen[k] = c;
       });
       if (dupes.length === 0) return null;
       return (
         <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl mb-4">
           <p className="text-xs font-bold text-rose-700 mb-2 flex items-center gap-1.5"><AlertCircle size={14}/> {dupes.length} Duplicate {dupes.length === 1 ? 'Company' : 'Companies'} Found</p>
           <p className="text-[10px] text-rose-600 mb-3">These were created by previous imports. Click to merge them and fix all product references.</p>
           <button onClick={async () => {
             const canonical = {};
             companies.forEach(c => { const k = c.name.trim().toLowerCase(); if (!canonical[k]) canonical[k] = c.id; });
             let fixed = 0;
             for (const dupe of dupes) {
               const keepId = canonical[dupe.name.trim().toLowerCase()];
               if (keepId === dupe.id) continue;
               const affected = products.filter(p => String(p.companyId) === String(dupe.id));
               for (const p of affected) { await saveToFirebase('products', p.id, { ...p, companyId: keepId }); }
               await deleteFromFirebase('companies', dupe.id);
               fixed++;
             }
             showToast(`Merged ${fixed} duplicate companies`);
           }} className="w-full bg-rose-600 text-white py-2 rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors">
             Fix {dupes.length} Duplicate{dupes.length > 1 ? 's' : ''} Now
           </button>
         </div>
       );
     })()}

     {/* Import Section */}
     <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Upload size={14} className="text-emerald-600"/> Import Data</h3>
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Items</p>
             <p className="text-[9px] text-slate-400 mb-2 leading-tight">Columns: Name, Company, Unit, BoxQty, Cost, Selling</p>
             <div className="flex gap-1.5">
               <button onClick={downloadImportTemplate} className="flex-1 bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg font-bold text-[10px]">Template</button>
               <label className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg font-bold text-[10px] cursor-pointer text-center"><input type="file" accept=".csv" className="hidden" onChange={handleImportCSV}/>Import</label>
             </div>
           </div>
           <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Clients</p>
             <p className="text-[9px] text-slate-400 mb-2 leading-tight">Columns: Name, Contact, Phone, Address1, Map1, OpeningBalance</p>
             <div className="flex gap-1.5">
               <button onClick={() => exportToCSV([{Name:'Sample Clinic',Contact:'Dr Ali',Phone:'0300-0000000',Address1:'DHA Karachi',Map1:'https://maps.app.goo.gl/...',OpeningBalance:0}], 'Customer_Import_Template.csv')} className="flex-1 bg-white border border-slate-200 text-slate-600 py-1.5 rounded-lg font-bold text-[10px]">Template</button>
               <label className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg font-bold text-[10px] cursor-pointer text-center"><input type="file" accept=".csv" className="hidden" onChange={handleImportCustomers}/>Import</label>
             </div>
           </div>
        </div>
     </div>

     {/* Bulk Price Edit */}
     <div className="flex-none bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden" style={{minHeight: '300px'}}>
        <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 gap-2">
           <div className="flex items-center gap-2 flex-1">
             <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 shrink-0"><ArrowUpDown size={15}/> Quick Edit</h3>
             <input value={bulkSearch} onChange={e=>setBulkSearch(e.target.value)} placeholder="Search..." className="flex-1 p-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-400 font-semibold bg-white"/>
           </div>
           <button onClick={handleBulkSave} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm shrink-0">Save All</button>
        </div>
        <div className="overflow-auto" style={{maxHeight: '400px'}}>
           <table className="w-full text-left text-xs whitespace-nowrap min-w-[760px]">
              <thead className="text-slate-500 uppercase font-bold tracking-wider bg-slate-50 sticky top-0"><tr><th className="p-2 pb-3">Product</th><th className="p-2 pb-3 w-16">Unit</th><th className="p-2 pb-3 w-16">Box</th><th className="p-2 pb-3 w-24">Cost</th><th className="p-2 pb-3 w-24">Selling</th><th className="p-2 pb-3 w-16 text-center">Active</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                 {visibleProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                       <td className="p-2"><input type="text" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400 min-w-[140px]" value={p.name} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, name: e.target.value}:bp))} /></td>
                       <td className="p-2"><input type="text" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400" value={p.unit} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, unit: e.target.value}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:border-indigo-400" value={p.unitsInBox} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, unitsInBox: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 outline-none focus:border-indigo-400" value={p.costPrice} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, costPrice: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2"><input type="number" className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded font-bold text-emerald-700 outline-none focus:border-indigo-400" value={p.sellingPrice} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, sellingPrice: Number(e.target.value)}:bp))} /></td>
                       <td className="p-2 text-center"><input type="checkbox" checked={p.available} onChange={e => setBulkProducts(bulkProducts.map(bp=>bp.id===p.id?{...bp, available: e.target.checked}:bp))} className="w-4 h-4 accent-indigo-600" /></td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
     </div>
  </div>
);

};


function App() {
const [currentUser, setCurrentUser] = useState(() => {
try {
const item = window.localStorage.getItem('app_currentUser');
return item ? JSON.parse(item) : null;
} catch (error) { return null; }
});

useEffect(() => {
if (currentUser) {
window.localStorage.setItem('app_currentUser', JSON.stringify(currentUser));
} else {
window.localStorage.removeItem('app_currentUser');
}
}, [currentUser]);

const [loginForm, setLoginForm] = useState({ name: '', password: '' });
const [activeTab, setActiveTab] = useState('dashboard');
const [adminView, setAdminView] = useState('analytics');
const [toast, setToast] = useState(null);

// — Data State (Live from Firebase) —
const appUsers = useLiveCollection('app_users');
const companies = useLiveCollection('companies');
const products = useLiveCollection('products');
const customers = useLiveCollection('customers');
const invoices = useLiveCollection('invoices');
const expenses = useLiveCollection('expenses');
const expenseCategories = useLiveCollection('expenseCategories');
const payments = useLiveCollection('payments');
const cities = useLiveCollection('cities');
const areas = useLiveCollection('areas');
const customerTypes = useLiveCollection('customerTypes');

// Complex UI State
const [billingView, setBillingView] = useState('list');
const [currentInvoice, setCurrentInvoice] = useState(null);
const [showProductModal, setShowProductModal] = useState(false);
const [editingProduct, setEditingProduct] = useState(null);
const [showCustomerModal, setShowCustomerModal] = useState(false);
const [editingCustomer, setEditingCustomer] = useState(null);
const [showPaymentModal, setShowPaymentModal] = useState(false);
const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState(null);
const [showLedgerModal, setShowLedgerModal] = useState(false);
const [selectedLedgerId, setSelectedLedgerId] = useState(null);
const [showExpenseCatModal, setShowExpenseCatModal] = useState(false);
const [showUserModal, setShowUserModal] = useState(false);
const [editingUser, setEditingUser] = useState(null);
const [printConfig, setPrintConfig] = useState(null);
const [showSegmentsModal, setShowSegmentsModal] = useState(false);
const [editingPayment, setEditingPayment] = useState(null);

const isAdmin = currentUser?.role === 'admin';

const showToast = (msg, type = 'success') => {
setToast({ msg, type });
setTimeout(() => setToast(null), 3000);
};

const getCompanyName = (id) => companies.find(c => c.id === id)?.name || 'Unknown';

const checkDuplicate = (list, name, excludeId = null) => {
return list.some(item => item.name.toLowerCase() === name.toLowerCase() && item.id !== excludeId);
};

const handleLogin = async (e) => {
e.preventDefault();
if (appUsers.length === 0 && loginForm.name.toLowerCase() === 'tahir' && loginForm.password === '7869') {
const initUser = { id: Date.now().toString(), name: 'Tahir', password: '7869', role: 'admin' };
await saveToFirebase('app_users', initUser.id, initUser);
if (expenseCategories.length === 0) {
const defaultCats = ['Transport', 'Utility Bill', 'Staff Food/Tea', 'Maintenance', 'Other'];
defaultCats.forEach((cat, i) => saveToFirebase('expenseCategories', Date.now()+i, { id: Date.now()+i, name: cat }));
}
setCurrentUser(initUser);
showToast("Welcome! Clean Database Initialized.");
return;
}
const user = appUsers.find(u => u.name.toLowerCase() === loginForm.name.toLowerCase() && u.password === loginForm.password);
if (user) {
setCurrentUser(user);
showToast(`Welcome ${user.name}`);
} else {
showToast("Invalid Credentials", "error");
}
};

const saveToFirebase = async (collectionName, id, dataObj) => {
try {
await setDoc(doc(db, collectionName, String(id)), dataObj);
} catch (e) {
console.error("Firebase Write Error:", e);
showToast("Network Error - Could not save", "error");
}
};

const deleteFromFirebase = async (collectionName, id) => {
try {
await deleteDoc(doc(db, collectionName, String(id)));
} catch (e) {
console.error("Firebase Delete Error:", e);
showToast("Network Error - Could not delete", "error");
}
};

// — Ledger Engine —
const getCustomerLedger = (customerId) => {
const customer = customers.find(c => c.id === customerId);
if (!customer) return null;
const openingBal = customer.openingBalance || 0;
let entries = [];
invoices.filter(o => o.customerId === customerId && o.status === 'Billed').forEach(inv => {
entries.push({ id: inv.id, date: inv.date, ref: inv.id, desc: 'Sales Invoice', debit: inv.total, credit: 0, timestamp: new Date(inv.date).getTime() });
if (inv.receivedAmount > 0) {
entries.push({ id: `${inv.id}-PAY`, date: inv.date, ref: inv.id, desc: 'Payment (On Invoice)', debit: 0, credit: Number(inv.receivedAmount), timestamp: new Date(inv.date).getTime() + 1 });
}
});
payments.filter(p => p.customerId === customerId).forEach(pay => {
entries.push({ id: pay.id, date: pay.date, ref: pay.id, desc: pay.note || 'Payment Received', debit: 0, credit: Number(pay.amount), timestamp: new Date(pay.date).getTime() + 2 });
});
entries.sort((a, b) => a.timestamp === b.timestamp ? a.id.localeCompare(b.id) : a.timestamp - b.timestamp);
let runningBal = openingBal;
let totalDebit = 0;
let totalCredit = 0;
const rows = entries.map(entry => {
runningBal += entry.debit;
runningBal -= entry.credit;
totalDebit += entry.debit;
totalCredit += entry.credit;
return { ...entry, balance: runningBal };
});
return { id: customer.id, customerName: customer.name, phone: customer.phone, openingBal, rows, totalDebit, totalCredit, closingBal: runningBal };
};

const getCustomerBalance = (customerId) => {
const ledger = getCustomerLedger(customerId);
return ledger ? ledger.closingBal : 0;
};

const generateReceiptData = (ledger, rowId) => {
const row = ledger.rows.find(r => r.id === rowId);
if(!row) return null;
const isInvoicePayment = row.id.endsWith('-PAY');
const actualId = isInvoicePayment ? row.ref : row.id;
const entryIndex = ledger.rows.findIndex(r => r.id === row.id);
const prevBalance = entryIndex > 0 ? ledger.rows[entryIndex - 1].balance : ledger.openingBal;
return {
id: actualId,
date: row.date,
customerName: ledger.customerName,
receivedAmount: row.credit,
prevBalance: prevBalance,
newBalance: row.balance,
note: row.desc
};
};

// Global keyboard shortcuts — must be BEFORE any conditional return (Rules of Hooks)
useEffect(() => {
  if (!currentUser) return;
  const handler = (e) => {
    if (e.altKey) {
      const map = { d: 'dashboard', i: 'products', b: 'billing', c: 'customers', a: 'admin' };
      if (map[e.key]) { e.preventDefault(); setActiveTab(map[e.key]); }
    }
    if (e.key === 'Escape') {
      if (printConfig) setPrintConfig(null);
      else if (showProductModal) setShowProductModal(false);
      else if (showCustomerModal) setShowCustomerModal(false);
      else if (showPaymentModal) { setEditingPayment(null); setShowPaymentModal(false); }
      else if (showLedgerModal) setShowLedgerModal(false);
      else if (showUserModal) setShowUserModal(false);
      else if (showExpenseCatModal) setShowExpenseCatModal(false);
      else if (showSegmentsModal) setShowSegmentsModal(false);
      else if (billingView === 'form') setBillingView('list');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [currentUser, printConfig, showProductModal, showCustomerModal, showPaymentModal, showLedgerModal, showUserModal, showExpenseCatModal, showSegmentsModal, billingView]);

// — Auth Screen —
if (!currentUser) {
return (
<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-[Inter,system-ui,sans-serif]">
<div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
<div className="text-center mb-10">
<h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight">{APP_NAME}</h1>
<p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Customer Management App</p>
</div>
<form onSubmit={handleLogin} className="space-y-5">
<div>
<label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
<input type="text" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-semibold mt-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} />
</div>
<div>
<label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
<input type="password" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-semibold mt-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
</div>
<button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl text-lg shadow-lg shadow-indigo-600/20 mt-8 active:scale-[0.98] transition-all">Access System</button>
</form>
</div>
</div>
);
}

// — Main Render —
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
  { id: 'products', icon: Package, label: 'Items' },
  { id: 'billing', icon: ReceiptText, label: 'Billing' },
  { id: 'customers', icon: Users, label: 'Clients' },
  { id: 'payments', icon: Wallet, label: 'Receipts' },
  { id: 'admin', icon: Settings, label: 'Admin', adminOnly: true },
];
const ctx = {
isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers,
cities, areas, customerTypes,
showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData,
billingView, setBillingView, currentInvoice, setCurrentInvoice,
activeTab, setActiveTab, adminView, setAdminView,
editingProduct, setEditingProduct, showProductModal, setShowProductModal,
editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal,
showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment,
showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId,
showExpenseCatModal, setShowExpenseCatModal,
showUserModal, setShowUserModal, editingUser, setEditingUser,
setPrintConfig, printConfig,
showSegmentsModal, setShowSegmentsModal,
editingPayment, setEditingPayment,
};
return (
<AppContext.Provider value={ctx}>
{/* ── Responsive wrapper: side-by-side on desktop, stacked on mobile ── */}
<div className="h-screen bg-slate-100 text-slate-900 font-[Inter,system-ui,sans-serif] flex flex-row print:hidden" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>

  {/* ── Desktop Sidebar Navigation (hidden on mobile) ── */}
  <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-200 shadow-sm z-20 shrink-0">
    <div className="px-5 py-5 border-b border-slate-100">
      <h1 className="text-base font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight leading-none">{APP_NAME}</h1>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{currentUser?.name}</p>
    </div>
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {TABS.map(tab => {
        if (tab.adminOnly && !isAdmin) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked').length : 0;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={`Alt+${tab.label[0].toLowerCase()}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${active ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <div className="relative shrink-0">
              <tab.icon size={18} strokeWidth={active ? 2.5 : 2} />
              {draftCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center leading-none">{draftCount > 9 ? '9+' : draftCount}</span>}
            </div>
            <span>{tab.label}</span>
            {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
          </button>
        );
      })}
    </nav>
    <div className="px-3 py-3 border-t border-slate-100">
      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2 px-1">Shortcuts: Alt+B=Billing, Alt+C=Clients</div>
      <button onClick={() => setCurrentUser(null)} className="w-full text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">Log Out</button>
    </div>
  </aside>

  {/* ── Main content area ── */}
  <div className="flex-1 flex flex-col overflow-hidden min-w-0">
    {/* Mobile/tablet header */}
    <header className="lg:hidden bg-white/90 backdrop-blur-md px-5 py-4 flex justify-between items-center shadow-sm z-10 sticky top-0 border-b border-slate-100">
      <div>
        <h1 className="text-xl font-extrabold bg-gradient-to-r from-indigo-700 to-blue-500 bg-clip-text text-transparent tracking-tight leading-none pb-0.5">{APP_NAME}</h1>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{currentUser?.name}</p>
      </div>
      <button onClick={() => setCurrentUser(null)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">Log Out</button>
    </header>

    {/* Desktop top bar */}
    <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-3 items-center justify-between shadow-sm z-10">
      <h2 className="text-base font-bold text-slate-800 capitalize">{TABS.find(t=>t.id===activeTab)?.label || ''}</h2>
      <div className="flex items-center gap-3">
        {activeTab === 'billing' && billingView === 'list' && (
          <button onClick={() => { setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', notes: '' }); setBillingView('form'); }} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"><Plus size={16}/> New Invoice <kbd className="ml-1 text-[9px] bg-indigo-500 px-1.5 py-0.5 rounded font-mono">Alt+B</kbd></button>
        )}
        {activeTab === 'customers' && (
          <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm"><Wallet size={16}/> Receive Payment</button>
        )}
        <span className="text-[10px] text-slate-400 font-medium">Esc = back/close</span>
      </div>
    </header>

    <main className="flex-1 overflow-hidden h-full bg-slate-50 lg:bg-slate-100">
      <div className="h-full lg:max-w-4xl lg:mx-auto lg:my-0 bg-slate-50 lg:shadow-sm overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'admin' && <AdminTab />}
      </div>
    </main>

    {/* Mobile bottom nav */}
    <nav className="lg:hidden bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-between pb-6 pt-3 px-2 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
      {TABS.map(tab => {
        if (tab.adminOnly && !isAdmin) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked').length : 0;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-full transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
            <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-indigo-50 shadow-sm' : ''}`}>
              <tab.icon size={22} strokeWidth={active ? 2.5 : 2} />
              {draftCount > 0 && <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">{draftCount > 9 ? '9+' : draftCount}</span>}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${active ? 'text-indigo-700 mt-1' : 'mt-0.5'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  </div>

  {/* Print View - Rendered as separate component */}
  {printConfig && (
    <PrintView
      printConfig={printConfig}
      setPrintConfig={setPrintConfig}
      products={products}
      customers={customers}
      getCustomerLedger={getCustomerLedger}
      getCustomerBalance={getCustomerBalance}
      showToast={showToast}
    />
  )}

  {showProductModal && <ProductModal />}
  {showCustomerModal && <CustomerModal />}
  {showLedgerModal && <CustomerLedgerModal />}
  {showPaymentModal && <PaymentModal />}
  {showExpenseCatModal && <ExpenseCategoryModal />}
  {showUserModal && <UserModal />}
  {showSegmentsModal && <SegmentsModal />}

  {toast && (
    <div className={`fixed top-6 right-6 lg:left-auto left-1/2 lg:-translate-x-0 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-xl z-[100] font-semibold text-white flex items-center gap-2.5 text-sm transition-all animate-slide-up ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>
      {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18} className="text-emerald-400"/>}
      {toast.msg}
    </div>
  )}

  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { font-family: 'Inter', system-ui, sans-serif; }
    @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .animate-slide-up { animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }
  `}</style>
</div>
</AppContext.Provider>

);
}

export default App;