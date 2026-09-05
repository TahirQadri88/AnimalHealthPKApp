import { useState, useEffect, useRef, useContext } from 'react';
import { Plus, Search, X, Edit, Trash2, Save, Users, Package, Truck, MapPin, Calendar,
         AlertCircle, AlignLeft, BookOpen, FileText, ReceiptText, RotateCcw } from 'lucide-react';
// claimDocNumber comes through context, not by import: ../../lib/claimDocNumber pulls in
// ../firebase, which initialises Auth on import and would make this — the screen that
// bills every invoice — impossible to load from a test.
import { AppContext } from '../../context/AppContext';
import { VEHICLES, getLocalDateStr, formatDateDisp, checkDateFilter } from '../../helpers';
import { makeArrowNav } from '../../lib/a11y';
import { getNextSeqNum } from '../../lib/docNumbers';
import { QUEUED } from '../../lib/pendingWrite';
import { isTransportMethod, isKnownVehicleType, usesCarrierPerson } from '../../lib/transport';
import { invoiceTotal } from '../../services/accounting/invoiceTotals';

export const BillingTab = () => {
const { getPaymentStatus, isAdmin, hasPermission, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, productPreFill, setProductPreFill, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, setShowCreditNoteModal, setEditingCreditNote, showConfirm, riders, vehicleTypes, transportCompanies, showPrompt, voidRecord, logSave, invoicesRaw, logDelete, claimDocNumber } = useContext(AppContext);
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
const written = await saveToFirebase('invoices', finalInvoice.id, finalInvoice);
// `currentInvoice.id` is only set when editing, which is also what decides the toast below.
await logSave('invoices', currentInvoice.id ? invoices.find(o => o.id === finalInvoice.id) : null, finalInvoice, finalInvoice.id);
const statusLabels = { Estimate: 'Estimate', Booked: 'Draft Order', Billed: 'Invoice' };
const label = statusLabels[status] || status;
// "Saved" and "saved on this device" are different facts, and on a document that will be
// handed to a customer the difference is worth a sentence.
showToast(written === QUEUED
  ? `${label} ${finalInvoice.id} saved on this device — it will sync when you are back online`
  : (currentInvoice.id ? `${label} Updated` : `${label} Saved`));
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
