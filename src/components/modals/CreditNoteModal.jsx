import React, { useState, useMemo, useRef, useContext } from 'react';
import { X, Search, Package, Users, RotateCcw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { getLocalDateStr } from '../../helpers';
import { getNextSeqNum } from '../../lib/docNumbers';
import { claimDocNumber } from '../../lib/claimDocNumber';

export const CreditNoteModal = () => {
const { currentUser, products, customers, invoices, showToast, saveToFirebase, setShowCreditNoteModal, editingCreditNote, setEditingCreditNote, getCompanyName, logSave, invoicesRaw } = useContext(AppContext);
const inputClass = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";

// Editing an existing CN (id starts with 'CN-') vs new
const existingCN = editingCreditNote?.id?.startsWith('CN-') ? invoices.find(o => o.id === editingCreditNote.id) : null;

const [form, setForm] = useState({
  customerId: existingCN?.customerId || editingCreditNote?.customerId || '',
  originalInvoiceId: existingCN ? (existingCN.originalInvoiceId || '') : (!editingCreditNote?.id?.startsWith('CN-') ? editingCreditNote?.id || '' : ''),
  date: existingCN?.date || getLocalDateStr(),
  reason: existingCN?.reason || '',
  items: existingCN ? existingCN.items.map(i => ({ ...i, _soldQty: i.quantity })) : [],
});
const [custSearch, setCustSearch]   = useState('');
const [showCustDrop, setShowCustDrop] = useState(false);
const [hiCust, setHiCust]           = useState(-1);
const [prodSearch, setProdSearch]   = useState('');
const [hiProd, setHiProd]           = useState(-1);
const custSearchRef = useRef(null);
const prodSearchRef = useRef(null);
const lastQtyRef    = useRef(null);

const grandTotal = form.items.reduce((s, i) => s + (i.price * i.quantity), 0);
const custId = Number(form.customerId);

// Customer's purchase history (most-recent price per product)
const purchaseHistory = React.useMemo(() => {
  if (!custId) return [];
  const seen = new Map();
  [...invoices]
    .filter(o => o.customerId === custId && o.status === 'Billed')
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .forEach(inv => {
      (inv.items || []).filter(i => !i.isBonus).forEach(item => {
        const k = String(item.productId || item.uniqueId || item.name);
        if (!seen.has(k)) seen.set(k, { ...item, _soldQty: item.quantity, _invId: inv.id });
      });
    });
  return Array.from(seen.values());
}, [custId, invoices]);

const addedKeys = new Set(form.items.map(i => String(i.productId || i.uniqueId || i.name)));

const itemKey = (i) => String(i.productId || i.uniqueId || i.name);

const addHistoryItem = (item) => {
  const k = itemKey(item);
  if (addedKeys.has(k)) {
    setForm(f => ({ ...f, items: f.items.map(i => itemKey(i) === k ? { ...i, quantity: i.quantity + 1 } : i) }));
  } else {
    setForm(f => ({ ...f, items: [...f.items, { ...item, quantity: 1 }] }));
  }
  setTimeout(() => prodSearchRef.current?.focus(), 50);
};

const addProduct = (p) => {
  const k = String(p.id);
  if (form.items.find(i => String(i.productId) === k)) {
    setForm(f => ({ ...f, items: f.items.map(i => String(i.productId) === k ? { ...i, quantity: i.quantity + 1 } : i) }));
  } else {
    setForm(f => ({ ...f, items: [...f.items, { productId: p.id, name: p.name, price: p.sellingPrice, costPrice: p.costPrice, company: getCompanyName(p.companyId), quantity: 1, unit: p.unit, unitsInBox: p.unitsInBox }] }));
  }
  setProdSearch(''); setHiProd(-1);
  setTimeout(() => lastQtyRef.current?.focus(), 50);
};

const pickCustomer = (c) => {
  setForm(f => ({ ...f, customerId: c.id, items: [] }));
  setShowCustDrop(false); setCustSearch(''); setHiCust(-1);
  setTimeout(() => prodSearchRef.current?.focus(), 80);
};

const save = async () => {
  if (!form.customerId || form.items.length === 0) return showToast('Customer and at least one item required', 'error');
  const cust = customers.find(c => c.id === Number(form.customerId));
  let cnId = existingCN ? existingCN.id : null;
  if (!cnId) {
    const cnGuess = getNextSeqNum(invoicesRaw, 'CN');
    cnId = `CN-${String((await claimDocNumber('CN', cnGuess)) ?? cnGuess).padStart(4, '0')}`;
  }
  const cn = {
    id: cnId,
    date: form.date,
    customerId: Number(form.customerId),
    customerName: cust?.name || '',
    originalInvoiceId: form.originalInvoiceId || '',
    items: form.items.map(({ _soldQty, _invId, ...rest }) => rest),
    deliveryBilled: 0,
    total: grandTotal,
    reason: form.reason || '',
    status: 'CreditNote',
    salespersonId: currentUser.id,
    salespersonName: currentUser.name,
    customerDetails: cust ? { contactPerson: cust.contactPerson || '', phone: cust.phone || '', address1: cust.address1 || cust.address || '' } : {},
  };
  await saveToFirebase('invoices', cn.id, cn);
  await logSave('invoices', existingCN || null, cn, cn.id);
  showToast(existingCN ? 'Credit Note Updated!' : 'Credit Note Saved!');
  setEditingCreditNote(null); setShowCreditNoteModal(false);
};

// Filtered product list for search
const filteredProds = prodSearch
  ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()))
  : [];
