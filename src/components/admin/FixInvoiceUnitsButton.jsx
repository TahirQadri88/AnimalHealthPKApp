import { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export const FixInvoiceUnitsButton = () => {
const { products, invoices, saveToFirebase, showToast } = useContext(AppContext);
const [running, setRunning] = useState(false);
const run = async () => {
  setRunning(true);
  // Build lookup maps
  const byId   = new Map(products.map(p => [String(p.id), p]));
  const byName = new Map(products.map(p => [(p.name||'').toLowerCase().trim(), p]));
  const byWord = new Map();
  products.forEach(p => { const w=(p.name||'').toLowerCase().trim().split(/\s+/)[0]; if(w&&w.length>2&&!byWord.has(w)) byWord.set(w,p); });
  const findProd = (item) => {
    let prod = byId.get(String(item.productId||'')) || byId.get(String(item.uniqueId||'')) || null;
    if (!prod) { const nl=(item.name||'').toLowerCase().trim(); prod=byName.get(nl)||null; }
    if (!prod) { const nl=(item.name||'').toLowerCase().trim(); const fw=nl.split(/\s+/)[0]; if(fw&&fw.length>2) prod=byWord.get(fw)||null; }
    if (!prod) { const nl=(item.name||'').toLowerCase().trim(); prod=products.find(p=>{const pn=(p.name||'').toLowerCase().trim();return pn&&(nl.startsWith(pn.slice(0,10))||pn.startsWith(nl.slice(0,10)));}) || null; }
    return prod;
  };
  const isValidUnit = (u) => !!u && isNaN(u) && String(u).trim().length > 1;
  let invoicesFixed=0, unitsFixed=0, namesFixed=0;
  for (const inv of invoices) {
    const updatedItems = inv.items?.map(item => {
      const prod = findProd(item);
      if (!prod) return item;
      let updated = { ...item };
      let anyChange = false;
      if (!isValidUnit(item.unit)) {
        updated.unit = prod.unit || '';
        updated.unitsInBox = item.unitsInBox || prod.unitsInBox || 1;
        unitsFixed++; anyChange = true;
      }
      // Only sync name when matched by ID — safe to update
      const idMatch = byId.get(String(item.productId||'')) === prod || byId.get(String(item.uniqueId||'')) === prod;
      if (idMatch && prod.name && item.name !== prod.name) {
        updated.name = prod.name;
        namesFixed++; anyChange = true;
      }
      return anyChange ? updated : item;
    });
    if (!updatedItems) continue;
    const changed = updatedItems.some((it,i) => JSON.stringify(it) !== JSON.stringify(inv.items[i]));
    if (changed) { await saveToFirebase('invoices', inv.id, {...inv, items: updatedItems}); invoicesFixed++; }
  }
  setRunning(false);
  const total = unitsFixed + namesFixed;
  showToast(total>0 ? `Updated ${invoicesFixed} invoice${invoicesFixed>1?'s':''}: ${namesFixed} name${namesFixed!==1?'s':''} + ${unitsFixed} unit${unitsFixed!==1?'s':''} fixed!` : 'All items already up to date — nothing to fix.', total>0?'success':'info');
};
return (
<div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
  <h3 className="font-black text-slate-800 text-base mb-1">Fix Invoice Item Units</h3>
  <p className="text-xs text-slate-400 mb-4">Re-enriches all saved invoice items that are missing unit labels (e.g. Vial, Bottle) from the current product master. Run this once to fix old invoices.</p>
  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-black text-teal-900 text-sm">Scan & Fix All Invoices</div>
        <div className="text-[11px] text-teal-700 mt-1">{invoices.length} invoices · {products.length} products in master</div>
      </div>
      <button onClick={run} disabled={running} className={`font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shrink-0 ${running?'bg-slate-200 text-slate-400':'bg-teal-600 hover:bg-teal-700 text-white'}`}>
        {running?'Running…':'Run Fix'}
      </button>
    </div>
  </div>
</div>
);
};
