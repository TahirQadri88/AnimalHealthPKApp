import { useState, useMemo, useContext } from 'react';
import { Plus, Search, X, Edit, Trash2, Wallet, AlertCircle, BookOpen, ReceiptText, PhoneCall } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import SearchableSelect from '../SearchableSelect';
import { buildCustomerCard, balanceReminderText, waNumber } from '../../services/customers/customerCard';
import { customerAging } from '../../services/analytics/receivables';
import { APP_NAME, VEHICLES, formatDateDisp, getLocalDateStr } from '../../helpers';

export const CustomersTab = () => {
const { isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, cities, areas, customerTypes, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm, showPrompt, voidRecord, logSave } = useContext(AppContext);
const [search, setSearch] = useState('');
const [filterCity, setFilterCity] = useState('');
const [filterArea, setFilterArea] = useState('');
const [filterType, setFilterType] = useState('');
const [filterBalance, setFilterBalance] = useState('All');
const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
const incompleteIds = useMemo(() => new Set(customers.filter(c => !c.city || !c.area || !c.customerType).map(c => c.id)), [customers]);
const today = getLocalDateStr();
const activeFilters = filterCity || filterArea || filterType || filterBalance !== 'All' || showIncompleteOnly;
const clearFilters = () => { setFilterCity(''); setFilterArea(''); setFilterType(''); setFilterBalance('All'); setShowIncompleteOnly(false); };
return (
<div className="p-4 flex flex-col h-full">
<div className="flex justify-between items-center mb-4">
<h2 className="font-display text-3xl text-kt-ink">Ledgers{incompleteIds.size > 0 && !showIncompleteOnly && <span className="font-ui text-sm text-kt-amber font-medium ml-2 align-middle">· {incompleteIds.size} incomplete</span>}</h2>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="bg-kt-primary text-white p-2 px-3 rounded-xl flex items-center gap-1 text-xs font-medium"><Wallet size={16}/> Pay</button>}
{isAdmin && <button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} className="bg-kt-primary text-white p-2 rounded-xl"><Plus size={18}/></button>}
</div>
</div>
<div className="relative mb-2"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-kt-muted" size={18} /><input placeholder="Search clients" className="w-full pl-10 pr-4 py-3 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
<ScrollableTabBar className="mb-3 shrink-0">
  <SearchableSelect value={filterCity} onChange={e=>{setFilterCity(e.target.value);setFilterArea('');}} className="h-11 sm:h-9 px-3 rounded-lg border border-kt-line bg-white font-medium text-base sm:text-xs text-kt-ink outline-none shrink-0 min-w-[110px]" placeholder="All Cities" options={cities.map(c=>({value:c.name,label:c.name}))} />
  <SearchableSelect value={filterArea} onChange={e=>setFilterArea(e.target.value)} className="h-11 sm:h-9 px-3 rounded-lg border border-kt-line bg-white font-medium text-base sm:text-xs text-kt-ink outline-none shrink-0 min-w-[110px]" placeholder="All Areas" options={areas.filter(a=>!filterCity||!a.cityName||a.cityName===filterCity).map(a=>({value:a.name,label:a.name}))} />
  <select value={filterType} onChange={e=>setFilterType(e.target.value)} className="h-11 sm:h-9 px-3 rounded-lg border border-kt-line bg-white font-medium text-base sm:text-xs text-kt-ink outline-none shrink-0">
    <option value="">All Types</option>
    {customerTypes.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
  </select>
  <select value={filterBalance} onChange={e=>setFilterBalance(e.target.value)} className="h-11 sm:h-9 px-3 rounded-lg border border-kt-line bg-white font-medium text-base sm:text-xs text-kt-ink outline-none shrink-0">
    <option value="All">All Balances</option>
    <option value="Outstanding">Outstanding (Dr)</option>
    <option value="Advance">Advance (Cr)</option>
    <option value="Clear">Cleared</option>
  </select>
  <button onClick={() => setShowIncompleteOnly(v => !v)} className={`shrink-0 h-11 sm:h-9 px-3 text-base sm:text-xs font-medium rounded-lg flex items-center gap-1.5 border transition-colors ${showIncompleteOnly ? 'bg-kt-amber text-white border-kt-amber/30' : 'bg-white text-kt-amber border-kt-amber/30 hover:bg-kt-amber/10'}`}><AlertCircle size={10}/> Incomplete{incompleteIds.size > 0 ? ` (${incompleteIds.size})` : ''}</button>
  {activeFilters && <button onClick={clearFilters} className="shrink-0 h-11 sm:h-9 px-3 text-base sm:text-xs font-medium text-kt-red bg-kt-red/10 border border-kt-red/30 rounded-lg flex items-center gap-1.5 hover:bg-kt-red/10 transition-colors"><X size={10}/> Clear</button>}
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
// Last invoice, last payment and last activity — brief §14. The card had the name and the
// balance, and everything else meant opening the ledger to find out.
const card = buildCustomerCard(c.id, { invoices, payments });
// Only worth computing for someone who actually owes something.
const aging = bal > 0 ? customerAging(c.id, { customers, invoices, payments, asOf: today }) : null;
const wa = waNumber(c.phone);
return (
<div key={c.id} className="bg-white p-4 rounded-xl border border-kt-line flex justify-between items-start hover:border-kt-blue/30 transition-colors">
<div className="flex-1 min-w-0">
<button type="button" className="w-full text-left" onClick={() => { setSelectedLedgerId(c.id); setShowLedgerModal(true); }}>
<h4 className="font-medium text-kt-blue text-base hover:underline">{c.name}</h4>
<p className="text-xs font-medium text-kt-sub mt-0.5">{c.contactPerson ? `${c.contactPerson} - ` : ''}{c.phone}</p>
{incompleteIds.has(c.id) && <div className="flex flex-wrap gap-1 mt-1">{!c.city && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-kt-amber/10 text-kt-amber">No City</span>}{!c.area && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-kt-amber/10 text-kt-amber">No Area</span>}{!c.customerType && <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-kt-amber/10 text-kt-amber">No Type</span>}</div>}
<div className="mt-2.5">
<span className={`text-xs font-medium  px-2 py-1 rounded-md ${bal > 0 ? 'bg-kt-red/10 text-kt-red border border-kt-red/30' : bal < 0 ? 'bg-kt-blue/10 text-kt-blue border border-kt-blue/30' : 'bg-kt-green/10 text-kt-green border border-kt-green/30'}`}>
Bal: Rs. {bal.toLocaleString('en-US')} {bal > 0 ? '(Dr)' : bal < 0 ? '(Cr)' : ''}
</span>
</div>
<div className="mt-2 space-y-0.5">
  {card.isNew ? (
    <p className="text-xs font-medium text-kt-muted">No transactions yet</p>
  ) : (
    <>
      {card.lastInvoice && (
        <p className="text-xs text-kt-sub">
          <span className="font-medium text-kt-sub">Last bill</span> {card.lastInvoice.id} · {formatDateDisp(card.lastInvoice.date)} · Rs.{card.lastInvoice.amount.toLocaleString('en-US')}
        </p>
      )}
      {card.lastPayment && (
        <p className="text-xs text-kt-sub">
          <span className="font-medium text-kt-sub">Last paid</span> {formatDateDisp(card.lastPayment.date)} · Rs.{card.lastPayment.amount.toLocaleString('en-US')}
          {card.lastPayment.atBilling ? ' (at billing)' : ''}
        </p>
      )}
      {!card.lastPayment && <p className="text-xs font-medium text-kt-amber">Never paid</p>}
      {/* How old the money is, not how long since they bought — the two are different, and
          the aging report already settles each debt oldest-first to work it out. */}
      {bal > 0 && aging && aging.oldestAgeDays > 30 && (
        <p className={`text-xs font-medium ${aging.oldestAgeDays > 90 ? 'text-kt-red' : 'text-kt-amber'}`}>
          Oldest debt {aging.oldestAgeDays} days
        </p>
      )}
      {card.daysSinceActivity !== null && card.daysSinceActivity > 30 && (
        <p className="text-xs font-medium text-kt-amber">Quiet for {card.daysSinceActivity} days</p>
      )}
    </>
  )}
</div>
</button>
{/* The four actions §14 asks for. Ledger is the card itself; these are the other three. */}
<div className="flex flex-wrap gap-1.5 mt-2.5">
  <button
    onClick={() => { setSelectedLedgerId(c.id); setShowLedgerModal(true); }}
    className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg bg-kt-raised text-kt-sub border border-kt-line hover:bg-kt-raised"
  ><BookOpen size={11}/> Ledger</button>
  {(isAdmin || hasPermission('issueInvoices')) && (
    <button
      onClick={() => {
        setCurrentInvoice({ id: null, customerId: c.id, customerName: c.name, customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' });
        setBillingView('form');
        setActiveTab('billing');
      }}
      className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg bg-kt-blue/10 text-kt-blue border border-kt-blue/30 hover:bg-kt-blue/10"
    ><ReceiptText size={11}/> New Invoice</button>
  )}
  {(isAdmin || hasPermission('receivePayments')) && (
    <button
      onClick={() => { setSelectedCustomerForPayment(c.id); setShowPaymentModal(true); }}
      className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg bg-kt-green/10 text-kt-green border border-kt-green/30 hover:bg-kt-green/10"
    ><Wallet size={11}/> Receive</button>
  )}
  {wa && (
    <a
      href={`https://wa.me/${wa}?text=${encodeURIComponent(balanceReminderText(c, bal, APP_NAME))}`}
      target="_blank" rel="noopener noreferrer"
      title={`WhatsApp ${c.name}`}
      className="flex items-center gap-1 text-xs font-medium px-2 py-1.5 rounded-lg bg-kt-green/10 text-kt-green border border-kt-green/30 hover:bg-kt-green/10"
    ><PhoneCall size={11}/> WhatsApp</a>
  )}
</div>
</div>
{isAdmin && (<div className="flex flex-col gap-2 ml-3 shrink-0"><button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setShowCustomerModal(true); }} className="p-2 bg-kt-raised text-kt-sub rounded-lg hover:bg-kt-raised transition-colors"><Edit size={16}/></button><button onClick={async (e) => {
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
}} className="p-2 bg-kt-red/10 text-kt-red rounded-lg hover:bg-kt-red/10 transition-colors"><Trash2 size={16}/></button></div>)}
</div>
);
})}
</div>
</div>
);
};

// ─── Credit Note Modal ───
