import { useState, useEffect, useRef, useContext, useMemo, Fragment } from 'react';
import { Plus, Search, X, Edit, Trash2, Save, Truck, MapPin, Calendar,
         AlertCircle, BookOpen, FileText, ReceiptText, RotateCcw, Gift } from 'lucide-react';
// nextDocNumber comes through context, not by import: ../../lib/claimDocNumber pulls in
// ../firebase, which initialises Auth on import and would make this — the screen that
// bills every invoice — impossible to load from a test.
import { AppContext } from '../../context/AppContext';
import { FilterSelect } from '../ui/FilterSelect';
import { VEHICLES, getLocalDateStr, formatDateDisp, checkDateFilter } from '../../helpers';
import { makeArrowNav } from '../../lib/a11y';
import { getNextSeqNum, prefixForStatus, needsRenumber } from '../../lib/docNumbers';
import { QUEUED } from '../../lib/pendingWrite';
import { isTransportMethod, isKnownVehicleType, usesCarrierPerson } from '../../lib/transport';
import { invoiceTotal } from '../../services/accounting/invoiceTotals';
import { billingSummary, paymentStatusFor } from '../../lib/billingSummary';
import { lastPricesForCustomer } from '../../lib/lastPrice';
import { rankProducts, customerMatches } from '../../lib/productSearch';
import { validateInvoiceDraft } from '../../lib/invoiceValidation';
import { useSoftKeyboard } from '../../hooks/useSoftKeyboard';
import { InvoiceSummaryBar } from '../billing/InvoiceSummaryBar';

