import { useState, useContext } from 'react';
import { needsCost } from '../../lib/costPending';
import { Plus, Search, Edit, Trash2, RotateCcw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export const ProductsTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
const [search, setSearch] = useState('');
return (
<div className="p-4 flex flex-col h-full">
<div className="flex gap-2 mb-4">
<div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-kt-muted" size={18} /><input placeholder="Search products" className="w-full pl-10 pr-4 py-3 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }} /></div>
<button onClick={() => { setEditingProduct(null); setShowProductModal(true); }} className="bg-kt-primary text-white p-3 rounded-xl"><Plus size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto space-y-3 pb-24 pr-1">
{/* Products waiting for a cost come first: the Home notice and the tab badge send you here for them. */}
{products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => needsCost(b) - needsCost(a)).map(p => (
<div key={p.id} className={`p-4 rounded-xl border  ${p.archived ? 'bg-kt-amber/10 border-kt-amber/30 opacity-75' : 'bg-white border-kt-line'}`}>
<div className="flex justify-between items-start mb-3">
<div><h4 className="font-medium text-kt-ink text-base leading-tight">{p.name}{p.archived && <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-kt-amber/10 text-kt-amber rounded-full align-middle">Archived</span>}{isAdmin && needsCost(p) && <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-kt-red/10 text-kt-red rounded-full align-middle whitespace-nowrap" title="Registered by staff. Until a cost is set, its sales count as pure profit.">Cost needed</span>}</h4><p className="text-xs text-kt-sub font-medium mt-1">{getCompanyName(p.companyId)} • {p.unit} ({p.unitsInBox})</p></div>
{isAdmin && (<div className="flex gap-1.5"><button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} title="Edit product" aria-label="Edit product" className="p-2 bg-kt-raised text-kt-sub rounded-lg hover:bg-kt-raised transition-colors"><Edit size={16}/></button>
{p.archived
  ? <button onClick={async () => { await saveToFirebase('products', p.id, { ...p, archived: false }); }} className="p-2 bg-kt-green/10 text-kt-green rounded-lg hover:bg-kt-green/10 transition-colors" title="Unarchive"><RotateCcw size={16}/></button>
  : <button onClick={async () => {
      const billCount = invoices.filter(inv => inv.items?.some(it => String(it.productId||it.uniqueId||'') === String(p.id))).length;
      if (billCount > 0) {
        const doArchive = await showConfirm(`"${p.name}" is used in ${billCount} bill${billCount>1?'s':''}.\n\nArchive instead? (Hidden from new sales, preserved in history)`);
        if (doArchive) { await saveToFirebase('products', p.id, { ...p, archived: true, available: false }); return; }
        if (!await showConfirm(`Permanently delete "${p.name}"? Cannot be undone.`)) return;
      } else { if (!await showConfirm(`Delete ${p.name}?`)) return; }
      await deleteFromFirebase('products', p.id);
    }} className="p-2 bg-kt-red/10 text-kt-red rounded-lg hover:bg-kt-red/10 transition-colors"><Trash2 size={16}/></button>
}</div>)}
</div>
<div className="flex justify-between items-end border-t border-kt-line pt-3 mt-1">
<div className="flex flex-col"><span className="font-display text-2xl text-kt-ink leading-tight">Rs. {p.sellingPrice.toLocaleString('en-US')}</span>{isAdmin && <span className="text-kt-muted text-xs font-medium mt-0.5">Cost: Rs. {p.costPrice}</span>}</div>
{isAdmin ? (<button onClick={async () => { await saveToFirebase('products', p.id, {...p, available: !p.available}) }} className={`px-3 py-1.5 rounded-lg text-xs font-medium  ${p.available ? 'bg-kt-green/10 text-kt-green border border-kt-green/30' : 'bg-kt-red/10 text-kt-red border border-kt-red/30'}`}>{p.available ? 'In Stock' : 'Out Stock'}</button>) : (<span className={`px-3 py-1.5 rounded-lg text-xs font-medium  ${p.available ? 'bg-kt-green/10 text-kt-green border border-kt-green/30' : 'bg-kt-red/10 text-kt-red border border-kt-red/30'}`}>{p.available ? 'In Stock' : 'Out Stock'}</span>)}
</div>
</div>
))}
</div>
</div>
);
};
