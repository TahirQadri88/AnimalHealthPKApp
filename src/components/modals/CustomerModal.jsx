import { useState, useEffect, useContext } from 'react';
import { MapPin, Globe } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import SearchableSelect from '../SearchableSelect';
import { getLocalDateStr } from '../../helpers';

export const CustomerModal = () => {
const { editingCustomer, customers, invoices, billingView, currentInvoice, isAdmin, checkDuplicate, saveToFirebase, showToast, setShowCustomerModal, setCurrentInvoice, cities, areas, customerTypes, setShowSegmentsModal } = useContext(AppContext);
const isEdit = !!editingCustomer;
const [form, setForm] = useState(isEdit ? editingCustomer : { name: '', contactPerson: '', phone: '', address1: '', map1: '', address2: '', map2: '', openingBalance: 0, city: '', area: '', customerType: '', registrationDate: getLocalDateStr() });
useEffect(() => { if (isEdit && editingCustomer.address && !editingCustomer.address1) { setForm(prev => ({...prev, address1: editingCustomer.address})); } }, [isEdit, editingCustomer]);
const save = async () => {
if(!form.name) return showToast("Customer Name required", "error");
if(checkDuplicate(customers, form.name, form.id)) return showToast("Customer Name must be unique", "error");
if(isEdit) {
const updatedCustomer = {...form, openingBalance: Number(form.openingBalance)};
if(updatedCustomer.address) delete updatedCustomer.address;
await saveToFirebase('customers', form.id, updatedCustomer);
if(form.name !== editingCustomer.name) { for (const o of invoices) { if (o.customerId === form.id) await saveToFirebase('invoices', o.id, {...o, customerName: form.name}); } }
showToast("Customer Updated");
} else {
const newId = Date.now();
const newCust = { ...form, openingBalance: Number(form.openingBalance), id: newId };
await saveToFirebase('customers', newId, newCust);
if (billingView === 'form' && currentInvoice) { setCurrentInvoice({...currentInvoice, customerId: newCust.id, customerName: newCust.name}); }
showToast("Customer Added");
}
setShowCustomerModal(false);
};
const inputClass = "w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder-slate-400";
return (
<ModalWrapper title={isEdit ? "Edit Customer Profile" : "Add New Customer"} onClose={() => setShowCustomerModal(false)}>
<form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-5 pb-8">
<div className="space-y-3">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1">Basic Details</h3>
<div className="grid grid-cols-2 gap-3">
<div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Customer / Business Name *</label><input placeholder="e.g. Karachi Vet Clinic" className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Registration Date</label><input type="date" className={inputClass} value={form.registrationDate || getLocalDateStr()} onChange={e => setForm({...form, registrationDate: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Phone Number</label><input placeholder="03XXXXXXXXX" className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
</div>
<div className="grid grid-cols-2 gap-3">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Contact Person</label><input placeholder="Name" className={inputClass} value={form.contactPerson || ''} onChange={e => setForm({...form, contactPerson: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Alt. Phone (Optional)</label><input placeholder="03XXXXXXXXX" className={inputClass} value={form.altPhone || ''} onChange={e => setForm({...form, altPhone: e.target.value})} /></div>
</div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Email (Optional)</label><input type="email" placeholder="clinic@example.com" className={inputClass} value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
</div>
<div className="space-y-3 bg-slate-100 p-3 rounded-xl border border-slate-200">
<h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1"><MapPin size={14}/> Primary Location</h3>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Address 1</label><textarea placeholder="Complete Delivery Address..." rows="2" className={inputClass} value={form.address1} onChange={e => setForm({...form, address1: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Google Maps Link 1</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map1 || ''} onChange={e => setForm({...form, map1: e.target.value})} /></div>
</div>
<div className="space-y-3 p-3 rounded-xl border border-slate-200 border-dashed">
<h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin size={14}/> Secondary Location (Optional)</h3>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Address 2</label><textarea placeholder="Alternative Address..." rows="2" className={inputClass} value={form.address2 || ''} onChange={e => setForm({...form, address2: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Google Maps Link 2</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map2 || ''} onChange={e => setForm({...form, map2: e.target.value})} /></div>
</div>
<div className="space-y-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
<div className="flex justify-between items-center"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1"><Globe size={14}/> Segment / Classification</h3><button type="button" onClick={()=>setShowSegmentsModal(true)} className="text-[10px] font-bold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-2 py-1 rounded-md transition-colors">+ Manage</button></div>
<div className="grid grid-cols-3 gap-2">
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">City</label><SearchableSelect className={inputClass} value={form.city||''} onChange={e=>setForm({...form,city:e.target.value,area:''})} placeholder="–" options={cities.map(c=>({value:c.name,label:c.name}))} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Area</label><SearchableSelect className={inputClass} value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})} placeholder="–" options={areas.filter(a=>!form.city||!a.cityName||a.cityName===form.city).map(a=>({value:a.name,label:a.name}))} /></div>
<div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Type</label><SearchableSelect className={inputClass} value={form.customerType||''} onChange={e=>setForm({...form,customerType:e.target.value})} placeholder="–" options={customerTypes.map(t=>({value:t.name,label:t.name}))} /></div>
</div>
</div>
{isAdmin && (
<div className="bg-rose-50 p-3 rounded-xl border border-rose-100 mt-2 space-y-3">
<div><label className="text-[10px] font-bold text-rose-500 uppercase tracking-wider ml-1 mb-1 block">Opening Balance (Dr)</label><input type="number" placeholder="0.00" className={`${inputClass} !border-rose-200 focus:!border-rose-500`} value={form.openingBalance} onChange={e => setForm({...form, openingBalance: e.target.value})} /></div>
<div><label className="text-[10px] font-bold text-amber-600 uppercase tracking-wider ml-1 mb-1 block">Credit Limit (Rs) — 0 = no limit</label><input type="number" placeholder="0 = unlimited" className={`${inputClass} !border-amber-200 !bg-amber-50/50 focus:!border-amber-500`} value={form.creditLimit||0} onChange={e => setForm({...form, creditLimit: e.target.value})} /></div>
</div>
)}
<button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all">Save Customer Profile</button>
</form>
</ModalWrapper>
);
};
