import React, { useState, useMemo, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
LayoutDashboard, Package, ReceiptText, BarChart3, Settings,
Plus, Search, Truck, CheckCircle2, AlertCircle, Users,
Share2, Printer, Trash2, Edit, X, Lock, DollarSign,
TrendingUp, Receipt, FileSpreadsheet, Calendar, Save, ChevronRight, ChevronLeft,
Wallet, Download, Upload, TrendingDown, Filter, ArrowUpDown, Award, CreditCard,
FileDown, BookOpen, ShoppingCart, Tag, Building2, BarChart2, PieChart, Activity,
Percent, Hash, Zap, Archive, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp,
AlignLeft, Bell, Star, Layers, Globe, PhoneCall, MapPin, Briefcase, ClipboardList, Copy,
RotateCcw, FileText, Database, Clock
} from 'lucide-react';
import { db, auth, firebaseConfig, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, runTransaction,
         getDocs, query, orderBy, limit,
         getAuth, initializeApp, deleteApp, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, signOut, onAuthStateChanged, authEmailFor, loginSlug } from './firebase';
import { AUDIT, auditEntry, changedFields, describeEntry, notVoided, isVoided, voidPatch, restorePatch } from './services/audit/auditLog';
import { APP_NAME, VEHICLES, getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter, exportToCSV, shareOrDownload } from './helpers';
import PrintView from './components/PrintView';
import { invoiceTotal } from './services/accounting/invoiceTotals';
import { buildCustomerLedger, allocateCredits, statusFromSettled } from './services/accounting/ledger';
import { profitImpactOfCostChange, defaultEffectiveDate, firstSaleDate } from './services/accounting/costPriceChange';
import { computePnL } from './services/analytics/profitAndLoss';
import { buildAgingReport, summariseAging, AGING_BUCKETS } from './services/analytics/receivables';
import { netBilled, topProducts, momChangePct } from './services/analytics/dashboard';
import SearchableSelect from './components/SearchableSelect';
import { AppContext } from './context/AppContext';
import { isTransportMethod, isKnownVehicleType, usesCarrierPerson } from './lib/transport';
import { getNextSeqNum } from './lib/docNumbers';
import { claimDocNumber } from './lib/claimDocNumber';
import { makeArrowNav } from './lib/a11y';
import { getISOWeekFilename, uploadToDrive, getDriveScript } from './lib/driveBackup';
import { EXPENSE_GROUPS, EXPENSE_GROUP_COLORS, RIDER_VEHICLE_TYPES, LOG_PAGE } from './lib/constants';
import { useLiveCollection } from './hooks/useLiveCollection';
import { ModalWrapper } from './components/ui/ModalWrapper';
import { ScrollableTabBar } from './components/ui/ScrollableTabBar';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { MultiPicker } from './components/ui/MultiPicker';
import { RidersAdminView } from './components/admin/RidersAdminView';
import { CompanyManager } from './components/admin/CompanyManager';
import { ExpensesView } from './components/admin/ExpensesView';
import { CustomersTab } from './components/tabs/CustomersTab';
import { TransportCompaniesManager } from './components/admin/TransportCompaniesManager';
import { AuditView } from './components/admin/AuditView';
import { ReceivablesView } from './components/admin/ReceivablesView';
import { MastersView } from './components/admin/MastersView';
import { SegmentsAdminView } from './components/admin/SegmentsAdminView';
import { UserManagementView } from './components/admin/UserManagementView';
import { BulkOpsView } from './components/admin/BulkOpsView';
import { FixInvoiceUnitsButton } from './components/admin/FixInvoiceUnitsButton';
import { AppSettingsView } from './components/admin/AppSettingsView';
import { ExpenseCategoryModal } from './components/modals/ExpenseCategoryModal';
import { PaymentModal } from './components/modals/PaymentModal';
import { CustomerModal } from './components/modals/CustomerModal';
import { RidersModal } from './components/modals/RidersModal';
import { UserModal } from './components/modals/UserModal';
import { ProductModal } from './components/modals/ProductModal';
import { CustomerLedgerModal } from './components/modals/CustomerLedgerModal';
import { SegmentsModal } from './components/modals/SegmentsModal';
import { CreditNoteModal } from './components/modals/CreditNoteModal';




// ─── TOP-LEVEL MODAL COMPONENTS (outside App to prevent focus-loss on re-render) ───


const DashboardTab = () => {
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

const BillingTab = () => {
const { getPaymentStatus, isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, setShowCreditNoteModal, setEditingCreditNote, showConfirm, riders, vehicleTypes, transportCompanies, showPrompt, voidRecord, logSave, invoicesRaw, logDelete } = useContext(AppContext);
const [search, setSearch] = useState('');
const [dateFilter, setDateFilter] = useState('All Time');
const [statusFilter, setStatusFilter] = useState('All');
const [prodSearch, setProdSearch] = useState('');
const [customerSearch, setCustomerSearch] = useState('');
const [showCustomerDrop, setShowCustomerDrop] = useState(false);
const [hiCustomer, setHiCustomer] = useState(-1);
const [riderSearch, setRiderSearch] = useState('');
const [showRiderDrop, setShowRiderDrop] = useState(false);
const [tcSearch, setTcSearch] = useState('');
const [showTcDrop, setShowTcDrop] = useState(false);
const [bookerSearch, setBookerSearch] = useState('');
const [showBookerDrop, setShowBookerDrop] = useState(false);
const [hiProduct, setHiProduct] = useState(-1);
const justAddedRef = useRef(false);
const lastQtyRef = useRef(null);
const prodSearchRef = useRef(null);
const pickCustomer = (c) => {
  const cid = c.id; const cName = c.name;
  const pastInvs = invoices.filter(inv => inv.customerId === cid).sort((a,b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
  const lastInv = pastInvs[0];
  setCurrentInvoice(prev => ({ ...prev, customerId: cid, customerName: cName, vehicle: lastInv ? (lastInv.vehicle || VEHICLES[0]) : VEHICLES[0], transportCompany: lastInv && isTransportMethod(vehicleTypes, lastInv.vehicle) ? (lastInv.transportCompany || '') : '', biltyNumber: lastInv && isTransportMethod(vehicleTypes, lastInv.vehicle) ? (lastInv.biltyNumber || '') : '', driverName: lastInv ? (lastInv.driverName || '') : '', driverPhone: lastInv ? (lastInv.driverPhone || '') : '', riderId: lastInv ? (lastInv.riderId || '') : '', deliveryAddressKey: lastInv ? (lastInv.deliveryAddressKey || 'address1') : 'address1', deliveryBilled: lastInv ? (lastInv.deliveryBilled || 0) : 0, transportExpense: lastInv ? (lastInv.transportExpense || 0) : 0 }));
  setShowCustomerDrop(false); setHiCustomer(-1);
  setTimeout(() => prodSearchRef.current?.focus(), 80);
};
const startNewInvoice = () => {
setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' });
setCustomerSearch(''); setShowCustomerDrop(false);
setRiderSearch(''); setShowRiderDrop(false);
setBillingView('form');
};
useEffect(() => {
  if (justAddedRef.current && lastQtyRef.current) {
    justAddedRef.current = false;
    lastQtyRef.current.focus();
    lastQtyRef.current.select();
  }
}, [currentInvoice?.items?.length]);
const saveInvoice = async (status) => {
if(!currentInvoice.customerId || currentInvoice.items.length === 0) return showToast("Customer and items are required", "error");
const grandTotal = invoiceTotal(currentInvoice);
const activeCustomer = customers.find(c => c.id === currentInvoice.customerId);
const enrichedItems = currentInvoice.items.map(item => {
  if (item.unit && item.unitsInBox) return item;
  const nameLower = (item.name || '').toLowerCase().trim();
  const prod = products.find(p =>
    (item.productId && String(p.id) === String(item.productId)) ||
    (item.uniqueId && String(p.id) === String(item.uniqueId)) ||
    (nameLower && p.name?.toLowerCase().trim() === nameLower) ||
    (nameLower && p.name?.toLowerCase().trim().startsWith(nameLower.slice(0, 10)))
  );
  return { ...item, unit: item.unit || prod?.unit || '', unitsInBox: item.unitsInBox || prod?.unitsInBox || 1 };
});
// Strip logistics fields the chosen method cannot use, so details carried over from a
// previous order can't ride along invisibly. Only erase when the method is positively
// classified: if its vehicle type was renamed or deleted after this invoice was written
// we cannot tell what it used, and blanking a real consignment number would be data loss.
const known = isKnownVehicleType(vehicleTypes, currentInvoice.vehicle);
const usesCourier = isTransportMethod(vehicleTypes, currentInvoice.vehicle);
const dropCourier = known && !usesCourier;
const dropPerson  = known && !usesCarrierPerson(currentInvoice.vehicle);
const finalInvoice = { ...currentInvoice,
  transportCompany: dropCourier ? '' : (currentInvoice.transportCompany || ''),
  biltyNumber:      dropCourier ? '' : (currentInvoice.biltyNumber || ''),
  driverName:       dropPerson  ? '' : (currentInvoice.driverName || ''),
  driverPhone:      dropPerson  ? '' : (currentInvoice.driverPhone || ''),
  riderId:          dropPerson  ? '' : (currentInvoice.riderId || ''),
  items: enrichedItems, total: grandTotal, status: status, salespersonId: currentUser.id, salespersonName: currentUser.name, customerDetails: activeCustomer ? { contactPerson: activeCustomer.contactPerson || '', phone: activeCustomer.phone || '', address1: activeCustomer.address1 || activeCustomer.address || '', map1: activeCustomer.map1 || '', address2: activeCustomer.address2 || '', map2: activeCustomer.map2 || '' } : {} };
if (!finalInvoice.id) {
  const prefix = status === 'Estimate' ? 'EST' : status === 'Booked' ? 'ORD' : 'INV';
  const clientGuess = getNextSeqNum(invoicesRaw, prefix);
  const nextNum = (await claimDocNumber(prefix, clientGuess)) ?? clientGuess;
  finalInvoice.id = `${prefix}-${String(nextNum).padStart(4, '0')}`;
  if (!finalInvoice.date) finalInvoice.date = getLocalDateStr();
}
await saveToFirebase('invoices', finalInvoice.id, finalInvoice);
// `currentInvoice.id` is only set when editing, which is also what decides the toast below.
await logSave('invoices', currentInvoice.id ? invoices.find(o => o.id === finalInvoice.id) : null, finalInvoice, finalInvoice.id);
const statusLabels = { Estimate: 'Estimate', Booked: 'Draft Order', Billed: 'Invoice' };
const label = statusLabels[status] || status;
showToast(currentInvoice.id ? `${label} Updated` : `${label} Saved`);
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
const editingStatus = currentInvoice.status || '';
const grandTotal = invoiceTotal(currentInvoice);
const formTypeLabel = isEdit
  ? (editingStatus === 'Estimate' ? 'Edit Estimate' : editingStatus === 'Booked' ? 'Edit Draft Order' : editingStatus === 'CreditNote' ? 'Credit Note' : `Edit Invoice`)
  : (statusFilter === 'Estimate' ? 'New Estimate / Quotation' : statusFilter === 'Booked' ? 'New Draft Order' : 'New Invoice');
const canSaveAsEstimate = !isEdit || editingStatus === 'Estimate' || editingStatus === 'Booked';
return (
<div className="h-full flex flex-col bg-slate-50 absolute inset-0 z-20 animate-slide-up" onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); saveInvoice('Billed'); } }}>
<div className="bg-white/80 backdrop-blur-md p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
<div><h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{isEdit ? `${formTypeLabel} — ${currentInvoice.id}` : formTypeLabel}</h2><input type="date" value={currentInvoice.date || getLocalDateStr()} onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})} className="text-[11px] font-bold text-slate-500 bg-transparent border-0 outline-none cursor-pointer hover:text-indigo-600 transition-colors mt-0.5 p-0" /></div>
<button onClick={() => setBillingView('list')} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><X size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto p-4 space-y-5 pb-4">
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Users size={12}/> Select Customer</h3>
<div className="flex gap-2 items-center">
<div className="relative flex-1">
  <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none z-10"/>
  <input
    autoFocus={!currentInvoice.customerId}
    className={`pl-10 ${inputClass}`}
    placeholder="Search client…"
    value={showCustomerDrop ? customerSearch : (customers.find(c => c.id === currentInvoice.customerId)?.name || '')}
    onFocus={() => { setShowCustomerDrop(true); setCustomerSearch(''); setHiCustomer(-1); }}
    onChange={e => { setCustomerSearch(e.target.value); setHiCustomer(-1); }}
    onBlur={() => setTimeout(() => { setShowCustomerDrop(false); setHiCustomer(-1); }, 150)}
    onKeyDown={e => {
      const filtC = customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()));
      if (e.key === 'ArrowDown') { e.preventDefault(); setHiCustomer(h => Math.min(h + 1, filtC.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHiCustomer(h => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hiCustomer >= 0 && filtC[hiCustomer]) pickCustomer(filtC[hiCustomer]); else if (filtC.length === 1) pickCustomer(filtC[0]); }
      else if (e.key === 'Escape') { setShowCustomerDrop(false); setHiCustomer(-1); }
    }}
  />
  {showCustomerDrop && (
    <div className="absolute z-50 w-full mt-1 border border-indigo-200 bg-white rounded-xl max-h-52 overflow-y-auto shadow-lg">
      {customers
        .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
        .map((c, idx) => (
          <button
            type="button"
            key={c.id}
            data-cust-idx={idx}
            className={`w-full text-left px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors ${c.id === currentInvoice.customerId ? 'bg-indigo-50 text-indigo-700' : idx === hiCustomer ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800 hover:bg-indigo-50'}`}
            onMouseDown={e => { e.preventDefault(); pickCustomer(c); }}
          >{c.name}</button>
        ))
      }
      {customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
        <p className="px-4 py-3 text-sm text-slate-400 font-medium">No clients found</p>
      )}
    </div>
  )}
