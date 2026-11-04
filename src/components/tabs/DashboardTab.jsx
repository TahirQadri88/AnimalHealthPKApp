import { useState, useMemo, useContext } from 'react';
import { Search, Calendar, Wallet, TrendingUp, TrendingDown, DollarSign, ChevronRight, Award, Bell, ReceiptText } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { getLocalDateStr, formatDateDisp, checkDateFilter } from '../../helpers';
import { netBilled, topProducts, momChangePct } from '../../services/analytics/dashboard';
import { productsNeedingCost, billsAffected } from '../../lib/costPending';

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

// Products staff registered without a cost. Until an admin prices them, every sale of one
// counts as pure profit, so the admin is told here rather than left to find it on Items.
const costPending = isAdmin ? productsNeedingCost(products) : [];
const costPendingBills = billsAffected(costPending, invoices);
const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-US')}`;
const canLedger = hasPermission('viewLedger');
const maxTop = Math.max(1, ...topStats.topValue.map(t => t.revenue));
const shownActivity = recentActivity.filter(entry => !activitySearch || entry.customerName.toLowerCase().includes(activitySearch.toLowerCase()) || entry.id.toLowerCase().includes(activitySearch.toLowerCase()));
// Khyber Traders look: each kind of document keeps one meaning colour, as on the Billing screen.
const kindConfig = {
  invoice:    { label: 'Invoice',     chip: 'bg-kt-raised text-kt-ink',     amount: 'text-kt-ink' },
  payment:    { label: 'Payment',     chip: 'bg-kt-green/10 text-kt-green', amount: 'text-kt-green' },
  estimate:   { label: 'Estimate',    chip: 'bg-kt-blue/10 text-kt-blue',   amount: 'text-kt-ink' },
  creditnote: { label: 'Credit Note', chip: 'bg-kt-red/10 text-kt-red',     amount: 'text-kt-red' },
  draft:      { label: 'Draft',       chip: 'bg-kt-amber/10 text-kt-amber', amount: 'text-kt-ink' },
};
const payChip = (ps) => ps === 'Paid' ? 'bg-kt-green/10 text-kt-green' : ps === 'Partial' ? 'bg-kt-amber/10 text-kt-amber' : 'bg-kt-red/10 text-kt-red';
const card = "bg-white rounded-xl border border-kt-line shadow-[0_1px_2px_rgba(20,20,20,0.05)]";
return (
<div className="font-ui h-full overflow-y-auto bg-kt-page">
<div className="p-3 sm:p-6 space-y-3 sm:space-y-4 pb-24">
{costPending.length > 0 && (
<button onClick={() => setActiveTab('products')} className="w-full text-left bg-white border border-kt-red/30 rounded-xl px-3 py-2.5 sm:p-4 flex items-start gap-3 hover:bg-kt-red/5 transition-colors">
  <Bell size={18} strokeWidth={1.5} className="text-kt-red shrink-0 mt-0.5" />
  <span className="flex-1 min-w-0">
    <span className="block text-sm font-medium text-kt-red">
      {costPending.length} product{costPending.length !== 1 ? 's' : ''} need{costPending.length === 1 ? 's' : ''} a cost price
    </span>
    <span className="hidden sm:block text-sm text-kt-sub mt-0.5 leading-relaxed">
      Added by staff: {costPending.slice(0, 3).map(p => p.name).join(', ')}{costPending.length > 3 ? ` and ${costPending.length - 3} more` : ''}.
      {costPendingBills > 0 ? ` Sold on ${costPendingBills} bill${costPendingBills !== 1 ? 's' : ''} so far, counted as pure profit until you set the cost.` : ' Set the cost before it is sold, or its sales count as pure profit.'}
    </span>
    {/* One line on a phone; the full explanation is on Items, one tap away. */}
    <span className="sm:hidden block text-sm text-kt-sub truncate">{costPending.slice(0, 2).map(p => p.name).join(', ')}{costPending.length > 2 ? ` +${costPending.length - 2}` : ''}</span>
  </span>
  <ChevronRight size={16} strokeWidth={1.5} className="text-kt-muted shrink-0 mt-0.5" />
</button>
)}
<div className="flex justify-between items-center gap-3">
<h2 className="font-display text-[28px] sm:text-3xl text-kt-ink">Overview</h2>
<div className="relative">
<Calendar size={16} strokeWidth={1.5} className="absolute left-3 top-3 text-kt-muted pointer-events-none" />
<select value={dateFilter} onChange={e => setDateFilter(e.target.value)} aria-label="Period" className="h-9 sm:h-10 pl-9 pr-3 bg-white border border-kt-line rounded-lg text-sm text-kt-ink outline-none cursor-pointer"><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option></select>
</div>
</div>

{/* The period in one band: sales in Khyber Yellow, receivables beside it for an admin,
    today's bills and collections underneath. It replaces three separately coloured boxes. */}
{/* Compact on a phone: smaller figures, receivables on one row, today on one line. */}
<div className="bg-kt-band text-white rounded-xl px-4 py-3 sm:p-5">
  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 sm:gap-y-3">
    <div>
      <p className="text-sm text-white/70 flex items-center gap-1.5"><TrendingUp size={16} strokeWidth={1.5}/> {dateFilter} {ownOnly ? 'My Sales' : 'Sales'}</p>
      <p className="font-display text-[28px] sm:text-4xl text-kt-yellow leading-tight">{money(revenue)}</p>
      {momChange !== null && <p className="text-xs sm:text-sm text-white/80">{Number(momChange) >= 0 ? '▲' : '▼'} {Math.abs(momChange)}% vs last month</p>}
    </div>
    {isAdmin && (
    <button onClick={() => { setSelectedLedgerId(null); setShowLedgerModal(false); setActiveTab('customers'); }} className="w-full sm:w-auto flex sm:block items-baseline justify-between gap-3 text-left sm:text-right rounded-lg -mx-2 px-2 py-1 sm:-m-2 sm:p-2 hover:bg-white/10 transition-colors">
      <p className="text-sm text-white/70 flex items-center sm:justify-end gap-1.5"><DollarSign size={16} strokeWidth={1.5}/> Receivables{topReceivables.length > 0 && <span className="text-white/70"> · {topReceivables.length} high</span>}</p>
      <p className="font-display text-2xl sm:text-3xl leading-tight whitespace-nowrap">{money(totalReceivables)}</p>
    </button>
    )}
  </div>
  <div className="mt-2 pt-2 sm:mt-4 sm:pt-3 border-t border-white/15 flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-0.5 text-sm">
    <span className="flex items-center gap-1.5 text-white/80"><ReceiptText size={16} strokeWidth={1.5} className="hidden sm:block"/> Today <span className="text-white font-medium">{todayInvoices.length} bill{todayInvoices.length !== 1 ? 's' : ''}</span>{todayRevenue > 0 && <span className="text-white font-medium tabular-nums">· {money(todayRevenue)}</span>}</span>
    <span className="flex items-center gap-1.5 text-white/80"><Wallet size={16} strokeWidth={1.5} className="hidden sm:block"/> Collected <span className="text-white font-medium tabular-nums">{money(todayCollected)}</span></span>
  </div>
</div>

{/* Receivables Quick View — admin only (shows all customers' balances) */}
{isAdmin && topReceivables.length > 0 && (
<div className={`${card} overflow-hidden`}>
  <div className="flex justify-between items-center px-4 sm:px-5 pt-3 sm:pt-4 pb-1 sm:pb-2">
    <h3 className="font-display text-2xl text-kt-ink flex items-center gap-3">
      Outstanding balances
      <span className="font-ui text-xs font-medium bg-kt-red/10 text-kt-red px-2 h-6 inline-flex items-center rounded-md">{topReceivables.length}</span>
    </h3>
    <button onClick={() => { setActiveTab('admin'); setAdminView('analytics'); setAnalyticsView('Receivables'); }} className="text-sm font-medium text-kt-ink hover:underline flex items-center gap-0.5">View all <ChevronRight size={16} strokeWidth={1.5}/></button>
  </div>
  <div className="divide-y divide-kt-line">
    {topReceivables.map(c => (
      <button key={c.id} onClick={() => canLedger && (setSelectedLedgerId(c.id), setShowLedgerModal(true))} className={`w-full flex justify-between items-center gap-3 px-4 sm:px-5 py-2 sm:py-3 transition-colors text-left ${canLedger ? 'hover:bg-kt-raised cursor-pointer' : 'cursor-default'}`}>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-kt-ink truncate">{c.name}</p>
          {c.phone && <p className="hidden sm:block text-sm text-kt-muted mt-0.5 tabular-nums">{c.phone}</p>}
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          {/* On a phone the red figure says it; the label would push the name out. */}
          {c.balance >= 100000 && <span className="text-xs font-medium bg-kt-red/10 text-kt-red px-2 h-6 hidden sm:inline-flex items-center rounded-md">High</span>}
          <p className={`font-display text-2xl ${c.balance >= 100000 ? 'text-kt-red' : c.balance >= 50000 ? 'text-kt-amber' : 'text-kt-ink'}`}>{money(c.balance)}</p>
        </div>
        {canLedger && <ChevronRight size={16} strokeWidth={1.5} className="text-kt-muted shrink-0"/>}
      </button>
    ))}
  </div>
</div>
)}

{isAdmin && (
<div className="grid sm:grid-cols-2 gap-4">
<button type="button" className={`${card} p-4 sm:p-5 flex justify-between items-center hover:border-kt-muted/40 transition-colors text-left`} onClick={() => {setActiveTab('admin'); setAdminView('expenses');}}>
<div><p className="text-sm text-kt-sub flex items-center gap-1.5"><TrendingDown size={16} strokeWidth={1.5}/> Operational expenses · {dateFilter}</p><p className="font-display text-2xl sm:text-3xl text-kt-ink mt-0.5 sm:mt-1">{money(totalExpenses)}</p></div>
<ChevronRight size={20} strokeWidth={1.5} className="text-kt-muted"/>
</button>
{/* Top products as a ranked list with thin bars: the bar is the share of the top seller. */}
<div className={`${card} p-4 sm:p-5`}>
<h3 className="text-sm text-kt-sub mb-3 flex items-center gap-1.5"><Award size={16} strokeWidth={1.5}/> Top 5 products by sales · {dateFilter}</h3>
<div className="space-y-3">
{topStats.topValue.map((item, i) => (
  <div key={i}>
    <div className="flex justify-between items-baseline gap-3 text-sm"><span className="text-kt-ink truncate">{i+1}. {item.name}</span><span className="font-medium text-kt-ink shrink-0 tabular-nums">{money(item.revenue)}</span></div>
    <div className="mt-1 h-1.5 rounded-full bg-kt-raised overflow-hidden"><div className="h-full rounded-full bg-kt-band" style={{ width: `${Math.max(4, Math.round(item.revenue / maxTop * 100))}%` }}></div></div>
  </div>
))}
{topStats.topValue.length === 0 && <p className="text-sm text-kt-muted">No sales in this period</p>}
</div>
</div>
</div>
)}

{/* Recent Activity */}
<div className="pt-2">
<div className="flex justify-between items-center mb-3">
<h3 className="font-display text-2xl text-kt-ink flex items-center gap-3">
  Recent activity
  {recentActivity.length > 0 && <span className="font-ui text-xs font-medium bg-kt-raised text-kt-sub px-2 h-6 inline-flex items-center rounded-md tabular-nums">{recentActivity.length}</span>}
</h3>
<button onClick={() => setActiveTab('billing')} className="text-sm font-medium text-kt-ink hover:underline flex items-center gap-0.5">View all <ChevronRight size={16} strokeWidth={1.5}/></button>
</div>
<div className="relative mb-3"><Search className="absolute left-3 top-3 text-kt-muted" size={16} strokeWidth={1.5}/><input placeholder="Search activity" className="w-full h-10 pl-9 pr-3 bg-white border border-kt-line rounded-lg text-sm text-kt-ink placeholder-kt-muted outline-none focus:border-kt-ink transition-colors" value={activitySearch} onChange={e => setActivitySearch(e.target.value)} /></div>
<div className={`${card} divide-y divide-kt-line overflow-hidden`}>
{shownActivity.map(entry => {
  const cfg = kindConfig[entry.kind] || kindConfig.draft;
  return (
    <div key={entry.id} className="px-4 py-2.5 sm:py-3 flex gap-3 items-center">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-kt-ink truncate">{entry.customerName}</p>
        <p className="text-sm text-kt-sub mt-0.5 flex items-center gap-x-3 gap-y-1 flex-wrap">
          <span className="font-mono text-[13px] text-kt-ink">{entry.id}</span>
          <span className="tabular-nums">{formatDateDisp(entry.date)}</span>
          <span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${cfg.chip}`}>{cfg.label}</span>
          {entry.kind === 'invoice' && entry.paymentStatus && <span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${payChip(entry.paymentStatus)}`}>{entry.paymentStatus === 'Pending' ? 'Unpaid' : entry.paymentStatus}</span>}
          {entry.kind === 'payment' && entry.note && <span className="text-kt-muted">{entry.note}</span>}
        </p>
      </div>
      <p className={`font-medium shrink-0 tabular-nums ${cfg.amount}`}>{entry.kind === 'creditnote' ? '− ' : ''}{money(entry.amount)}</p>
    </div>
  );
})}
{shownActivity.length === 0 && <p className="text-center text-kt-muted text-sm py-8">{activitySearch ? 'No matching activity' : 'No activity for this period'}</p>}
</div>
</div>
</div>
</div>
);
};
