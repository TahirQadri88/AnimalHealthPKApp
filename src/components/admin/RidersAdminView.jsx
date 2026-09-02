import { useState, useContext } from 'react';
import { Truck, Search, Edit, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export const RidersAdminView = () => {
const { riders, vehicleTypes, saveToFirebase, deleteFromFirebase, showToast, showConfirm } = useContext(AppContext);
const riderVehicleTypes = vehicleTypes.filter(vt => vt.requiresRider).map(vt => vt.name);
const riderTypeList = riderVehicleTypes.length ? riderVehicleTypes : ['Rider', 'Rickshaw', 'Suzuki'];
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 shadow-sm";
const [form, setForm] = useState({ name: '', phone: '', vehicleType: '', vehicleNumber: '' });
const [editingId, setEditingId] = useState(null);
const [editForm, setEditForm] = useState({});
const [riderSearch, setRiderSearch] = useState('');
const add = async () => {
  if (!form.name) return showToast("Name required", "error");
  // Fall back to the first listed type. The select shows that type when state is
  // empty, so saving the raw state would store a type the user never saw and the
  // billing picker's filter would never match the rider.
  const obj = { id: Date.now(), name: form.name, phone: form.phone, vehicleType: form.vehicleType || riderTypeList[0], vehicleNumber: form.vehicleNumber };
  await saveToFirebase('riders', obj.id, obj);
  setForm({ name: '', phone: '', vehicleType: '', vehicleNumber: '' });
  showToast("Rider Added");
};
const saveEdit = async (rider) => {
  if (!editForm.name) return showToast("Name required", "error");
  await saveToFirebase('riders', rider.id, { ...rider, ...editForm });
  setEditingId(null);
  showToast("Rider Updated");
};
return (
<div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
<form onSubmit={e=>{e.preventDefault();add();}} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Register New Rider / Vehicle</h3>
  <div className="grid grid-cols-2 gap-3">
    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Full Name *</label><input className={inputCls} placeholder="e.g. Ali Raza" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
    <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label><input className={inputCls} placeholder="03XX..." value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
    <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Number</label><input className={inputCls} placeholder="e.g. ABC-123" value={form.vehicleNumber} onChange={e=>setForm({...form,vehicleNumber:e.target.value})} /></div>
    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Type *</label><select className={inputCls} value={form.vehicleType || riderTypeList[0]} onChange={e=>setForm({...form,vehicleType:e.target.value})}>{riderTypeList.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
  </div>
  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors">Add Rider / Vehicle</button>
</form>
<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2"><Truck size={14} className="text-indigo-500"/><span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Registered Riders</span><span className="ml-auto text-xs font-black text-indigo-600">{riders.length}</span></div>
  <div className="px-3 pt-3 pb-2"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={14}/><input placeholder="Search riders..." className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none text-sm focus:border-indigo-400" value={riderSearch} onChange={e=>setRiderSearch(e.target.value)} /></div></div>
  {riders.length === 0 && <p className="text-center py-8 text-sm text-slate-400 font-medium">No riders registered yet.</p>}
  <ul className="divide-y divide-slate-100">
    {riders.filter(r => !riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase()) || (r.phone||'').includes(riderSearch) || (r.vehicleNumber||'').toLowerCase().includes(riderSearch.toLowerCase())).map(rider => (
      <li key={rider.id} className="p-3 hover:bg-slate-50">
        {editingId === rider.id ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Name *</label><input autoFocus className="w-full p-2 text-sm font-semibold border border-indigo-300 rounded-lg outline-none" value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="e.g. Ali Raza" onKeyDown={e=>{if(e.key==='Escape')setEditingId(null);if(e.key==='Enter'){e.preventDefault();saveEdit(rider);}}} /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label><input className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} placeholder="03XX..." /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle No.</label><input className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.vehicleNumber||''} onChange={e=>setEditForm({...editForm,vehicleNumber:e.target.value})} placeholder="e.g. ABC-123" /></div>
              <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Type *</label><select className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.vehicleType||riderTypeList[0]} onChange={e=>setEditForm({...editForm,vehicleType:e.target.value})}>{[...new Set([...(editForm.vehicleType ? [editForm.vehicleType] : []), ...riderTypeList])].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={()=>saveEdit(rider)} className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100">Save</button>
              <button type="button" onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-sm">{rider.name}</span>
                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{rider.vehicleType}</span>
                {rider.vehicleNumber && <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{rider.vehicleNumber}</span>}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{rider.phone || 'No phone'}</p>
            </div>
            <button type="button" onClick={()=>{setEditingId(rider.id);setEditForm({...rider});}} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={14}/></button>
            <button type="button" onClick={async()=>{if(await showConfirm(`Delete ${rider.name}?`))await deleteFromFirebase('riders',rider.id);showToast(`${rider.name} deleted`);}} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        )}
      </li>
    ))}
  </ul>
</div>
</div>
);
};
