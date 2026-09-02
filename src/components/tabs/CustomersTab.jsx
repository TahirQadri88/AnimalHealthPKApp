import { useState, useMemo, useContext } from 'react';
import { Plus, Search, X, Edit, Trash2, Wallet, AlertCircle } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import SearchableSelect from '../SearchableSelect';

export const CustomersTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, cities, areas, customerTypes, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm, showPrompt, voidRecord, logSave } = useContext(AppContext);
const [search, setSearch] = useState('');
const [filterCity, setFilterCity] = useState('');
const [filterArea, setFilterArea] = useState('');
const [filterType, setFilterType] = useState('');
const [filterBalance, setFilterBalance] = useState('All');
const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
const incompleteIds = useMemo(() => new Set(customers.filter(c => !c.city || !c.area || !c.customerType).map(c => c.id)), [customers]);
const activeFilters = filterCity || filterArea || filterType || filterBalance !== 'All' || showIncompleteOnly;
const clearFilters = () => { setFilterCity(''); setFilterArea(''); setFilterType(''); setFilterBalance('All'); setShowIncompleteOnly(false); };
return (
<div className="p-4 flex flex-col h-full">
<div className="flex justify-between items-center mb-4">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Ledgers{incompleteIds.size > 0 && !showIncompleteOnly && <span className="text-[11px] text-amber-600 font-bold ml-2 align-middle">· {incompleteIds.size} incomplete</span>}</h2>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="bg-emerald-500 text-white p-2 px-3 rounded-xl shadow-md flex items-center gap-1 text-xs font-bold"><Wallet size={16}/> Pay</button>}
{isAdmin && <button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} className="bg-indigo-600 text-white p-2 rounded-xl shadow-md"><Plus size={18}/></button>}
</div>
</div>
<div className="relative mb-2"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Clients..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
<ScrollableTabBar className="mb-3 shrink-0">
  <SearchableSelect value={filterCity} onChange={e=>{setFilterCity(e.target.value);setFilterArea('');}} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] text-slate-700 outline-none shrink-0 min-w-[90px]" placeholder="All Cities" options={cities.map(c=>({value:c.name,label:c.name}))} />
  <SearchableSelect value={filterArea} onChange={e=>setFilterArea(e.target.value)} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] text-slate-700 outline-none shrink-0 min-w-[90px]" placeholder="All Areas" options={areas.filter(a=>!filterCity||!a.cityName||a.cityName===filterCity).map(a=>({value:a.name,label:a.name}))} />
  <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] text-slate-700 outline-none shrink-0">
    <option value="">All Types</option>
    {customerTypes.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
  </select>
  <select value={filterBalance} onChange={e=>setFilterBalance(e.target.value)} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-bold text-[11px] text-slate-700 outline-none shrink-0">
    <option value="All">All Balances</option>
    <option value="Outstanding">Outstanding (Dr)</option>
    <option value="Advance">Advance (Cr)</option>
    <option value="Clear">Cleared</option>
  </select>
  <button onClick={() => setShowIncompleteOnly(v => !v)} className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 border transition-colors ${showIncompleteOnly ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'}`}><AlertCircle size={10}/> Incomplete{incompleteIds.size > 0 ? ` (${incompleteIds.size})` : ''}</button>
  {activeFilters && <button onClick={clearFilters} className="shrink-0 text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-rose-100 transition-colors"><X size={10}/> Clear</button>}
</ScrollableTabBar>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{customers.filter(c => {
const bal = getCustomerBalance(c.id);
const nameMatch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.contactPerson||'').toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search);
const cityMatch = !filterCity || (c.city||'') === filterCity;
const areaMatch = !filterArea || (c.area||'') === filterArea;
const typeMatch = !filterType || (c.customerType||'') === filterType;
const balMatch = filterBalance === 'All' || (filterBalance === 'Outstanding' && bal > 0) || (filterBalance === 'Advance' && bal < 0) || (filterBalance === 'Clear' && bal === 0);
const incompleteMatch = !showIncompleteOnly || incompleteIds.has(c.id);
return nameMatch && cityMatch && areaMatch && typeMatch && balMatch && incompleteMatch;
}).map(c => {
const bal = getCustomerBalance(c.id);
return (
<div key={c.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm hover:border-indigo-200 transition-colors">
<button type="button" className="flex-1 text-left" onClick={() => { setSelectedLedgerId(c.id); setShowLedgerModal(true); }}>
<h4 className="font-bold text-slate-800 text-sm hover:text-indigo-600">{c.name}</h4>
<p className="text-[11px] font-medium text-slate-500 mt-0.5">{c.contactPerson ? `${c.contactPerson} - ` : ''}{c.phone}</p>
{incompleteIds.has(c.id) && <div className="flex flex-wrap gap-1 mt-1">{!c.city && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">No City</span>}{!c.area && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">No Area</span>}{!c.customerType && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">No Type</span>}</div>}
<div className="mt-2.5">
<span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${bal > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : bal < 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
Bal: Rs. {bal.toLocaleString('en-US')} {bal > 0 ? '(Dr)' : bal < 0 ? '(Cr)' : ''}
</span>
</div>
</button>
{isAdmin && (<div className="flex flex-col gap-2 ml-3"><button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setShowCustomerModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button><button onClick={async (e) => {
  e.stopPropagation();
  const relInvoices = invoices.filter(o => o.customerId === c.id);
  const relPayments = payments.filter(p => p.customerId === c.id);
  const hasRecords = relInvoices.length > 0 || relPayments.length > 0;
  if (hasRecords) {
    if (!await showConfirm(`${c.name} has ${relInvoices.length} invoice(s) and ${relPayments.length} payment(s).\n\nDelete this client and VOID all related records?\n\nThe records stay on file and leave every balance.`)) return;
    // The customer goes, but their financial history is voided rather than destroyed —
    // otherwise deleting one client silently rewrites last year's revenue.
    await Promise.all([
      ...relInvoices.map(o => voidRecord('invoices', o, { label: o.id, reason: `Client ${c.name} deleted` })),
      ...relPayments.map(p => voidRecord('payments', p, { label: p.id, reason: `Client ${c.name} deleted` })),
    ]);
  } else {
    if (!await showConfirm(`Permanently delete ${c.name}?`)) return;
  }
  await deleteFromFirebase('customers', c.id);
  showToast(`${c.name} deleted`);
}} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button></div>)}
</div>
);
})}
</div>
</div>
);
};

// ─── Credit Note Modal ───
