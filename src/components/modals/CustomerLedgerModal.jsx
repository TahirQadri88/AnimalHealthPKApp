import { useState, useContext } from 'react';
import { Wallet, Edit, Trash2, Receipt, ReceiptText, FileText, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import { getLocalDateStr, formatDateDisp } from '../../helpers';

export const CustomerLedgerModal = () => {
const { selectedLedgerId, getCustomerLedger, generateReceiptData, setPrintConfig, setShowPaymentModal, setSelectedCustomerForPayment, setShowLedgerModal, deleteFromFirebase, saveToFirebase, invoices, isAdmin, setEditingPayment, payments, setShowCreditNoteModal, setEditingCreditNote, showConfirm, setCurrentInvoice, setBillingView, setActiveTab, showPrompt, voidRecord, logSave, showToast } = useContext(AppContext);
const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return getLocalDateStr(d); });
const [endDate, setEndDate] = useState(getLocalDateStr());
const [ledgerMode, setLedgerMode] = useState('simple'); // 'simple' | 'detailed'
const fullLedger = getCustomerLedger(selectedLedgerId);
if(!fullLedger) return null;
const preRows = fullLedger.rows.filter(r => r.date < startDate);
const periodOpeningBal = fullLedger.openingBal + preRows.reduce((sum, r) => sum + r.debit - r.credit, 0);
const filteredRows = fullLedger.rows.filter(r => r.date >= startDate && r.date <= endDate);
const periodTotalDebit = filteredRows.reduce((sum, r) => sum + r.debit, 0);
const periodTotalCredit = filteredRows.reduce((sum, r) => sum + r.credit, 0);
const printData = { ...fullLedger, dateRange: { start: startDate, end: endDate }, openingBal: periodOpeningBal, rows: filteredRows, totalDebit: periodTotalDebit, totalCredit: periodTotalCredit, ledgerMode };
return (
<ModalWrapper title={`${fullLedger.customerName} - Account Ledger`} onClose={() => setShowLedgerModal(false)} maxWidth="max-w-3xl">
<div className="space-y-4 pb-10">
<div className="flex items-center gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200">
<div className="flex-1"><label className="text-[9px] font-bold uppercase text-slate-500 block mb-1 tracking-wider">Start Date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-indigo-500 bg-white" /></div>
<div className="flex-1"><label className="text-[9px] font-bold uppercase text-slate-500 block mb-1 tracking-wider">End Date</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-slate-300 outline-none focus:border-indigo-500 bg-white" /></div>
<div className="ml-2 text-right bg-rose-50 px-2.5 py-2 rounded-xl border border-rose-200 shadow-sm shrink-0"><p className="text-[9px] font-bold uppercase text-rose-600 tracking-widest whitespace-nowrap">Balance</p><p className="text-sm font-black text-rose-700 mt-0.5 whitespace-nowrap">Rs.{fullLedger.closingBal.toLocaleString('en-US')}</p></div>
</div>
{/* Ledger mode toggle */}
<div className="flex bg-slate-100 p-1 rounded-xl gap-1">
  <button onClick={() => setLedgerMode('simple')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-colors ${ledgerMode==='simple'?'bg-indigo-600 text-white shadow-sm':'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}>Simple Ledger</button>
  <button onClick={() => setLedgerMode('detailed')} className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-colors ${ledgerMode==='detailed'?'bg-indigo-600 text-white shadow-sm':'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}>Detailed (Items)</button>
</div>
{/* Summary row */}
<div className="grid grid-cols-3 gap-2 text-center">
  <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Debit</p><p className="font-black text-indigo-700 text-sm tabular-nums">Rs.{periodTotalDebit.toLocaleString('en-US')}</p></div>
  <div className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2"><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Credit</p><p className="font-black text-emerald-600 text-sm tabular-nums">Rs.{periodTotalCredit.toLocaleString('en-US')}</p></div>
  <div className="bg-rose-50 border border-rose-200 rounded-xl px-2 py-2"><p className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">Period Bal</p><p className="font-black text-rose-700 text-sm tabular-nums">Rs.{(periodOpeningBal+periodTotalDebit-periodTotalCredit).toLocaleString('en-US')}</p></div>
</div>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setEditingPayment(null); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all text-xs"><Wallet size={15} /> Receive Payment</button>}
{isAdmin && <button onClick={() => { setEditingCreditNote({customerId: fullLedger.id, id: ''}); setShowCreditNoteModal(true); }} className="flex-1 bg-rose-500 hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all text-xs"><RotateCcw size={15} /> Credit Note</button>}
<button onClick={() => setPrintConfig({docType: 'ledger', format: 'a5', data: printData})} className="flex-1 bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all text-xs"><FileSpreadsheet size={15} /> Print Ledger</button>
</div>
<div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
<div className="overflow-x-auto">
<table className="w-full text-left text-[11px] sm:text-xs min-w-[500px]">
<thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="py-2.5 px-3 font-bold uppercase tracking-wider">Date</th><th className="py-2.5 px-3 font-bold uppercase tracking-wider">Particulars</th><th className="py-2.5 px-3 text-right font-bold uppercase tracking-wider">Debit</th><th className="py-2.5 px-3 text-right font-bold uppercase tracking-wider">Credit</th><th className="py-2.5 px-3 text-right font-bold uppercase tracking-wider">Balance</th><th className="py-2.5 px-2 text-center"></th></tr></thead>
<tbody className="divide-y divide-slate-100 text-slate-800">
<tr className="bg-slate-50/30"><td className="py-2 px-3 text-slate-500 font-medium text-[10px]" colSpan={4}>Opening Balance <span className="text-[9px]">(as of {formatDateDisp(startDate)})</span></td><td className="py-2 px-3 text-right font-bold text-slate-700 tabular-nums">Rs.{periodOpeningBal.toLocaleString('en-US')}</td><td></td></tr>
{filteredRows.map(row => (
<tr key={row.id} className="hover:bg-slate-50 transition-colors">
<td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap">{formatDateDisp(row.date)}</td>
<td className="py-2.5 px-3 max-w-[200px]">
<span className={`font-bold block ${row.isCreditNote ? 'text-rose-700' : 'text-slate-800'}`}>{row.desc}</span>
<span className="block text-[9px] text-slate-400 mt-0.5">{row.ref}</span>
{row.isCreditNote && <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block">Credit Note</span>}
{ledgerMode === 'detailed' && (row.lineItems || []).length > 0 && (
  <div className="mt-2 border-t border-slate-100 pt-2">
    <table className="w-full text-[9.5px]" style={{borderCollapse:'collapse'}}>
      <thead>
        <tr className="text-slate-400 border-b border-slate-100">
          <th className="text-left font-bold pb-1 pr-2">Product</th>
          <th className="text-center font-bold pb-1 px-1 whitespace-nowrap">Qty</th>
          <th className="text-right font-bold pb-1 px-1 whitespace-nowrap">Rate</th>
          <th className="text-right font-bold pb-1 pl-1 whitespace-nowrap">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {row.lineItems.map((li, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? '' : 'bg-slate-50/50'}>
            <td className="py-0.5 pr-2 font-semibold text-slate-700 leading-tight">{li.isBonus && <span className="mr-0.5">🎁</span>}{li.name}</td>
            <td className="py-0.5 px-1 text-center text-slate-500 tabular-nums">{li.qty}</td>
            <td className="py-0.5 px-1 text-right text-slate-500 tabular-nums">{li.isBonus ? '—' : `Rs.${(li.price||0).toLocaleString('en-US')}`}</td>
            <td className="py-0.5 pl-1 text-right font-bold text-slate-700 tabular-nums">{li.isBonus ? <span className="text-emerald-600 font-bold text-[9px]">FREE</span> : `Rs.${(li.subtotal||0).toLocaleString('en-US')}`}</td>
          </tr>
        ))}
        {(row.deliveryBilled || 0) > 0 && (
          <tr className="border-t border-slate-100">
            <td colSpan={3} className="pt-1 pr-2 text-slate-400 font-semibold">+ Delivery Charge</td>
            <td className="pt-1 pl-1 text-right font-bold text-slate-600 tabular-nums">Rs.{row.deliveryBilled.toLocaleString('en-US')}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}
</td>
<td className="py-2.5 px-3 text-right font-extrabold text-indigo-600 tabular-nums">{row.debit > 0 ? row.debit.toLocaleString('en-US') : '-'}</td>
<td className="py-2.5 px-3 text-right font-extrabold text-emerald-600 tabular-nums">{row.credit > 0 ? row.credit.toLocaleString('en-US') : '-'}</td>
<td className="py-2.5 px-3 text-right font-extrabold text-slate-800 tabular-nums">{row.balance.toLocaleString('en-US')}</td>
<td className="py-2.5 px-2 text-center">
<div className="flex gap-1 justify-center flex-wrap">
{row.debit > 0 && !row.isCreditNote && (<button onClick={() => { const inv = invoices.find(o => o.id === row.id); if(inv) setPrintConfig({docType:'invoice', format:'thermal', data: inv}); }} title="Print Invoice" className="p-1.5 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-indigo-500 rounded-lg transition-colors"><ReceiptText size={13}/></button>)}
{isAdmin && row.debit > 0 && !row.isCreditNote && (<button onClick={() => { const inv = invoices.find(o => o.id === row.id); if(inv){ setCurrentInvoice(inv); setBillingView('form'); setActiveTab('billing'); setShowLedgerModal(false); }}} title="Edit Invoice" className="p-1.5 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-600 rounded-lg transition-colors"><Edit size={13}/></button>)}
{row.isCreditNote && (<button onClick={() => { const cn = invoices.find(o => o.id === row.id); if(cn) setPrintConfig({docType:'creditnote', format:'a4', data: cn}); }} title="Print Credit Note" className="p-1.5 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-1 focus:ring-rose-400 text-rose-500 rounded-lg transition-colors"><FileText size={13}/></button>)}
{row.isCreditNote && isAdmin && (<button onClick={() => { setEditingCreditNote({ customerId: fullLedger.id, id: row.id }); setShowLedgerModal(false); setShowCreditNoteModal(true); }} title="Edit Credit Note" className="p-1.5 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-600 rounded-lg transition-colors"><Edit size={13}/></button>)}
{row.isCreditNote && isAdmin && (<button onClick={async () => { const cn = invoices.find(o => o.id === row.id); if (!cn) return; const reason = await showPrompt(`Void credit note ${row.id}?\n\nIt stays on file and drops out of the balance.`, { placeholder: 'e.g. entered twice' }); if (reason === null) return; await voidRecord('invoices', cn, { label: row.id, reason }); showToast(`${row.id} voided`); }} title="Void Credit Note" className="p-1.5 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-1 focus:ring-rose-400 text-rose-500 rounded-lg transition-colors"><Trash2 size={13}/></button>)}
{row.credit > 0 && !row.isCreditNote && (<button onClick={() => setPrintConfig({docType: 'receipt', format: 'thermal', data: generateReceiptData(fullLedger, row.id)})} title="Print Receipt" className="p-1.5 bg-emerald-50 hover:bg-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-emerald-600 rounded-lg transition-colors"><Receipt size={13}/></button>)}
{isAdmin && row.credit > 0 && row.id.startsWith('REC-') && (
<button title="Edit Payment" onClick={() => { const pay = payments.find(p => p.id === row.id); if(pay){ setEditingPayment(pay); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }}} className="p-1.5 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-600 rounded-lg transition-colors"><Edit size={13}/></button>
)}
{isAdmin && row.credit > 0 && !row.isCreditNote && (
<button title="Void Payment" onClick={async () => {
  const reason = await showPrompt('Void this payment?\n\nIt stays on file and comes back out of the balance.', { placeholder: 'e.g. recorded against the wrong client' });
  if (reason === null) return;
  if (row.id.startsWith('REC-')) {
    const pay = payments.find(p => p.id === row.id);
    if (pay) await voidRecord('payments', pay, { label: row.id, reason });
  } else if (row.id.endsWith('-PAY')) {
    // Cash taken at billing time is a field on the invoice, not a record of its own, so
    // there is nothing to void — clearing it is an edit, and it is logged as one.
    const inv = invoices.find(i => i.id === row.ref);
    if (inv) {
      const after = { ...inv, receivedAmount: 0, paymentStatus: 'Pending' };
      await saveToFirebase('invoices', inv.id, after);
      await logSave('invoices', inv, after, inv.id);
    }
  }
  showToast('Payment voided');
}} className="p-1.5 bg-rose-50 hover:bg-rose-100 focus:outline-none focus:ring-1 focus:ring-rose-400 text-rose-500 rounded-lg transition-colors"><Trash2 size={14}/></button>
)}
</div>
</td>
</tr>
))}
{filteredRows.length === 0 && (<tr><td colSpan={6} className="text-center py-6 text-slate-400 font-medium">No transactions in this period.</td></tr>)}
</tbody>
<tfoot className="bg-slate-50 border-t border-slate-200">
<tr><td colSpan={2} className="py-2.5 px-3 font-bold text-right uppercase tracking-wider text-slate-500 text-[10px]">Period Totals:</td><td className="py-2.5 px-3 text-right font-black text-indigo-700 tabular-nums">Rs.{periodTotalDebit.toLocaleString('en-US')}</td><td className="py-2.5 px-3 text-right font-black text-emerald-600 tabular-nums">Rs.{periodTotalCredit.toLocaleString('en-US')}</td><td colSpan={2}></td></tr>
</tfoot>
</table>
</div>
</div>
</div>
</ModalWrapper>
);
};
