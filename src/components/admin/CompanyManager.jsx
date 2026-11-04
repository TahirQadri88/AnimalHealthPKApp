import { useState, useContext } from 'react';
import { Building2, Edit, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export const CompanyManager = ({ search = '' }) => {
const { companies, products, saveToFirebase, deleteFromFirebase, showToast, checkDuplicate, showConfirm } = useContext(AppContext);
const [newName, setNewName] = useState('');
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const [mergeFrom, setMergeFrom] = useState(null); // company being deleted
const [mergeTo, setMergeTo]   = useState('');     // target company id
const [expandedId, setExpandedId] = useState(null); // company whose products are shown

const companyProducts = (companyId) => products.filter(p => p.companyId === companyId);
const productCount = (companyId) => companyProducts(companyId).length;
const filtered = companies.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

const add = async () => {
  if (!newName.trim()) return;
  if (checkDuplicate(companies, newName)) return showToast("Company already exists", "error");
  const id = Date.now();
  await saveToFirebase('companies', id, { id, name: newName.trim() });
  setNewName(''); showToast("Company added");
};
const saveEdit = async (item) => {
  if (!editVal.trim()) return;
  if (checkDuplicate(companies, editVal.trim(), item.id)) return showToast("Name already used by another company", "error");
  await saveToFirebase('companies', item.id, { ...item, name: editVal.trim() });
  setEditingId(null); showToast("Company updated");
};
const startDelete = (c) => {
  const count = productCount(c.id);
  if (count === 0) {
    showConfirm(`Delete "${c.name}"? It has no products.`).then(ok => {
      if (ok) deleteFromFirebase('companies', c.id).then(() => showToast("Company deleted"));
    });
  } else {
    setMergeFrom(c);
    setMergeTo('');
  }
};
const doMerge = async () => {
  if (!mergeTo) return showToast("Select a company to reassign products to", "error");
  const affected = products.filter(p => p.companyId === mergeFrom.id);
  for (const p of affected) {
    await saveToFirebase('products', p.id, { ...p, companyId: Number(mergeTo) });
  }
  await deleteFromFirebase('companies', mergeFrom.id);
  showToast(`${affected.length} product${affected.length !== 1 ? 's' : ''} reassigned — "${mergeFrom.name}" deleted`);
  setMergeFrom(null);
};
return (
<div className="space-y-2">
  <div className="flex gap-2">
    <input type="text" placeholder="New company name..." className="flex-1 p-2.5 bg-white border border-kt-line rounded-xl font-semibold outline-none focus:border-kt-ink text-sm" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} />
    <button onClick={add} className="bg-kt-primary text-white px-4 rounded-xl font-medium text-sm hover:bg-kt-primary/90 transition-colors">Add</button>
  </div>
  {mergeFrom && (
    <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-kt-amber">"{mergeFrom.name}" has {productCount(mergeFrom.id)} product{productCount(mergeFrom.id)!==1?'s':''}. Reassign them to another company before deleting.</p>
      <select className="w-full p-2.5 bg-white border border-kt-amber/30 rounded-xl text-sm font-semibold outline-none" value={mergeTo} onChange={e=>setMergeTo(e.target.value)}>
        <option value="">— Select target company —</option>
        {companies.filter(c=>c.id!==mergeFrom.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-2">
        <button onClick={doMerge} className="flex-1 bg-kt-red hover:bg-kt-red/90 text-white font-medium py-2 rounded-xl text-sm">Reassign & Delete</button>
        <button onClick={()=>setMergeFrom(null)} className="px-4 bg-kt-raised hover:bg-kt-line text-kt-ink font-medium py-2 rounded-xl text-sm">Cancel</button>
      </div>
    </div>
  )}
  {filtered.map(c=>{
    const count = productCount(c.id);
    const isExpanded = expandedId === c.id;
    return (
    <div key={c.id} className="rounded-xl border border-kt-line overflow-hidden">
      <div className="bg-white p-3 flex items-center gap-2">
        {editingId===c.id ? (
          <>
            <input autoFocus className="flex-1 p-2 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(c);if(e.key==='Escape')setEditingId(null);}} />
            <button onClick={()=>saveEdit(c)} className="text-xs font-medium text-kt-blue px-3 py-1.5 bg-kt-blue/10 rounded-lg hover:bg-kt-blue/10">Save</button>
            <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1.5 bg-kt-raised rounded-lg">✕</button>
          </>
        ) : (
          <>
            <span className="flex-1 font-semibold text-kt-ink text-sm flex items-center gap-2">
              <Building2 size={14} className="text-kt-muted"/>
              {c.name}
              {count > 0 && (
                <button onClick={()=>setExpandedId(isExpanded ? null : c.id)} className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${isExpanded ? 'bg-kt-blue/10 text-kt-blue' : 'bg-kt-raised text-kt-sub hover:bg-kt-blue/10 hover:text-kt-blue'}`}>
                  {count} item{count!==1?'s':''} {isExpanded ? '▲' : '▼'}
                </button>
              )}
            </span>
            <button onClick={()=>{setEditingId(c.id);setEditVal(c.name);}} className="p-1.5 text-kt-muted hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg transition-colors"><Edit size={14}/></button>
            <button onClick={()=>startDelete(c)} className="p-1.5 text-kt-muted hover:text-kt-red hover:bg-kt-red/10 rounded-lg transition-colors"><Trash2 size={14}/></button>
          </>
        )}
      </div>
      {isExpanded && count > 0 && (
        <div className="border-t border-kt-line bg-kt-raised px-3 py-2 space-y-1">
          {companyProducts(c.id).map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs py-1">
              <span className={`font-semibold ${p.archived ? 'text-kt-muted line-through' : 'text-kt-ink'}`}>{p.name}</span>
              <span className="text-kt-muted font-medium">{p.unit} &bull; Sell: Rs.{p.sellingPrice}{p.archived && ' · Archived'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    );
  })}
</div>
);
};

// ─── Master Records View ───
