import { useState, useContext } from 'react';
import { Truck, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export const TransportCompaniesManager = ({ lockedType = null, compact = false }) => {
const { transportCompanies, vehicleTypes, saveToFirebase, deleteFromFirebase, showToast, showConfirm } = useContext(AppContext);
// Non-rider types are the ones a courier can belong to. Self-Pickup has no carrier.
const nonRiderTypes = vehicleTypes.filter(vt => !vt.requiresRider && vt.name !== 'Self-Pickup').map(vt => vt.name);
const typeList = nonRiderTypes.length ? nonRiderTypes : ['Intercity Transport'];
const blank = { name: '', phone: '', city: '', defaultDriverName: '', defaultDriverPhone: '', transportType: lockedType || typeList[0] };
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-amber-500 shadow-sm";
const smallCls = "p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none w-full";
const [form, setForm] = useState(blank);
const [editingId, setEditingId] = useState(null);
const [editForm, setEditForm] = useState({});
const [search, setSearch] = useState('');
const [showAdd, setShowAdd] = useState(!compact);

const scoped = transportCompanies.filter(c => !lockedType || c.transportType === lockedType);
const visible = scoped.filter(c => !search ||
  c.name.toLowerCase().includes(search.toLowerCase()) ||
  (c.phone || '').includes(search) ||
  (c.city || '').toLowerCase().includes(search.toLowerCase()));

const add = async () => {
  if (!form.name.trim()) return showToast("Company name required", "error");
  const obj = { id: Date.now(), ...form, name: form.name.trim(), transportType: lockedType || form.transportType };
  await saveToFirebase('transportCompanies', obj.id, obj);
  setForm({ ...blank, transportType: lockedType || form.transportType });
  if (compact) setShowAdd(false);
  showToast("Transport company added");
};
const saveEdit = async (co) => {
  if (!(editForm.name || '').trim()) return showToast("Company name required", "error");
  await saveToFirebase('transportCompanies', co.id, { ...co, ...editForm, name: editForm.name.trim() });
  setEditingId(null);
  showToast("Transport company updated");
};
const remove = async (co) => {
  if (await showConfirm(`Delete "${co.name}"?`)) {
    await deleteFromFirebase('transportCompanies', co.id);
    showToast(`${co.name} deleted`);
  }
};

const addForm = (
  <div className={compact ? "space-y-2 bg-amber-50/60 p-3 rounded-xl border border-amber-100" : "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"}>
    {!compact && <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Register New Transport Company</h3>}
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Company Name *</label><input className={compact ? smallCls : inputCls} placeholder="e.g. Daewoo Express" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} /></div>
      <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label><input className={compact ? smallCls : inputCls} placeholder="03XX..." value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
      <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">City</label><input className={compact ? smallCls : inputCls} placeholder="e.g. Lahore" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></div>
      <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Usual Booking Person</label><input className={compact ? smallCls : inputCls} placeholder="Who usually books here" value={form.defaultDriverName} onChange={e=>setForm({...form,defaultDriverName:e.target.value})} /></div>
      <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Their Phone</label><input className={compact ? smallCls : inputCls} placeholder="03XX..." value={form.defaultDriverPhone} onChange={e=>setForm({...form,defaultDriverPhone:e.target.value})} /></div>
      {!lockedType && <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Transport Type *</label><select className={compact ? smallCls : inputCls} value={form.transportType} onChange={e=>setForm({...form,transportType:e.target.value})}>{typeList.map(t=><option key={t} value={t}>{t}</option>)}</select></div>}
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={add} className={`${compact ? 'text-xs py-2 px-3' : 'w-full py-3'} bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors`}>Add Company</button>
      {compact && <button type="button" onClick={()=>{setShowAdd(false);setForm(blank);}} className="text-xs font-bold text-slate-500 px-3 py-2 bg-slate-100 rounded-lg">Cancel</button>}
    </div>
  </div>
);

const list = (
  <ul className="divide-y divide-slate-100">
    {visible.map(co => (
      <li key={co.id} className={compact ? "py-2" : "p-3 hover:bg-slate-50"}>
        {editingId === co.id ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input autoFocus className={`col-span-2 ${smallCls} !border-amber-300`} value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="Company name" onKeyDown={e=>{if(e.key==='Escape')setEditingId(null);if(e.key==='Enter'){e.preventDefault();saveEdit(co);}}} />
              <input className={smallCls} value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} placeholder="Phone" />
              <input className={smallCls} value={editForm.city||''} onChange={e=>setEditForm({...editForm,city:e.target.value})} placeholder="City" />
              <input className={smallCls} value={editForm.defaultDriverName||''} onChange={e=>setEditForm({...editForm,defaultDriverName:e.target.value})} placeholder="Usual booking person" />
              <input className={smallCls} value={editForm.defaultDriverPhone||''} onChange={e=>setEditForm({...editForm,defaultDriverPhone:e.target.value})} placeholder="Their phone" />
              {!lockedType && <select className={`col-span-2 ${smallCls}`} value={editForm.transportType||typeList[0]} onChange={e=>setEditForm({...editForm,transportType:e.target.value})}>{typeList.map(t=><option key={t} value={t}>{t}</option>)}</select>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={()=>saveEdit(co)} className="text-xs font-bold text-amber-700 px-3 py-1.5 bg-amber-50 rounded-lg hover:bg-amber-100">Save</button>
              <button type="button" onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-sm">{co.name}</span>
                {!lockedType && <span className="text-[9px] font-black bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100">{co.transportType}</span>}
                {co.city && <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{co.city}</span>}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {co.phone || 'No phone'}
                {co.defaultDriverName ? ` · Usually booked by: ${co.defaultDriverName}${co.defaultDriverPhone ? ` (${co.defaultDriverPhone})` : ''}` : ''}
              </p>
            </div>
            <button type="button" onClick={()=>{setEditingId(co.id);setEditForm({name:co.name,phone:co.phone||'',city:co.city||'',defaultDriverName:co.defaultDriverName||'',defaultDriverPhone:co.defaultDriverPhone||'',transportType:co.transportType||typeList[0]});}} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg shrink-0"><Edit size={14}/></button>
            <button type="button" onClick={()=>remove(co)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"><Trash2 size={14}/></button>
          </div>
        )}
      </li>
    ))}
  </ul>
);

// Inline variant: sits under one transport type in the Segments list.
if (compact) return (
  <div className="mt-2 pl-1 border-l-2 border-amber-200 ml-1 space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Transport Companies</span>
      <span className="text-[10px] font-black text-amber-600">{scoped.length}</span>
      {!showAdd && <button type="button" onClick={()=>setShowAdd(true)} className="ml-auto text-[10px] font-bold text-amber-700 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1"><Plus size={11}/> Add</button>}
    </div>
    {showAdd && addForm}
    {scoped.length === 0 && !showAdd && <p className="text-[11px] text-slate-400 font-medium py-1">None yet — add the couriers you ship with.</p>}
    {scoped.length > 0 && list}
  </div>
);

// Full variant: its own Admin tab.
return (
<div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
{addForm}
<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2"><Truck size={14} className="text-amber-500"/><span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Transport Companies</span><span className="ml-auto text-xs font-black text-amber-600">{transportCompanies.length}</span></div>
  <div className="px-3 pt-3 pb-2"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={14}/><input placeholder="Search companies..." className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none text-sm focus:border-amber-400" value={search} onChange={e=>setSearch(e.target.value)} /></div></div>
  {transportCompanies.length === 0 && <p className="text-center py-8 text-sm text-slate-400 font-medium">No transport companies registered yet.</p>}
  {list}
</div>
</div>
);
};

// Receivables aging — who owes, and for how long.
//
// Additive: reads the same debts and credits the ledger does and changes no stored value.
// Totals are asserted against the ledger in receivables.test.js, because a collections
// report that disagrees with the ledger is worse than none.
