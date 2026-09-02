import { useState, useContext } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';

export const RidersModal = () => {
const { riders, vehicleTypes, saveToFirebase, deleteFromFirebase, showToast, setShowRidersModal, showConfirm } = useContext(AppContext);
const riderVehicleTypes = vehicleTypes.filter(vt => vt.requiresRider).map(vt => vt.name);
const fallbackRiderTypes = ['Rider', 'Rickshaw', 'Suzuki'];
const riderTypeList = riderVehicleTypes.length ? riderVehicleTypes : fallbackRiderTypes;
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-500 shadow-sm";
const [form, setForm] = useState({ name: '', phone: '', vehicleType: '', vehicleNumber: '' });
const [editingId, setEditingId] = useState(null);
const [editForm, setEditForm] = useState({});
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
<ModalWrapper title="Manage Riders & Vehicles" onClose={() => setShowRidersModal(false)}>
<div className="space-y-4 pb-10">
<form onSubmit={e=>{e.preventDefault();add();}} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
  <div className="grid grid-cols-2 gap-2">
    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Name *</label><input className={inputCls} placeholder="e.g. Ali Raza" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
    <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label><input className={inputCls} placeholder="03XX..." value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
    <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle No.</label><input className={inputCls} placeholder="e.g. ABC-123" value={form.vehicleNumber} onChange={e=>setForm({...form,vehicleNumber:e.target.value})} /></div>
    <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Type *</label><select className={inputCls} value={form.vehicleType || riderTypeList[0]} onChange={e=>setForm({...form,vehicleType:e.target.value})}>{riderTypeList.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
  </div>
  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">Add Rider / Vehicle</button>
</form>
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
  {riders.length === 0 && <p className="text-center py-6 text-sm text-slate-400">No riders registered yet.</p>}
  <ul className="divide-y divide-slate-100">
    {riders.map(rider => (
      <li key={rider.id} className="p-3 hover:bg-slate-50">
        {editingId === rider.id ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Name *</label><input autoFocus className="w-full p-2 text-sm font-semibold border border-indigo-300 rounded-lg outline-none" value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="e.g. Ali Raza" /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Phone</label><input className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} placeholder="03XX..." /></div>
              <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle No.</label><input className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.vehicleNumber||''} onChange={e=>setEditForm({...editForm,vehicleNumber:e.target.value})} placeholder="e.g. ABC-123" /></div>
              <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Vehicle Type *</label><select className="w-full p-2 text-sm font-semibold border border-slate-200 rounded-lg outline-none" value={editForm.vehicleType||riderTypeList[0]} onChange={e=>setEditForm({...editForm,vehicleType:e.target.value})}>{[...new Set([...(editForm.vehicleType ? [editForm.vehicleType] : []), ...riderTypeList])].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={()=>saveEdit(rider)} className="text-xs font-bold text-indigo-600 px-3 py-1.5 bg-indigo-50 rounded-lg">Save</button>
              <button type="button" onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 bg-slate-100 rounded-lg">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">{rider.name}</span>
                <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{rider.vehicleType}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{rider.phone || '—'}{rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ''}</p>
            </div>
            <button type="button" onClick={()=>{setEditingId(rider.id);setEditForm({...rider});}} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={14}/></button>
            <button type="button" onClick={async()=>{if(await showConfirm(`Delete ${rider.name}?`))await deleteFromFirebase('riders',rider.id);}} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
          </div>
        )}
      </li>
    ))}
  </ul>
</div>
</div>
</ModalWrapper>
);
};


// authKey re-subscribes the listener whenever the signed-in user changes.
//
// This is load-bearing once the security rules are closed. A listener that is refused
// permission is TERMINATED — Firestore does not retry it when the user later signs in.
// Without this dependency every collection would be denied on the login screen and stay
// dead afterwards, leaving a logged-in user staring at an empty app.