export const BillingTab = () => {
const { getPaymentStatus, isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, setShowCreditNoteModal, setEditingCreditNote, showConfirm, riders, vehicleTypes, transportCompanies, showPrompt, voidRecord, logSave, invoicesRaw, logDelete, nextDocNumber, billingCloseRef, confirmDialog } = useContext(AppContext);
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
const prodSearchRef = useRef(null);
const custSearchRef = useRef(null);
// After a keyboard add, the quantity of the line it landed on takes focus.
const focusLineRef = useRef(null);
const [flashKey, setFlashKey] = useState(null);
// One save at a time: a second Ctrl+Enter during the number claim used to write a second invoice.
const savingRef = useRef(false);
const [saving, setSaving] = useState(false);
// Errors show after the first refused save and then follow the form as it is fixed.
const [showErrors, setShowErrors] = useState(false);
const [summaryOpen, setSummaryOpen] = useState(() => { try { return localStorage.getItem('kt.billing.summaryOpen') === '1'; } catch { return false; } });
const toggleSummary = () => setSummaryOpen(o => { const n = !o; try { localStorage.setItem('kt.billing.summaryOpen', n ? '1' : '0'); } catch { /* private mode */ } return n; });
const openSnapshotRef = useRef('');
const hotkeyRef = useRef(null);
const formOpen = billingView === 'form';
const draftCustomerId = currentInvoice?.customerId;
const keyboardUp = useSoftKeyboard(formOpen);
// Worked out once per customer or data change, not on every keystroke.
const selectedCustomer = useMemo(() => (formOpen && draftCustomerId ? customers.find(c => c.id === draftCustomerId) || null : null), [formOpen, customers, draftCustomerId]);
const lastPriceMap = useMemo(() => (formOpen ? lastPricesForCustomer(invoices, draftCustomerId) : new Map()), [formOpen, invoices, draftCustomerId]);
const customerBalance = useMemo(() => (formOpen && draftCustomerId ? getCustomerBalance(draftCustomerId) : 0), [formOpen, draftCustomerId, invoices, payments, customers]);
const productList = useMemo(() => (formOpen ? rankProducts(products, prodSearch, { companyName: getCompanyName, limit: 30 }) : { items: [], total: 0 }),
  [formOpen, products, prodSearch, companies]);
const customerList = useMemo(() => (formOpen ? customerMatches(customers, customerSearch, 50) : { items: [], total: 0 }), [formOpen, customers, customerSearch]);
// What the form held when it opened, to tell a changed draft from an untouched one.
useEffect(() => {
  if (formOpen) { openSnapshotRef.current = JSON.stringify(currentInvoice); setShowErrors(false); }
}, [formOpen]);
useEffect(() => {
  const key = focusLineRef.current;
  if (!key) return;
  focusLineRef.current = null;
  const row = [...document.querySelectorAll('[data-item-row]')].find(r => r.getAttribute('data-key') === String(key));
  const q = row?.querySelector('[data-item-qty]');
  if (q) { q.focus(); q.select(); row.scrollIntoView?.({ block: 'nearest' }); }
}, [currentInvoice?.items]);
useEffect(() => {
  if (!flashKey) return undefined;
  const t = setTimeout(() => setFlashKey(null), 900);
  return () => clearTimeout(t);
}, [flashKey]);
// The highlighted result stays in view while arrowing through a long list.
useEffect(() => { document.querySelector(`[data-prod-idx="${hiProduct}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [hiProduct]);
useEffect(() => { document.querySelector(`[data-cust-idx="${hiCustomer}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [hiCustomer]);
// Keys that work anywhere in the open form. Values come through a ref set by the form render.
useEffect(() => {
  if (!formOpen) return undefined;
  const onKey = (e) => { hotkeyRef.current?.(e); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [formOpen]);
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
const canCollect = hasPermission('collectOnBill');
const focusFirstError = () => setTimeout(() => {
  const el = document.querySelector('[data-billing-form] [aria-invalid="true"]');
  if (el) { el.focus(); el.scrollIntoView?.({ block: 'center' }); }
}, 0);
const saveInvoice = async (status) => {
if (savingRef.current) return;
// Checked before a document number is claimed, so a refused bill never uses one up.
const check = validateInvoiceDraft(currentInvoice, { canCollect });
if (!check.ok) { setShowErrors(true); focusFirstError(); return showToast(check.errors[0].message, "error"); }
savingRef.current = true; setSaving(true);
try {
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
  items: enrichedItems, total: grandTotal, status: status,
  // Worked out now, against the total being saved, not when "received" was last typed.
  paymentStatus: paymentStatusFor(canCollect ? currentInvoice.receivedAmount : 0, grandTotal, currentInvoice.paymentStatus),
  // The author stays the author. Stamping whoever pressed Save handed a staff member's invoice to
  // the admin who corrected it: it left their sales figures and they could no longer edit it.
  salespersonId: currentInvoice.salespersonId ?? currentUser.id, salespersonName: currentInvoice.salespersonName ?? currentUser.name, customerDetails: activeCustomer ? { contactPerson: activeCustomer.contactPerson || '', phone: activeCustomer.phone || '', address1: activeCustomer.address1 || activeCustomer.address || '', map1: activeCustomer.map1 || '', address2: activeCustomer.address2 || '', map2: activeCustomer.map2 || '' } : {} };
// A document that changes series needs a number from the series it is moving INTO.
// This used to claim a number only for a brand-new document, so converting EST-0037 to an
// invoice kept the estimate's number and printed the word INVOICE above it. The
// Issue-as-Invoice button on the list always renumbered; the form did not.
const prefix = prefixForStatus(status);
const converting = needsRenumber(finalInvoice.id, status);
if (converting && !hasPermission('issueInvoices')) return showToast("Converting a saved document needs the Issue / Convert Docs permission", "error");
const previousId = converting ? finalInvoice.id : null;
if (!finalInvoice.id || converting) {
  const clientGuess = getNextSeqNum(invoicesRaw, prefix);
  // Null means offline with no reserved numbers left. Refusing is the point: a guessed
  // number can duplicate one another device is using, and both get printed.
  const nextNum = await nextDocNumber(prefix, clientGuess);
  if (nextNum === null) return showToast("No document numbers left offline. Reconnect once to reserve more.", "error");
  finalInvoice.id = `${prefix}-${String(nextNum).padStart(4, '0')}`;
  // The date is left exactly as the form has it. Conversion must not silently re-date a
  // document whose date the user can see and edit.
  if (!finalInvoice.date) finalInvoice.date = getLocalDateStr();
}
const written = await saveToFirebase('invoices', finalInvoice.id, finalInvoice);
// A conversion is a CREATE under the new number, not an edit of it — `invoices.find` would
// look for an id that has never existed and log an update against `undefined`.
await logSave('invoices', (!converting && currentInvoice.id) ? invoices.find(o => o.id === finalInvoice.id) : null, finalInvoice, finalInvoice.id);
if (previousId) {
  // The old document is consumed by the conversion, exactly as the list button does it.
  await deleteFromFirebase('invoices', previousId);
  await logDelete('invoices', invoices.find(o => o.id === previousId) || { id: previousId }, `Converted to ${finalInvoice.id}`, previousId);
}
const statusLabels = { Estimate: 'Estimate', Booked: 'Draft Order', Billed: 'Invoice' };
const label = statusLabels[status] || status;
// "Saved" and "saved on this device" are different facts, and on a document that will be
// handed to a customer the difference is worth a sentence.
showToast(written === QUEUED
  ? `${label} ${finalInvoice.id} saved on this device — it will sync when you are back online`
  : previousId ? `${previousId} converted to ${label} ${finalInvoice.id}`
  : (currentInvoice.id ? `${label} Updated` : `${label} Saved`));
setBillingView('list');
} finally { savingRef.current = false; setSaving(false); }
};
// Escape and the close button ask before throwing away a changed draft.
const requestClose = async () => {
  if (savingRef.current) return;
  const changed = JSON.stringify(currentInvoice) !== openSnapshotRef.current;
  if (changed && !(await showConfirm('Discard the changes to this bill?'))) return;
  setBillingView('list');
};
if (billingCloseRef) billingCloseRef.current = formOpen ? requestClose : null;
// Khyber Traders look (unslop trial): bone neutrals, hairlines, one yellow block per screen.
const inputClass = "w-full h-11 px-3 bg-white border border-kt-line rounded-lg text-sm text-kt-ink placeholder-kt-muted focus:outline-none focus:border-kt-ink transition-colors";
const labelClass = "text-xs font-medium text-kt-sub mb-1.5 block";
const sectionClass = "bg-white p-4 lg:p-5 rounded-xl border border-kt-line shadow-[0_1px_2px_rgba(20,20,20,0.05)]";
const sectionTitleClass = "font-display text-xl sm:text-2xl text-kt-ink mb-3 flex items-center gap-3";
// The signature detail: sections numbered like the parts of a bill book, in the order a bill is written.
const Step = ({ n }) => <span aria-hidden="true" className="font-ui w-6 h-6 shrink-0 rounded-full bg-kt-primary text-white text-xs font-medium flex items-center justify-center">{n}</span>;
const iconBtn = "w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-kt-line bg-white text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors";
// `viaKey`: added from the keyboard, so the line's quantity takes focus. A tap keeps the
// search focused (and the phone keyboard up) for the next product.
const handleAddItem = (p, isBonus, viaKey = false) => {
const uniqueId = isBonus ? `${p.id}_bonus` : p.id;
// The rate this customer was last charged, as before; the list price otherwise.
const historicalPrice = !isBonus && lastPriceMap.has(p.id) ? lastPriceMap.get(p.id) : p.sellingPrice;
// Functional update: two quick adds must not overwrite each other.
setCurrentInvoice(prev => {
  const existing = prev.items.find(i => (i.uniqueId || i.productId) === uniqueId);
  if (existing) return { ...prev, items: prev.items.map(i => (i.uniqueId || i.productId) === uniqueId ? { ...i, quantity: (Number(i.quantity) || 0) + 1 } : i) };
  return { ...prev, items: [...prev.items, { uniqueId: uniqueId, productId: p.id, name: p.name, price: isBonus ? 0 : historicalPrice, originalPrice: p.sellingPrice, costPrice: p.costPrice, company: getCompanyName(p.companyId), quantity: 1, unitsInBox: p.unitsInBox, unit: p.unit, isBonus: isBonus }] };
});
setFlashKey(uniqueId);
if (viaKey) focusLineRef.current = uniqueId;
else setTimeout(() => prodSearchRef.current?.focus(), 0);
setProdSearch(''); setHiProduct(-1);
};
const numFocus = (e) => e.target.select();
// A mouse wheel over a focused number field changed the figure; it scrolls the page instead.
const numWheel = (e) => e.currentTarget.blur();
if (billingView === 'form') {
const isEdit = !!currentInvoice.id;
const editingStatus = currentInvoice.status || '';
const grandTotal = invoiceTotal(currentInvoice);
const formTypeLabel = isEdit
  ? (editingStatus === 'Estimate' ? 'Edit Estimate' : editingStatus === 'Booked' ? 'Edit Draft Order' : editingStatus === 'CreditNote' ? 'Credit Note' : `Edit Invoice`)
  : (statusFilter === 'Estimate' ? 'New Estimate / Quotation' : statusFilter === 'Booked' ? 'New Draft Order' : 'New Invoice');
const canSaveAsEstimate = !isEdit || editingStatus === 'Estimate' || editingStatus === 'Booked';
// Moving a saved document into another series is a conversion: a new number, and the old
// document deleted. The rules give that delete to Issue / Convert Docs alone, so without it the
// new document saved and the old one stayed — an estimate and its invoice, both on the books.
const canConvert = hasPermission('issueInvoices');
const offerStatus = (target) => !isEdit || editingStatus === target || canConvert;
const errs = showErrors ? validateInvoiceDraft(currentInvoice, { canCollect }).errors : [];
const errFor = (field, key) => errs.filter(e => e.field === field && (key === undefined || e.key === key));
const summary = billingSummary(currentInvoice, { canCollect, priorBalance: customerBalance, isEdit });
// Ctrl+S keeps the document what it is: a Draft Order when new, its own status when edited.
const quickStatus = isEdit
  ? (['Estimate', 'Booked', 'Billed'].includes(editingStatus) ? editingStatus : null)
  : (canSaveAsEstimate && offerStatus('Booked') ? 'Booked' : null);
hotkeyRef.current = (e) => {
  // A dialog or modal on top owns the keyboard.
  if (confirmDialog || showProductModal || showCustomerModal || showLedgerModal || printConfig) return;
  const mod = e.ctrlKey || e.metaKey;
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (mod && e.key === 'Enter') { e.preventDefault(); if (!e.repeat && offerStatus('Billed')) saveInvoice('Billed'); return; }
  if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (!e.repeat && quickStatus) saveInvoice(quickStatus); return; }
  if (e.key === 'F2' || (e.key === '/' && !typing && !mod)) { e.preventDefault(); prodSearchRef.current?.focus(); return; }
  if (e.key === 'F4') { e.preventDefault(); custSearchRef.current?.focus(); }
};
return (
<div data-billing-form="1" className="font-ui h-full flex flex-col bg-kt-page absolute inset-0 z-20 animate-slide-up">
<div className="bg-kt-band text-white px-4 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center sticky top-0 z-30">
<div><h2 className="font-display text-xl sm:text-2xl leading-tight">{isEdit ? `${formTypeLabel} — ${currentInvoice.id}` : formTypeLabel}</h2><input type="date" value={currentInvoice.date || getLocalDateStr()} onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})} className="text-sm text-white/70 bg-transparent border-0 outline-none cursor-pointer hover:text-white transition-colors mt-1 p-0 tabular-nums [color-scheme:dark]" /></div>
<button onClick={requestClose} title="Close (Esc)" aria-label="Close" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"><X size={18} strokeWidth={1.5}/></button>
</div>
{/* From 1536px wide, two columns: the customer and products where the work happens, delivery, payment and notes beside them. */}
<div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 space-y-3 2xl:space-y-0 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:gap-4 2xl:items-start">
<div className="space-y-3 min-w-0">
<div className={sectionClass}>
<h3 className={sectionTitleClass}><Step n={1}/> Customer</h3>
<div className="flex gap-2 items-center">
<div className="relative flex-1">
  <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none z-10"/>
  <input
    ref={custSearchRef}
    autoFocus={!currentInvoice.customerId}
    className={`pl-10 ${inputClass}`}
    placeholder="Search clients"
    title="F4"
    enterKeyHint="search"
    aria-invalid={errFor('customer').length ? 'true' : undefined}
    value={showCustomerDrop ? customerSearch : (selectedCustomer?.name || '')}
    onFocus={() => { setShowCustomerDrop(true); setCustomerSearch(''); setHiCustomer(-1); }}
    onChange={e => { setCustomerSearch(e.target.value); setHiCustomer(-1); }}
    onBlur={() => setTimeout(() => { setShowCustomerDrop(false); setHiCustomer(-1); }, 150)}
    onKeyDown={e => {
      const filtC = customerList.items;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHiCustomer(h => Math.min(h + 1, filtC.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHiCustomer(h => Math.max(h - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (hiCustomer >= 0 && filtC[hiCustomer]) pickCustomer(filtC[hiCustomer]); else if (filtC.length === 1) pickCustomer(filtC[0]); }
      // The first Escape only closes the list; the form-level Escape must not also fire.
      else if (e.key === 'Escape' && showCustomerDrop) { e.stopPropagation(); setShowCustomerDrop(false); setHiCustomer(-1); e.currentTarget.blur(); }
    }}
  />
  {showCustomerDrop && (
    <div className="absolute z-50 w-full mt-1 border border-kt-line bg-white rounded-lg max-h-52 overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      {customerList.items
        .map((c, idx) => (
          <button
            type="button"
            key={c.id}
            data-cust-idx={idx}
            className={`w-full min-h-11 text-left px-3 py-2.5 text-sm break-words cursor-pointer transition-colors ${c.id === currentInvoice.customerId || idx === hiCustomer ? 'bg-kt-raised text-kt-ink font-medium' : 'text-kt-ink hover:bg-kt-raised'}`}
            onMouseDown={e => { e.preventDefault(); pickCustomer(c); }}
          >{c.name}</button>
        ))
      }
      {customerList.total === 0 && (
        <p className="px-3 py-3 text-sm text-kt-muted">No clients found</p>
      )}
      {customerList.total > customerList.items.length && (
        <p className="px-3 py-2 text-xs text-kt-sub">Showing {customerList.items.length} of {customerList.total}. Keep typing to narrow it down.</p>
      )}
    </div>
  )}
</div>
{hasPermission('addCustomers') && <button onClick={() => { setEditingCustomer(null); setShowCustomerModal(true); }} title="New client" aria-label="New client" className={iconBtn}><Plus size={18} strokeWidth={1.5}/></button>}
{currentInvoice.customerId && <button type="button" onClick={() => { setSelectedLedgerId(currentInvoice.customerId); setShowLedgerModal(true); }} className={iconBtn} title="View Customer Ledger" aria-label="View Customer Ledger"><BookOpen size={18} strokeWidth={1.5}/></button>}
</div>
{errFor('customer').map(e => <p key="c" className="mt-2 text-xs text-kt-red">{e.message}</p>)}
{currentInvoice.customerId && (() => {
  const cust = selectedCustomer;
  const bal = customerBalance;
  const limit = Number(cust?.creditLimit || 0);
  if (bal > 0 || (limit > 0 && bal >= limit * 0.8)) {
    const overLimit = limit > 0 && bal >= limit;
    return (
      <div className={`mt-3 px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 bg-kt-raised ${overLimit ? 'text-kt-red' : 'text-kt-amber'}`}>
        <AlertCircle size={16} strokeWidth={1.5} className="shrink-0"/>
        <span className="tabular-nums">{overLimit ? `Over credit limit. Balance Rs. ${bal.toLocaleString('en-US')}, limit Rs. ${limit.toLocaleString('en-US')}` : `Outstanding balance Rs. ${bal.toLocaleString('en-US')}${limit > 0 ? `, limit Rs. ${limit.toLocaleString('en-US')}` : ''}`}</span>
      </div>
    );
  }
  return null;
})()}
</div>
<div className={sectionClass}>
<h3 className={sectionTitleClass}><Step n={2}/> Products</h3>
<div className="flex gap-2 items-center mb-4">
  <div className="relative flex-1"><Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted"/><input ref={prodSearchRef} placeholder="Search products" title="F2 or /" enterKeyHint="search" aria-invalid={errFor('items').length ? 'true' : undefined} className={`pl-10 ${inputClass}`} value={prodSearch} onChange={e=>{ setProdSearch(e.target.value); setHiProduct(-1); }} onKeyDown={e => {
    const filtP = productList.items;
    // The first result is highlighted until the arrows move it.
    const hi = hiProduct >= 0 ? hiProduct : 0;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHiProduct(Math.min(hi + 1, filtP.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHiProduct(Math.max(hi - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const p = filtP[hi]; if (prodSearch.trim() && p) handleAddItem(p, e.shiftKey, true); }
    else if (e.key === 'Escape' && prodSearch) { e.stopPropagation(); setProdSearch(''); setHiProduct(-1); }
  }} /></div>
  {hasPermission('addEditProducts') && <button type="button" onClick={() => { setProductPreFill(prodSearch.trim()); setEditingProduct(null); setShowProductModal(true); }} className="shrink-0 h-11 flex items-center gap-1.5 px-4 bg-white text-kt-ink border border-kt-line rounded-lg text-sm font-medium hover:bg-kt-raised transition-colors" title="Register a new product"><Plus size={16} strokeWidth={1.5}/> New</button>}
</div>
{prodSearch.trim() && (
<div className="border border-kt-line bg-white rounded-lg mb-4 max-h-72 overflow-y-auto p-1 space-y-0.5">
{productList.items.map((p, idx) => {
const hi = (hiProduct >= 0 ? hiProduct : 0) === idx;
const company = getCompanyName(p.companyId);
return (
<div key={p.id} data-prod-idx={idx} className={`px-2 py-1 rounded-md flex justify-between items-center gap-2 ${hi ? 'bg-kt-raised' : 'hover:bg-kt-raised'}`}>
{/* mousedown is cancelled so the search keeps focus, and the phone keyboard stays up for the next product. */}
<button type="button" className="flex-1 min-w-0 min-h-11 py-1 text-sm text-kt-ink text-left break-words" onMouseDown={e => e.preventDefault()} onClick={() => handleAddItem(p, false)}><span>{p.name}</span><span className="text-kt-sub ml-2 tabular-nums whitespace-nowrap">Rs. {Number(p.sellingPrice).toLocaleString('en-US')}</span>{company && <span className="block text-xs text-kt-sub">{company}</span>}</button>
<button type="button" title="Add as Bonus (Shift+Enter)" onMouseDown={e => e.preventDefault()} onClick={() => handleAddItem(p, true)} className="shrink-0 h-11 px-3 text-xs flex items-center gap-1.5 text-kt-sub border border-kt-line rounded-md hover:bg-white hover:text-kt-ink transition-colors"><Gift size={14} strokeWidth={1.5}/> Bonus</button>
</div>
);})}
{productList.total === 0 && <p className="px-3 py-3 text-sm text-kt-muted">No products found</p>}
{productList.total > productList.items.length && <p className="px-3 py-2 text-xs text-kt-sub">Showing {productList.items.length} of {productList.total}. Keep typing to narrow it down.</p>}
</div>
)}
{errFor('items').map(e => <p key="i" className="-mt-2 mb-3 text-xs text-kt-red">{e.message}</p>)}
<div className="space-y-2">
{currentInvoice.items.map((item) => {
const itemKey = item.uniqueId || item.productId;
const setLine = (patch) => setCurrentInvoice(prev => ({ ...prev, items: prev.items.map(i => (i.uniqueId || i.productId) === itemKey ? { ...i, ...patch(i) } : i) }));
const qtyErr = errFor('qty', itemKey);
const rateErr = errFor('rate', itemKey);
return (
<div key={itemKey} data-item-row="1" data-key={String(itemKey)} className={`bg-kt-page/50 p-4 lg:px-3 lg:py-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-3 rounded-lg border transition-shadow duration-500 ${flashKey === itemKey ? 'border-kt-ink shadow-[0_0_0_3px_rgb(var(--kt-yellow))]' : 'border-kt-line'}`}>
{/* Phones: a two-row card. Desktop: the wrappers dissolve (lg:contents) into one line, reordered name, rate, quantity, amount, remove. */}
<div className="flex justify-between items-start gap-2 mb-3 lg:contents">
<p className="min-w-0 break-words font-medium text-[15px] text-kt-ink leading-tight pt-1 lg:pt-0 lg:order-1 lg:flex-1">{item.name}{item.isBonus && <span className="ml-2 text-xs font-medium text-kt-green bg-kt-green/10 px-1.5 py-0.5 rounded">Bonus</span>}</p>
<span className="ml-auto pt-0.5 lg:pt-0 lg:order-4 lg:ml-0 lg:min-w-28 lg:text-right font-display text-2xl lg:text-xl text-kt-ink leading-none whitespace-nowrap">{item.isBonus ? 'Free' : `Rs. ${((Number(item.price) || 0) * (Number(item.quantity) || 0)).toLocaleString('en-US')}`}</span>
<button type="button" tabIndex={-1} onClick={() => setCurrentInvoice(prev => ({ ...prev, items: prev.items.filter(i => (i.uniqueId || i.productId) !== itemKey) }))} title="Remove" aria-label={`Remove ${item.name}`} className="w-11 h-11 -mt-2 -mr-2 lg:m-0 lg:order-5 shrink-0 flex items-center justify-center rounded-lg text-kt-muted hover:text-kt-red hover:bg-kt-raised transition-colors"><X size={16} strokeWidth={1.5}/></button>
</div>
<div className="flex items-end justify-between gap-3 lg:contents">
<div className="flex flex-col lg:order-2 lg:flex-row lg:items-center lg:gap-2">
<label className="text-xs text-kt-sub mb-1 lg:sr-only">Rate (Rs)</label>
<input type="number" inputMode="decimal" enterKeyHint="next" aria-label={`Rate of ${item.name}`} aria-invalid={rateErr.length ? 'true' : undefined} className={`w-28 h-11 px-2 text-sm font-medium text-kt-ink bg-white border rounded-md tabular-nums focus:outline-none focus:border-kt-ink ${rateErr.length ? 'border-kt-red' : 'border-kt-line'}`} value={item.price} disabled={item.isBonus} onFocus={numFocus} onWheel={numWheel} onChange={(e) => { const v = e.target.value; setLine(() => ({ price: Number(v) })); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const q = e.target.closest('[data-item-row]')?.querySelector('[data-item-qty]'); q?.focus(); q?.select(); } }} />
{item.isBonus && <span className="text-xs text-kt-muted line-through mt-1 lg:mt-0 tabular-nums">Rs. {item.originalPrice}</span>}
</div>
<div className="flex flex-col items-center lg:order-3">
<label className="text-xs text-kt-sub mb-1 lg:sr-only">Quantity</label>
<div className={`flex items-center bg-white border rounded-md ${qtyErr.length ? 'border-kt-red' : 'border-kt-line'}`}>
<button type="button" tabIndex={-1} onClick={() => setCurrentInvoice(prev => ({ ...prev, items: prev.items.map(i => (i.uniqueId || i.productId) === itemKey ? { ...i, quantity: (Number(i.quantity) || 0) - 1 } : i).filter(i => i.quantity > 0) }))} aria-label="One less" className="w-11 h-11 text-lg text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors">−</button>
<input data-item-qty="1" type="number" inputMode="decimal" enterKeyHint="done" aria-label={`Quantity of ${item.name}`} aria-invalid={qtyErr.length ? 'true' : undefined} className="w-14 h-11 text-center text-sm font-medium text-kt-ink bg-transparent outline-none appearance-none tabular-nums" value={item.quantity} onFocus={numFocus} onWheel={numWheel} onChange={(e) => { const v = e.target.value; setLine(() => ({ quantity: Number(v) })); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); prodSearchRef.current?.focus(); } }} />
<button type="button" tabIndex={-1} onClick={() => setLine(i => ({ quantity: (Number(i.quantity) || 0) + 1 }))} aria-label="One more" className="w-11 h-11 text-lg text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors">+</button>
</div>
</div>
</div>
{[...rateErr, ...qtyErr].map((e, n) => <p key={n} className="mt-2 lg:mt-1 lg:order-6 lg:basis-full text-xs text-kt-red">{e.message}</p>)}
</div>
)})}
</div>
</div>
</div>
<div className="space-y-3 min-w-0">
{currentInvoice.customerId && (() => {
  const cust = selectedCustomer;
  if (!cust?.address2) return null;
  return (
    <div className={sectionClass}>
      <h3 className={sectionTitleClass}><MapPin size={18} strokeWidth={1.5} className="text-kt-muted"/> Delivery address</h3>
      <div className="space-y-2">
        {[{key:'address1',label:'Primary',address:cust.address1},{key:'address2',label:'Secondary',address:cust.address2}].map(opt=>(
          <label key={opt.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${currentInvoice.deliveryAddressKey===opt.key?'bg-kt-raised border-kt-ink':'bg-white border-kt-line hover:bg-kt-raised'}`}>
            <input type="radio" name="deliveryAddress" className="mt-0.5 accent-kt-primary" checked={currentInvoice.deliveryAddressKey===opt.key} onChange={()=>setCurrentInvoice({...currentInvoice,deliveryAddressKey:opt.key})} />
            <div><span className="text-xs font-medium text-kt-sub">{opt.label}</span><p className="text-sm text-kt-ink mt-0.5 leading-snug">{opt.address}</p></div>
          </label>
        ))}
      </div>
    </div>
  );
})()}
<div className={sectionClass}>
<h3 className={sectionTitleClass}><Step n={3}/> Delivery and payment</h3>
<div className="mb-4"><label className={labelClass}>Vehicle / transport method</label><select className={inputClass} value={currentInvoice.vehicle} onChange={e => { const v = e.target.value; setCurrentInvoice({...currentInvoice, vehicle: v, ...(isTransportMethod(vehicleTypes, v) ? {} : { transportCompany: '', biltyNumber: '' }), ...(usesCarrierPerson(v) ? {} : { driverName: '', driverPhone: '', riderId: '' })}); }}>{(vehicleTypes.length ? vehicleTypes : [{name:'Rider'},{name:'Rickshaw'},{name:'Suzuki'},{name:'Intercity Transport'},{name:'Self-Pickup'}]).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></div>
{(isTransportMethod(vehicleTypes, currentInvoice.vehicle) || (!isKnownVehicleType(vehicleTypes, currentInvoice.vehicle) && (currentInvoice.transportCompany || currentInvoice.biltyNumber))) && (
<div className="grid grid-cols-2 gap-3 mb-4 bg-kt-page/60 p-4 rounded-lg border border-kt-line">
{transportCompanies.filter(c => c.transportType === currentInvoice.vehicle).length > 0 && (
  <div className="col-span-2">
    <label className={labelClass}>Pick from Registry</label>
    <div className="relative">
      <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass}`}
        placeholder="Search transport companies"
        value={showTcDrop ? tcSearch : (currentInvoice.transportCompany || '')}
        onFocus={() => { setShowTcDrop(true); setTcSearch(''); }}
        onChange={e => setTcSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowTcDrop(false), 150)}
      />
      {showTcDrop && (
        <div className="absolute z-50 w-full mt-1 border border-kt-line bg-white rounded-lg max-h-48 overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div
            className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised ${!currentInvoice.transportCompany ? 'bg-kt-raised text-kt-ink' : 'text-kt-muted'}`}
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, transportCompany: ''}); setShowTcDrop(false); }}
          >– Clear Company –</div>
          {transportCompanies
            .filter(c => c.transportType === currentInvoice.vehicle && (!tcSearch || c.name.toLowerCase().includes(tcSearch.toLowerCase()) || (c.city||'').toLowerCase().includes(tcSearch.toLowerCase())))
            .map(c => (
              <div
                key={c.id}
                className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised ${c.name === currentInvoice.transportCompany ? 'bg-kt-raised font-medium text-kt-ink' : 'text-kt-ink'}`}
                onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, transportCompany: c.name, driverName: c.defaultDriverName || currentInvoice.driverName || '', driverPhone: c.defaultDriverPhone || currentInvoice.driverPhone || ''}); setShowTcDrop(false); }}
              >{c.name}{c.city ? ` · ${c.city}` : ''}</div>
            ))
          }
          {transportCompanies.filter(c => c.transportType === currentInvoice.vehicle && (!tcSearch || c.name.toLowerCase().includes(tcSearch.toLowerCase()) || (c.city||'').toLowerCase().includes(tcSearch.toLowerCase()))).length === 0 && (
            <p className="px-3 py-3 text-sm text-kt-muted">No companies found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2"><label className={labelClass}>Transport Company</label><input placeholder="e.g. Daewoo Express" className={`${inputClass}`} value={currentInvoice.transportCompany || ''} onChange={e => setCurrentInvoice({...currentInvoice, transportCompany: e.target.value})} /></div>
<div className="col-span-2"><label className={labelClass}>Consignment No. (Bill of Transport)</label><input placeholder="No. on the transport receipt" className={`${inputClass}`} value={currentInvoice.biltyNumber || ''} onChange={e => setCurrentInvoice({...currentInvoice, biltyNumber: e.target.value})} /></div>
<div className="col-span-2 pt-3 border-t border-kt-line">
  <p className="text-xs text-kt-sub leading-snug">Who took the stock to the transport office — one of your own riders, or by hand.</p>
</div>
{riders.length > 0 && (
  <div className="col-span-2">
    <label className={labelClass}>Pick Booking Person</label>
    <div className="relative">
      <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass}`}
        placeholder="Search riders and drivers"
        value={showBookerDrop ? bookerSearch : (currentInvoice.driverName || '')}
        onFocus={() => { setShowBookerDrop(true); setBookerSearch(''); }}
        onChange={e => setBookerSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowBookerDrop(false), 150)}
      />
      {showBookerDrop && (
        <div className="absolute z-50 w-full mt-1 border border-kt-line bg-white rounded-lg max-h-48 overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised text-kt-muted"
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: '', driverPhone: ''}); setShowBookerDrop(false); }}
          >– Clear –</div>
          <div className="px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised text-kt-ink"
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: 'By Hand', driverPhone: ''}); setShowBookerDrop(false); }}
          >By Hand</div>
          {/* Any rider, whatever their vehicle — the person who runs stock to the courier
              office may be a rider, a rickshaw driver or a Suzuki driver. */}
          {riders.filter(r => !bookerSearch || r.name.toLowerCase().includes(bookerSearch.toLowerCase())).map(r => (
            <div key={r.id}
              className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised ${String(r.id) === String(currentInvoice.riderId) ? 'bg-kt-raised font-medium text-kt-ink' : 'text-kt-ink'}`}
              onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: r.id, driverName: r.name, driverPhone: r.phone || ''}); setShowBookerDrop(false); }}
            >{r.name} <span className="text-xs text-kt-muted">· {r.vehicleType}</span></div>
          ))}
          {riders.filter(r => !bookerSearch || r.name.toLowerCase().includes(bookerSearch.toLowerCase())).length === 0 && (
            <p className="px-3 py-3 text-sm text-kt-muted">No riders found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2 sm:col-span-1 2xl:col-span-2"><label className={labelClass}>Booked By (Rider / Driver)</label><input placeholder="Name, or 'By Hand'" className={`${inputClass}`} value={currentInvoice.driverName || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverName: e.target.value, riderId: ''})} /></div>
<div className="col-span-2 sm:col-span-1 2xl:col-span-2"><label className={labelClass}>Their Phone</label><input placeholder="03XX XXXXXXX" className={`${inputClass}`} value={currentInvoice.driverPhone || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverPhone: e.target.value})} /></div>
</div>
)}
{(vehicleTypes.find(v => v.name === currentInvoice.vehicle)?.requiresRider ?? ['Rider','Rickshaw','Suzuki'].includes(currentInvoice.vehicle)) && (
<div className="grid grid-cols-2 gap-3 mb-4 bg-kt-page/60 p-4 rounded-lg border border-kt-line">
{riders.filter(r => r.vehicleType === currentInvoice.vehicle).length > 0 && (
  <div className="col-span-2">
    <label className={labelClass}>Pick from Registry</label>
    <div className="relative">
      <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted pointer-events-none z-10"/>
      <input
        className={`pl-10 ${inputClass}`}
        placeholder="Search riders"
        value={showRiderDrop ? riderSearch : (riders.find(r => String(r.id) === String(currentInvoice.riderId))?.name || '')}
        onFocus={() => { setShowRiderDrop(true); setRiderSearch(''); }}
        onChange={e => setRiderSearch(e.target.value)}
        onBlur={() => setTimeout(() => setShowRiderDrop(false), 150)}
      />
      {showRiderDrop && (
        <div className="absolute z-50 w-full mt-1 border border-kt-line bg-white rounded-lg max-h-48 overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div
            className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised ${!currentInvoice.riderId ? 'bg-kt-raised text-kt-ink' : 'text-kt-muted'}`}
            onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: '', driverName: '', driverPhone: ''}); setShowRiderDrop(false); }}
          >– Clear Rider –</div>
          {riders
            .filter(r => r.vehicleType === currentInvoice.vehicle && (!riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase())))
            .map(r => (
              <div
                key={r.id}
                className={`px-3 py-2.5 text-sm cursor-pointer hover:bg-kt-raised ${String(r.id) === String(currentInvoice.riderId) ? 'bg-kt-raised font-medium text-kt-ink' : 'text-kt-ink'}`}
                onMouseDown={e => { e.preventDefault(); setCurrentInvoice({...currentInvoice, riderId: r.id, driverName: r.name, driverPhone: r.phone || ''}); setShowRiderDrop(false); }}
              >{r.name}{r.vehicleNumber ? ` (${r.vehicleNumber})` : ''}</div>
            ))
          }
          {riders.filter(r => r.vehicleType === currentInvoice.vehicle && (!riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase()))).length === 0 && (
            <p className="px-3 py-3 text-sm text-kt-muted">No riders found</p>
          )}
        </div>
      )}
    </div>
  </div>
)}
<div className="col-span-2 sm:col-span-1 2xl:col-span-2"><label className={labelClass}>Rider / Driver Name</label><input placeholder="Name, or 'By Hand'" className={`${inputClass}`} value={currentInvoice.driverName || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverName: e.target.value, riderId: ''})} /></div>
<div className="col-span-2 sm:col-span-1 2xl:col-span-2"><label className={labelClass}>Rider / Driver Phone</label><input placeholder="03XX XXXXXXX" className={`${inputClass}`} value={currentInvoice.driverPhone || ''} onChange={e => setCurrentInvoice({...currentInvoice, driverPhone: e.target.value})} /></div>
</div>
)}
<div className="grid grid-cols-1 sm:grid-cols-3 2xl:grid-cols-1 gap-3">
<div><label className={labelClass}>Delivery (+)</label><input type="number" inputMode="decimal" enterKeyHint="next" aria-invalid={errFor('deliveryBilled').length ? 'true' : undefined} className={`${inputClass} tabular-nums`} value={currentInvoice.deliveryBilled} onFocus={numFocus} onWheel={numWheel} onChange={e => setCurrentInvoice({...currentInvoice, deliveryBilled: e.target.value})} /></div>
<div><label className={labelClass}>Driver expense (−)</label><input type="number" inputMode="decimal" enterKeyHint="next" aria-invalid={errFor('transportExpense').length ? 'true' : undefined} className={`${inputClass} tabular-nums`} value={currentInvoice.transportExpense} onFocus={numFocus} onWheel={numWheel} onChange={e => setCurrentInvoice({...currentInvoice, transportExpense: e.target.value})} /></div>
<div><label className={labelClass}>Discount (−)</label><input type="number" inputMode="decimal" enterKeyHint="next" aria-invalid={errFor('discount').length ? 'true' : undefined} className={`${inputClass} tabular-nums`} value={currentInvoice.discount || ''} placeholder="0" onFocus={numFocus} onWheel={numWheel} onChange={e => setCurrentInvoice({...currentInvoice, discount: Number(e.target.value) || 0})} /></div>
</div>
{[...errFor('deliveryBilled'), ...errFor('transportExpense'), ...errFor('discount')].map((e, n) => <p key={n} className="mt-2 text-xs text-kt-red">{e.message}</p>)}
{hasPermission('collectOnBill') && (
<div className="mt-4 pt-4 border-t border-kt-line">
<label className={labelClass}>Payment received</label>
<div className="flex items-center gap-2">
<input type="number" inputMode="decimal" enterKeyHint="done" aria-invalid={errFor('receivedAmount').length ? 'true' : undefined} className={`${inputClass} text-base font-medium tabular-nums`} value={currentInvoice.receivedAmount || ''} onFocus={numFocus} onWheel={numWheel} onChange={e => setCurrentInvoice({...currentInvoice, receivedAmount: Number(e.target.value), paymentStatus: Number(e.target.value) >= grandTotal ? 'Paid' : (Number(e.target.value)>0 ? 'Partial' : 'Pending')})} placeholder="0" />
<button onClick={() => setCurrentInvoice({...currentInvoice, receivedAmount: grandTotal, paymentStatus: 'Paid'})} className="h-11 px-4 bg-white text-kt-ink font-medium rounded-lg text-sm whitespace-nowrap border border-kt-line hover:bg-kt-raised transition-colors">Full pay</button>
</div>
{errFor('receivedAmount').map(e => <p key="r" className="mt-2 text-xs text-kt-red">{e.message}</p>)}
</div>
)}
</div>
<div className={sectionClass}>
<h3 className={sectionTitleClass}><Step n={4}/> Notes</h3>
<textarea rows={3} placeholder="Delivery instructions, payment terms" className={`${inputClass} h-auto py-2.5 resize-none`} value={currentInvoice.notes || ''} onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})} />
</div>
{isEdit && isAdmin && (<button onClick={async () => { const reason = await showPrompt(`Void ${currentInvoice.id}?\n\nIt stays on file and drops out of every balance and report.`, { placeholder: 'e.g. duplicate entry' }); if (reason === null) return; /* void what is stored, not the half-edited form state */ const stored = invoices.find(o => o.id === currentInvoice.id) || currentInvoice; await voidRecord('invoices', stored, { label: stored.id, reason }); showToast(`${currentInvoice.id} voided`); setBillingView('list'); }} className="w-full h-11 bg-white text-kt-red font-medium rounded-lg flex justify-center items-center gap-2 border border-kt-line hover:bg-kt-raised transition-colors"><Trash2 size={16} strokeWidth={1.5}/> Void {editingStatus === 'Estimate' ? 'Estimate' : editingStatus === 'Booked' ? 'Draft Order' : 'Invoice'}</button>)}
</div>
</div>
<InvoiceSummaryBar summary={summary} open={summaryOpen} onToggle={toggleSummary} compact={keyboardUp} onDone={() => document.activeElement?.blur?.()}>
{(() => {
  const busy = { disabled: saving, 'aria-busy': saving || undefined };
  const kbd = (k) => <kbd className="hidden lg:inline text-[11px] font-mono px-1.5 rounded bg-black/5 text-kt-sub">{k}</kbd>;
  const showEst = canSaveAsEstimate && offerStatus('Estimate');
  const showDraft = canSaveAsEstimate && offerStatus('Booked');
  const showBill = offerStatus('Billed');
  const second = "h-12 bg-white text-kt-ink border border-kt-line rounded-lg font-medium text-sm flex justify-center items-center gap-2 px-2 hover:bg-kt-raised active:scale-[0.98] transition-[background-color,transform] disabled:opacity-60";
  return (
    <div className="flex gap-2">
      {showEst && <button type="button" {...busy} title="Save as Estimate / Quotation" onClick={() => saveInvoice('Estimate')} className={`flex-1 min-w-0 ${second}`}><FileText size={16} strokeWidth={1.5} className="hidden sm:block shrink-0"/><span className="sm:hidden">Estimate</span><span className="hidden sm:inline truncate">Save as Estimate</span>{isEdit && quickStatus === 'Estimate' && kbd('Ctrl+S')}</button>}
      {showDraft && <button type="button" {...busy} onClick={() => saveInvoice('Booked')} className={`flex-1 min-w-0 ${second}`}><Save size={16} strokeWidth={1.5} className="hidden sm:block shrink-0"/><span className="sm:hidden">Draft</span><span className="hidden sm:inline">Draft Order</span>{quickStatus === 'Booked' && kbd('Ctrl+S')}</button>}
      {showBill && <button type="button" {...busy} onClick={() => saveInvoice('Billed')} className={`${showEst || showDraft ? 'flex-[2]' : 'flex-1'} min-w-0 h-12 bg-kt-primary hover:bg-kt-primary/90 text-white rounded-lg font-medium flex justify-center items-center gap-2 px-2 active:scale-[0.98] transition-[background-color,transform] disabled:opacity-60`}><ReceiptText size={18} strokeWidth={1.5} className="shrink-0"/> {saving ? 'Saving…' : (isEdit && editingStatus === 'Billed' ? 'Update Invoice' : 'Issue Invoice')}<kbd className="hidden lg:inline text-[11px] font-mono px-1.5 rounded bg-white/15">Ctrl+Enter</kbd></button>}
    </div>
  );
})()}
</InvoiceSummaryBar>
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
// The period at a glance, from the same documents the list shows (search and type filter aside).
const inPeriod = invoices.filter(o => (!ownOnly || String(o.salespersonId) === String(currentUser?.id)) && checkDateFilter(o.date, dateFilter));
const billedDocs = inPeriod.filter(o => o.status === 'Billed');
const billedSum = billedDocs.reduce((t, o) => t + (Number(o.total) || 0), 0);
const returnsSum = inPeriod.filter(o => o.status === 'CreditNote').reduce((t, o) => t + (Number(o.total) || 0), 0);
const unpaidCount = billedDocs.filter(o => getPaymentStatus(o) !== 'Paid').length;
const openDrafts = inPeriod.filter(o => o.status === 'Estimate' || o.status === 'Booked').length;
return (
<div className="font-ui p-4 sm:p-6 flex flex-col h-full bg-kt-page">
{/* On a phone the four counts became four stacked blocks and the band filled the screen.
    There they are one line of text under the total; from sm up, columns. */}
<div className="bg-kt-band text-white rounded-xl px-4 py-3 sm:px-5 sm:py-4 mb-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-8 sm:gap-y-3">
  <div className="sm:mr-auto">
    <p className="text-sm text-white/70">Billed · {dateFilter}</p>
    <p className="font-display text-3xl sm:text-4xl text-kt-yellow leading-tight">Rs. {billedSum.toLocaleString('en-US')}</p>
  </div>
  <p className="sm:hidden text-sm text-white/80 mt-1 leading-snug">
    {/* Each figure stays whole across a line break: "Rs." must never end a line. */}
    {[`${billedDocs.length} bill${billedDocs.length !== 1 ? 's' : ''}`, `${unpaidCount} not fully paid`,
      `${openDrafts} quote${openDrafts !== 1 ? 's' : ''} or order${openDrafts !== 1 ? 's' : ''}`,
      ...(returnsSum > 0 ? [`Rs. ${returnsSum.toLocaleString('en-US')} returns`] : [])]
      .map((t, i) => <Fragment key={t}>{i > 0 && ' · '}<span className="whitespace-nowrap">{t}</span></Fragment>)}
  </p>
  <div className="hidden sm:block"><p className="text-sm text-white/70">Bills</p><p className="font-display text-2xl leading-tight">{billedDocs.length}</p></div>
  <div className="hidden sm:block"><p className="text-sm text-white/70">Not fully paid</p><p className="font-display text-2xl leading-tight">{unpaidCount}</p></div>
  <div className="hidden sm:block"><p className="text-sm text-white/70">Quotes and orders</p><p className="font-display text-2xl leading-tight">{openDrafts}</p></div>
  {returnsSum > 0 && <div className="hidden sm:block"><p className="text-sm text-white/70">Returns</p><p className="font-display text-2xl leading-tight">Rs. {returnsSum.toLocaleString('en-US')}</p></div>}
</div>
<div className="flex gap-2 mb-3">
<div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted" size={16} strokeWidth={1.5} /><input placeholder="Search invoices" className="w-full h-11 pl-9 pr-3 bg-white border border-kt-line rounded-lg text-sm text-kt-ink placeholder-kt-muted outline-none focus:border-kt-ink transition-colors" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
{statusFilter === 'CreditNote'
  ? hasPermission('salesReturns') && <button onClick={() => { setEditingCreditNote({ customerId: '', id: '' }); setShowCreditNoteModal(true); }} className="h-11 bg-kt-primary hover:bg-kt-primary/90 text-white px-4 rounded-lg font-medium text-sm flex items-center gap-2 active:scale-[0.98] transition-[background-color,transform] whitespace-nowrap"><RotateCcw size={16} strokeWidth={1.5}/> New return</button>
  : <button onClick={startNewInvoice} className="h-11 bg-kt-primary hover:bg-kt-primary/90 text-white px-4 rounded-lg font-medium text-sm flex items-center gap-2 active:scale-[0.98] transition-[background-color,transform]"><Plus size={16} strokeWidth={1.5}/> New</button>
}
</div>
<div className="flex flex-col sm:flex-row gap-2 mb-4">
<FilterSelect tall className="sm:w-48 shrink-0" value={dateFilter} onChange={e => setDateFilter(e.target.value)} label="Period" icon={Calendar}><option>All Time</option><option>Today</option><option>This Week</option><option>This Month</option><option>This Year</option></FilterSelect>
<div className="flex flex-1 gap-1 p-1 bg-white border border-kt-line rounded-lg">
{[{v:'All',l:'All'},{v:'Estimate',l:'Quotes'},{v:'Booked',l:'Orders'},{v:'Billed',l:'Invoices'},{v:'CreditNote',l:'Returns'}].map(({v,l}) => (
<button key={v} data-billingstatus={v} tabIndex={statusFilter===v?0:-1}
  onClick={() => setStatusFilter(v)}
  onKeyDown={makeArrowNav(['All','Estimate','Booked','Billed','CreditNote'],statusFilter,setStatusFilter,'data-billingstatus')}
  className={`flex-1 h-8 rounded-md text-sm transition-colors ${statusFilter===v ? 'bg-kt-yellow text-black font-medium' : 'text-kt-sub hover:bg-kt-raised hover:text-kt-ink'}`}>{l}</button>
))}
</div>
</div>
<div className="flex-1 overflow-y-auto space-y-2 pb-24 pr-1">
{filtered.slice().sort((a, b) => {
  const d = (b.date||'').localeCompare(a.date||'');
  if (d !== 0) return d;
  return (parseInt((b.id||'').replace(/\D/g,''))||0) - (parseInt((a.id||'').replace(/\D/g,''))||0);
}).map(o => (
<div key={o.id} className="bg-white px-5 py-4 rounded-xl border border-kt-line shadow-[0_1px_2px_rgba(20,20,20,0.05)] hover:shadow-[0_6px_20px_rgba(20,20,20,0.07)] transition-shadow">
<div className="flex justify-between gap-4">
<div className="min-w-0"><h4 className="font-medium text-kt-blue text-base truncate">{o.customerName}</h4></div>
<div className="text-right shrink-0"><p className={`font-display text-2xl leading-tight ${o.status==='CreditNote'?'text-kt-red':'text-kt-ink'}`}>{o.status==='CreditNote'?'− ':''}Rs. {o.total.toLocaleString('en-US')}</p>

</div>
</div>
<div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 mt-2">
<div className="text-sm text-kt-sub flex items-center gap-x-3 gap-y-0.5 flex-wrap"><span className="font-mono text-[13px] text-kt-ink">{o.id}</span><span className="tabular-nums">{formatDateDisp(o.date)}</span><span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${o.status==='CreditNote'?'bg-kt-red/10 text-kt-red':o.status==='Estimate'?'bg-kt-blue/10 text-kt-blue':o.status==='Booked'?'bg-kt-amber/10 text-kt-amber':'bg-kt-raised text-kt-ink'}`}>{o.status==='CreditNote'?'Credit Note':o.status==='Booked'?'Draft Order':o.status}</span>{/* The derived status, the same one the edge used to be coloured from. The label used to read
    the stored field, so a bill settled by a later receipt could say Pending in green. */}
{o.status==='Billed' && (() => { const ps = getPaymentStatus(o); return <span className={`inline-flex items-center h-6 px-2 rounded-md text-xs font-medium ${ps==='Paid'?'bg-kt-green/10 text-kt-green':ps==='Partial'?'bg-kt-amber/10 text-kt-amber':'bg-kt-red/10 text-kt-red'}`}>{ps==='Pending'?'Unpaid':ps}</span>; })()}</div>
<div className="flex gap-1 w-full justify-between sm:w-auto sm:justify-end">
{o.status === 'Estimate' && hasPermission('issueInvoices') && <button onClick={async () => { await saveToFirebase('invoices', o.id, {...o, status: 'Booked'}); showToast('Converted to Draft Order'); }} title="Convert to Draft Order" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><Save size={16} strokeWidth={1.5}/></button>}
{(o.status === 'Estimate' || o.status === 'Booked') && hasPermission('issueInvoices') && <button onClick={async () => { const invGuess = getNextSeqNum(invoicesRaw, 'INV'); const invNum = await nextDocNumber('INV', invGuess); if (invNum === null) return showToast("No invoice numbers left offline. Reconnect once to reserve more.", "error"); const newId = `INV-${String(invNum).padStart(4, '0')}`; const issued = {...o, id: newId, status: 'Billed', date: getLocalDateStr()}; await saveToFirebase('invoices', newId, issued); await logSave('invoices', null, issued, newId); await deleteFromFirebase('invoices', o.id); await logDelete('invoices', o, `Issued as ${newId}`, o.id); showToast(`Converted to Invoice: ${newId}`); }} title="Issue as Invoice" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><ReceiptText size={16} strokeWidth={1.5}/></button>}
{o.status === 'Billed' && hasPermission('salesReturns') && <button onClick={() => { setEditingCreditNote({customerId: o.customerId, id: o.id}); setShowCreditNoteModal(true); }} title="Issue Credit Note / Return" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><RotateCcw size={16} strokeWidth={1.5}/></button>}
{(hasPermission('viewLedger') || String(o.salespersonId) === String(currentUser?.id)) && <button onClick={() => { setSelectedLedgerId(o.customerId); setShowLedgerModal(true); }} title="Customer Ledger" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><BookOpen size={16} strokeWidth={1.5}/></button>}
{(isAdmin || (hasPermission('editOwnInvoices') && String(o.salespersonId) === String(currentUser?.id))) && o.status !== 'CreditNote' && <button onClick={() => { setCurrentInvoice(o); setBillingView('form'); }} title="Edit" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><Edit size={16} strokeWidth={1.5}/></button>}
{isAdmin && <button onClick={async () => { const reason = await showPrompt(`Void ${o.id}?\n\nIt stays on file and drops out of every balance and report.`, { placeholder: 'e.g. duplicate entry' }); if (reason === null) return; await voidRecord('invoices', o, { label: o.id, reason }); showToast(`${o.id} voided`); }} title="Void" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-red transition-colors"><Trash2 size={16} strokeWidth={1.5}/></button>}
{o.status === 'Estimate' ? <button onClick={() => setPrintConfig({docType: 'estimate', format: 'a4', data: o})} title="View Estimate" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><FileText size={16} strokeWidth={1.5}/></button> : o.status === 'Booked' ? <><button onClick={() => setPrintConfig({docType: 'dispatch', format: 'thermal', data: o})} title="Dispatch Note" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><Truck size={16} strokeWidth={1.5}/></button><button onClick={() => setPrintConfig({docType: 'estimate', format: 'a4', data: o})} title="View Order" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><FileText size={16} strokeWidth={1.5}/></button></> : o.status === 'CreditNote' ? <button onClick={() => setPrintConfig({docType: 'creditnote', format: 'a4', data: o})} title="Print Credit Note" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><FileText size={16} strokeWidth={1.5}/></button> : <><button onClick={() => setPrintConfig({docType: 'dispatch', format: 'thermal', data: o})} title="Dispatch" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><Truck size={16} strokeWidth={1.5}/></button><button onClick={() => setPrintConfig({docType: 'invoice', format: 'thermal', data: o})} title="Print" className="w-9 h-9 flex items-center justify-center rounded-md text-kt-sub hover:bg-kt-raised hover:text-kt-ink transition-colors"><ReceiptText size={16} strokeWidth={1.5}/></button></>}
</div>
</div>
</div>
))}
</div>
</div>
);
};
