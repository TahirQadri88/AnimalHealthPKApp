import { useState, useContext } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import { EXPENSE_GROUPS, EXPENSE_GROUP_COLORS } from '../../lib/constants';

export const ExpenseCategoryModal = () => {
const { expenseCategories, saveToFirebase, deleteFromFirebase, showToast, setShowExpenseCatModal, showConfirm } = useContext(AppContext);
const [newCat, setNewCat] = useState('');
const [newGroup, setNewGroup] = useState('Transportation');
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 shadow-sm";
const addCat = async () => {
if(!newCat) return;
if(expenseCategories.some(c => c.name.toLowerCase() === newCat.toLowerCase())) return showToast("Category exists", "error");
const catObj = { id: Date.now(), name: newCat, group: newGroup };
await saveToFirebase('expenseCategories', catObj.id, catObj);
setNewCat('');
showToast("Category Added");
};
return (
<ModalWrapper title="Manage Expense Labels" onClose={() => setShowExpenseCatModal(false)}>
<div className="space-y-4 pb-10">
<form onSubmit={e=>{e.preventDefault();addCat();}} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
  <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Category Name</label><input type="text" placeholder="e.g. Bike Ride, Petrol..." className={inputCls} value={newCat} onChange={e=>setNewCat(e.target.value)} /></div>
  <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Group / Type</label><select className={inputCls} value={newGroup} onChange={e=>setNewGroup(e.target.value)}>{EXPENSE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">Add Category</button>
</form>
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
{expenseCategories.length === 0 && <p className="text-center py-6 text-sm text-slate-400">No categories yet.</p>}
<ul className="divide-y divide-slate-100">
{EXPENSE_GROUPS.map(g => {
  const cats = expenseCategories.filter(c => (c.group||'Other') === g);
  if (cats.length === 0) return null;
  return (
    <li key={g}>
      <div className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border-b border-slate-100 ${EXPENSE_GROUP_COLORS[g]}`}>{g}</div>
      <ul>
        {cats.map(c => (
          <li key={c.id} className="flex justify-between items-center px-3 py-2.5 hover:bg-slate-50">
            <span className="font-semibold text-slate-700 text-sm flex items-center gap-2"><Tag size={13} className="text-slate-400"/> {c.name}</span>
            <button type="button" onClick={async () => { if(await showConfirm(`Delete category "${c.name}"?`)) await deleteFromFirebase('expenseCategories', c.id); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={15}/></button>
          </li>
        ))}
      </ul>
    </li>
  );
})}
</ul>
</div>
</div>
</ModalWrapper>
);
};

// ─────────────────────────────────────────────────────────────────────────────
