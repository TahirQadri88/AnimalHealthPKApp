import { useState, useContext } from 'react';
import { Search, Plus, Edit, Trash2, Tag, RotateCcw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import { makeArrowNav } from '../../lib/a11y';
import { CompanyManager } from './CompanyManager';

export const MastersView = () => {
const { products, customers, invoices, payments, expenseCategories, getCompanyName, saveToFirebase, deleteFromFirebase, showToast, setEditingProduct, setShowProductModal, setEditingCustomer, setShowCustomerModal, setShowExpenseCatModal, showConfirm, showPrompt, voidRecord, logSave } = useContext(AppContext);
const [tab, setTab] = useState('products');
const [search, setSearch] = useState('');
const tabConfig = [
  { id: 'products', label: 'Items' },
  { id: 'customers', label: 'Clients' },
  { id: 'companies', label: 'Companies' },
  { id: 'categories', label: 'Exp. Labels' },
];
return (
<div className="flex-1 overflow-y-auto p-4 pb-6 space-y-4">
  <div className="bg-kt-raised p-1 rounded-xl">
  <ScrollableTabBar bgClass="bg-kt-raised">
    {tabConfig.map(t=>(
      <button key={t.id} data-masterstab={t.id} tabIndex={tab===t.id?0:-1}
        onClick={()=>{setTab(t.id);setSearch('');}}
        onKeyDown={makeArrowNav(tabConfig.map(x=>x.id),tab,id=>{setTab(id);setSearch('');}, 'data-masterstab')}
        className={`h-11 sm:h-8 px-3 rounded-lg font-medium text-sm sm:text-xs whitespace-nowrap transition-colors ${tab===t.id?'bg-white text-kt-green ':'text-kt-sub'}`}>{t.label}</button>
    ))}
  </ScrollableTabBar>
  </div>
  <div className="flex gap-2">
    <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted" size={14}/><input placeholder="Search..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm focus:border-kt-ink" value={search} onChange={e=>setSearch(e.target.value)} /></div>
    {tab !== 'companies' && tab !== 'categories' && (
      <button onClick={() => {
        if (tab === 'products') { setEditingProduct(null); setShowProductModal(true); }
        else if (tab === 'customers') { setEditingCustomer(null); setShowCustomerModal(true); }
      }} className="bg-kt-primary text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-kt-primary/90 transition-colors flex items-center gap-1.5">
        <Plus size={16}/> Add
      </button>
    )}
    {tab === 'categories' && (
      <button onClick={()=>setShowExpenseCatModal(true)} className="bg-kt-primary text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-kt-primary/90 transition-colors flex items-center gap-1.5"><Plus size={16}/> Add</button>
    )}
  </div>

  {tab === 'products' && (
    <div className="space-y-2 pb-10">
      {products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())).map(p=>(
        <div key={p.id} className={`p-3 rounded-xl border  flex justify-between items-center ${p.archived?'bg-kt-amber/10 border-kt-amber/30 opacity-75':'bg-white border-kt-line'}`}>
          <div className="flex-1 min-w-0 mr-2">
            <p className="font-medium text-kt-ink text-sm truncate">{p.name}{p.archived&&<span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-kt-amber/10 text-kt-amber rounded-full align-middle">Archived</span>}</p>
            <p className="text-xs text-kt-muted font-medium mt-0.5">{getCompanyName(p.companyId)} &bull; {p.unit} &bull; Cost: {p.costPrice} &bull; Sell: {p.sellingPrice}</p>
            <span className={`text-xs font-medium mt-1 inline-block px-1.5 py-0.5 rounded  ${p.available?'bg-kt-green/10 text-kt-green border border-kt-green/30':'bg-kt-red/10 text-kt-red border border-kt-red/30'}`}>{p.available?'In Stock':'Out of Stock'}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={()=>{setEditingProduct(p);setShowProductModal(true);}} className="p-2 bg-kt-raised text-kt-sub rounded-lg hover:bg-kt-blue/10 hover:text-kt-blue transition-colors"><Edit size={14}/></button>
            {p.archived
              ? <button onClick={async()=>{await saveToFirebase('products',p.id,{...p,archived:false});}} className="p-2 bg-kt-green/10 text-kt-green rounded-lg hover:bg-kt-green/10 transition-colors" title="Unarchive"><RotateCcw size={14}/></button>
              : <button onClick={async()=>{
                  const billCount=invoices.filter(inv=>inv.items?.some(it=>String(it.productId||it.uniqueId||'')===String(p.id))).length;
                  if(billCount>0){
                    const doArchive=await showConfirm(`"${p.name}" is used in ${billCount} bill${billCount>1?'s':''}.\n\nArchive instead? (Hidden from new sales, preserved in history)`);
                    if(doArchive){await saveToFirebase('products',p.id,{...p,archived:true,available:false});return;}
                    if(!await showConfirm(`Permanently delete "${p.name}"? Cannot be undone.`))return;
                  }else{if(!await showConfirm(`Delete ${p.name}?`))return;}
                  await deleteFromFirebase('products',p.id);
                }} className="p-2 bg-kt-red/10 text-kt-red rounded-lg hover:bg-kt-red/10 transition-colors"><Trash2 size={14}/></button>
            }
          </div>
        </div>
      ))}
    </div>
  )}

  {tab === 'customers' && (
    <div className="space-y-2 pb-10">
      {customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=>(
        <div key={c.id} className="bg-white p-3 rounded-xl border border-kt-line flex justify-between items-center">
          <div className="flex-1 min-w-0 mr-2">
            <p className="font-medium text-kt-ink text-sm truncate">{c.name}</p>
            <p className="text-xs text-kt-muted font-medium mt-0.5 truncate">{[c.contactPerson, c.phone, c.city].filter(Boolean).join(' • ')}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={()=>{setEditingCustomer(c);setShowCustomerModal(true);}} className="p-2 bg-kt-raised text-kt-sub rounded-lg hover:bg-kt-blue/10 hover:text-kt-blue transition-colors"><Edit size={14}/></button>
            <button onClick={async()=>{
  const relInvoices = invoices.filter(o => o.customerId === c.id);
  const relPayments = payments.filter(p => p.customerId === c.id);
  const hasRecords = relInvoices.length > 0 || relPayments.length > 0;
  if (hasRecords) {
    if (!await showConfirm(`${c.name} has ${relInvoices.length} invoice(s) and ${relPayments.length} payment(s).\n\nDelete this client and VOID all related records?\n\nThe records stay on file and leave every balance.`)) return;
    // The customer goes, but their financial history is voided rather than destroyed —
    // otherwise deleting one client silently rewrites last year's revenue.
    await Promise.all([
      ...relInvoices.map(o => voidRecord('invoices', o, { label: o.id, reason: `Client ${c.name} deleted` })),
      ...relPayments.map(p => voidRecord('payments', p, { label: p.id, reason: `Client ${c.name} deleted` })),
    ]);
  } else {
    if (!await showConfirm(`Permanently delete ${c.name}?`)) return;
  }
  await deleteFromFirebase('customers', c.id);
  showToast(`${c.name} deleted`);
}} className="p-2 bg-kt-red/10 text-kt-red rounded-lg hover:bg-kt-red/10 transition-colors"><Trash2 size={14}/></button>
          </div>
        </div>
      ))}
    </div>
  )}

  {tab === 'companies' && <CompanyManager search={search} />}

  {tab === 'categories' && (
    <div className="space-y-2 pb-10">
      {expenseCategories.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=>(
        <div key={c.id} className="bg-white p-3 rounded-xl border border-kt-line flex justify-between items-center">
          <span className="font-semibold text-kt-ink text-sm flex items-center gap-2"><Tag size={14} className="text-kt-muted"/> {c.name}</span>
          <button onClick={async()=>{if(await showConfirm(`Delete category "${c.name}"?`)) await deleteFromFirebase('expenseCategories',c.id);}} className="p-2 bg-kt-red/10 text-kt-red rounded-lg hover:bg-kt-red/10 transition-colors"><Trash2 size={14}/></button>
        </div>
      ))}
    </div>
  )}
</div>
);
};

// Courier registry CRUD for non-rider transport types. Rendered two ways:
//   • as its own Admin tab (no `lockedType`) — shows every company, type selectable
//   • inline under one transport type in Segments (`lockedType` set) — scoped to that type
// One component rather than two so the two entry points cannot drift apart.
