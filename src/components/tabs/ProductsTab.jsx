import { useState, useContext } from 'react';
import { Plus, Search, Edit, Trash2, RotateCcw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export const ProductsTab = () => {
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
