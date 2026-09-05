import { useState, useContext } from 'react';
import { AlertCircle } from 'lucide-react';
// nextDocNumber arrives through context rather than being imported: ../../lib/claimDocNumber
// pulls in ../firebase, which initialises Auth on import and makes this component
// impossible to load from a test.
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import SearchableSelect from '../SearchableSelect';
import { getLocalDateStr } from '../../helpers';
import { getNextSeqNum } from '../../lib/docNumbers';
import { QUEUED } from '../../lib/pendingWrite';

export const PaymentModal = () => {
const { selectedCustomerForPayment, customers, payments, getCustomerBalance, saveToFirebase, showToast, setShowPaymentModal, editingPayment, setEditingPayment, logSave, paymentsRaw, nextDocNumber } = useContext(AppContext);
const isEdit = !!editingPayment;
const [form, setForm] = useState(
  isEdit
    ? { customerId: editingPayment.customerId, amount: editingPayment.amount, discount: editingPayment.discount || 0, date: editingPayment.date, note: editingPayment.note || 'Cash Payment' }
    : { customerId: selectedCustomerForPayment || '', amount: '', discount: 0, date: getLocalDateStr(), note: 'Cash Payment' }
);
const handleClose = () => { setEditingPayment(null); setShowPaymentModal(false); };
const discount = Number(form.discount) || 0;
const totalCredit = (Number(form.amount) || 0) + discount;
const save = async () => {
if(!form.customerId || !form.amount) return showToast("Customer and Amount are required", "error");
if (isEdit) {
  const updated = { ...editingPayment, customerId: Number(form.customerId), amount: Number(form.amount), discount, date: form.date, note: form.note };
  const written = await saveToFirebase('payments', updated.id, updated);
  await logSave('payments', editingPayment, updated, updated.id);
  showToast(written === QUEUED
    ? 'Receipt updated on this device — it will sync when you are back online'
    : 'Payment Receipt Updated!');
} else {
  const recNum = await nextDocNumber('REC', getNextSeqNum(paymentsRaw, 'REC'));
  if (recNum === null) return showToast("No receipt numbers left offline. Reconnect once to reserve more.", "error");
  const newPayment = { id: `REC-${String(recNum).padStart(4, '0')}`, customerId: Number(form.customerId), amount: Number(form.amount), discount, date: form.date, note: form.note };
  const written = await saveToFirebase('payments', newPayment.id, newPayment);
  await logSave('payments', null, newPayment, newPayment.id);
  // The ledger updates either way — it is computed in the browser from the local cache.
  showToast(written === QUEUED
    ? `${newPayment.id} saved on this device — it will sync when you are back online`
    : 'Payment Received & Ledger Updated!');
}
handleClose();
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Payment Receipt" : "Receive Payment"} onClose={handleClose}>
<form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4 pb-10">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Select Client</label><SearchableSelect className={inputClass} value={form.customerId} onChange={e=>setForm({...form, customerId: e.target.value})} placeholder="– Choose Client –" options={customers.map(c=>({value:c.id,label:c.name}))} disabled={isEdit && customers.some(c => c.id === Number(form.customerId) || String(c.id) === String(form.customerId))} />
{isEdit && !customers.some(c => String(c.id) === String(form.customerId)) && (
  <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1"><AlertCircle size={11}/> Original client was deleted — please re-assign to an existing client or delete this receipt.</p>
)}</div>
{form.customerId && (<div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center"><p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Current Outstanding Balance</p><p className="text-xl font-black text-rose-600 mt-1">Rs. {getCustomerBalance(Number(form.customerId)).toLocaleString('en-US')}</p></div>)}
<div className="grid grid-cols-2 gap-3">
<div className="col-span-2"><label className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider ml-1 mb-1 block">Amount Received (Cash / Cheque)</label><input type="number" placeholder="0.00" className={`${inputClass} !border-emerald-200 !text-emerald-700 !font-extrabold text-lg`} value={form.amount} onChange={e=>setForm({...form, amount: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider ml-1 mb-1 block">Round-off Discount</label><input type="number" placeholder="0" className={`${inputClass} !border-amber-200 !text-amber-700 !font-bold`} value={form.discount || ''} onChange={e=>setForm({...form, discount: Number(e.target.value)||0})} /></div>
<div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col justify-center">
  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Total Credit</p>
  <p className="text-lg font-black text-amber-800">Rs. {totalCredit.toLocaleString('en-US')}</p>
</div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Date</label><input type="date" className={inputClass} value={form.date} onChange={e=>setForm({...form, date: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Mode / Note</label><input type="text" placeholder="e.g. Cash / Cheque No." className={inputClass} value={form.note} onChange={e=>setForm({...form, note: e.target.value})} /></div>
</div>
<button type="submit" className={`w-full text-white font-bold py-4 rounded-xl mt-6 shadow-md active:scale-[0.98] transition-all ${isEdit ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}>{isEdit ? 'Update Payment' : 'Process Payment'}</button>
</form>
</ModalWrapper>
);
};