// History items filtered by search (when search active, show matching history; else show all)
const historyList = prodSearch
  ? purchaseHistory.filter(i => (i.name || '').toLowerCase().includes(prodSearch.toLowerCase()))
  : purchaseHistory;

return (
<div className="h-full flex flex-col bg-slate-50 absolute inset-0 z-20 animate-slide-up"
  onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); save(); } }}>

{/* Header */}
<div className="bg-white/80 backdrop-blur-md p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
  <div>
    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Sales Return / Credit Note</h2>
    <input type="date" value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))}
      className="text-[11px] font-bold text-slate-500 bg-transparent border-0 outline-none cursor-pointer hover:text-rose-600 mt-0.5 p-0" />
  </div>
  <button onClick={() => { setEditingCreditNote(null); setShowCreditNoteModal(false); }} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200 transition-colors"><X size={20}/></button>
</div>

<div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">

  {/* ── Customer ── */}
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Users size={12}/> Customer</h3>
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none z-10"/>
      <input ref={custSearchRef} autoFocus={!form.customerId}
        className={`pl-10 ${inputClass}`} placeholder="Search customer…"
        value={showCustDrop ? custSearch : (customers.find(c => c.id === custId)?.name || '')}
        onFocus={() => { setShowCustDrop(true); setCustSearch(''); setHiCust(-1); }}
        onChange={e => { setCustSearch(e.target.value); setHiCust(-1); }}
        onBlur={() => setTimeout(() => { setShowCustDrop(false); setHiCust(-1); }, 150)}
        onKeyDown={e => {
          const fc = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()));
          if (e.key === 'ArrowDown') { e.preventDefault(); setHiCust(h => Math.min(h+1, fc.length-1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHiCust(h => Math.max(h-1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (hiCust >= 0 && fc[hiCust]) pickCustomer(fc[hiCust]); else if (fc.length === 1) pickCustomer(fc[0]); }
          else if (e.key === 'Escape') { setShowCustDrop(false); }
        }}
      />
      {showCustDrop && (
        <div className="absolute z-50 w-full mt-1 border border-rose-200 bg-white rounded-xl max-h-52 overflow-y-auto shadow-lg">
          {customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase())).map((c, idx) => (
            <button type="button" key={c.id}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${c.id === custId || idx === hiCust ? 'bg-rose-50 text-rose-700' : 'text-slate-800 hover:bg-rose-50'}`}
              onMouseDown={e => { e.preventDefault(); pickCustomer(c); }}>{c.name}</button>
          ))}
          {customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase())).length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400">No customers found</p>
          )}
        </div>
      )}
    </div>
  </div>

  {/* ── Items ── */}
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
      <Package size={12}/> Returned Items
      {form.items.length > 0 && <span className="ml-1 text-rose-600 font-bold normal-case tracking-normal">{form.items.length} SKU{form.items.length!==1?'s':''} · {form.items.reduce((s,i)=>s+(i.quantity||0),0)} units</span>}
    </h3>

    {/* Search input — shows history items when no query, all products when typing */}
    <div className="relative mb-3">
      <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400"/>
      <input ref={prodSearchRef}
        placeholder={custId ? 'Search to add… (history shown below)' : 'Select a customer first…'}
        disabled={!custId}
        className={`pl-10 ${inputClass} ${!custId ? 'opacity-50 cursor-not-allowed' : ''}`}
        value={prodSearch}
        onChange={e => { setProdSearch(e.target.value); setHiProd(-1); }}
        onKeyDown={e => {
          // Arrow navigation over merged list: history items first (when no search), then products
          const list = prodSearch ? filteredProds.map(p => ({ _type:'prod', p })) : historyList.slice(0,8).map(i => ({ _type:'hist', i }));
          if (e.key === 'ArrowDown') { e.preventDefault(); setHiProd(h => Math.min(h+1, list.length-1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHiProd(h => Math.max(h-1, 0)); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            const entry = hiProd >= 0 ? list[hiProd] : list.length === 1 ? list[0] : null;
            if (!entry) return;
            if (entry._type === 'hist') addHistoryItem(entry.i);
            else addProduct(entry.p);
          }
          else if (e.key === 'Escape') { setProdSearch(''); setHiProd(-1); }
        }}
      />
    </div>

    {/* Dropdown list: purchase history OR search results */}
    {custId && (prodSearch ? filteredProds.length > 0 : historyList.length > 0) && (
      <div className="border border-rose-200 bg-rose-50/30 rounded-xl mb-4 max-h-56 overflow-y-auto p-2 space-y-1 shadow-inner">
        {prodSearch ? (
          // Search results from all products
          filteredProds.map((p, idx) => {
            const inList = form.items.some(i => String(i.productId) === String(p.id));
            return (
              <div key={p.id} className={`p-2 rounded-lg border flex items-center justify-between ${idx === hiProd ? 'bg-rose-100 border-rose-300' : 'bg-white border-rose-100'}`}>
                <button type="button" className="flex-1 text-left font-semibold text-sm text-slate-800 hover:text-rose-700" onClick={() => addProduct(p)}>
                  {p.name}
                  <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Rs.{p.sellingPrice}</span>
                </button>
                {inList && <span className="text-[10px] font-bold text-rose-500 ml-2">✓</span>}
              </div>
            );
          })
        ) : (
          // Purchase history items (no search active)
          historyList.map((item, idx) => {
            const k = itemKey(item);
            const inList = addedKeys.has(k);
            return (
              <div key={k} className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${idx === hiProd ? 'bg-rose-100 border-rose-300' : 'bg-white border-rose-100'}`}>
                <button type="button" className="flex-1 text-left" onClick={() => addHistoryItem(item)}>
                  <span className="font-semibold text-sm text-slate-800">{item.name}</span>
                  <span className="ml-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Rs.{item.price}</span>
                  <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">×{item._soldQty || item.quantity}</span>
                  {item._invId && <span className="ml-1 text-[10px] text-slate-400">{item._invId}</span>}
                </button>
                {inList && <span className="text-[10px] font-bold text-rose-500 shrink-0">✓ Added</span>}
              </div>
            );
          })
        )}
        {prodSearch && filteredProds.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-3">No products found</p>
        )}
      </div>
    )}
    {custId && !prodSearch && historyList.length === 0 && (
      <p className="text-sm text-slate-400 text-center py-3 mb-3">No purchase history — type to search all products</p>
    )}

    {/* Added return items */}
    <div className="space-y-3">
      {form.items.map((item, idx) => {
        const k = itemKey(item);
        return (
          <div key={k} data-item-row="1" className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-bold text-sm text-slate-800 leading-tight">{item.name}</p>
                {item._soldQty && <span className="text-[10px] text-slate-400">Sold: ×{item._soldQty}</span>}
              </div>
              <button tabIndex={-1} onClick={() => setForm(f=>({...f, items: f.items.filter(i => itemKey(i) !== k)}))} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16}/></button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 ml-1">Rate (Rs)</label>
                <input type="number" data-item-rate="1"
                  className="w-24 p-1.5 text-sm font-extrabold text-rose-700 bg-white border border-rose-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner"
                  value={item.price}
                  onChange={e => setForm(f=>({...f, items: f.items.map(i => itemKey(i)===k ? {...i, price: Number(e.target.value)} : i)}))}
                  onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); const q = e.target.closest('[data-item-row]')?.querySelector('[data-item-qty]'); q?.focus(); q?.select(); } }} />
              </div>
              <div className="flex flex-col items-center">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Qty</label>
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                  <button tabIndex={-1} onClick={() => setForm(f=>({...f, items: f.items.map(i => itemKey(i)===k ? {...i, quantity: i.quantity-1} : i).filter(i=>i.quantity>0)}))} className="w-8 h-8 rounded-md bg-slate-50 text-slate-600 font-bold hover:bg-slate-100">-</button>
                  <input data-item-qty="1" type="number" ref={idx === form.items.length-1 ? lastQtyRef : null}
                    className="w-12 text-center text-sm font-bold bg-transparent outline-none appearance-none"
                    value={item.quantity}
                    onChange={e => setForm(f=>({...f, items: f.items.map(i => itemKey(i)===k ? {...i, quantity: Number(e.target.value)||1} : i)}))}
                    onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); prodSearchRef.current?.focus(); } }} />
                  <button tabIndex={-1} onClick={() => setForm(f=>({...f, items: f.items.map(i => itemKey(i)===k ? {...i, quantity: i.quantity+1} : i)}))} className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 font-bold hover:bg-rose-100">+</button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-400 font-bold uppercase">Subtotal</p>
                <p className="font-extrabold text-rose-700 text-sm">Rs.{(item.price * item.quantity).toLocaleString('en-US')}</p>
              </div>
            </div>
          </div>
        );
      })}
      {form.items.length === 0 && custId && <p className="text-center text-slate-400 text-sm py-2">Pick items from the list above to return</p>}
    </div>
  </div>

  {/* ── Return details (reason + invoice ref) ── */}
  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Return Reason &amp; Reference</h3>
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><input placeholder="Reason: Expired, Wrong item, Excess stock…" className={inputClass} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} /></div>
      <div className="col-span-2"><input placeholder="Original Invoice (optional): INV-XXXX" className={inputClass} value={form.originalInvoiceId} onChange={e=>setForm(f=>({...f,originalInvoiceId:e.target.value}))} /></div>
    </div>
  </div>

  {/* ── Total ── */}
  {form.items.length > 0 && (
    <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-5 rounded-2xl border border-rose-100 text-center shadow-sm">
      <p className="text-rose-600 font-bold uppercase text-[10px] tracking-widest mb-1">{form.items.length} SKU{form.items.length!==1?'s':''} · Total Credit</p>
      <p className="text-4xl font-black text-rose-800 tracking-tight">Rs. {grandTotal.toLocaleString('en-US')}</p>
    </div>
  )}
</div>

{/* Footer */}
<div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 fixed bottom-0 w-full max-w-md flex gap-3 z-30">
  <button onClick={() => { setEditingCreditNote(null); setShowCreditNoteModal(false); }} className="flex-1 bg-white text-slate-700 border border-slate-300 py-3.5 rounded-xl font-bold shadow-sm flex justify-center items-center gap-2"><X size={18}/> Cancel</button>
  <button onClick={save} className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-xl font-bold shadow-md flex justify-center items-center gap-2 active:scale-95 transition-all"><RotateCcw size={18}/> Save · Ctrl+↵</button>
</div>
</div>
);
};

// ─── Payments / Receipts Tab ───
