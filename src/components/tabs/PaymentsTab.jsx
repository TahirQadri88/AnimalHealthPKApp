import { useState, useMemo, useContext } from 'react';
import { Plus, Search, Edit, Trash2, Receipt, Printer } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import SearchableSelect from '../SearchableSelect';
import { formatDateDisp, checkDateFilter } from '../../helpers';

export const PaymentsTab = () => {
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