</div>
{hasPermission('addCustomers') && <button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-black shrink-0 transition-colors"><Plus size={18}/></button>}
{currentInvoice.customerId && <button type="button" onClick={() => { setSelectedLedgerId(currentInvoice.customerId); setShowLedgerModal(true); }} className="p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl shrink-0 transition-colors" title="View Customer Ledger"><BookOpen size={18}/></button>}
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
        <span>{overLimit ? `⚠ Credit limit exceeded! Balance Rs.${bal.toLocaleString('en-US')} ≥ limit Rs.${limit.toLocaleString('en-US')}` : `Outstanding balance: Rs.${bal.toLocaleString('en-US')}${limit > 0 ? ` (limit: Rs.${limit.toLocaleString('en-US')})` : ''}`}</span>
      </div>
    );
  }
  return null;
})()}
</div>
{currentInvoice.customerId && (() => {
  const cust = customers.find(c => c.id === currentInvoice.customerId);
  if (!cust?.address2) return null;
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><MapPin size={12}/> Delivery Address</h3>
      <div className="space-y-2">
        {[{key:'address1',label:'Primary',address:cust.address1},{key:'address2',label:'Secondary',address:cust.address2}].map(opt=>(
          <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${currentInvoice.deliveryAddressKey===opt.key?'bg-indigo-50 border-indigo-300':'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
            <input type="radio" name="deliveryAddress" className="mt-0.5 accent-indigo-600" checked={currentInvoice.deliveryAddressKey===opt.key} onChange={()=>setCurrentInvoice({...currentInvoice,deliveryAddressKey:opt.key})} />
            <div><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{opt.label}</span><p className="text-sm font-semibold text-slate-700 mt-0.5 leading-snug">{opt.address}</p></div>
          </label>
        ))}
      </div>
    </div>
  );
})()}
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Package size={12}/> Products{currentInvoice.items.length > 0 && <span className="ml-1 text-indigo-600 font-bold normal-case tracking-normal">{currentInvoice.items.length} SKU{currentInvoice.items.length !== 1 ? 's' : ''} · {currentInvoice.items.reduce((s,i)=>s+(i.quantity||0),0)} units</span>}</h3>
<div className="flex gap-2 items-center mb-4">
  <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-400"/><input ref={prodSearchRef} placeholder="Search to add..." className={`pl-10 ${inputClass}`} value={prodSearch} onChange={e=>{ setProdSearch(e.target.value); setHiProduct(-1); }} onKeyDown={e => { const filtP = products.filter(p => p.available && !p.archived && p.name.toLowerCase().includes(prodSearch.toLowerCase())); if (e.key === 'ArrowDown') { e.preventDefault(); setHiProduct(h => Math.min(h + 1, filtP.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHiProduct(h => Math.max(h - 1, 0)); } else if (e.key === 'Enter') { e.preventDefault(); const p = hiProduct >= 0 ? filtP[hiProduct] : filtP.length === 1 ? filtP[0] : null; if (p) { justAddedRef.current = true; handleAddItem(p, false); setProdSearch(''); setHiProduct(-1); } } else if (e.key === 'Escape') { setProdSearch(''); setHiProduct(-1); } }} /></div>
  {hasPermission('addEditProducts') && <button type="button" onClick={() => { setProductPreFill(prodSearch.trim()); setEditingProduct(null); setShowProductModal(true); }} className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 active:scale-95 transition-all" title="Register a new product"><Plus size={14}/> New</button>}
</div>
{prodSearch && (
<div className="border border-indigo-200 bg-indigo-50/50 rounded-xl mb-4 max-h-48 overflow-y-auto p-2 space-y-1 shadow-inner">
{products.filter(p => p.available && !p.archived && p.name.toLowerCase().includes(prodSearch.toLowerCase())).map((p, idx) => (
<div key={p.id} className={`p-2 rounded-lg shadow-sm border flex justify-between items-center group ${idx === hiProduct ? 'bg-indigo-100 border-indigo-300' : 'bg-white border-indigo-100'}`}>
<button type="button" className="flex-1 font-semibold text-sm text-slate-800 text-left hover:text-indigo-600 transition-colors" onClick={() => { justAddedRef.current = true; handleAddItem(p, false); setProdSearch(''); setHiProduct(-1); }}><span>{p.name}</span><span className="text-indigo-600 font-bold ml-2">Rs.{p.sellingPrice}</span></button>
<button onClick={() => handleAddItem(p, true)} className="px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 rounded font-bold hover:bg-emerald-100 transition-colors ml-2">🎁 Bonus</button>
</div>
))}
</div>
)}
<div className="space-y-3">
{currentInvoice.items.map((item, idx) => {
const itemKey = item.uniqueId || item.productId;
return (
<div key={itemKey} data-item-row="1" className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-start mb-2">
<p className="font-bold text-sm text-slate-800 leading-tight">{item.name}{item.isBonus && <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-200">Bonus</span>}</p>
<button tabIndex={-1} onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.filter(i => (i.uniqueId || i.productId) !== itemKey)})} className="text-slate-400 hover:text-rose-500"><X size={16}/></button>
</div>
<div className="flex items-center justify-between">
<div className="flex flex-col">
<label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">Rate (Rs)</label>
<input type="number" className="w-24 p-1.5 text-sm font-extrabold text-indigo-700 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" value={item.price} disabled={item.isBonus} onChange={(e) => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, price: Number(e.target.value)} : i)})} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const q = e.target.closest('[data-item-row]')?.querySelector('[data-item-qty]'); q?.focus(); q?.select(); } }} />
{item.isBonus && <span className="text-[9px] text-slate-400 font-medium line-through mt-0.5">Rs. {item.originalPrice}</span>}
</div>
<div className="flex flex-col items-center">
<label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Quantity</label>
<div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
<button tabIndex={-1} onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: i.quantity - 1} : i).filter(i=>i.quantity>0)})} className="w-8 h-8 rounded-md bg-slate-50 text-slate-600 font-bold hover:bg-slate-100 transition-colors">-</button>
<input data-item-qty="1" type="number" ref={idx === currentInvoice.items.length - 1 ? lastQtyRef : null} className="w-12 text-center text-sm font-bold bg-transparent outline-none appearance-none" value={item.quantity} onChange={(e) => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: Number(e.target.value)} : i)})} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); prodSearchRef.current?.focus(); } }} />
<button tabIndex={-1} onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.map(i => (i.uniqueId || i.productId) === itemKey ? {...i, quantity: i.quantity + 1} : i)})} className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">+</button>
</div>
</div>
</div>
</div>
)})}
</div>
</div>
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Truck size={12}/> Logistics</h3>
<div className="mb-3"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Vehicle / Transport Method</label><select className={inputClass} value={currentInvoice.vehicle} onChange={e => { const v = e.target.value; setCurrentInvoice({...currentInvoice, vehicle: v, ...(isTransportMethod(vehicleTypes, v) ? {} : { transportCompany: '', biltyNumber: '' }), ...(usesCarrierPerson(v) ? {} : { driverName: '', driverPhone: '', riderId: '' })}); }}>{(vehicleTypes.length ? vehicleTypes : [{name:'Rider'},{name:'Rickshaw'},{name:'Suzuki'},{name:'Intercity Transport'},{name:'Self-Pickup'}]).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>
{(isTransportMethod(vehicleTypes, currentInvoice.vehicle) || (!isKnownVehicleType(vehicleTypes, currentInvoice.vehicle) && (currentInvoice.transportCompany || currentInvoice.biltyNumber))) && (
<div className="grid grid-cols-2 gap-3 mb-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
{transportCompanies.filter(c => c.transportType === currentInvoice.vehicle).length > 0 && (
  <div className="col-span-2">
    <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Pick from Registry</label>
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass} !bg-white !border-amber-200`}
        placeholder="Search transport company…"
        value={showTcDrop ? tcSearch : (currentInvoice.transportCompany || '')}
        onFocus={() => { setShowTcDrop(true); setTcSearch(''); }}
        onChange={e => setTcSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowTcDrop(false), 150)}
      />
      {showTcDrop && (
        <div className="absolute z-50 w-full mt-1 border border-amber-200 bg-white rounded-xl max-h-48 overflow-y-auto shadow-lg">
          <div
            className={`px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-amber-50 ${!currentInvoice.transportCompany ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, transportCompany: ''}); setShowTcDrop(false); }}
          >– Clear Company –</div>
          {transportCompanies
            .filter(c => c.transportType === currentInvoice.vehicle && (!tcSearch || c.name.toLowerCase().includes(tcSearch.toLowerCase()) || (c.city||'').toLowerCase().includes(tcSearch.toLowerCase())))
            .map(c => (
              <div
                key={c.id}
                className={`px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-amber-50 ${c.name === currentInvoice.transportCompany ? 'bg-amber-50 text-amber-700' : 'text-slate-800'}`}
                onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, transportCompany: c.name, driverName: c.defaultDriverName || currentInvoice.driverName || '', driverPhone: c.defaultDriverPhone || currentInvoice.driverPhone || ''}); setShowTcDrop(false); }}
              >{c.name}{c.city ? ` · ${c.city}` : ''}</div>
            ))
          }
          {transportCompanies.filter(c => c.transportType === currentInvoice.vehicle && (!tcSearch || c.name.toLowerCase().includes(tcSearch.toLowerCase()) || (c.city||'').toLowerCase().includes(tcSearch.toLowerCase()))).length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400 font-medium">No companies found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Transport Company</label><input placeholder="e.g. Daewoo Express" className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.transportCompany || ''} onChange={e => setCurrentInvoice({...currentInvoice, transportCompany: e.target.value})} /></div>
<div className="col-span-2"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Consignment No. (Bill of Transport)</label><input placeholder="No. on the transport receipt" className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.biltyNumber || ''} onChange={e => setCurrentInvoice({...currentInvoice, biltyNumber: e.target.value})} /></div>
<div className="col-span-2 pt-1 border-t border-amber-200/70">
  <p className="text-[9px] font-semibold text-amber-700/80 leading-snug mb-1.5 ml-1">Who took the stock to the transport office — one of your own riders, or by hand.</p>
</div>
{riders.length > 0 && (
  <div className="col-span-2">
    <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Pick Booking Person</label>
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass} !bg-white !border-amber-200`}
        placeholder="Search rider / rickshaw / driver…"
        value={showBookerDrop ? bookerSearch : (currentInvoice.driverName || '')}
        onFocus={() => { setShowBookerDrop(true); setBookerSearch(''); }}
        onChange={e => setBookerSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowBookerDrop(false), 150)}
      />
      {showBookerDrop && (
        <div className="absolute z-50 w-full mt-1 border border-amber-200 bg-white rounded-xl max-h-48 overflow-y-auto shadow-lg">
          <div className="px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-amber-50 text-slate-400"
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: '', driverPhone: ''}); setShowBookerDrop(false); }}
          >– Clear –</div>
          <div className="px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-amber-50 text-slate-800"
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: 'By Hand', driverPhone: ''}); setShowBookerDrop(false); }}
          >By Hand</div>
          {/* Any rider, whatever their vehicle — the person who runs stock to the courier
              office may be a rider, a rickshaw driver or a Suzuki driver. */}
          {riders.filter(r => !bookerSearch || r.name.toLowerCase().includes(bookerSearch.toLowerCase())).map(r => (
            <div key={r.id}
              className={`px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-amber-50 ${String(r.id) === String(currentInvoice.riderId) ? 'bg-amber-50 text-amber-700' : 'text-slate-800'}`}
              onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: r.id, driverName: r.name, driverPhone: r.phone || ''}); setShowBookerDrop(false); }}
            >{r.name} <span className="text-[10px] text-slate-400">· {r.vehicleType}</span></div>
          ))}
          {riders.filter(r => !bookerSearch || r.name.toLowerCase().includes(bookerSearch.toLowerCase())).length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400 font-medium">No riders found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Booked By (Rider / Driver)</label><input placeholder="Name, or 'By Hand'" className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.driverName || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverName: e.target.value, riderId: ''})} /></div>
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider ml-1 mb-1 block">Their Phone</label><input placeholder="03XX..." className={`${inputClass} !bg-white !border-amber-200`} value={currentInvoice.driverPhone || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverPhone: e.target.value})} /></div>
</div>
)}
{(vehicleTypes.find(v => v.name === currentInvoice.vehicle)?.requiresRider ?? ['Rider','Rickshaw','Suzuki'].includes(currentInvoice.vehicle)) && (
<div className="grid grid-cols-2 gap-3 mb-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
{riders.filter(r => r.vehicleType === currentInvoice.vehicle).length > 0 && (
  <div className="col-span-2">
    <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider ml-1 mb-1 block">Pick from Registry</label>
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass} !bg-white !border-indigo-200`}
        placeholder="Search rider…"
        value={showRiderDrop ? riderSearch : (riders.find(r => String(r.id) === String(currentInvoice.riderId))?.name || '')}
        onFocus={() => { setShowRiderDrop(true); setRiderSearch(''); }}
        onChange={e => setRiderSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowRiderDrop(false), 150)}
      />
      {showRiderDrop && (
        <div className="absolute z-50 w-full mt-1 border border-indigo-200 bg-white rounded-xl max-h-48 overflow-y-auto shadow-lg">
          <div
            className={`px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-indigo-50 ${!currentInvoice.riderId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: '', driverPhone: ''}); setShowRiderDrop(false); }}
          >– Clear Rider –</div>
          {riders
            .filter(r => r.vehicleType === currentInvoice.vehicle && (!riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase())))
            .map(r => (
              <div
                key={r.id}
                className={`px-4 py-2.5 text-sm font-semibold cursor-pointer hover:bg-indigo-50 ${String(r.id) === String(currentInvoice.riderId) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}
                onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: r.id, driverName: r.name, driverPhone: r.phone || ''}); setShowRiderDrop(false); }}
              >{r.name}{r.vehicleNumber ? ` (${r.vehicleNumber})` : ''}</div>
            ))
          }
          {riders.filter(r => r.vehicleType === currentInvoice.vehicle && (!riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase()))).length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400 font-medium">No riders found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider ml-1 mb-1 block">Rider / Driver Name</label><input placeholder="Name, or 'By Hand'" className={`${inputClass} !bg-white !border-indigo-200`} value={currentInvoice.driverName || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverName: e.target.value, riderId: ''})} /></div>
