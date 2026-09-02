import { useState, useMemo, useContext } from 'react';
import { Search, Calendar, Wallet, TrendingUp, TrendingDown, DollarSign, ChevronRight, Award, Bell, ReceiptText } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { getLocalDateStr, formatDateDisp, checkDateFilter } from '../../helpers';
import { netBilled, topProducts, momChangePct } from '../../services/analytics/dashboard';

export const DashboardTab = () => {
const { getPaymentStatus, isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, analyticsView, setAnalyticsView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [dateFilter, setDateFilter] = useState('This Month');
const [activitySearch, setActivitySearch] = useState('');
// Staff without viewAllInvoices only see their own invoices on the dashboard
const ownOnly = !isAdmin && !currentUser?.permissions?.viewAllInvoices;
const visibleInvoices = ownOnly ? invoices.filter(o => String(o.salespersonId) === String(currentUser?.id)) : invoices;
const filteredInvoices = visibleInvoices.filter(o => o.status === 'Billed' && checkDateFilter(o.date, dateFilter));
// Returns belong to whoever's figures they came out of, so credit notes are filtered the
// same way — same date window, same salesperson when a staff member sees only their own.
// Without this the dashboard counted sales that had already come back, and Analytics —
// which nets them — reported a different figure for the very same period.
const filteredCreditNotes = visibleInvoices.filter(o => o.status === 'CreditNote' && checkDateFilter(o.date, dateFilter));
const filteredExpenses = expenses.filter(e => checkDateFilter(e.date, dateFilter));
const revenue = netBilled({ billedInvoices: filteredInvoices, creditNotes: filteredCreditNotes });
const totalReceivables = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
const todayStr = getLocalDateStr();
// The bill COUNT stays a count of bills raised — a return is not an un-issued invoice —
// but the money beside it is netted like every other figure here.
const todayInvoices = visibleInvoices.filter(o => o.status === 'Billed' && o.date === todayStr);
const todayRevenue = netBilled({
  billedInvoices: todayInvoices,
  creditNotes: visibleInvoices.filter(o => o.status === 'CreditNote' && o.date === todayStr),
});
const todayCollected = payments.filter(p => p.date === todayStr).reduce((s,p)=>s+Number(p.amount||0),0);
const thisMonth = todayStr.slice(0,7);
const mo = parseInt(thisMonth.slice(5,7)), yr = parseInt(thisMonth.slice(0,4));
const lastMonth = mo === 1 ? `${yr-1}-12` : `${yr}-${String(mo-1).padStart(2,'0')}`;
const monthNet = (month) => netBilled({
  billedInvoices: invoices.filter(o => o.status === 'Billed' && o.date.startsWith(month)),
  creditNotes: invoices.filter(o => o.status === 'CreditNote' && o.date.startsWith(month)),
});
const momChange = momChangePct(monthNet(thisMonth), monthNet(lastMonth));
const topStats = useMemo(
  () => topProducts({ billedInvoices: filteredInvoices, creditNotes: filteredCreditNotes }),
  [filteredInvoices, filteredCreditNotes]);

// Receivables: top customers with outstanding balance
const topReceivables = useMemo(() => {
  return customers
    .map(c => ({ ...c, balance: getCustomerBalance(c.id) }))
    .filter(c => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);
}, [customers, invoices, payments]);

// Recent activity: merge invoices + payments, sort by date desc, take 8
// Uses visibleInvoices so staff only see their own activity
const recentActivity = useMemo(() => {
  const invEntries = visibleInvoices.filter(o => checkDateFilter(o.date, dateFilter)).map(o => ({
    id: o.id, date: o.date, customerName: o.customerName, amount: o.total,
    kind: o.status === 'Billed' ? 'invoice' : o.status === 'Estimate' ? 'estimate' : o.status === 'CreditNote' ? 'creditnote' : 'draft',
    paymentStatus: getPaymentStatus(o), raw: o
  }));
  const payEntries = (ownOnly ? [] : payments).filter(p => checkDateFilter(p.date, dateFilter)).map(p => ({
    id: p.id, date: p.date,
    customerName: customers.find(c => c.id === p.customerId)?.name || 'Unknown',
    amount: Number(p.amount), kind: 'payment', note: p.note, raw: p
  }));
  return [...invEntries, ...payEntries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 8);
}, [visibleInvoices, payments, customers, dateFilter, ownOnly]);

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

{/* Today's Summary Bar */}
<div className="bg-slate-800 text-white rounded-2xl px-4 py-3 flex justify-between items-center gap-3 flex-wrap shadow-sm">
  <div className="flex items-center gap-1.5">
    <ReceiptText size={14} className="text-indigo-300 shrink-0"/>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</span>
    <span className="text-sm font-extrabold text-white ml-1">{todayInvoices.length} bill{todayInvoices.length!==1?'s':''}</span>
    {todayRevenue > 0 && <span className="text-sm font-bold text-indigo-300">· Rs.{todayRevenue.toLocaleString('en-US')}</span>}
  </div>
  <div className="w-px h-5 bg-slate-600 shrink-0 hidden sm:block"/>
  <div className="flex items-center gap-1.5">
    <Wallet size={14} className="text-emerald-300 shrink-0"/>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collected today</span>
    <span className={`text-sm font-extrabold ml-1 ${todayCollected > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>Rs.{todayCollected.toLocaleString('en-US')}</span>
  </div>
</div>

<div className={`grid gap-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
<div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5 rounded-2xl shadow-lg shadow-indigo-600/20">
<p className="text-[10px] uppercase font-bold text-indigo-100 flex items-center gap-1.5 tracking-wider"><TrendingUp size={14}/> {dateFilter} {ownOnly ? 'My Sales' : 'Sales'}</p>
<p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Rs. {revenue.toLocaleString('en-US')}</p>
{momChange !== null && <p className={`text-[10px] font-bold mt-1 ${Number(momChange)>=0?'text-emerald-300':'text-rose-300'}`}>{Number(momChange)>=0?'▲':'▼'} {Math.abs(momChange)}% vs last month</p>}
</div>
{isAdmin && (
<button onClick={() => { setSelectedLedgerId(null); setShowLedgerModal(false); setActiveTab('customers'); }} className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-5 rounded-2xl shadow-lg shadow-rose-500/20 text-left w-full">
<p className="text-[10px] uppercase font-bold text-rose-100 flex items-center gap-1.5 tracking-wider">
  <DollarSign size={14}/> Receivables
  {topReceivables.length > 0 && <span className="ml-auto bg-white/30 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{topReceivables.length}</span>}
</p>
<p className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Rs. {totalReceivables.toLocaleString('en-US')}</p>
</button>
)}
</div>

{/* Receivables Quick View — admin only (shows all customers' balances) */}
{isAdmin && topReceivables.length > 0 && (
<div className="bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden">
  <div className="flex justify-between items-center px-4 pt-4 pb-2">
    <h3 className="text-[11px] font-bold text-rose-700 uppercase tracking-widest flex items-center gap-1.5">
      <Bell size={13}/> Outstanding Balances
      <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{topReceivables.length}</span>
    </h3>
    <button onClick={() => { setActiveTab('admin'); setAdminView('analytics'); setAnalyticsView('Receivables'); }} className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">View All <ChevronRight size={12}/></button>
  </div>
  <div className="divide-y divide-rose-50">
    {topReceivables.map(c => (
      <button key={c.id} onClick={() => hasPermission('viewLedger') && (setSelectedLedgerId(c.id), setShowLedgerModal(true))} className={`w-full flex justify-between items-center px-4 py-3 transition-colors text-left ${hasPermission('viewLedger') ? 'hover:bg-rose-50 cursor-pointer' : 'cursor-default'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
          {c.phone && <p className="text-[10px] text-slate-400 mt-0.5">{c.phone}</p>}
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className={`font-extrabold text-sm ${c.balance >= 100000 ? 'text-rose-600' : c.balance >= 50000 ? 'text-amber-600' : 'text-slate-700'}`}>Rs. {c.balance.toLocaleString('en-US')}</p>
          {c.balance >= 100000 && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">High</span>}
        </div>
        {hasPermission('viewLedger') && <ChevronRight size={14} className="text-slate-300 ml-2 shrink-0"/>}
      </button>
    ))}
  </div>
</div>
)}

{isAdmin && (
<button type="button" className="w-full bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-between items-center hover:border-indigo-200 transition-colors text-left" onClick={() => {setActiveTab('admin'); setAdminView('expenses');}}>
<div><p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5 tracking-wider"><TrendingDown size={14}/> Operational Expenses</p><p className="text-xl font-black text-slate-800 mt-1">Rs. {totalExpenses.toLocaleString('en-US')}</p></div>
<span className="p-3 bg-slate-50 text-slate-400 rounded-xl"><ChevronRight size={20}/></span>
</button>
)}
{isAdmin && (
<div className="space-y-4">
<h3 className="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">Top 5 Products ({dateFilter})</h3>
<div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
<h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-1.5"><Award size={14}/> By Sales Value</h4>
<div className="space-y-2.5">
{topStats.topValue.map((item, i) => (<div key={i} className="flex justify-between items-center"><span className="text-sm font-semibold text-slate-700 truncate mr-2">{i+1}. {item.name}</span><span className="font-bold text-slate-800 text-sm shrink-0">Rs. {item.revenue.toLocaleString('en-US')}</span></div>))}
{topStats.topValue.length === 0 && <p className="text-xs text-slate-400">No data.</p>}
</div>
</div>
</div>
)}

{/* Recent Activity */}
<div>
<div className="flex justify-between items-end mb-3 mt-2">
<h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
  Recent Activity
  {recentActivity.length > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">{recentActivity.length}</span>}
</h3>
<button onClick={() => setActiveTab('billing')} className="text-xs font-bold text-indigo-600 flex items-center gap-0.5">View All <ChevronRight size={14}/></button>
</div>
<div className="relative mb-3"><Search className="absolute left-3.5 top-3 text-slate-400" size={15}/><input placeholder="Search activity..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={activitySearch} onChange={e => setActivitySearch(e.target.value)} /></div>
<div className="space-y-2.5">
{recentActivity.filter(entry => !activitySearch || entry.customerName.toLowerCase().includes(activitySearch.toLowerCase()) || entry.id.toLowerCase().includes(activitySearch.toLowerCase())).map(entry => {
  const kindConfig = {
    invoice: { dot: 'bg-indigo-500', label: 'Invoice', labelCls: 'bg-indigo-100 text-indigo-700', amountCls: 'text-indigo-700' },
    payment: { dot: 'bg-emerald-500', label: 'Payment', labelCls: 'bg-emerald-100 text-emerald-700', amountCls: 'text-emerald-600' },
    estimate: { dot: 'bg-purple-400', label: 'Estimate', labelCls: 'bg-purple-100 text-purple-700', amountCls: 'text-slate-700' },
    creditnote: { dot: 'bg-rose-400', label: 'Credit Note', labelCls: 'bg-rose-100 text-rose-600', amountCls: 'text-rose-600' },
    draft: { dot: 'bg-amber-400', label: 'Draft', labelCls: 'bg-amber-100 text-amber-700', amountCls: 'text-slate-700' },
  };
  const cfg = kindConfig[entry.kind] || kindConfig.draft;
  return (
    <div key={entry.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 flex gap-3 items-center shadow-sm">
      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-bold text-slate-800 text-sm truncate">{entry.customerName}</p>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.labelCls}`}>{cfg.label}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          {entry.id} &bull; {formatDateDisp(entry.date)}
          {entry.kind === 'invoice' && entry.paymentStatus && (
            <span className={`ml-1.5 font-bold ${entry.paymentStatus==='Paid'?'text-emerald-600':entry.paymentStatus==='Partial'?'text-amber-600':'text-rose-500'}`}>&bull; {entry.paymentStatus}</span>
          )}
          {entry.kind === 'payment' && entry.note && <span className="ml-1 italic">&bull; {entry.note}</span>}
        </p>
      </div>
      <p className={`font-extrabold text-sm shrink-0 ${cfg.amountCls}`}>Rs. {entry.amount.toLocaleString('en-US')}</p>
    </div>
  );
})}
{recentActivity.filter(e => !activitySearch || e.customerName.toLowerCase().includes(activitySearch.toLowerCase()) || e.id.toLowerCase().includes(activitySearch.toLowerCase())).length === 0 && <p className="text-center text-slate-400 text-sm py-8 font-medium">{activitySearch ? 'No matching activity.' : 'No activity for this period.'}</p>}
</div>
</div>
</div>
</div>
);
};
