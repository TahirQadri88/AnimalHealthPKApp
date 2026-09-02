import { useState, useContext } from 'react';
import { AlertCircle } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import SearchableSelect from '../SearchableSelect';
import { getLocalDateStr, formatDateDisp } from '../../helpers';
import { profitImpactOfCostChange, defaultEffectiveDate, firstSaleDate } from '../../services/accounting/costPriceChange';

export const ProductModal = () => {
const { editingProduct, products, companies, invoices, isAdmin, checkDuplicate, saveToFirebase, showToast, setShowProductModal, productPreFill, setProductPreFill } = useContext(AppContext);
const isEdit = !!editingProduct;
const [form, setForm] = useState(isEdit ? editingProduct : { name: productPreFill || '', companyId: '', unit: '', unitsInBox: '', costPrice: '', sellingPrice: '', available: true });
const originalCost = isEdit ? editingProduct.costPrice : '';
const costChanged = isEdit && Number(form.costPrice) !== Number(originalCost);
// Defaults to today. It used to default to the product's FIRST EVER SALE, so saving a new
// cost quietly rewrote every invoice ever raised for it and moved the profit reported for
// months that were already closed. Reaching into history is now something you choose.
const [effectiveDate, setEffectiveDate] = useState(() => defaultEffectiveDate(getLocalDateStr()));
const earliestSale = isEdit ? firstSaleDate(form.id, invoices, getLocalDateStr()) : getLocalDateStr();
const costImpact = costChanged
  ? profitImpactOfCostChange({ productId: form.id, newCost: Number(form.costPrice || 0), effectiveDate, invoices })
  : { invoiceCount: 0, profitDelta: 0 };
const [newCompany, setNewCompany] = useState('');
const [isAddingCompany, setIsAddingCompany] = useState(false);
const save = async () => {
if(!form.name || !form.sellingPrice || !form.costPrice || !form.unit || !form.unitsInBox || (!form.companyId && !newCompany)) {
return showToast("All fields (Name, Company, Unit, Qty, Cost, Selling) are compulsory.", "error");
}
if(checkDuplicate(products, form.name, form.id)) return showToast("Product Name must be unique", "error");
let finalCompanyId = form.companyId;
if (isAddingCompany) {
if(checkDuplicate(companies, newCompany)) return showToast("Company Name already exists", "error");
const newComp = { id: Date.now(), name: newCompany };
await saveToFirebase('companies', newComp.id, newComp);
finalCompanyId = newComp.id;
}
const newCost = Number(form.costPrice||0);
const formatted = { ...form, companyId: Number(finalCompanyId), costPrice: newCost, sellingPrice: Number(form.sellingPrice), unitsInBox: Number(form.unitsInBox) };
if (isEdit) {
await saveToFirebase('products', form.id, formatted);
if (costChanged) {
const affectedInvoices = invoices.filter(inv => inv.date >= effectiveDate);
let costUpdCount = 0;
for (const inv of affectedInvoices) {
const updatedItems = inv.items.map(item => item.productId === form.id ? { ...item, costPrice: newCost } : item);
if (updatedItems.some((item, i) => item.costPrice !== inv.items[i]?.costPrice)) {
  await saveToFirebase('invoices', inv.id, { ...inv, items: updatedItems });
  costUpdCount++;
}
}
showToast(`Product Updated. Cost applied to ${costUpdCount} invoice${costUpdCount !== 1 ? 's' : ''} from ${effectiveDate}`);
} else { showToast("Product Updated"); }
} else {
const newId = Date.now();
await saveToFirebase('products', newId, { ...formatted, id: newId });
setProductPreFill('');
showToast("Product Registered");
}
setShowProductModal(false);
};
const inputClass = "w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Product" : "Register Product"} onClose={() => setShowProductModal(false)}>
<form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4 pb-10">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Product Name *</label><input placeholder="Unique Product Name" className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
<div className="flex justify-between items-center mb-3"><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Manufacturer / Company *</label><button onClick={() => setIsAddingCompany(!isAddingCompany)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors">{isAddingCompany ? 'Select Existing' : '+ Add New'}</button></div>
{isAddingCompany ? (<input placeholder="Enter New Company Name..." className={inputClass} value={newCompany} onChange={e => setNewCompany(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setIsAddingCompany(false); } }} />) : (
<SearchableSelect className={inputClass} value={form.companyId} onChange={e => setForm({...form, companyId: e.target.value})} placeholder="– Select Company –" options={companies.map(c => ({ value: c.id, label: c.name }))} />
)}
</div>
<div className="grid grid-cols-2 gap-4">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Unit Type *</label><input placeholder="e.g. Vial" className={inputClass} value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Units per Box *</label><input type="number" placeholder="Qty" className={inputClass} value={form.unitsInBox} onChange={e => setForm({...form, unitsInBox: e.target.value})} /></div>
</div>
<div className="grid grid-cols-2 gap-4 pt-2">
{isAdmin && (<div className="col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Cost Price *</label><input type="number" placeholder="Cost" className={`${inputClass} !border-indigo-200 !bg-indigo-50/50 focus:!border-indigo-500`} value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} /></div>)}
<div className={isAdmin ? 'col-span-2 sm:col-span-1' : 'col-span-2'}><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Selling Price *</label><input type="number" placeholder="Selling" className={`${inputClass} !border-emerald-200 !bg-emerald-50/50 focus:!border-emerald-500 text-emerald-700 font-bold`} value={form.sellingPrice} onChange={e => setForm({...form, sellingPrice: e.target.value})} /></div>
</div>
{costChanged && isAdmin && (
<div className="bg-amber-50 p-4 rounded-xl border border-amber-200 animate-slide-up mt-2">
<label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-2 flex items-center gap-1"><AlertCircle size={14}/> Effective From Date</label>
<p className="text-[10px] text-amber-700 font-medium mb-2 leading-relaxed">
  <strong>The cost has changed from today?</strong> Leave this as it is — past invoices keep the
  cost you actually paid, so the profit already reported stays correct.<br/>
  <strong>Correcting a mistake?</strong> Set it back to when the wrong figure started.
</p>
<input type="date" className={`${inputClass} !bg-white !border-amber-300 !text-amber-900`} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
{earliestSale < getLocalDateStr() && (
  <button type="button" onClick={() => setEffectiveDate(earliestSale)}
    className="mt-2 text-[10px] font-bold text-amber-800 underline">
    Correct every invoice, back to the first sale ({formatDateDisp(earliestSale)})
  </button>
)}
{costImpact.invoiceCount > 0 ? (
  <div className="mt-3 bg-white border border-rose-200 rounded-lg p-3">
    <p className="text-[11px] font-bold text-rose-700">
      This rewrites {costImpact.invoiceCount} already-issued invoice{costImpact.invoiceCount !== 1 ? 's' : ''}.
    </p>
    <p className="text-[11px] font-semibold text-slate-700 mt-1">
      Reported profit for those dates {costImpact.profitDelta < 0 ? 'falls' : 'rises'} by{' '}
      <strong className={costImpact.profitDelta < 0 ? 'text-rose-700' : 'text-emerald-700'}>
        Rs. {Math.abs(costImpact.profitDelta).toLocaleString('en-US')}
      </strong>.
    </p>
    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
      Only do this if the old cost was wrong. If you simply bought at a new price, set the date to today.
    </p>
  </div>
) : (
  <p className="mt-2 text-[11px] font-semibold text-emerald-700">
    No issued invoices are affected — history is untouched.
  </p>
)}
</div>
)}
<button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-6 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save Product</button>
</form>
</ModalWrapper>
);
};