<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider ml-1 mb-1 block">Rider / Driver Phone</label><input placeholder="03XX..." className={`${inputClass} !bg-white !border-indigo-200`} value={currentInvoice.driverPhone || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverPhone: e.target.value})} /></div>
</div>
)}
<div className="grid grid-cols-3 gap-2 mb-2">
<div><label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider ml-1 mb-1 block">Delivery (+)</label><input type="number" className={inputClass} value={currentInvoice.deliveryBilled} onChange={e => setCurrentInvoice({...currentInvoice, deliveryBilled: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Driver Exp (-)</label><input type="number" className={inputClass} value={currentInvoice.transportExpense} onChange={e => setCurrentInvoice({...currentInvoice, transportExpense: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider ml-1 mb-1 block">Discount (-)</label><input type="number" className={inputClass} value={currentInvoice.discount || ''} placeholder="0" onChange={e => setCurrentInvoice({...currentInvoice, discount: Number(e.target.value) || 0})} /></div>
</div>
{hasPermission('collectOnBill') && (
<div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block mb-2">Payment Received</label>
<div className="flex items-center gap-2">
<input type="number" className="w-full p-3 bg-white border border-slate-300 rounded-xl font-extrabold text-emerald-600 text-lg outline-none" value={currentInvoice.receivedAmount || ''} onChange={e => setCurrentInvoice({...currentInvoice, receivedAmount: Number(e.target.value), paymentStatus: Number(e.target.value) >= grandTotal ? 'Paid' : (Number(e.target.value)>0 ? 'Partial' : 'Pending')})} placeholder="0.00" />
<button onClick={() => setCurrentInvoice({...currentInvoice, receivedAmount: grandTotal, paymentStatus: 'Paid'})} className="px-4 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs whitespace-nowrap border border-indigo-100">Full Pay</button>
</div>
</div>
)}
</div>
<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
<h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlignLeft size={12}/> Notes / Remarks</h3>
<textarea rows={3} placeholder="e.g. Special instructions, delivery notes, payment terms..." className={`${inputClass} resize-none`} value={currentInvoice.notes || ''} onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})} />
</div>
<div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100 text-center shadow-sm">
<p className="text-emerald-600 font-bold uppercase text-[10px] tracking-widest mb-1">Grand Total</p>
<p className="text-4xl font-black text-emerald-800 tracking-tight">Rs. {grandTotal.toLocaleString('en-US')}</p>
</div>
{isEdit && isAdmin && (<button onClick={async () => { const reason = await showPrompt(`Void ${currentInvoice.id}?\n\nIt stays on file and drops out of every balance and report.`, { placeholder: 'e.g. duplicate entry' }); if (reason === null) return; /* void what is stored, not the half-edited form state */ const stored = invoices.find(o => o.id === currentInvoice.id) || currentInvoice; await voidRecord('invoices', stored, { label: stored.id, reason }); showToast(`${currentInvoice.id} voided`); setBillingView('list'); }} className="w-full bg-white text-rose-600 font-bold p-4 rounded-xl flex justify-center items-center gap-2 border border-rose-200 hover:bg-rose-50 shadow-sm mt-4"><Trash2 size={18}/> Void {editingStatus === 'Estimate' ? 'Estimate' : editingStatus === 'Booked' ? 'Draft Order' : 'Invoice'}</button>)}
</div>
<div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shrink-0 space-y-2">
{canSaveAsEstimate && <button onClick={() => saveInvoice('Estimate')} className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2 active:scale-95 transition-all text-sm"><FileText size={16}/> Save as Estimate / Quotation</button>}
<div className="flex gap-3">
{canSaveAsEstimate && <button onClick={() => saveInvoice('Booked')} className="flex-1 bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2 active:scale-95 transition-all hover:bg-slate-50"><Save size={18}/> Draft Order</button>}
<button onClick={() => saveInvoice('Billed')} className={`${canSaveAsEstimate ? 'flex-[2]' : 'flex-1'} bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-md flex justify-center items-center gap-2 active:scale-95 transition-all`}><ReceiptText size={18}/> {isEdit && editingStatus === 'Billed' ? 'Update Invoice' : 'Issue Invoice'}</button>
</div>
</div>
</div>
);
}
const ownOnly = !isAdmin && !currentUser?.permissions?.viewAllInvoices;
const filtered = invoices.filter(o =>
  (!ownOnly || String(o.salespersonId) === String(currentUser?.id)) &&
  (o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search)) &&
  checkDateFilter(o.date, dateFilter) &&
  (statusFilter === 'All' || o.status === statusFilter)
);
return (
<div className="p-4 flex flex-col h-full">
<div className="flex gap-2 mb-4">
<div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Invoices..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
{statusFilter === 'CreditNote'
  ? hasPermission('salesReturns') && <button onClick={() => { setEditingCreditNote({ customerId: '', id: '' }); setShowCreditNoteModal(true); }} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-3 rounded-xl shadow-md font-bold flex items-center gap-1.5 active:scale-95 whitespace-nowrap"><RotateCcw size={16}/> New Return</button>
  : <button onClick={startNewInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl shadow-md font-bold flex items-center gap-1.5 active:scale-95"><Plus size={18}/> New</button>
}
</div>
<div className="flex items-center gap-2 mb-3"><Calendar size={18} className="text-slate-400" /><select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-white border border-slate-200 px-3 py-2 rounded-lg font-bold text-sm text-slate-700 outline-none flex-1"><option>All Time</option><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option></select></div>
<div className="flex gap-1.5 mb-4">
{[{v:'All',l:'All'},{v:'Estimate',l:'Quotes'},{v:'Booked',l:'Orders'},{v:'Billed',l:'Invoices'},{v:'CreditNote',l:'Returns'}].map(({v,l}) => (
<button key={v} data-billingstatus={v} tabIndex={statusFilter===v?0:-1}
  onClick={() => setStatusFilter(v)}
  onKeyDown={makeArrowNav(['All','Estimate','Booked','Billed','CreditNote'],statusFilter,setStatusFilter,'data-billingstatus')}
  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${statusFilter===v ? (v==='Estimate'?'bg-violet-600 text-white':v==='Booked'?'bg-amber-500 text-white':v==='Billed'?'bg-indigo-600 text-white':v==='CreditNote'?'bg-rose-600 text-white':'bg-slate-800 text-white') : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>{l}</button>
))}
</div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{filtered.slice().sort((a, b) => {
  const d = (b.date||'').localeCompare(a.date||'');
  if (d !== 0) return d;
  return (parseInt((b.id||'').replace(/\D/g,''))||0) - (parseInt((a.id||'').replace(/\D/g,''))||0);
}).map(o => (
<div key={o.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200">
<div className={`absolute top-0 left-0 w-1.5 h-full ${o.status==='CreditNote'?'bg-rose-500':o.status==='Estimate'?'bg-violet-400':o.status==='Billed'?(getPaymentStatus(o)==='Paid'?'bg-emerald-500':'bg-amber-500'):'bg-slate-300'}`}></div>
<div className="flex justify-between border-b border-slate-100 pb-3 mb-3 pl-3">
<div><h4 className="font-bold text-slate-800 text-sm">{o.customerName}</h4><p className="text-[11px] text-slate-500 font-medium mt-0.5">{o.id} • {formatDateDisp(o.date)} • <span className={`font-bold ${o.status==='Billed'?'text-indigo-600':o.status==='Estimate'?'text-violet-600':o.status==='CreditNote'?'text-rose-600':'text-amber-500'}`}>{o.status==='CreditNote'?'Credit Note':o.status==='Booked'?'Draft Order':o.status}</span></p></div>
<div className="text-right"><p className={`font-extrabold text-base ${o.status==='CreditNote'?'text-rose-600':'text-indigo-700'}`}>{o.status==='CreditNote'?'-':''} Rs. {o.total.toLocaleString('en-US')}</p><p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${o.status==='Billed'?'text-indigo-500':o.status==='CreditNote'?'text-rose-500':'text-slate-400'}`}>{o.status==='CreditNote'?'Credit Note':o.status==='Booked'?'Draft Order':o.status}</p></div>
</div>
<div className="flex justify-between items-center pl-3">
<div className="flex items-center gap-2"><span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${getPaymentStatus(o)==='Paid'?'bg-emerald-100 text-emerald-700':o.paymentStatus==='Partial'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>{o.paymentStatus}</span></div>
<div className="flex gap-1.5">
{o.status === 'Estimate' && hasPermission('issueInvoices') && <button onClick={async () => { await saveToFirebase('invoices', o.id, {...o, status: 'Booked'}); showToast('Converted to Draft Order'); }} title="Convert to Draft Order" className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 rounded-lg"><Save size={14}/></button>}
{(o.status === 'Estimate' || o.status === 'Booked') && hasPermission('issueInvoices') && <button onClick={async () => { const invGuess = getNextSeqNum(invoicesRaw, 'INV'); const invNum = (await claimDocNumber('INV', invGuess)) ?? invGuess; const newId = `INV-${String(invNum).padStart(4, '0')}`; const issued = {...o, id: newId, status: 'Billed', date: getLocalDateStr()}; await saveToFirebase('invoices', newId, issued); await logSave('invoices', null, issued, newId); await deleteFromFirebase('invoices', o.id); await logDelete('invoices', o, `Issued as ${newId}`, o.id); showToast(`Converted to Invoice: ${newId}`); }} title="Issue as Invoice" className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg"><ReceiptText size={14}/></button>}
{o.status === 'Billed' && hasPermission('salesReturns') && <button onClick={() => { setEditingCreditNote({customerId: o.customerId, id: o.id}); setShowCreditNoteModal(true); }} title="Issue Credit Note / Return" className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 rounded-lg"><RotateCcw size={14}/></button>}
{(hasPermission('viewLedger') || String(o.salespersonId) === String(currentUser?.id)) && <button onClick={() => { setSelectedLedgerId(o.customerId); setShowLedgerModal(true); }} title="Customer Ledger" className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg"><BookOpen size={14}/></button>}
{(isAdmin || (hasPermission('editOwnInvoices') && String(o.salespersonId) === String(currentUser?.id))) && o.status !== 'CreditNote' && <button onClick={() => { setCurrentInvoice(o); setBillingView('form'); }} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg"><Edit size={16}/></button>}
{isAdmin && <button onClick={async () => { const reason = await showPrompt(`Void ${o.id}?\n\nIt stays on file and drops out of every balance and report.`, { placeholder: 'e.g. duplicate entry' }); if (reason === null) return; await voidRecord('invoices', o, { label: o.id, reason }); showToast(`${o.id} voided`); }} title="Void" className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg"><Trash2 size={16}/></button>}
{o.status === 'Estimate' ? <button onClick={() => setPrintConfig({docType: 'estimate', format: 'a4', data: o})} title="View Estimate" className="p-2 bg-violet-50 text-violet-600 hover:bg-violet-100 rounded-lg"><FileText size={16}/></button> : o.status === 'Booked' ? <><button onClick={() => setPrintConfig({docType: 'dispatch', format: 'thermal', data: o})} title="Dispatch Note" className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Truck size={16}/></button><button onClick={() => setPrintConfig({docType: 'estimate', format: 'a4', data: o})} title="View Order" className="p-2 bg-slate-50 text-slate-600 rounded-lg"><FileText size={16}/></button></> : o.status === 'CreditNote' ? <button onClick={() => setPrintConfig({docType: 'creditnote', format: 'a4', data: o})} title="Print Credit Note" className="p-2 bg-rose-50 text-rose-600 rounded-lg"><FileText size={16}/></button> : <><button onClick={() => setPrintConfig({docType: 'dispatch', format: 'thermal', data: o})} title="Dispatch" className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Truck size={16}/></button><button onClick={() => setPrintConfig({docType: 'invoice', format: 'thermal', data: o})} title="Print" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ReceiptText size={16}/></button></>}
</div>
</div>
</div>
))}
</div>
</div>
);
};

const ProductsTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [search, setSearch] = useState('');
return (
<div className="p-4 flex flex-col h-full">
<div className="flex gap-2 mb-4">
<div className="relative flex-1"><Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} /><input placeholder="Search Inventory..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-semibold outline-none shadow-sm text-sm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
<button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="bg-indigo-600 text-white p-3 rounded-xl shadow-md"><Plus size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
<div key={p.id} className={`p-4 rounded-2xl border shadow-sm ${p.archived ? 'bg-amber-50/40 border-amber-200 opacity-75' : 'bg-white border-slate-200'}`}>
<div className="flex justify-between items-start mb-3">
<div><h4 className="font-bold text-slate-800 text-base leading-tight">{p.name}{p.archived && <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full uppercase align-middle">Archived</span>}</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">{getCompanyName(p.companyId)} • {p.unit} ({p.unitsInBox})</p></div>
{isAdmin && (<div className="flex gap-1.5"><button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><Edit size={16}/></button>
{p.archived
  ? <button onClick={async () => { await saveToFirebase('products', p.id, { ...p, archived: false }); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors" title="Unarchive"><RotateCcw size={16}/></button>
  : <button onClick={async () => {
      const billCount = invoices.filter(inv => inv.items?.some(it => String(it.productId||it.uniqueId||'') === String(p.id))).length;
      if (billCount > 0) {
        const doArchive = await showConfirm(`"${p.name}" is used in ${billCount} bill${billCount>1?'s':''}.\n\nArchive instead? (Hidden from new sales, preserved in history)`);
        if (doArchive) { await saveToFirebase('products', p.id, { ...p, archived: true, available: false }); return; }
        if (!await showConfirm(`Permanently delete "${p.name}"? Cannot be undone.`)) return;
      } else { if (!await showConfirm(`Delete ${p.name}?`)) return; }
      await deleteFromFirebase('products', p.id);
    }} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
}</div>)}
</div>
<div className="flex justify-between items-end border-t border-slate-100 pt-3 mt-1">
<div className="flex flex-col"><span className="text-indigo-700 font-extrabold text-lg">Rs. {p.sellingPrice.toLocaleString('en-US')}</span>{isAdmin && <span className="text-slate-400 text-[9px] font-bold uppercase mt-0.5">Cost: Rs. {p.costPrice}</span>}</div>
{isAdmin ? (<button onClick={async () => { await saveToFirebase('products', p.id, {...p, available: !p.available}) }} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase ${p.available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{p.available ? 'In Stock' : 'Out Stock'}</button>) : (<span className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase ${p.available ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{p.available ? 'In Stock' : 'Out Stock'}</span>)}
</div>
</div>
))}
</div>
</div>
);
};

const PaymentsTab = () => {
const { isAdmin, hasPermission, currentUser, customers, payments, invoices, deleteFromFirebase, saveToFirebase, showToast, setShowPaymentModal, setSelectedCustomerForPayment, setEditingPayment, showConfirm, setPrintConfig, getCustomerLedger, generateReceiptData, showPrompt, voidRecord, logSave } = useContext(AppContext);
const canReceive = hasPermission('receivePayments');
// Staff without viewAllInvoices only see payments from their own customers.
// Wrapped in useMemo so the Set reference is stable between renders —
// allPayments useMemo depends on it and would re-run on every render otherwise.
const myCustomerIds = useMemo(() => {
  if (isAdmin || currentUser?.permissions?.viewAllInvoices) return null;
  return new Set(invoices.filter(inv => String(inv.salespersonId) === String(currentUser?.id)).map(inv => String(inv.customerId)));
}, [isAdmin, currentUser, invoices]);
const [search, setSearch] = useState('');
const [dateFilter, setDateFilter] = useState('This Month');
const [customerFilter, setCustomerFilter] = useState('');
const allPayments = useMemo(() => {
  const standalone = payments
    .filter(p => !myCustomerIds || myCustomerIds.has(String(p.customerId)))
    .map(p => ({
      id: p.id, date: p.date, customerId: p.customerId,
      customerName: customers.find(c => c.id === p.customerId)?.name || 'Unknown',
      amount: Number(p.amount), note: p.note || 'Payment', type: 'receipt', raw: p
    }));
  const invPays = invoices
    .filter(inv => Number(inv.receivedAmount) > 0 && (!myCustomerIds || myCustomerIds.has(String(inv.customerId))))
    .map(inv => ({
      id: `${inv.id}-PAY`, date: inv.date, customerId: inv.customerId,
      customerName: inv.customerName, amount: Number(inv.receivedAmount),
      note: `On Invoice ${inv.id}`, type: 'invoice', raw: inv
    }));
  return [...standalone, ...invPays].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}, [payments, invoices, customers, myCustomerIds]);
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
    {canReceive && (
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
      <SearchableSelect value={customerFilter} onChange={e=>setCustomerFilter(e.target.value)} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg font-semibold text-sm text-slate-700 outline-none shadow-sm" placeholder="All Clients" options={customers.map(c=>({value:String(c.id),label:c.name}))} />
    </div>
  </div>
  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center">
    <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">{filtered.length} Receipts</span>
    <span className="font-black text-emerald-800 text-sm">Total: Rs. {totalAmount.toLocaleString('en-US')}</span>
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
            <p className="font-extrabold text-emerald-600 text-base">Rs. {p.amount.toLocaleString('en-US')}</p>
            <div className="flex gap-1 mt-1.5 justify-end">
              <button onClick={() => {
                const ledger = getCustomerLedger(p.customerId);
                const receiptData = generateReceiptData(ledger, p.id);
                if (receiptData) setPrintConfig({ docType: 'receipt', format: 'thermal', data: receiptData });
              }} title="Print Receipt" className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-100 transition-colors"><Printer size={13}/></button>
              {isAdmin && p.type === 'receipt' && (
                <button onClick={() => { setEditingPayment(p.raw); setSelectedCustomerForPayment(p.customerId); setShowPaymentModal(true); }} className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg border border-slate-200 transition-colors"><Edit size={13}/></button>
              )}
              {isAdmin && (p.type === 'receipt' || p.type === 'invoice') && (
                <button onClick={async()=>{
                  const reason = await showPrompt('Void this payment?\n\nIt stays on file and comes back out of the balance.', { placeholder: 'e.g. recorded against the wrong client' });
                  if(reason === null) return;
                  if(p.type === 'receipt'){
                    await voidRecord('payments', p.raw, { label: p.id, reason });
                  } else {
                    // Cash taken at billing time is a field on the invoice, so this is an edit.
                    const inv = invoices.find(i => i.id === p.raw.id);
                    if(inv) { const after = {...inv, receivedAmount: 0, paymentStatus: 'Pending'}; await saveToFirebase('invoices', inv.id, after); await logSave('invoices', inv, after, inv.id); }
                  }
                  showToast('Payment deleted');
                }} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100 transition-colors"><Trash2 size={13}/></button>
              )}
            </div>
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
const AdminTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
if(!isAdmin) return <div className="p-10 text-center font-bold text-slate-400 flex flex-col items-center mt-20"><Lock className="mb-4 text-slate-300" size={48}/> <p className="text-sm uppercase tracking-widest">Admin Access Required</p></div>;
return (
<div className="h-full flex flex-col">
<div className="px-4 pt-4 pb-2">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-4">Admin Hub</h2>
<div className="bg-slate-200 p-1 rounded-xl">
<ScrollableTabBar bgClass="bg-slate-200">
{[['analytics','bg-white text-indigo-700',<BarChart3 size={14}/>,'Analytics'],['expenses','bg-white text-rose-600',<Wallet size={14}/>,'Expenses'],['masters','bg-white text-teal-600',<Archive size={14}/>,'Masters'],['bulk','bg-white text-emerald-600',<Upload size={14}/>,'Bulk Ops'],['segments','bg-white text-purple-600',<Globe size={14}/>,'Segments'],['users','bg-white text-amber-600',<Users size={14}/>,'Users'],['settings','bg-white text-slate-700',<Settings size={14}/>,'Settings'],['riders','bg-white text-indigo-600',<Truck size={14}/>,'Riders'],['transportCos','bg-white text-amber-700',<Truck size={14}/>,'Transport Cos'],['receivables','bg-white text-rose-600',<Wallet size={14}/>,'Receivables'],['audit','bg-white text-slate-700',<Activity size={14}/>,'Activity']].map(([v,activeClass,icon,label])=>(
  <button key={v} data-admintab={v} tabIndex={adminView===v?0:-1}
    onClick={()=>setAdminView(v)}
    onKeyDown={makeArrowNav(['analytics','expenses','masters','bulk','segments','users','settings','riders','transportCos','receivables','audit'],adminView,setAdminView,'data-admintab')}
    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView===v?activeClass+' shadow-sm':'text-slate-500'}`}>{icon} {label}</button>
))}
</ScrollableTabBar>
</div>
</div>
<div className="flex-1 overflow-hidden">
<div style={{display: adminView === 'analytics' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AnalyticsView /></div>
<div style={{display: adminView === 'expenses' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><ExpensesView /></div>
<div style={{display: adminView === 'masters' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><MastersView /></div>
<div style={{display: adminView === 'bulk' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><BulkOpsView /></div>
<div style={{display: adminView === 'segments' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><SegmentsAdminView /></div>
<div style={{display: adminView === 'users' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><UserManagementView /></div>
<div style={{display: adminView === 'settings' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AppSettingsView /></div>
<div style={{display: adminView === 'riders' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><RidersAdminView /></div>
<div style={{display: adminView === 'transportCos' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><TransportCompaniesManager /></div>
<div style={{display: adminView === 'receivables' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><ReceivablesView /></div>
<div style={{display: adminView === 'audit' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AuditView /></div>
</div>
</div>
)
};


const AnalyticsView = () => {
const { getPaymentStatus, isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, cities, areas, customerTypes, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, analyticsView, setAnalyticsView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [view, setView] = useState(analyticsView || 'Overview');
useEffect(() => { if (analyticsView) { setView(analyticsView); setAnalyticsView(''); } }, [analyticsView]);
const [dateFilter, setDateFilter] = useState('This Month');
const [customStart, setCustomStart] = useState('');
const [customEnd, setCustomEnd] = useState(getLocalDateStr());
const [filterCompanies, setFilterCompanies] = useState(new Set());
const [filterCustomers, setFilterCustomers] = useState(new Set());
const [filterSalespersons, setFilterSalespersons] = useState(new Set());
const toggleFilter = (setter, id) => setter(prev => { const next = new Set(prev); next.has(String(id)) ? next.delete(String(id)) : next.add(String(id)); return next; });
const clearFilter = (setter) => setter(new Set());
const [sortBy, setSortBy] = useState('profit');
const [itemProdFilter, setItemProdFilter] = useState('');
const [itemCustFilter, setItemCustFilter] = useState('');

const checkCustomFilter = (dateStr) => {
  if (dateFilter !== 'Custom') return checkDateFilter(dateStr, dateFilter);
  if (!customStart) return dateStr <= customEnd;
  return dateStr >= customStart && dateStr <= customEnd;
};

const reportEngine = useMemo(() => {
  let billedForPnL = invoices.filter(o => o.status === 'Billed' && checkCustomFilter(o.date));
  if(filterCustomers.size > 0) billedForPnL = billedForPnL.filter(o => filterCustomers.has(String(o.customerId)));
  if(filterSalespersons.size > 0) billedForPnL = billedForPnL.filter(o => filterSalespersons.has(String(o.salespersonId)));
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
      if(filterCompanies.size > 0 && !filterCompanies.has(String(itemCompanyId))) return;
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
  // Credit Note impact — subtract returned values from all metrics (after monthlyData is built)
  const creditNotes = invoices.filter(o => o.status === 'CreditNote' && checkCustomFilter(o.date) && (filterCustomers.size === 0 || filterCustomers.has(String(o.customerId))) && (filterSalespersons.size === 0 || filterSalespersons.has(String(o.salespersonId))));
  creditNotes.forEach(cn => {
    let cnRev = 0, cnCost = 0;
    (cn.items || []).forEach(item => {
      // Bonus lines are NOT skipped. Free stock carries a real costPrice and no price, so
      // giving it away is a loss of its cost — the billed loop above counts it that way —
      // and taking it back must return that cost. Skipping it here expensed returned free
      // stock forever, and left these breakdowns disagreeing with the headline P&L, which
      // computePnL derives symmetrically a few lines below.
      const rev = (item.price || 0) * (item.quantity || 0);
      const cost = (item.costPrice || 0) * (item.quantity || 0);
      const gp = rev - cost;
      cnRev += rev; cnCost += cost;
      kpis.productRevenue -= rev; kpis.totalCOGS -= cost; kpis.grossMargin -= gp;
      kpis.netProfit -= gp;
      const pKey = item.name;
      if (!byProduct[pKey]) byProduct[pKey] = { qty: 0, revenue: 0, cost: 0, profit: 0, company: item.company || '' };
      byProduct[pKey].qty -= (item.quantity || 0); byProduct[pKey].revenue -= rev; byProduct[pKey].cost -= cost; byProduct[pKey].profit -= gp;
      const cmpKey = item.company || 'Unknown';
      if (!byCompany[cmpKey]) byCompany[cmpKey] = { qty: 0, revenue: 0, cost: 0, profit: 0 };
      byCompany[cmpKey].revenue -= rev; byCompany[cmpKey].cost -= cost; byCompany[cmpKey].profit -= gp;
    });
    const cnGP = cnRev - cnCost;
    // Customer breakdown
    if (!byCustomer[cn.customerName]) byCustomer[cn.customerName] = { productRevenue: 0, cost: 0, profit: 0, orders: 0 };
    byCustomer[cn.customerName].productRevenue -= cnRev;
    byCustomer[cn.customerName].cost -= cnCost;
    byCustomer[cn.customerName].profit -= cnGP;
    // Salesperson breakdown
    const cnSp = cn.salespersonName || 'Unknown';
    if (!bySalesperson[cnSp]) bySalesperson[cnSp] = { revenue: 0, profit: 0, orders: 0 };
    bySalesperson[cnSp].revenue -= cnRev; bySalesperson[cnSp].profit -= cnGP;
    // Segment breakdowns
    const cnSeg = custSegment[cn.customerName] || {};
    ['city', 'area', 'type'].forEach(k => {
      const val = cnSeg[k] || 'Unknown';
      const map = k === 'city' ? byCity : k === 'area' ? byArea : byType;
      if (map[val]) { map[val].revenue -= cnRev; map[val].profit -= cnGP; }
    });
    // Monthly trend
    const month = cn.date.slice(0, 7);
    if (monthlyData[month]) { monthlyData[month].revenue -= cnRev; monthlyData[month].cost -= cnCost; monthlyData[month].profit -= cnGP; }
    // Daily breakdown
    if (dailyBreakdown[cn.date]) { dailyBreakdown[cn.date].revenue -= cnRev; dailyBreakdown[cn.date].profit -= cnGP; }
  });
  kpis.creditNotesCount = creditNotes.length;

  // Sales returns, corrected. See services/analytics/profitAndLoss.js.
  //
  // Revenue above comes only from Billed invoices, so a credit note reduced nothing. The
  // P&L then showed "Gross Sales = revenue + returns" and subtracted the returns back off,
  // which cancelled out: a fully returned sale still reported profit, and the cost of the
  // goods that came back stayed in COGS.
  //
  // productRevenue and totalCOGS are reassigned to the NET figures. Every display already
  // adds returns back for its "Gross Sales" line and derives gross profit as
  // productRevenue − totalCOGS, so correcting the two inputs makes those lines right
  // without touching a thousand lines of presentation.
  //
  // Per-product, per-customer and per-company breakdowns further up remain gross; they are
  // adjusted separately by the credit-note loop above.
  const pnl = computePnL({
    billedInvoices: billedForPnL,
    creditNotes,
    expenses: filteredExpenses,
    includeItem: (item) => {
      if (filterCompanies.size === 0) return true;
      const cid = products.find(p => p.id === item.productId)?.companyId;
      return filterCompanies.has(String(cid));
    },
  });
  kpis.creditNotesTotal = pnl.salesReturns;
  kpis.productRevenue  = pnl.netSales;
  kpis.totalCOGS       = pnl.cogs;
  kpis.grossMargin     = pnl.grossProfit;
  kpis.netProfit       = pnl.netProfit;
  // All-time collection rate: (total ever billed − currently outstanding) / total ever billed
  // Period-filtered billing vs period-filtered payments is misleading (cross-period collections inflate to 100%)
  const allTimeBilled = invoices.filter(o => o.status === 'Billed').reduce((s, o) => s + o.total, 0);
  const allTimeOutstanding = receivablesList.reduce((s, r) => s + r.amount, 0);
  const collectionRate = allTimeBilled > 0 ? Math.max(0, Math.min(((allTimeBilled - allTimeOutstanding) / allTimeBilled) * 100, 100)).toFixed(1) : '0.0';
  const totalBilledAmt = billedForPnL.reduce((s, o) => s + o.total, 0);
  // Payment velocity: avg days from invoice date to first payment received for that customer
  let velDays = 0, velCount = 0;
  invoices.filter(o => o.status === 'Billed' && getPaymentStatus(o) === 'Paid').forEach(inv => {
    const pmt = payments.filter(p => String(p.customerId) === String(inv.customerId) && p.date >= inv.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (pmt) { const d = Math.floor((new Date(pmt.date) - new Date(inv.date)) / 86400000); if (d >= 0) { velDays += d; velCount++; } }
  });
  const avgDaysToPay = velCount > 0 ? Math.round(velDays / velCount) : null;
  // New vs repeat customers in period
  const custFirstOrderDate = {};
  invoices.filter(o => o.status === 'Billed').sort((a,b)=>a.date.localeCompare(b.date)).forEach(o => { if (!custFirstOrderDate[o.customerId]) custFirstOrderDate[o.customerId] = o.date; });
  const periodCustIds = [...new Set(billedForPnL.map(o => o.customerId))];
  let newCustCount = 0, repeatCustCount = 0;
  periodCustIds.forEach(id => { if (billedForPnL.some(o => o.customerId === id && o.date === custFirstOrderDate[id])) newCustCount++; else repeatCustCount++; });
  return { kpis, byProduct, byCompany, byCustomer, bySalesperson, byCity, byArea, byType, receivablesList: receivablesList.sort((a,b)=>b.amount-a.amount), trends, dailyBreakdown, byExpenseCategory, agingBuckets, monthlyData, collectionRate, newCustCount, repeatCustCount, totalBilledAmt, avgDaysToPay };
}, [invoices, expenses, payments, dateFilter, customStart, customEnd, ...[...filterCompanies], ...[...filterCustomers], ...[...filterSalespersons], products, customers]);

const getSortedExportData = () => {
   if (view === 'Overview' || view === 'Item Sales') return null;
   if (view === 'Insights') {
     const kpis = reportEngine.kpis;
     const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
     const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
     const rows = [{ 'P&L Item': 'Gross Product Sales', 'Amount (Rs)': kpis.productRevenue + kpis.creditNotesTotal, 'Notes': '' }];
     if (kpis.creditNotesTotal > 0) rows.push({ 'P&L Item': 'Sales Returns', 'Amount (Rs)': -kpis.creditNotesTotal, 'Notes': `${kpis.creditNotesCount} credit notes` });
     rows.push({ 'P&L Item': 'Net Product Sales', 'Amount (Rs)': kpis.productRevenue, 'Notes': '' });
     rows.push({ 'P&L Item': 'Total COGS', 'Amount (Rs)': -kpis.totalCOGS, 'Notes': '' });
     rows.push({ 'P&L Item': 'Gross Profit', 'Amount (Rs)': kpis.grossMargin, 'Notes': `${gpMargin}% margin` });
     rows.push({ 'P&L Item': 'Delivery Revenue', 'Amount (Rs)': kpis.deliveryBilled, 'Notes': '' });
     rows.push({ 'P&L Item': 'Transport Expense', 'Amount (Rs)': -kpis.transportExpense, 'Notes': '' });
     rows.push({ 'P&L Item': 'Operational Expenses', 'Amount (Rs)': -kpis.totalExpenses, 'Notes': '' });
     rows.push({ 'P&L Item': 'Net Profit', 'Amount (Rs)': kpis.netProfit, 'Notes': `${netMargin}% net margin` });
     rows.push({ 'P&L Item': 'Outstanding Receivables', 'Amount (Rs)': kpis.totalReceivables, 'Notes': `${reportEngine.collectionRate}% collected` });
     if (reportEngine.avgDaysToPay !== null) rows.push({ 'P&L Item': 'Avg Days to Pay', 'Amount (Rs)': '', 'Notes': `${reportEngine.avgDaysToPay} days` });
     rows.push({ 'P&L Item': `Active Customers: ${reportEngine.newCustCount + reportEngine.repeatCustCount}`, 'Amount (Rs)': '', 'Notes': `${reportEngine.newCustCount} new · ${reportEngine.repeatCustCount} repeat` });
     return rows;
   }
   if (view === 'Receivables') return reportEngine.receivablesList.map(r => ({
     'Customer Name': r.name, 'Outstanding (Rs)': r.amount,
     'Days Since Last Invoice': r.daysSince || 0, 'Last Invoice Date': r.lastInvDate || ''
   }));
   if (view === 'By Salesperson') return Object.entries(reportEngine.bySalesperson)
     .map(([key,val]) => ({ 'Staff Name': key, 'Orders': val.orders, 'Revenue (Rs)': val.revenue, 'Gross Profit (Rs)': val.profit,
       'Margin %': val.revenue > 0 ? +((val.profit/val.revenue)*100).toFixed(1) : 0 }))
     .sort((a,b)=>b['Revenue (Rs)']-a['Revenue (Rs)']);
   const segmentKey = view === 'By City' ? 'City' : view === 'By Area' ? 'Area' : view === 'By Type' ? 'Type' : null;
   const dataObj = view === 'By Product' ? reportEngine.byProduct : view === 'By Company' ? reportEngine.byCompany : view === 'By City' ? reportEngine.byCity : view === 'By Area' ? reportEngine.byArea : view === 'By Type' ? reportEngine.byType : reportEngine.byCustomer;
   let arr = Object.entries(dataObj).map(([key, val]) => ({ key, ...val })).sort((a,b) => b[sortBy] - a[sortBy]);
   if (view === 'By Product') return arr.map(r => ({
     'Product Name': r.key, 'Brand': r.company || '',
     'Qty Sold': r.qty || 0, 'Revenue (Rs)': r.revenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0, 'Margin %': (r.revenue||0) > 0 ? +((r.profit/r.revenue)*100).toFixed(1) : 0,
   }));
   if (view === 'By Company') return arr.map(r => ({
     'Brand Name': r.key,
     'Qty Sold': r.qty || 0, 'Revenue (Rs)': r.revenue || r.productRevenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0, 'Margin %': (r.revenue||r.productRevenue||0) > 0 ? +((r.profit/(r.revenue||r.productRevenue))*100).toFixed(1) : 0,
   }));
   const nameKey = segmentKey || 'Customer Name';
   return arr.map(r => ({
     [nameKey]: r.key,
     'Orders': r.orders || 0, 'Revenue (Rs)': r.revenue || r.productRevenue || 0, 'Cost (Rs)': r.cost || 0,
     'Gross Profit (Rs)': r.profit || 0,
   }));
};

const handleExport = (format) => {
    const title = `Analytics - ${view}`;
    const exportData = getSortedExportData();
    if (format === 'csv') {
        if(view === 'Overview') return showToast("Cannot export Overview as CSV", "error");
        const numericKeys = ['Revenue (Rs)', 'Gross Profit (Rs)', 'Cost (Rs)', 'Outstanding (Rs)', 'Qty Sold', 'Orders'];
        const csvTotals = {};
        numericKeys.forEach(k => { if (exportData.some(r => r[k] !== undefined)) csvTotals[k] = exportData.reduce((s,r)=>s+(Number(r[k])||0),0); });
        const filterDesc = [
          filterCompanies.size > 0 && `Brand: ${[...filterCompanies].map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join('+')}`,
          filterCustomers.size > 0 && `Client: ${[...filterCustomers].map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join('+')}`,
          filterSalespersons.size > 0 && `Staff: ${[...filterSalespersons].map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join('+')}`,
        ].filter(Boolean).join(' | ');
        exportToCSV(exportData, `${title.replace(/ /g,'_')}_${filterLabel.replace(/ /g,'_')}.csv`, {
          title: `${APP_NAME} — ${title}`,
          subtitle: `Period: ${filterLabel}${filterDesc ? ' | ' + filterDesc : ''} | Generated: ${getLocalDateStr()}`,
          totals: csvTotals,
        });
    } else if (format === 'pdf') {
        const appliedFilters = {
          companies: filterCompanies.size > 0 ? [...filterCompanies].map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ') : '',
          customers: filterCustomers.size > 0 ? [...filterCustomers].map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ') : '',
          salespersons: filterSalespersons.size > 0 ? [...filterSalespersons].map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join(', ') : '',
          customStart: dateFilter === 'Custom' ? customStart : '',
          customEnd: dateFilter === 'Custom' ? customEnd : '',
        };
        setPrintConfig({ docType: 'report', format: 'a5', data: { title, dateFilter: filterLabel, view, stats: reportEngine.kpis, rows: exportData, appliedFilters, generatedOn: getLocalDateStr() } });
    } else if (format === 'text') {
        const kpis = reportEngine.kpis;
        const margin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : 0;
        let text = `📊 *${APP_NAME}*\n*${title}* | Period: ${filterLabel}\n${'─'.repeat(30)}\n`;
        if (view === 'Overview') {
          text += `💰 *Sales & Profitability*\n`;
          text += `Product Sales: Rs. ${kpis.productRevenue.toLocaleString('en-US')}\n`;
          text += `Total COGS:    Rs. ${kpis.totalCOGS.toLocaleString('en-US')}\n`;
          text += `Gross Margin:  Rs. ${kpis.grossMargin.toLocaleString('en-US')} (${margin}%)\n`;
          text += `\n🚛 *Delivery*\n`;
          text += `Billed: Rs. ${kpis.deliveryBilled.toLocaleString('en-US')} | Expense: Rs. ${kpis.transportExpense.toLocaleString('en-US')}\n`;
          text += `\n💸 *Expenses*\n`;
          text += `Operational: Rs. ${kpis.totalExpenses.toLocaleString('en-US')}\n`;
          text += `\n${'─'.repeat(30)}\n`;
          text += `✅ *Net Profit: Rs. ${kpis.netProfit.toLocaleString('en-US')}*\n`;
          text += `📌 Receivables: Rs. ${kpis.totalReceivables.toLocaleString('en-US')}\n`;
          if (reportEngine.trends.revenue !== null) text += `📈 Revenue trend: ${Number(reportEngine.trends.revenue) >= 0 ? '+' : ''}${reportEngine.trends.revenue}% vs prev period\n`;
        } else if (view === 'Insights') {
          const gpMargin = kpis.productRevenue > 0 ? ((kpis.grossMargin / kpis.productRevenue) * 100).toFixed(1) : '0.0';
          const netMargin = kpis.productRevenue > 0 ? ((kpis.netProfit / kpis.productRevenue) * 100).toFixed(1) : '0.0';
          text += `💰 *P&L Summary*\n`;
          text += `Gross Sales:     Rs.${(kpis.productRevenue + kpis.creditNotesTotal).toLocaleString('en-US')}\n`;
          if (kpis.creditNotesTotal > 0) text += `Sales Returns:   - Rs.${kpis.creditNotesTotal.toLocaleString('en-US')}\n`;
          text += `Net Sales:       Rs.${kpis.productRevenue.toLocaleString('en-US')}\n`;
          text += `Total COGS:      - Rs.${kpis.totalCOGS.toLocaleString('en-US')}\n`;
          text += `Gross Profit:    Rs.${kpis.grossMargin.toLocaleString('en-US')} (${gpMargin}%)\n`;
          text += `Delivery Net:    + Rs.${(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}\n`;
          text += `Op. Expenses:    - Rs.${kpis.totalExpenses.toLocaleString('en-US')}\n`;
          text += `${'─'.repeat(30)}\n`;
          text += `✅ *Net Profit: Rs.${kpis.netProfit.toLocaleString('en-US')} (${netMargin}%)*\n`;
          text += `\n📌 *Key Metrics*\n`;
          text += `Receivables:     Rs.${kpis.totalReceivables.toLocaleString('en-US')}\n`;
          text += `Collection Rate: ${reportEngine.collectionRate}%\n`;
          if (reportEngine.avgDaysToPay !== null) text += `Avg Days to Pay: ${reportEngine.avgDaysToPay} days\n`;
          text += `Customers:       ${reportEngine.newCustCount + reportEngine.repeatCustCount} (${reportEngine.newCustCount} new, ${reportEngine.repeatCustCount} repeat)\n`;
          const topProduct = Object.entries(reportEngine.byProduct).sort((a,b) => b[1].profit - a[1].profit)[0];
          const topCustomer = Object.entries(reportEngine.byCustomer).sort((a,b) => b[1].productRevenue - a[1].productRevenue)[0];
          if (topProduct || topCustomer || reportEngine.trends.revenue !== null) {
            text += `\n⭐ *Smart Callouts*\n`;
            if (topProduct) text += `Top Product: ${topProduct[0]} — Rs.${topProduct[1].profit.toLocaleString('en-US')} GP\n`;
            if (topCustomer) text += `Top Customer: ${topCustomer[0]} — Rs.${(topCustomer[1].productRevenue||0).toLocaleString('en-US')} revenue\n`;
            if (reportEngine.trends.revenue !== null) text += `Revenue Trend: ${Number(reportEngine.trends.revenue) >= 0 ? '+' : ''}${reportEngine.trends.revenue}% vs prev period\n`;
            if (reportEngine.agingBuckets.days90plus.length > 0) text += `⚠️ ${reportEngine.agingBuckets.days90plus.length} customer(s) overdue 90+ days\n`;
          }
        } else if (view === 'Receivables') {
          exportData.forEach((r, i) => {
            const name = r['Customer Name'] || '?';
            const outstanding = r['Outstanding (Rs)'] || 0;
            const days = r['Days Since Last Invoice'];
            text += `${i+1}. *${name}*\n`;
            text += `   Outstanding: Rs.${Number(outstanding).toLocaleString('en-US')}`;
            if (days != null) text += ` | ${days} days overdue`;
            text += `\n`;
          });
          if (exportData.length > 0) {
            const total = exportData.reduce((s,r)=>s+(r['Outstanding (Rs)']||0),0);
            text += `${'─'.repeat(30)}\nTotal Outstanding: Rs.${total.toLocaleString('en-US')}\n`;
          }
        } else {
          exportData.forEach((r, i) => {
            const name = r['Product Name'] || r['Brand Name'] || r['Customer Name'] || r['Staff Name'] || r['City'] || r['Area'] || r['Type'] || '?';
            const brand = r['Brand'] || '';
            const gp = r['Gross Profit (Rs)'] || 0;
            const rev = r['Revenue (Rs)'] || 0;
            const qty = r['Qty Sold'] || 0;
            const orders = r['Orders'] || 0;
            const gpMargin = rev > 0 ? ` (${((gp/rev)*100).toFixed(1)}%)` : '';
            text += `${i+1}. *${name}*${brand ? ` — ${brand}` : ''}\n`;
            if (qty) text += `   Qty: ${Number(qty).toLocaleString('en-US')} | `;
            if (orders) text += `   Orders: ${orders} | `;
            text += `Rev: Rs.${Number(rev).toLocaleString('en-US')} | GP: Rs.${Number(gp).toLocaleString('en-US')}${gpMargin}\n`;
          });
          if (exportData.length > 0) {
            const totalRev = exportData.reduce((s,r)=>s+(r['Revenue (Rs)']||0),0);
            const totalGP = exportData.reduce((s,r)=>s+(r['Gross Profit (Rs)']||0),0);
            text += `${'─'.repeat(30)}\nTotal Rev: Rs.${totalRev.toLocaleString('en-US')} | Total GP: Rs.${totalGP.toLocaleString('en-US')}\n`;
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
                        {type === 'Customer' ? (
                          <button className="font-bold text-slate-800 hover:text-indigo-600 text-left transition-colors" onClick={() => { const c = customers.find(c => c.name === row.key); if(c){ setSelectedLedgerId(c.id); setShowLedgerModal(true); } }}>{row.key}</button>
                        ) : (
                          <div className="font-bold text-slate-800">{row.key}</div>
                        )}
                      </div>
                      {row.company && <div className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">{row.company}</div>}
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5 max-w-[100px]"><div className="bg-emerald-400 h-1 rounded-full" style={{width:`${barW}%`}}></div></div>
                    </td>
                    {type !== 'Customer' && <td className="p-3 text-center bg-slate-50/50 font-bold">{(row.qty||0).toLocaleString('en-US')}</td>}
                    {type === 'Customer' && <td className="p-3 text-center bg-slate-50/50 font-bold">{row.orders||0}</td>}
                    <td className="p-3 text-right text-slate-800 font-bold">Rs.{rev.toLocaleString('en-US')}</td>
                    <td className="p-3 text-right text-slate-500">{revShare}%</td>
                    <td className="p-3 text-right font-bold" style={{color: gp >= 0 ? '#059669' : '#e11d48'}}>Rs.{gp.toLocaleString('en-US')}</td>
                    <td className="p-3 text-right text-indigo-600 font-bold">{margin}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-slate-800 text-xs">
              <tr>
                <td className="p-3 uppercase tracking-wider text-slate-600">Totals</td>
                <td className="p-3 text-center">{totalQtyOrOrders.toLocaleString('en-US')}</td>
                <td className="p-3 text-right">Rs.{totalRev.toLocaleString('en-US')}</td>
                <td className="p-3 text-right text-slate-500">100%</td>
                <td className="p-3 text-right text-emerald-700">Rs.{totalGP.toLocaleString('en-US')}</td>
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
                  <td className="p-3 text-right font-bold text-slate-800">Rs.{rev.toLocaleString('en-US')}</td>
                  <td className="p-3 text-right font-bold" style={{color: gp >= 0 ? '#059669' : '#e11d48'}}>Rs.{gp.toLocaleString('en-US')}</td>
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

const filterLabel = (() => {
  const nowPKT = getPKTDate();
  if (dateFilter === 'Custom') return `${customStart||'...'} to ${customEnd}`;
  if (dateFilter === 'Today') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `Today, ${nowPKT.getDate()} ${months[nowPKT.getMonth()]} ${nowPKT.getFullYear()}`;
  }
  if (dateFilter === 'This Week') {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const today = new Date(nowPKT.getFullYear(), nowPKT.getMonth(), nowPKT.getDate());
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
    if (sameMonth) return `${months[startOfWeek.getMonth()]} ${startOfWeek.getDate()}–${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    return `${startOfWeek.getDate()} ${months[startOfWeek.getMonth()]} – ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]} ${endOfWeek.getFullYear()}`;
  }
  if (dateFilter === 'This Month') {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[nowPKT.getMonth()]} ${nowPKT.getFullYear()}`;
  }
  if (dateFilter === 'This Year') return `Year ${nowPKT.getFullYear()}`;
  return dateFilter;
})();

return (
  <div className="h-full flex flex-col p-4">
    {/* Filter Bar */}
    <div className="flex flex-wrap gap-2 mb-3 shrink-0 pb-1">
       <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
         <Calendar size={13} className="text-indigo-500"/>
         <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-transparent font-bold text-[11px] text-slate-700 outline-none cursor-pointer">
           <option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option><option>All Time</option><option>Custom</option>
         </select>
       </div>
       <MultiPicker label="Brand" Icon={Filter} items={companies} selected={filterCompanies}
         onToggle={id=>toggleFilter(setFilterCompanies,id)} onClear={()=>clearFilter(setFilterCompanies)} />
       <MultiPicker label="Client" Icon={Users} items={customers} selected={filterCustomers}
         onToggle={id=>toggleFilter(setFilterCustomers,id)} onClear={()=>clearFilter(setFilterCustomers)} />
       <MultiPicker label="Staff" Icon={Award} items={appUsers} selected={filterSalespersons}
         onToggle={id=>toggleFilter(setFilterSalespersons,id)} onClear={()=>clearFilter(setFilterSalespersons)} />
    </div>

    {/* Custom date inputs */}
    {dateFilter === 'Custom' && (
      <div className="flex gap-2 mb-3 shrink-0">
        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"/></div>
        <div className="flex-1"><label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"/></div>
      </div>
    )}

    {/* View Tabs */}
    <ScrollableTabBar className="pb-2 shrink-0">
       {['Overview','Insights','Monthly Trend','By Product','By Company','By Customer','By City','By Area','By Type','By Salesperson','Receivables','Item Sales'].map(v => (
         <button key={v} data-analytictab={v} tabIndex={view===v?0:-1}
           onClick={() => setView(v)}
           onKeyDown={makeArrowNav(['Overview','Insights','Monthly Trend','By Product','By Company','By Customer','By City','By Area','By Type','By Salesperson','Receivables','Item Sales'],view,setView,'data-analytictab')}
           className={`px-3 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap shadow-sm transition-colors ${view === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{v}</button>
       ))}
    </ScrollableTabBar>

    {/* Active filter chips */}
    {(filterCompanies.size > 0 || filterCustomers.size > 0 || filterSalespersons.size > 0) && (
      <div className="flex flex-wrap gap-1.5 mb-2 px-0.5 shrink-0">
        {filterCompanies.size > 0 && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          Brand: {[...filterCompanies].slice(0,2).map(id=>companies.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ')}{filterCompanies.size > 2 && ` +${filterCompanies.size-2}`}
          <button onClick={()=>clearFilter(setFilterCompanies)} className="ml-1 text-indigo-400 hover:text-indigo-700"><X size={10}/></button>
        </span>}
        {filterCustomers.size > 0 && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          Client: {[...filterCustomers].slice(0,2).map(id=>customers.find(c=>String(c.id)===id)?.name).filter(Boolean).join(', ')}{filterCustomers.size > 2 && ` +${filterCustomers.size-2}`}
          <button onClick={()=>clearFilter(setFilterCustomers)} className="ml-1 text-emerald-400 hover:text-emerald-700"><X size={10}/></button>
        </span>}
        {filterSalespersons.size > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
          Staff: {[...filterSalespersons].slice(0,2).map(id=>appUsers.find(u=>String(u.id)===id)?.name).filter(Boolean).join(', ')}{filterSalespersons.size > 2 && ` +${filterSalespersons.size-2}`}
          <button onClick={()=>clearFilter(setFilterSalespersons)} className="ml-1 text-amber-400 hover:text-amber-700"><X size={10}/></button>
        </span>}
      </div>
    )}

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
                         {date.slice(5)}<br/>Rev: {data.revenue.toLocaleString('en-US')}<br/>GP: {data.profit.toLocaleString('en-US')}
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
                       <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700 truncate">{name}</span><span className="font-bold text-emerald-600 ml-2 shrink-0">Rs.{data.profit.toLocaleString('en-US')}</span></div>
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
                         <div className="flex justify-between text-xs"><span className="font-semibold text-slate-600 truncate">{cat}</span><span className="font-bold text-rose-500 ml-2 shrink-0">Rs.{amt.toLocaleString('en-US')}</span></div>
                         <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1"><div className="bg-rose-400 h-1.5 rounded-full" style={{width:`${Math.min((amt/maxAmt)*100,100)}%`}}></div></div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {/* P&L Card */}
           {(() => {
             const k = reportEngine.kpis;
             const gpPct = k.productRevenue > 0 ? ((k.grossMargin / k.productRevenue) * 100).toFixed(1) : '0.0';
             const netPct = k.productRevenue > 0 ? ((k.netProfit / k.productRevenue) * 100).toFixed(1) : '0.0';
             return (
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
                 <p className="text-[10px] uppercase font-bold text-slate-400 mb-5 tracking-widest flex justify-between"><span>P&L Dashboard</span><span className="text-indigo-300">{filterLabel}</span></p>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center text-sm font-medium"><span className="text-slate-300">Gross Product Sales</span><span className="font-bold text-white">Rs.{(k.productRevenue + k.creditNotesTotal).toLocaleString('en-US')}</span></div>
                   {k.creditNotesTotal > 0 && <div className="flex justify-between items-center text-xs"><span className="text-rose-300">Sales Returns ({k.creditNotesCount})</span><span className="font-bold text-rose-300">− Rs.{k.creditNotesTotal.toLocaleString('en-US')}</span></div>}
                   <div className="flex justify-between items-center text-sm font-medium"><span className="text-rose-300">Total COGS</span><span className="font-bold text-rose-300">- Rs.{k.totalCOGS.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-baseline"><span className="text-indigo-300 text-sm font-semibold">Gross Profit</span><div className="text-right"><span className="font-bold text-indigo-300">Rs.{k.grossMargin.toLocaleString('en-US')}</span><span className="text-[10px] text-indigo-400 ml-2">{gpPct}%</span></div></div>
                   <div className="h-px bg-slate-700 my-1"></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-slate-400">Delivery Billed</span><span className="font-bold text-slate-300">+ Rs.{k.deliveryBilled.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-rose-400">Transport Expenses</span><span className="font-bold text-rose-400">- Rs.{k.transportExpense.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-rose-400">Operational Expenses</span><span className="font-bold text-rose-400">- Rs.{k.totalExpenses.toLocaleString('en-US')}</span></div>
                   <div className="h-px bg-slate-700 my-1"></div>
                   <div className="flex justify-between items-baseline"><span className="font-bold uppercase tracking-widest text-emerald-400 text-xs">Net Profit</span><div className="text-right"><span className={`font-black text-2xl tracking-tight ${k.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Rs.{k.netProfit.toLocaleString('en-US')}</span><span className={`text-[10px] ml-2 ${k.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{netPct}%</span></div></div>
                   <div className="h-px bg-slate-700 my-1"></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-amber-400 font-semibold">Outstanding Receivables</span><span className="font-bold text-amber-300">Rs.{k.totalReceivables.toLocaleString('en-US')}</span></div>
                   <div className="flex justify-between items-center text-xs"><span className="text-slate-500">Collection Rate (all-time)</span><span className={`font-bold ${Number(reportEngine.collectionRate) >= 80 ? 'text-emerald-400' : Number(reportEngine.collectionRate) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{reportEngine.collectionRate}%</span></div>
                 </div>
               </div>
             );
           })()}
        </div>
      )}

      {view === 'By Product' && renderTable(reportEngine.byProduct, 'Product')}
      {view === 'By Company' && renderTable(reportEngine.byCompany, 'Company')}
      {view === 'By Customer' && renderTable(reportEngine.byCustomer, 'Customer')}
      {view === 'By City' && renderSegmentTable(reportEngine.byCity, 'City')}
      {view === 'By Area' && renderSegmentTable(reportEngine.byArea, 'Area')}
      {view === 'By Type' && renderSegmentTable(reportEngine.byType, 'Type')}

      {view === 'Item Sales' && (() => {
        const prodQ = itemProdFilter.toLowerCase().trim();
        const custQ = itemCustFilter.toLowerCase().trim();
        const hasFilter = prodQ || custQ;
        const rows = hasFilter ? (() => {
          const out = [];
          invoices.filter(o => o.status === 'Billed' && checkCustomFilter(o.date)).forEach(inv => {
            if (custQ && !inv.customerName.toLowerCase().includes(custQ)) return;
            (inv.items || []).filter(i => !i.isBonus).forEach(item => {
              if (prodQ && !(item.name || '').toLowerCase().includes(prodQ)) return;
              out.push({ date: inv.date, customerId: inv.customerId, customerName: inv.customerName, invoiceId: inv.id, inv, name: item.name, qty: item.quantity || 0, rate: item.price || 0, sub: (item.price || 0) * (item.quantity || 0) });
            });
          });
          return out.sort((a, b) => b.date.localeCompare(a.date));
        })() : [];
        const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
        const totalAmt = rows.reduce((s, r) => s + r.sub, 0);
        return (
          <div className="space-y-3 mt-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Search size={11}/> Filter</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"/>
                  <input className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300" placeholder="Product name…" value={itemProdFilter} onChange={e => setItemProdFilter(e.target.value)}/>
                </div>
                <div className="relative">
                  <Users size={13} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"/>
                  <input className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300" placeholder="Customer name…" value={itemCustFilter} onChange={e => setItemCustFilter(e.target.value)}/>
                </div>
              </div>
            </div>
            {!hasFilter && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <Package size={28} className="mx-auto text-slate-300 mb-2"/>
                <p className="text-slate-500 font-semibold text-sm">Search a product or customer to see invoice-level sales</p>
              </div>
            )}
            {hasFilter && rows.length === 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
                <p className="text-slate-400 font-semibold text-sm">No results found for the current filters</p>
              </div>
            )}
            {hasFilter && rows.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-center">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Invoices</p>
                    <p className="text-xl font-black text-indigo-700">{new Set(rows.map(r=>r.invoiceId)).size}</p>
                  </div>
                  <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 text-center">
                    <p className="text-[10px] font-bold text-teal-500 uppercase tracking-wider">Units</p>
                    <p className="text-xl font-black text-teal-700">{totalUnits.toLocaleString('en-US')}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Revenue</p>
                    <p className="text-lg font-black text-emerald-700">Rs.{totalAmt.toLocaleString('en-US')}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200">
                        <tr><th className="p-3">Date</th><th className="p-3">Customer</th><th className="p-3">Invoice</th><th className="p-3">Product</th><th className="p-3 text-center">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-500 font-medium">{formatDateDisp(r.date)}</td>
                            <td className="p-3"><button className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors text-left" onClick={() => { setSelectedLedgerId(r.customerId); setShowLedgerModal(true); }}>{r.customerName}</button></td>
                            <td className="p-3"><button className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors" onClick={() => setPrintConfig({ docType: 'invoice', format: 'thermal', data: r.inv })}>{r.invoiceId}</button></td>
                            <td className="p-3 font-semibold text-slate-800">{r.name}</td>
                            <td className="p-3 text-center font-bold text-slate-700">{r.qty}</td>
                            <td className="p-3 text-right text-slate-600">Rs.{r.rate.toLocaleString('en-US')}</td>
                            <td className="p-3 text-right font-bold text-emerald-700">Rs.{r.sub.toLocaleString('en-US')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                        <tr><td colSpan={4} className="p-3 text-slate-600 uppercase tracking-wider">Totals</td><td className="p-3 text-center">{totalUnits.toLocaleString('en-US')}</td><td></td><td className="p-3 text-right text-emerald-700">Rs.{totalAmt.toLocaleString('en-US')}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

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
                      <td className="p-3 text-right font-bold text-slate-800">Rs.{data.revenue.toLocaleString('en-US')}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">Rs.{data.profit.toLocaleString('en-US')}</td>
                      <td className="p-3 text-right font-bold text-indigo-600">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                {(() => { const totalRev = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.revenue,0); const totalGP = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.profit,0); const totalOrders = Object.values(reportEngine.bySalesperson).reduce((s,d)=>s+d.orders,0); return (<tr><td className="p-3 text-slate-600 uppercase tracking-wider">Totals</td><td className="p-3 text-center">{totalOrders}</td><td className="p-3 text-right">Rs.{totalRev.toLocaleString('en-US')}</td><td className="p-3 text-right text-emerald-700">Rs.{totalGP.toLocaleString('en-US')}</td><td className="p-3 text-right text-indigo-700">{totalRev > 0 ? ((totalGP/totalRev)*100).toFixed(1) : 0}%</td></tr>); })()}
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Collection Rate <span className="text-slate-300">(All-time)</span></p>
              <p className={`text-2xl font-black mt-1 ${Number(reportEngine.collectionRate) >= 80 ? 'text-emerald-600' : Number(reportEngine.collectionRate) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{reportEngine.collectionRate}%</p>
              <p className="text-[10px] text-slate-400 mt-1">of all-time billed amount recovered</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outstanding</p>
              <p className="text-2xl font-black mt-1 text-rose-600">Rs.{reportEngine.kpis.totalReceivables.toLocaleString('en-US')}</p>
              <p className="text-[10px] text-slate-400 mt-1">{reportEngine.receivablesList.length} customers with balance</p>
            </div>
          </div>
          {/* Top Overdue Balances */}
          {(() => {
            const overdue = [...reportEngine.agingBuckets.days30, ...reportEngine.agingBuckets.days60, ...reportEngine.agingBuckets.days90plus].sort((a,b)=>b.amount-a.amount).slice(0,5);
            if (!overdue.length) return null;
            return (
              <div className="bg-white rounded-2xl shadow-sm border border-rose-300 overflow-hidden">
                <div className="bg-rose-600 p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={13}/> Top Overdue Balances</span>
                  <span className="text-[10px] font-black text-rose-200">{overdue.length} accounts · 31+ days</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {overdue.map((r,i) => (
                    <div key={i} className="flex justify-between items-center p-3">
                      <div className="flex-1 min-w-0">
                        <button className="font-semibold text-sm text-slate-800 truncate hover:text-indigo-600 text-left w-full" onClick={()=>{setSelectedLedgerId(r.id);setShowLedgerModal(true);}}>{r.name}</button>
                        <p className="text-[10px] text-rose-400 font-semibold">{r.daysSince} days overdue</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="font-extrabold text-rose-600 text-sm">Rs.{r.amount.toLocaleString('en-US')}</span>
                        {r.phone && <a href={`https://wa.me/92${r.phone.replace(/^0/,'').replace(/\D/g,'')}?text=${encodeURIComponent(`Assalam o Alaikum ${r.name},\n\nYour outstanding balance is *Rs. ${r.amount.toLocaleString('en-US')}*. Kindly process payment at earliest.\n\nJazakAllah Khair`)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 border border-green-100"><PhoneCall size={13}/></a>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
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
                  <span className={`text-xs font-black text-${color}-700`}>Rs.{total.toLocaleString('en-US')}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {bucket.map((r,i) => {
                    const waMsg = `Assalam o Alaikum ${r.name},\n\nYour outstanding balance with ${APP_NAME} is *Rs. ${r.amount.toLocaleString('en-US')}*.\n\nKindly process the payment at your earliest convenience.\n\nJazakAllah Khair`;
                    return (
                      <div key={i} className="flex justify-between items-center p-3">
                        <div className="flex-1 min-w-0">
                          <button className="font-semibold text-sm text-slate-800 truncate hover:text-indigo-600 transition-colors text-left w-full" onClick={() => { setSelectedLedgerId(r.id); setShowLedgerModal(true); }}>{r.name}</button>
                          <p className="text-[10px] text-slate-400">{r.daysSince} days since last invoice {r.lastInvDate ? `(${formatDateDisp(r.lastInvDate)})` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="font-extrabold text-rose-600 text-sm">Rs.{r.amount.toLocaleString('en-US')}</span>
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
          { label: 'Gross Margin', value: `${gpMargin}%`, sub: `Rs.${kpis.grossMargin.toLocaleString('en-US')} on Rs.${kpis.productRevenue.toLocaleString('en-US')} sales`, color: Number(gpMargin) >= 25 ? 'emerald' : Number(gpMargin) >= 15 ? 'amber' : 'rose', icon: TrendingUp },
          { label: 'Net Profit Margin', value: `${netMargin}%`, sub: `Rs.${kpis.netProfit.toLocaleString('en-US')} after all expenses`, color: Number(netMargin) >= 15 ? 'emerald' : Number(netMargin) >= 5 ? 'amber' : 'rose', icon: DollarSign },
          { label: 'Collection Rate', value: `${reportEngine.collectionRate}%`, sub: `all-time billed vs outstanding`, color: Number(reportEngine.collectionRate) >= 80 ? 'emerald' : Number(reportEngine.collectionRate) >= 50 ? 'amber' : 'rose', icon: Wallet },
          { label: 'Active Customers', value: `${reportEngine.newCustCount + reportEngine.repeatCustCount}`, sub: `${reportEngine.newCustCount} new · ${reportEngine.repeatCustCount} repeat`, color: 'indigo', icon: Users },
          ...(reportEngine.avgDaysToPay !== null ? [{ label: 'Avg Days to Pay', value: `${reportEngine.avgDaysToPay}d`, sub: reportEngine.avgDaysToPay <= 7 ? 'Excellent payment speed' : reportEngine.avgDaysToPay <= 21 ? 'Acceptable turnaround' : 'Slow — follow up needed', color: reportEngine.avgDaysToPay <= 7 ? 'emerald' : reportEngine.avgDaysToPay <= 21 ? 'amber' : 'rose', icon: Clock }] : []),
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
              {topProduct && <div className="flex items-start gap-2 text-sm"><span className="text-emerald-600 font-black shrink-0">★</span><p className="text-slate-700"><span className="font-bold">{topProduct[0]}</span> is your most profitable product — Rs.{topProduct[1].profit.toLocaleString('en-US')} GP ({topProduct[1].qty} units sold)</p></div>}
              {topCustomer && <div className="flex items-start gap-2 text-sm"><span className="text-indigo-600 font-black shrink-0">★</span><p className="text-slate-700"><button className="font-bold hover:text-indigo-600 transition-colors" onClick={() => { const c = customers.find(c => c.name === topCustomer[0]); if(c){ setSelectedLedgerId(c.id); setShowLedgerModal(true); } }}>{topCustomer[0]}</button> is your top customer — Rs.{(topCustomer[1].productRevenue||0).toLocaleString('en-US')} revenue in {topCustomer[1].orders} orders</p></div>}
              {reportEngine.agingBuckets.days90plus.length > 0 && <div className="flex items-start gap-2 text-sm"><span className="text-rose-600 font-black shrink-0">!</span><p className="text-slate-700"><span className="font-bold text-rose-600">{reportEngine.agingBuckets.days90plus.length} customer{reportEngine.agingBuckets.days90plus.length>1?'s':''}</span> overdue 90+ days — Rs.{reportEngine.agingBuckets.days90plus.reduce((s,r)=>s+r.amount,0).toLocaleString('en-US')} at risk</p></div>}
              {reportEngine.trends.revenue !== null && <div className="flex items-start gap-2 text-sm"><span className={`font-black shrink-0 ${Number(reportEngine.trends.revenue)>=0?'text-emerald-600':'text-rose-600'}`}>{Number(reportEngine.trends.revenue)>=0?'↑':'↓'}</span><p className="text-slate-700">Revenue is <span className="font-bold">{Number(reportEngine.trends.revenue)>=0?'up':'down'} {Math.abs(reportEngine.trends.revenue)}%</span> vs previous period</p></div>}
              {kpis.deliveryBilled > kpis.transportExpense && <div className="flex items-start gap-2 text-sm"><span className="text-emerald-600 font-black shrink-0">+</span><p className="text-slate-700">Delivery net contribution: <span className="font-bold text-emerald-700">Rs.{(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}</span></p></div>}
            </div>
            {/* P&L summary */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-xl">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-4 tracking-widest">P&L Summary · {filterLabel}</p>
              <div className="space-y-0">
                {[
                  ['Gross Sales', `Rs.${(kpis.productRevenue + kpis.creditNotesTotal).toLocaleString('en-US')}`, 'text-white', false],
                  ...(kpis.creditNotesTotal > 0 ? [['Sales Returns', `- Rs.${kpis.creditNotesTotal.toLocaleString('en-US')}`, 'text-rose-300 text-xs', false]] : []),
                  ['COGS', `- Rs.${kpis.totalCOGS.toLocaleString('en-US')}`, 'text-rose-300', false],
                  ['Gross Profit', `Rs.${kpis.grossMargin.toLocaleString('en-US')}`, 'text-indigo-300', gpMargin + '%'],
                  ['Delivery Net', `+ Rs.${(kpis.deliveryBilled - kpis.transportExpense).toLocaleString('en-US')}`, 'text-slate-300', false],
                  ['Operational Expenses', `- Rs.${kpis.totalExpenses.toLocaleString('en-US')}`, 'text-rose-300', false],
                  ['Net Profit', `Rs.${kpis.netProfit.toLocaleString('en-US')}`, kpis.netProfit >= 0 ? 'text-emerald-400 text-base font-black' : 'text-rose-400 text-base font-black', netMargin + '%'],
                ].map(([label, val, cls, pct]) => (
                  <div key={label} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-700 last:border-0">
                    <span className="text-slate-400">{label}</span>
                    <div className="text-right"><span className={`font-bold ${cls}`}>{val}</span>{pct && <span className="text-[10px] text-slate-500 ml-1.5">{pct}</span>}</div>
                  </div>
                ))}
                <div className="h-px bg-slate-600 my-2"></div>
                <div className="flex justify-between items-center text-xs py-1"><span className="text-amber-400">Outstanding Receivables</span><span className="font-bold text-amber-300">Rs.{kpis.totalReceivables.toLocaleString('en-US')}</span></div>
                <div className="flex justify-between items-center text-xs py-0.5"><span className="text-slate-500">Collection Rate (all-time)</span><span className={`font-bold ${Number(reportEngine.collectionRate) >= 80 ? 'text-emerald-400' : Number(reportEngine.collectionRate) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{reportEngine.collectionRate}%</span></div>
              </div>
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
                        {monthNames[parseInt(mo)-1]} {yr.slice(2)}<br/>Rev: Rs.{d.revenue.toLocaleString('en-US')}<br/>GP: Rs.{d.profit.toLocaleString('en-US')}<br/>Orders: {d.orders}
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
                          <td className="p-3 text-right">Rs.{d.revenue.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right text-rose-500">Rs.{d.cost.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">Rs.{d.profit.toLocaleString('en-US')}</td>
                          <td className="p-3 text-right text-indigo-600">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                    {(() => { const totRev = months.reduce((s,m)=>s+reportEngine.monthlyData[m].revenue,0); const totGP = months.reduce((s,m)=>s+reportEngine.monthlyData[m].profit,0); const totOrd = months.reduce((s,m)=>s+reportEngine.monthlyData[m].orders,0); const totCost = months.reduce((s,m)=>s+reportEngine.monthlyData[m].cost,0); return (<tr><td className="p-3 text-slate-600 uppercase tracking-wider">Totals ({months.length}mo)</td><td className="p-3 text-center">{totOrd}</td><td className="p-3 text-right">Rs.{totRev.toLocaleString('en-US')}</td><td className="p-3 text-right text-rose-600">Rs.{totCost.toLocaleString('en-US')}</td><td className="p-3 text-right text-emerald-700">Rs.{totGP.toLocaleString('en-US')}</td><td className="p-3 text-right text-indigo-700">{totRev > 0 ? ((totGP/totRev)*100).toFixed(1) : 0}%</td></tr>); })()}
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
const [analyticsView, setAnalyticsView] = useState('Overview');
const [toast, setToast] = useState(null);

// — Data State (Live from Firebase) —
// Tracks the Firebase session. Drives listener re-subscription (above) and clears a
// stale stored profile below.
// undefined = Firebase has not reported yet, null = definitely signed out. The distinction
// matters: treating the initial state as signed-out would clear a perfectly good persisted
// session on every page load and bounce the user to the login screen.
const [authUid, setAuthUid] = useState(undefined);
useEffect(() => onAuthStateChanged(auth, (fbUser) => setAuthUid(fbUser ? fbUser.uid : null)), []);

// A stored profile with no live Firebase session is a stale login — from before the Auth
// migration, or expired. Once the rules are closed every read it makes would be denied, so
// clear it and show the login screen rather than a broken app. Declared here, after
// authUid: as a dependency it is read during render, so it must already exist.
useEffect(() => {
  if (authUid === null) setCurrentUser(prev => (prev && prev.authUid ? null : prev));
}, [authUid]);

const appUsers = useLiveCollection('app_users', authUid);
const companies = useLiveCollection('companies', authUid);
const products = useLiveCollection('products', authUid);
const customers = useLiveCollection('customers', authUid);
// Financial collections come back raw and are filtered once, here. Every balance, report,
// export and list downstream reads the filtered arrays, so voiding a record subtracts it
// everywhere at once instead of in forty places one at a time. The raw arrays are exposed
// separately and used only by the Voided view.
const invoicesRaw = useLiveCollection('invoices', authUid);
const expensesRaw = useLiveCollection('expenses', authUid);
const paymentsRaw = useLiveCollection('payments', authUid);
const invoices = useMemo(() => invoicesRaw.filter(notVoided), [invoicesRaw]);
const expenses = useMemo(() => expensesRaw.filter(notVoided), [expensesRaw]);
const payments = useMemo(() => paymentsRaw.filter(notVoided), [paymentsRaw]);
const expenseCategories = useLiveCollection('expenseCategories', authUid);
const cities = useLiveCollection('cities', authUid);
const areas = useLiveCollection('areas', authUid);
const customerTypes = useLiveCollection('customerTypes', authUid);
const vehicleTypes = useLiveCollection('vehicleTypes', authUid);
const appSettingsRaw = useLiveCollection('appSettings', authUid);
const riders = useLiveCollection('riders', authUid);
// Courier registry for transport types that carry no rider (Intercity Transport et al).
// These are to non-rider vehicle types what riders are to rider-based ones.
const transportCompanies = useLiveCollection('transportCompanies', authUid);
const appSettings = appSettingsRaw.find(s => s.id === 'main') || { businessName: 'Khyber Traders', appName: 'AnimalHealth.PK', tagline: 'Wholesale Veterinary Pharmacy · Karachi', showBusinessNameOnDocs: true, showBusinessNameOnReports: true };

// Complex UI State
const [billingView, setBillingView] = useState('list');
const [currentInvoice, setCurrentInvoice] = useState(null);
const [showProductModal, setShowProductModal] = useState(false);
const [editingProduct, setEditingProduct] = useState(null);
const [productPreFill, setProductPreFill] = useState('');
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
const [showRidersModal, setShowRidersModal] = useState(false);
const [editingPayment, setEditingPayment] = useState(null);
const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
const [editingCreditNote, setEditingCreditNote] = useState(null);
const [confirmDialog, setConfirmDialog] = useState(null);
const showConfirm = (message) => new Promise(resolve => setConfirmDialog({ message, resolve }));
// Same dialog, with a text field. Resolves the trimmed string, or null if cancelled — a
// caller must be able to tell "no reason given" from "changed my mind".
const showPrompt = (message, prompt = {}) =>
  new Promise(resolve => setConfirmDialog({ message, prompt: { label: 'Reason', required: true, ...prompt }, resolve }));

const isAdmin = currentUser?.role === 'admin';
const hasPermission = (key) => isAdmin || !!(currentUser?.permissions?.[key]);

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
// First-run bootstrap deliberately does NOT gate on appUsers being empty any more.
// That list is unreadable from the login screen once the rules are closed, so the old
// check would have been true for everyone and every sign-in would have been diverted
// into bootstrap and rejected. The setup secret is the gate; it is attempted only after
// Firebase confirms there is no such account.
const bootstrapFirstAdmin = async () => {
  const setupSecret = import.meta.env.VITE_SETUP_SECRET;
  if (!setupSecret || loginForm.password !== setupSecret) return false;
  const email = authEmailFor(loginForm.name);
  const cred = await createUserWithEmailAndPassword(auth, email, loginForm.password);
  const id = Date.now().toString();
  const profile = { id, name: loginForm.name, role: 'admin', permissions: {},
                    authUid: cred.user.uid, authEmail: email, loginName: loginForm.name };
  await saveToFirebase('app_users', id, profile);
  await saveToFirebase('userRoles', cred.user.uid, {
    uid: cred.user.uid, appUserId: id, name: loginForm.name, role: 'admin', permissions: {}, active: true });
  await writeLoginIndex(profile, email);
  const defaultCats = ['Transport', 'Utility Bill', 'Staff Food/Tea', 'Maintenance', 'Other'];
  defaultCats.forEach((cat, i) => saveToFirebase('expenseCategories', Date.now()+i, { id: Date.now()+i, name: cat }));
  setCurrentUser({ id, name: loginForm.name, role: 'admin', permissions: {}, authUid: cred.user.uid });
  showToast("Welcome! Admin account created.");
  return true;
};
// Authenticate BEFORE touching the database. The old flow looked the user up in
// app_users to find their credentials, which cannot work once the rules are closed —
// a signed-out visitor may read nothing. So: resolve the username to a login address
// through the public loginIndex, sign in, and only then read anything.
const slug = loginSlug(loginForm.name);
let email = null;
try {
  const idx = await getDoc(doc(db, 'loginIndex', slug));
  if (idx.exists()) email = idx.data().authEmail;
} catch (err) {
  console.error('Login index lookup failed:', err);
}
// No index entry: fall back to the address derived from the name. Covers accounts
// migrated before the index existed, and anyone whose login has never been reset.
if (!email) email = authEmailFor(loginForm.name);

try {
  const cred = await signInWithEmailAndPassword(auth, email, loginForm.password);
  // Identity comes from the role mirror, keyed by uid — the one document a signed-in
  // user is always allowed to read about themselves.
  const roleSnap = await getDoc(doc(db, 'userRoles', cred.user.uid));
  if (!roleSnap.exists()) {
    await signOut(auth);
    showToast("Account is not set up — ask an admin to re-save it", "error");
    return;
  }
  const r = roleSnap.data();
  if (r.active === false) {
    await signOut(auth);
    showToast("This account has been disabled", "error");
    return;
  }
  setCurrentUser({ id: r.appUserId, name: r.name, role: r.role || 'staff', permissions: r.permissions || {}, authUid: cred.user.uid });
  showToast(`Welcome ${r.name}`);
} catch (err) {
  const noSuchAccount = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err.code);
  if (noSuchAccount) {
    try {
      if (await bootstrapFirstAdmin()) return;
    } catch (bootErr) {
      console.error('Bootstrap failed:', bootErr.code || bootErr);
    }
  }
  console.error('Sign-in failed:', err.code);
  showToast(err.code === 'auth/too-many-requests'
    ? "Too many attempts — wait a minute and try again"
    : "Invalid Credentials", "error");
}
};

// Write the username -> login address entry that sign-in reads before authenticating.
// Public by necessity: it is consulted while signed out. It holds no secret — just the
// synthetic address a username maps to.
const writeLoginIndex = async (user, email) => {
  const slug = loginSlug(user.loginName || user.name);
  await saveToFirebase('loginIndex', slug, { slug, authEmail: email, appUserId: user.id });
};

// Rewrite every migrated account's index entry. Idempotent and cheap; exists because the
// first accounts were migrated before the index did, and without an entry a reset login
// cannot be resolved at sign-in.
const repairLoginIndex = async () => {
  const migrated = appUsers.filter(u => u.authUid);
  for (const u of migrated) {
    await writeLoginIndex(u, u.authEmail || authEmailFor(u.loginName || u.name));
  }
  return migrated.length;
};

// Create or update a staff account, keeping all three records in step: the profile in
// app_users, the role mirror the security rules read, and the login index sign-in needs.
// Letting these drift is how someone ends up able to log in but authorised for nothing.
const saveUserAccount = async (form, isEdit) => {
  const permissions = form.role === 'admin' ? {} : (form.permissions || {});
  // Losing the last working admin leaves nobody able to write userRoles, and the rules
  // grant that to admins alone — so the app could never promote anyone again. Recovery
  // would mean hand-editing Firestore in the console. Refuse instead. Demoting and
  // disabling both remove an admin, so both are checked.
  const stillAdmin = form.role === 'admin' && form.active !== false;
  if (isEdit && !stillAdmin) {
    const workingAdmins = appUsers.filter(u => u.role === 'admin' && u.active !== false);
    if (workingAdmins.length <= 1 && workingAdmins.some(u => String(u.id) === String(form.id))) {
      return { ok: false, why: 'This is the only active admin. Give someone else admin access first, or nobody will be able to manage users.' };
    }
  }
  if (isEdit && form.active === false && String(form.id) === String(currentUser?.id)) {
    return { ok: false, why: 'You cannot disable your own account — you would be signed out with no way back in.' };
  }
  if (isEdit) {
    const { password, ...rest } = form;
    const profile = { ...rest, permissions };
    await saveToFirebase('app_users', form.id, profile);
    if (form.authUid) {
      await saveToFirebase('userRoles', form.authUid, {
        uid: form.authUid, appUserId: form.id, name: form.name,
        role: form.role || 'staff', permissions, active: form.active !== false,
      });
      await writeLoginIndex(profile, profile.authEmail || authEmailFor(profile.loginName || profile.name));
    }
    return { ok: true };
  }

  const id = Date.now().toString();
  const email = authEmailFor(form.name);
  if ((form.password || '').length < 6) return { ok: false, why: 'Password must be at least 6 characters.' };
  let secondary = null;
  try {
    secondary = initializeApp(firebaseConfig, 'newuser-' + id);
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), email, form.password);
    const profile = { id, name: form.name, role: form.role || 'staff', permissions,
                      authUid: cred.user.uid, authEmail: email, loginName: form.name };
    await saveToFirebase('app_users', id, profile);
    await saveToFirebase('userRoles', cred.user.uid, {
      uid: cred.user.uid, appUserId: id, name: form.name,
      role: form.role || 'staff', permissions, active: true,
    });
    await writeLoginIndex(profile, email);
    return { ok: true };
  } catch (err) {
    return { ok: false, why: err.code === 'auth/email-already-in-use'
      ? 'That username is already taken by an old login. Pick a slightly different name.'
      : err.code === 'auth/operation-not-allowed'
        ? 'Email/Password sign-in is not enabled in the Firebase console.'
        : (err.code || err.message) };
  } finally {
    if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
  }
};

// Give a migrated account a new password.
//
// The client SDK cannot change another user's password, and Firebase's reset-by-email
// flow needs a real mailbox — these synthetic addresses have none. Without this there is
// NO way to recover a forgotten password short of a backend, which would mean a permanent
// lockout. So: create a fresh Auth account under a new alias and repoint the user record.
//
// The old Auth account still exists and its password still opens it, so its role mirror
// MUST be deleted — under the strict rules a stale userRoles document would keep granting
// that old login full access.
const resetUserLogin = async (u, newPassword) => {
  if (!newPassword || newPassword.length < 6) return { ok: false, why: 'Password must be at least 6 characters.' };
  const base = authEmailFor(u.loginName || u.name).split('@')[0];
  const email = `${base}.${Date.now().toString(36)}@animalhealthpk.app`;
  const previousUid = u.authUid;
  let secondary = null;
  try {
    secondary = initializeApp(firebaseConfig, 'reset-' + u.id + '-' + Date.now());
    const sAuth = getAuth(secondary);
    const cred = await createUserWithEmailAndPassword(sAuth, email, newPassword);
    const { password, ...rest } = u;
    await saveToFirebase('app_users', u.id, { ...rest, authUid: cred.user.uid, authEmail: email, loginName: u.loginName || u.name });
    await saveToFirebase('userRoles', cred.user.uid, {
      uid: cred.user.uid, appUserId: u.id, name: u.name,
      role: u.role || 'staff', permissions: u.permissions || {}, active: true,
    });
    if (previousUid && previousUid !== cred.user.uid) {
      await deleteFromFirebase('userRoles', previousUid);
    }
    // Point the username at the NEW address, or sign-in would keep resolving to the old
    // account and the reset would appear to do nothing.
    await writeLoginIndex(u, email);
    return { ok: true };
  } catch (err) {
    return { ok: false, why: err.code === 'auth/operation-not-allowed'
      ? 'Email/Password sign-in is not enabled in the Firebase console.'
      : (err.code || err.message) };
  } finally {
    if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
  }
};

// Migrate every account that still holds a stored password into Firebase Auth.
//
// Each account is created through a SECONDARY Firebase app instance: the client SDK signs
// you in as whoever it just created, which would kick the admin out of their own session
// halfway through the run. The secondary instance is discarded immediately after.
//
// Only clears the stored password once Firebase confirms the account exists, so a failure
// leaves that user still able to log in the old way.
const migrateUsersToAuth = async () => {
  const pending = appUsers.filter(u => !u.authUid);
  if (pending.length === 0) return { done: 0, failed: [] };
  const failed = [];
  let done = 0;

  for (const u of pending) {
    const email = authEmailFor(u.name);
    const pw = u.password || '';
    if (pw.length < 6) {
      failed.push({ name: u.name, why: 'Password is under 6 characters. Firebase requires 6+. Set a longer password for this user, then run this again.' });
      continue;
    }
    let secondary = null;
    try {
      secondary = initializeApp(firebaseConfig, 'migrate-' + u.id + '-' + Date.now());
      const sAuth = getAuth(secondary);
      let uid;
      try {
        const cred = await createUserWithEmailAndPassword(sAuth, email, pw);
        uid = cred.user.uid;
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          // A previous partial run already created it — adopt that account rather than
          // failing, but only if this password really opens it.
          const cred = await signInWithEmailAndPassword(sAuth, email, pw);
          uid = cred.user.uid;
        } else {
          throw err;
        }
      }
      const { password, ...withoutPassword } = u;
      await saveToFirebase('app_users', u.id, { ...withoutPassword, authUid: uid, authEmail: email, loginName: u.name });
      // Mirror the role under the Auth UID. Security rules can only get() a document by
      // path, and user documents are keyed by a timestamp id, not by uid — so without this
      // the rules have no way to look up who is asking. Keep it minimal: no password, no
      // personal data, just what an authorisation decision needs.
      await saveToFirebase('userRoles', uid, {
        uid,
        appUserId: u.id,
        name: u.name,
        role: u.role || 'staff',
        permissions: u.permissions || {},
        active: true,
      });
      await writeLoginIndex({ ...u, loginName: u.name }, email);
      done += 1;
    } catch (err) {
      failed.push({ name: u.name, why: err.code === 'auth/operation-not-allowed'
        ? 'Email/Password sign-in is not enabled in the Firebase console.'
        : (err.code || err.message) });
    } finally {
      if (secondary) { try { await signOut(getAuth(secondary)); } catch (e) {} try { await deleteApp(secondary); } catch (e) {} }
    }
  }
  return { done, failed };
};

// `merge` writes only the fields given, leaving the rest of the document alone. Default is
// a full replace, which is what almost every caller wants — but see the auto-backup below
// for the case where a replace silently undid somebody's edit.
const saveToFirebase = async (collectionName, id, dataObj, { merge = false } = {}) => {
try {
  const ack = setDoc(doc(db, collectionName, String(id)), dataObj, { merge });
  // Persistence is on, so the write applies locally at once but this promise only settles
  // when the SERVER acknowledges. On a bad connection it can stay pending indefinitely,
  // and the caller's success toast never runs — a save that appears to do nothing at all,
  // with no error either. Saying so is better than silence.
  let slow = false;
  const warn = setTimeout(() => { slow = true; showToast('Still saving — check your connection', 'error'); }, 6000);
  await ack;
  clearTimeout(warn);
  if (slow) showToast('Saved.');
} catch (e) {
console.error("Firebase Write Error:", e);
showToast("Network Error - Could not save", "error");
}
};

const vehicleTypesSeeded = React.useRef(false);
React.useEffect(() => {
  // Seed default vehicle types — only when Firestore has responded (appSettings loaded)
  // and the collection is genuinely empty. Predictable string IDs prevent duplicates.
  if (!appSettings?.id || vehicleTypes.length > 0 || vehicleTypesSeeded.current) return;
  vehicleTypesSeeded.current = true;
  const defaults = [
    { name: 'Rider',               requiresRider: true  },
    { name: 'Rickshaw',            requiresRider: true  },
    { name: 'Suzuki',              requiresRider: true  },
    { name: 'Intercity Transport', requiresRider: false },
    { name: 'Self-Pickup',         requiresRider: false },
  ];
  defaults.forEach(d => {
    const id = 'vt_' + d.name.replace(/\s+/g, '_');
    saveToFirebase('vehicleTypes', id, { id, name: d.name, requiresRider: d.requiresRider });
  });
}, [appSettings?.id, vehicleTypes.length]);

React.useEffect(() => {
  if (appSettings?.id === 'main' && appSettings.showBusinessNameOnDocs === undefined) {
    saveToFirebase('appSettings', 'main', { showBusinessNameOnDocs: true, showBusinessNameOnReports: true }, { merge: true });
  }
}, [appSettings?.id, appSettings?.showBusinessNameOnDocs]);

// Auto-backup (Firebase + Google Drive) — runs once per session when settings load
const autoBackupRan = React.useRef(false);
React.useEffect(() => {
  // Admins only. Once the rules are closed a staff member cannot read app_users, so their
  // backup would write an EMPTY copy over that day's real one — and every write would be
  // refused anyway, producing a failure toast per collection. Backing up is an admin job.
  if (autoBackupRan.current || !appSettings?.id || !isAdmin) return;
  const exportedAt = new Date().toISOString();
  const date = exportedAt.slice(0, 10);
  const isDue = (lastAt, freq) => {
    if (!freq || freq === 'never') return false;
    const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 30;
    return (Date.now() - (lastAt ? new Date(lastAt) : new Date(0)).getTime()) / 86400000 >= days;
  };

  const firebaseDue = isDue(appSettings.lastBackupAt, appSettings.backupFreq || appSettings.githubFreq);
  const driveDue = isDue(appSettings.lastDriveBackupAt, appSettings.driveFreq) && !!appSettings.driveScriptUrl;
  if (!firebaseDue && !driveDue) return;

  autoBackupRan.current = true;
  const cols = { app_users: appUsers, appSettings: [appSettings], companies, products, customers, invoices, expenses, expenseCategories, payments, riders, cities, areas, customerTypes, vehicleTypes };
  const backupObj = { exportedAt, collections: cols };

  if (firebaseDue) {
    Promise.all(Object.entries(cols).map(([col, items]) =>
      saveToFirebase('backups', `${date}_${col}`, { items: items || [], backedUpAt: exportedAt })
    ))
      // Stamp ONLY the timestamp, merged. This used to write { ...appSettings } back — a
      // snapshot captured before fifteen collections were uploaded — so anything the user
      // changed in Settings during those seconds was silently reverted to the old value.
      .then(() => saveToFirebase('appSettings', 'main', { lastBackupAt: exportedAt }, { merge: true }))
      .then(() => showToast('Auto-backup saved to Firebase'))
      .catch(e => console.warn('Firebase auto-backup failed:', e));
  }

  if (driveDue) {
    uploadToDrive(appSettings.driveScriptUrl, backupObj, appSettings.driveFolderId)
      .then(() => saveToFirebase('appSettings', 'main', { lastDriveBackupAt: exportedAt }, { merge: true }))
      .then(() => showToast('Auto-backup sent to Google Drive'))
      .catch(e => console.warn('Drive auto-backup failed:', e));
  }
}, [isAdmin, appSettings?.id, appSettings?.backupFreq, appSettings?.githubFreq, appSettings?.lastBackupAt, appSettings?.driveFreq, appSettings?.driveScriptUrl, appSettings?.lastDriveBackupAt]);

const deleteFromFirebase = async (collectionName, id) => {
try {
await deleteDoc(doc(db, collectionName, String(id)));
} catch (e) {
console.error("Firebase Delete Error:", e);
showToast("Network Error - Could not delete", "error");
}
};

// ── Audit log ──────────────────────────────────────────────────────────────
// Append-only in firestore.rules: any active user may create, nobody may update or delete.
// A failure here must never block the business action — a payment that saved and did not
// log is bad; a payment refused because the log was unreachable is worse. So this swallows
// its own errors and reports to the console only.
// auditLogs only ever grows, so it must never get a live listener — see
// docs/FIRESTORE_READS.md. One bounded read, newest first, when the tab is opened.
// Returns null on failure so the caller can tell "could not read" from "nothing logged".
const fetchAuditLog = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(LOG_PAGE)));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Audit log read failed:', e);
    return null;
  }
};

const writeAudit = async (entry) => {
  try {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await setDoc(doc(db, 'auditLogs', id), { id, ...entry });
  } catch (e) {
    console.error('Audit write failed:', e);
  }
};

const logAction = (action, collectionName, record, extra = {}) => writeAudit(auditEntry({
  action,
  collection: collectionName,
  recordId: record?.id,
  label: extra.label ?? record?.id ?? '',
  reason: extra.reason || '',
  changes: extra.changes || [],
  user: currentUser,
}));

// Log a save, working out for itself whether this is a create or an edit and what moved.
// `before` is the record as it was, or null/undefined for a new one.
const logSave = (collectionName, before, after, label) => logAction(
  before ? AUDIT.UPDATE : AUDIT.CREATE, collectionName, after,
  { label, changes: before ? changedFields(before, after) : [] });

// For the hard deletes that legitimately remain — an estimate consumed by being issued as
// an invoice, say. Financial records are voided, not deleted, so this is deliberately rare.
const logDelete = (collectionName, record, reason, label) =>
  logAction(AUDIT.DELETE, collectionName, record, { label: label || record?.id, reason });

// ── Void ───────────────────────────────────────────────────────────────────
// Financial records are never removed. Voiding keeps the document, drops it out of every
// balance (the filter above), and records who and why. `reason` is mandatory: a void with
// no explanation answers none of the questions the log exists to answer.
const voidRecord = async (collectionName, record, { label, reason } = {}) => {
  if (!record?.id) return false;
  const voided = { ...record, ...voidPatch({ user: currentUser, reason }) };
  await saveToFirebase(collectionName, record.id, voided);
  await logAction(AUDIT.VOID, collectionName, record, { label: label || record.id, reason });
  return true;
};

const restoreRecord = async (collectionName, record, { label } = {}) => {
  if (!record?.id) return false;
  await saveToFirebase(collectionName, record.id, { ...record, ...restorePatch({ user: currentUser }) });
  await logAction(AUDIT.RESTORE, collectionName, record, { label: label || record.id });
  return true;
};

// — Ledger Engine —
// Delegates to the tested service so every screen computes a balance identically.
// Behaviour is unchanged from the inline version this replaced; ledger.test.js pins it.
const getCustomerLedger = (customerId) => buildCustomerLedger(customerId, { customers, invoices, payments });

// Payment status, derived rather than stored.
//
// The stored `paymentStatus` field was set by hand and never maintained, so an invoice
// still read "Pending" after the customer had paid — on screen, and in the analytics filter
// that counts paid invoices. Computed here from what the customer has actually paid.
//
// Built as one map per data change rather than per row: allocation is per-customer, so
// calling it inside a list render would be quadratic.
const paymentStatusById = useMemo(() => {
  const byId = new Map();
  const customerIds = [...new Set(invoices.filter(o => o.status === 'Billed').map(o => o.customerId))];
  customerIds.forEach(cid => {
    const settled = allocateCredits(cid, { invoices, payments });
    settled.forEach((amount, invoiceId) => {
      const inv = invoices.find(o => o.id === invoiceId);
      if (inv) byId.set(invoiceId, statusFromSettled(inv.total, amount));
    });
  });
  return byId;
}, [invoices, payments]);

// Falls back to the stored value only for records the allocator does not cover.
const getPaymentStatus = (invoice) =>
  (invoice && paymentStatusById.get(invoice.id)) || invoice?.paymentStatus || null;

const getCustomerBalance = (customerId) => {
const ledger = getCustomerLedger(customerId);
return ledger ? ledger.closingBal : 0;
};

const generateReceiptData = (ledger, rowId) => {
if (!ledger) return null;
const row = ledger.rows.find(r => r.id === rowId);
if(!row) return null;
const isInvoicePayment = row.id.endsWith('-PAY');
const actualId = isInvoicePayment ? row.ref : row.id;
const entryIndex = ledger.rows.findIndex(r => r.id === row.id);
const prevBalance = entryIndex > 0 ? ledger.rows[entryIndex - 1].balance : ledger.openingBal;
const payDiscount = row.discount || 0;
const amountReceived = row.credit - payDiscount;
return {
id: actualId,
date: row.date,
customerName: ledger.customerName,
receivedAmount: amountReceived,
discount: payDiscount,
totalCredit: row.credit,
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
      else if (showCreditNoteModal) { setEditingCreditNote(null); setShowCreditNoteModal(false); }
      else if (showLedgerModal) setShowLedgerModal(false);
      else if (showUserModal) setShowUserModal(false);
      else if (showExpenseCatModal) setShowExpenseCatModal(false);
      else if (showSegmentsModal) setShowSegmentsModal(false);
      else if (showRidersModal) setShowRidersModal(false);
      else if (billingView === 'form') setBillingView('list');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [currentUser, printConfig, showProductModal, showCustomerModal, showPaymentModal, showCreditNoteModal, showLedgerModal, showUserModal, showExpenseCatModal, showSegmentsModal, showRidersModal, billingView]);

// Tab list & permission helpers — defined here so the redirect effect below can use them
// while still being BEFORE any conditional return (Rules of Hooks)
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home',     perm: 'viewDashboard' },
  { id: 'products',  icon: Package,         label: 'Items',    adminOnly: true },
  { id: 'billing',   icon: ReceiptText,     label: 'Billing' },
  { id: 'customers', icon: Users,           label: 'Clients',  perm: 'viewCustomers' },
  { id: 'payments',  icon: Wallet,          label: 'Receipts' },
  { id: 'admin',     icon: Settings,        label: 'Admin',    adminOnly: true },
];
const canSeeTab = (tab) => {
  if (tab.adminOnly) return isAdmin;
  if (tab.perm) return hasPermission(tab.perm);
  return true;
};
// Auto-redirect away from restricted tabs — must be BEFORE conditional return
useEffect(() => {
  const cur = TABS.find(t => t.id === activeTab);
  if (cur && !canSeeTab(cur)) setActiveTab('billing');
}, [activeTab, currentUser]);  // eslint-disable-line react-hooks/exhaustive-deps

// Toasts must be rendered by both the login screen and the main app. The login screen
// returns early, so anything defined only in the main render never appears there — which
// silently swallowed every login error, including "Invalid Credentials" on a wrong
// password. The screen simply did nothing.
const toastEl = toast && (
  <div className={`fixed top-6 right-6 lg:left-auto left-1/2 lg:-translate-x-0 -translate-x-1/2 px-5 py-3 rounded-2xl shadow-xl z-[100] font-semibold text-white flex items-center gap-2.5 text-sm transition-all animate-slide-up ${toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>
    {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18} className="text-emerald-400"/>}
    {toast.msg}
  </div>
);

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
{toastEl}
</div>
);
}

const logout = async () => {
  try { await signOut(auth); } catch (e) { console.error('Sign-out failed:', e); }
  setCurrentUser(null);
};

// — Main Render —
const ctx = {
isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers,
cities, areas, customerTypes, vehicleTypes,
getPaymentStatus,
showToast, showConfirm, showPrompt, confirmDialog, setConfirmDialog, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData,
voidRecord, restoreRecord, logSave, logDelete, fetchAuditLog, claimDocNumber, invoicesRaw, paymentsRaw, expensesRaw,
billingView, setBillingView, currentInvoice, setCurrentInvoice,
activeTab, setActiveTab, adminView, setAdminView, analyticsView, setAnalyticsView,
editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill,
editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal,
showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment,
showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId,
showExpenseCatModal, setShowExpenseCatModal,
showUserModal, setShowUserModal, editingUser, setEditingUser,
setPrintConfig, printConfig,
showSegmentsModal, setShowSegmentsModal,
showRidersModal, setShowRidersModal,
riders, transportCompanies,
editingPayment, setEditingPayment,
showCreditNoteModal, setShowCreditNoteModal, editingCreditNote, setEditingCreditNote,
appSettings,
migrateUsersToAuth, resetUserLogin, repairLoginIndex, saveUserAccount, logout,
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
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)} title={`Alt+${tab.label[0].toLowerCase()}`}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
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
      <button onClick={logout} className="w-full text-xs font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">Log Out</button>
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
      <button onClick={logout} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">Log Out</button>
    </header>

    {/* Desktop top bar */}
    <header className="hidden lg:flex bg-white border-b border-slate-200 px-6 py-3 items-center justify-between shadow-sm z-10">
      <h2 className="text-base font-bold text-slate-800 capitalize">{TABS.find(t=>t.id===activeTab)?.label || ''}</h2>
      <div className="flex items-center gap-3">
        {activeTab === 'billing' && billingView === 'list' && (
          <button onClick={() => { setCurrentInvoice({ id: null, customerId: '', customerName: '', customerDetails: {}, items: [], deliveryBilled: 0, transportExpense: 0, discount: 0, vehicle: VEHICLES[0], paymentStatus: 'Pending', receivedAmount: 0, transportCompany: '', biltyNumber: '', driverName: '', driverPhone: '', riderId: '', deliveryAddressKey: 'address1', notes: '' }); setBillingView('form'); }} className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"><Plus size={16}/> New Invoice <kbd className="ml-1 text-[9px] bg-indigo-500 px-1.5 py-0.5 rounded font-mono">Alt+B</kbd></button>
        )}
        {activeTab === 'customers' && (
          <button onClick={() => { setSelectedCustomerForPayment(null); setShowPaymentModal(true); }} className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm"><Wallet size={16}/> Receive Payment</button>
        )}
        <span className="text-[10px] text-slate-400 font-medium">Esc = back/close</span>
      </div>
    </header>

    <main className="flex-1 overflow-hidden h-full bg-slate-50 lg:bg-slate-100">
      <div className="relative h-full lg:max-w-4xl lg:mx-auto lg:my-0 bg-slate-50 lg:shadow-sm overflow-hidden flex flex-col">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'admin' && <AdminTab />}
      </div>
    </main>

    {/* Mobile bottom nav */}
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-between pb-6 pt-3 px-2 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
      {TABS.map(tab => {
        if (!canSeeTab(tab)) return null;
        const active = activeTab === tab.id;
        const draftCount = tab.id === 'billing' ? invoices.filter(o => o.status === 'Booked' || o.status === 'Estimate').length : 0;
        return (
          <button key={tab.id} data-sidenav={tab.id} tabIndex={active ? 0 : -1} onClick={() => setActiveTab(tab.id)}
            onKeyDown={makeArrowNav(TABS.filter(t=>canSeeTab(t)).map(t=>t.id), activeTab, setActiveTab, 'data-sidenav')}
            className={`flex flex-col items-center justify-center w-full transition-all ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
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
      appSettings={appSettings}
    />
  )}

  {showProductModal && <ProductModal />}
  {showCustomerModal && <CustomerModal />}
  {showLedgerModal && <CustomerLedgerModal />}
  {showPaymentModal && <PaymentModal />}
  {showCreditNoteModal && <CreditNoteModal />}
  {showExpenseCatModal && <ExpenseCategoryModal />}
  {showUserModal && <UserModal />}
  {showSegmentsModal && <SegmentsModal />}
  {showRidersModal && <RidersModal />}
  <ConfirmDialog />

  {toastEl}

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