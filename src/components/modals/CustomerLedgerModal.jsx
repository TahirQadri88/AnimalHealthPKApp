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
<div className="flex flex-wrap items-end gap-2 mb-4 bg-kt-raised p-3 rounded-xl border border-kt-line">
<div className="flex-1 min-w-[130px]"><label className="text-xs font-medium text-kt-sub block mb-1">Start date</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-kt-line outline-none focus:border-kt-ink bg-white" /></div>
<div className="flex-1 min-w-[130px]"><label className="text-xs font-medium text-kt-sub block mb-1">End date</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full p-2 text-xs font-semibold rounded-lg border border-kt-line outline-none focus:border-kt-ink bg-white" /></div>
{/* The figure the customer asks about, as the band every screen uses for its key number. */}
<div className="w-full sm:w-auto sm:ml-2 flex sm:block items-baseline justify-between text-right bg-kt-band text-white px-3 py-2 rounded-xl shrink-0"><p className="text-xs text-white/70 whitespace-nowrap">Balance</p><p className="font-display text-2xl text-kt-yellow leading-tight whitespace-nowrap">Rs. {fullLedger.closingBal.toLocaleString('en-US')}</p></div>
</div>
{/* Ledger mode toggle */}
<div className="flex bg-kt-raised p-1 rounded-xl gap-1">
  <button onClick={() => setLedgerMode('simple')} className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-colors ${ledgerMode==='simple'?'bg-kt-primary text-white ':'text-kt-sub hover:bg-kt-line hover:text-kt-ink'}`}>Simple Ledger</button>
  <button onClick={() => setLedgerMode('detailed')} className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-colors ${ledgerMode==='detailed'?'bg-kt-primary text-white ':'text-kt-sub hover:bg-kt-line hover:text-kt-ink'}`}>Detailed (Items)</button>
</div>
{/* Summary row */}
<div className="grid grid-cols-3 gap-2 text-center">
  <div className="bg-kt-raised border border-kt-line rounded-xl px-2 py-2"><p className="text-xs font-medium text-kt-muted">Debit</p><p className="font-semibold text-kt-blue text-sm tabular-nums">Rs.{periodTotalDebit.toLocaleString('en-US')}</p></div>
  <div className="bg-kt-raised border border-kt-line rounded-xl px-2 py-2"><p className="text-xs font-medium text-kt-muted">Credit</p><p className="font-semibold text-kt-green text-sm tabular-nums">Rs.{periodTotalCredit.toLocaleString('en-US')}</p></div>
  <div className="bg-kt-red/10 border border-kt-red/30 rounded-xl px-2 py-2"><p className="text-xs font-medium text-kt-red">Period Bal</p><p className="font-semibold text-kt-red text-sm tabular-nums">Rs.{(periodOpeningBal+periodTotalDebit-periodTotalCredit).toLocaleString('en-US')}</p></div>
</div>
<div className="flex gap-2">
{isAdmin && <button onClick={() => { setEditingPayment(null); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }} className="flex-1 bg-kt-primary hover:bg-kt-primary/90 text-white font-medium h-11 rounded-lg flex justify-center items-center gap-1.5 active:scale-[0.98] transition-colors text-sm"><Wallet size={16} strokeWidth={1.5} className="shrink-0" /> <span className="whitespace-nowrap">Receive<span className="hidden sm:inline"> payment</span></span></button>}
{isAdmin && <button onClick={() => { setEditingCreditNote({customerId: fullLedger.id, id: ''}); setShowCreditNoteModal(true); }} className="flex-1 bg-white border border-kt-line text-kt-red hover:bg-kt-red/5 font-medium h-11 rounded-lg flex justify-center items-center gap-1.5 active:scale-[0.98] transition-colors text-sm"><RotateCcw size={16} strokeWidth={1.5} className="shrink-0" /> <span className="whitespace-nowrap">Credit note</span></button>}
<button onClick={() => setPrintConfig({docType: 'ledger', format: 'a5', data: printData})} className="flex-1 bg-white border border-kt-line text-kt-ink hover:bg-kt-raised font-medium h-11 rounded-lg flex justify-center items-center gap-1.5 active:scale-[0.98] transition-colors text-sm"><FileSpreadsheet size={16} strokeWidth={1.5} className="shrink-0" /> <span className="whitespace-nowrap">Print<span className="hidden sm:inline"> ledger</span></span></button>
</div>
<div className="border border-kt-line rounded-xl overflow-hidden bg-white">
<div className="overflow-x-auto">
<table className="w-full text-left text-xs sm:text-xs min-w-[500px]">
<thead className="bg-kt-raised text-kt-sub border-b border-kt-line"><tr><th className="py-2.5 px-3 font-medium">Date</th><th className="py-2.5 px-3 font-medium">Particulars</th><th className="py-2.5 px-3 text-right font-medium">Debit</th><th className="py-2.5 px-3 text-right font-medium">Credit</th><th className="py-2.5 px-3 text-right font-medium">Balance</th><th className="py-2.5 px-2 text-center"></th></tr></thead>
<tbody className="divide-y divide-kt-line text-kt-ink">
<tr className="bg-kt-raised/30"><td className="py-2 px-3 text-kt-sub font-medium text-xs" colSpan={4}>Opening Balance <span className="text-xs">(as of {formatDateDisp(startDate)})</span></td><td className="py-2 px-3 text-right font-medium text-kt-ink tabular-nums">Rs.{periodOpeningBal.toLocaleString('en-US')}</td><td></td></tr>
{filteredRows.map(row => (
<tr key={row.id} className="hover:bg-kt-raised transition-colors">
<td className="py-2.5 px-3 font-medium text-kt-sub whitespace-nowrap">{formatDateDisp(row.date)}</td>
<td className="py-2.5 px-3 max-w-[200px]">
<span className={`font-medium block ${row.isCreditNote ? 'text-kt-red' : 'text-kt-ink'}`}>{row.desc}</span>
<span className="block text-xs text-kt-muted mt-0.5">{row.ref}</span>
{row.isCreditNote && <span className="text-xs bg-kt-red/10 text-kt-red px-1.5 py-0.5 rounded font-medium mt-1 inline-block">Credit Note</span>}
{ledgerMode === 'detailed' && (row.lineItems || []).length > 0 && (
  <div className="mt-2 border-t border-kt-line pt-2">
    <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
      <thead>
        <tr className="text-kt-muted border-b border-kt-line">
          <th className="text-left font-medium pb-1 pr-2">Product</th>
          <th className="text-center font-medium pb-1 px-1 whitespace-nowrap">Qty</th>
          <th className="text-right font-medium pb-1 px-1 whitespace-nowrap">Rate</th>
          <th className="text-right font-medium pb-1 pl-1 whitespace-nowrap">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {row.lineItems.map((li, idx) => (
          <tr key={idx} className={idx % 2 === 0 ? '' : 'bg-kt-raised/50'}>
            <td className="py-0.5 pr-2 font-semibold text-kt-ink leading-tight">{li.isBonus && <span className="mr-1 text-xs font-medium text-kt-green">Bonus</span>}{li.name}</td>
            <td className="py-0.5 px-1 text-center text-kt-sub tabular-nums">{li.qty}</td>
            <td className="py-0.5 px-1 text-right text-kt-sub tabular-nums">{li.isBonus ? '—' : `Rs.${(li.price||0).toLocaleString('en-US')}`}</td>
            <td className="py-0.5 pl-1 text-right font-medium text-kt-ink tabular-nums">{li.isBonus ? <span className="text-kt-green font-medium text-xs">FREE</span> : `Rs.${(li.subtotal||0).toLocaleString('en-US')}`}</td>
          </tr>
        ))}
        {(row.deliveryBilled || 0) > 0 && (
          <tr className="border-t border-kt-line">
            <td colSpan={3} className="pt-1 pr-2 text-kt-muted font-semibold">+ Delivery Charge</td>
            <td className="pt-1 pl-1 text-right font-medium text-kt-sub tabular-nums">Rs.{row.deliveryBilled.toLocaleString('en-US')}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}
</td>
<td className="py-2.5 px-3 text-right font-semibold text-kt-blue tabular-nums">{row.debit > 0 ? row.debit.toLocaleString('en-US') : '-'}</td>
<td className="py-2.5 px-3 text-right font-semibold text-kt-green tabular-nums">{row.credit > 0 ? row.credit.toLocaleString('en-US') : '-'}</td>
<td className="py-2.5 px-3 text-right font-semibold text-kt-ink tabular-nums">{row.balance.toLocaleString('en-US')}</td>
<td className="py-2.5 px-2 text-center">
<div className="flex gap-1 justify-center flex-wrap">
{row.debit > 0 && !row.isCreditNote && (<button onClick={() => { const inv = invoices.find(o => o.id === row.id); if(inv) setPrintConfig({docType:'invoice', format:'thermal', data: inv}); }} title="Print Invoice" className="p-1.5 bg-kt-blue/10 hover:bg-kt-blue/10 focus:outline-none focus:ring-1 text-kt-blue rounded-lg transition-colors"><ReceiptText size={13}/></button>)}
{isAdmin && row.debit > 0 && !row.isCreditNote && (<button onClick={() => { const inv = invoices.find(o => o.id === row.id); if(inv){ setCurrentInvoice(inv); setBillingView('form'); setActiveTab('billing'); setShowLedgerModal(false); }}} title="Edit Invoice" className="p-1.5 bg-kt-amber/10 hover:bg-kt-amber/10 focus:outline-none focus:ring-1 text-kt-amber rounded-lg transition-colors"><Edit size={13}/></button>)}
{row.isCreditNote && (<button onClick={() => { const cn = invoices.find(o => o.id === row.id); if(cn) setPrintConfig({docType:'creditnote', format:'a4', data: cn}); }} title="Print Credit Note" className="p-1.5 bg-kt-red/10 hover:bg-kt-red/10 focus:outline-none focus:ring-1 text-kt-red rounded-lg transition-colors"><FileText size={13}/></button>)}
{row.isCreditNote && isAdmin && (<button onClick={() => { setEditingCreditNote({ customerId: fullLedger.id, id: row.id }); setShowLedgerModal(false); setShowCreditNoteModal(true); }} title="Edit Credit Note" className="p-1.5 bg-kt-amber/10 hover:bg-kt-amber/10 focus:outline-none focus:ring-1 text-kt-amber rounded-lg transition-colors"><Edit size={13}/></button>)}
{row.isCreditNote && isAdmin && (<button onClick={async () => { const cn = invoices.find(o => o.id === row.id); if (!cn) return; const reason = await showPrompt(`Void credit note ${row.id}?\n\nIt stays on file and drops out of the balance.`, { placeholder: 'e.g. entered twice' }); if (reason === null) return; await voidRecord('invoices', cn, { label: row.id, reason }); showToast(`${row.id} voided`); }} title="Void Credit Note" className="p-1.5 bg-kt-red/10 hover:bg-kt-red/10 focus:outline-none focus:ring-1 text-kt-red rounded-lg transition-colors"><Trash2 size={13}/></button>)}
{row.credit > 0 && !row.isCreditNote && (<button onClick={() => setPrintConfig({docType: 'receipt', format: 'thermal', data: generateReceiptData(fullLedger, row.id)})} title="Print Receipt" className="p-1.5 bg-kt-green/10 hover:bg-kt-green/10 focus:outline-none focus:ring-1 text-kt-green rounded-lg transition-colors"><Receipt size={13}/></button>)}
{isAdmin && row.credit > 0 && row.id.startsWith('REC-') && (
<button title="Edit Payment" onClick={() => { const pay = payments.find(p => p.id === row.id); if(pay){ setEditingPayment(pay); setSelectedCustomerForPayment(fullLedger.id); setShowPaymentModal(true); }}} className="p-1.5 bg-kt-amber/10 hover:bg-kt-amber/10 focus:outline-none focus:ring-1 text-kt-amber rounded-lg transition-colors"><Edit size={13}/></button>
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
}} className="p-1.5 bg-kt-red/10 hover:bg-kt-red/10 focus:outline-none focus:ring-1 text-kt-red rounded-lg transition-colors"><Trash2 size={14}/></button>
)}
</div>
</td>
</tr>
))}
{filteredRows.length === 0 && (<tr><td colSpan={6} className="text-center py-6 text-kt-muted font-medium">No transactions in this period.</td></tr>)}
</tbody>
<tfoot className="bg-kt-raised border-t border-kt-line">
<tr><td colSpan={2} className="py-2.5 px-3 font-medium text-right text-kt-sub text-xs">Period Totals:</td><td className="py-2.5 px-3 text-right font-semibold text-kt-blue tabular-nums">Rs.{periodTotalDebit.toLocaleString('en-US')}</td><td className="py-2.5 px-3 text-right font-semibold text-kt-green tabular-nums">Rs.{periodTotalCredit.toLocaleString('en-US')}</td><td colSpan={2}></td></tr>
</tfoot>
</table>
</div>
</div>
</div>
</ModalWrapper>
);
};
