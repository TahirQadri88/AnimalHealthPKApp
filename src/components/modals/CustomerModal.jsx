import { useState, useEffect, useContext } from 'react';
import { MapPin, Globe } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';
import SearchableSelect from '../SearchableSelect';
import { getLocalDateStr } from '../../helpers';
import { isCashCustomer } from '../../lib/cashCustomer';

export const CustomerModal = () => {
const { editingCustomer, customers, invoices, billingView, currentInvoice, isAdmin, checkDuplicate, saveToFirebase, showToast, setShowCustomerModal, setCurrentInvoice, cities, areas, customerTypes, setShowSegmentsModal } = useContext(AppContext);
const isEdit = !!editingCustomer;
// isCashCustomer is seeded from the EFFECTIVE answer, not the raw field. Before this
// checkbox existed the walk-in account was recognised by its name alone; opening it here
// and saving would otherwise write `false` over that and quietly demote the one record the
// whole feature was built for.
const [form, setForm] = useState(isEdit
  ? { ...editingCustomer, isCashCustomer: isCashCustomer(editingCustomer) }
  : { name: '', contactPerson: '', phone: '', address1: '', map1: '', address2: '', map2: '', openingBalance: 0, city: '', area: '', customerType: '', registrationDate: getLocalDateStr(), isCashCustomer: false });
useEffect(() => { if (isEdit && editingCustomer.address && !editingCustomer.address1) { setForm(prev => ({...prev, address1: editingCustomer.address})); } }, [isEdit, editingCustomer]);
const save = async () => {
if(!form.name) return showToast("Customer Name required", "error");
if(checkDuplicate(customers, form.name, form.id)) return showToast("Customer Name must be unique", "error");
if(isEdit) {
// Opening Balance is admin-only, on screen and in firestore.rules, which refuses a staff
// save that changes it. Converting it to a number counts as a change on a record that
// stored it as text, so only an admin's save converts it; anyone else sends it back as is.
const updatedCustomer = {...form, isCashCustomer: !!form.isCashCustomer};
if (isAdmin) updatedCustomer.openingBalance = Number(form.openingBalance);
if(updatedCustomer.address) delete updatedCustomer.address;
await saveToFirebase('customers', form.id, updatedCustomer);
if(form.name !== editingCustomer.name) { for (const o of invoices) { if (o.customerId === form.id) await saveToFirebase('invoices', o.id, {...o, customerName: form.name}); } }
showToast("Customer Updated");
} else {
const newId = Date.now();
const newCust = { ...form, openingBalance: Number(form.openingBalance), isCashCustomer: !!form.isCashCustomer, id: newId };
await saveToFirebase('customers', newId, newCust);
if (billingView === 'form' && currentInvoice) { setCurrentInvoice({...currentInvoice, customerId: newCust.id, customerName: newCust.name}); }
showToast("Customer Added");
}
setShowCustomerModal(false);
};
const inputClass = "w-full h-11 px-3 bg-white border border-kt-line rounded-lg text-sm text-kt-ink placeholder-kt-muted focus:outline-none focus:border-kt-ink transition-colors";
return (
<ModalWrapper title={isEdit ? "Edit Customer Profile" : "Add New Customer"} onClose={() => setShowCustomerModal(false)}>
<form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-5 pb-8">
<div className="space-y-3">
<h3 className="text-sm font-medium text-kt-ink border-b border-kt-line pb-1">Basic Details</h3>
<div className="grid grid-cols-2 gap-3">
<div className="col-span-2"><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Customer / Business Name *</label><input placeholder="e.g. Karachi Vet Clinic" className={inputClass} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Registration Date</label><input type="date" className={inputClass} value={form.registrationDate || getLocalDateStr()} onChange={e => setForm({...form, registrationDate: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Phone Number</label><input placeholder="03XXXXXXXXX" className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
</div>
<div className="grid grid-cols-2 gap-3">
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Contact Person</label><input placeholder="Name" className={inputClass} value={form.contactPerson || ''} onChange={e => setForm({...form, contactPerson: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Alt. Phone (Optional)</label><input placeholder="03XXXXXXXXX" className={inputClass} value={form.altPhone || ''} onChange={e => setForm({...form, altPhone: e.target.value})} /></div>
</div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Email (Optional)</label><input type="email" placeholder="clinic@example.com" className={inputClass} value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
<label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.isCashCustomer ? 'bg-kt-amber/10 border-kt-amber/30' : 'bg-white border-kt-line hover:bg-kt-raised'}`}>
  <input
    type="checkbox"
    className="mt-0.5 w-4 h-4 accent-kt-primary shrink-0"
    checked={!!form.isCashCustomer}
    onChange={e => setForm({...form, isCashCustomer: e.target.checked})}
  />
  <span className="min-w-0">
    <span className="block text-xs font-medium text-kt-ink">Cash Sale (Walk in Customer)</span>
    <span className="block text-xs text-kt-sub leading-relaxed mt-0.5">
      A counter account settled on the spot. Its bills open on <strong>Bill Only</strong> — no
      previous balance and no running ledger, because a shared walk-in account&apos;s balance
      belongs to no one customer in particular. The toggle on the document still overrides it.
    </span>
  </span>
</label>
</div>
<div className="space-y-3 bg-kt-raised p-3 rounded-xl border border-kt-line">
<h3 className="text-sm font-medium text-kt-ink flex items-center gap-1"><MapPin size={14}/> Primary Location</h3>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Address 1</label><textarea placeholder="Complete Delivery Address..." rows="2" className={inputClass} value={form.address1} onChange={e => setForm({...form, address1: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Google Maps Link 1</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map1 || ''} onChange={e => setForm({...form, map1: e.target.value})} /></div>
</div>
<div className="space-y-3 p-3 rounded-xl border border-kt-line border-dashed">
<h3 className="text-sm font-medium text-kt-sub flex items-center gap-1"><MapPin size={14}/> Secondary Location (Optional)</h3>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Address 2</label><textarea placeholder="Alternative Address..." rows="2" className={inputClass} value={form.address2 || ''} onChange={e => setForm({...form, address2: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Google Maps Link 2</label><input placeholder="https://maps.app.goo.gl/..." className={inputClass} value={form.map2 || ''} onChange={e => setForm({...form, map2: e.target.value})} /></div>
</div>
<div className="space-y-3 bg-kt-blue/10 p-3 rounded-xl border border-kt-blue/30">
<div className="flex justify-between items-center"><h3 className="text-sm font-medium text-kt-ink flex items-center gap-1"><Globe size={14}/> Segment / Classification</h3>{isAdmin && <button type="button" onClick={()=>setShowSegmentsModal(true)} className="text-xs font-medium text-kt-blue bg-kt-blue/10 hover:bg-kt-blue/20 px-2 py-1 rounded-md transition-colors">+ Manage</button>}</div>
<div className="grid grid-cols-3 gap-2">
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">City</label><SearchableSelect className={inputClass} value={form.city||''} onChange={e=>setForm({...form,city:e.target.value,area:''})} placeholder="–" options={cities.map(c=>({value:c.name,label:c.name}))} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Area</label><SearchableSelect className={inputClass} value={form.area||''} onChange={e=>setForm({...form,area:e.target.value})} placeholder="–" options={areas.filter(a=>!form.city||!a.cityName||a.cityName===form.city).map(a=>({value:a.name,label:a.name}))} /></div>
<div><label className="text-xs font-medium text-kt-sub ml-1 mb-1 block">Type</label><SearchableSelect className={inputClass} value={form.customerType||''} onChange={e=>setForm({...form,customerType:e.target.value})} placeholder="–" options={customerTypes.map(t=>({value:t.name,label:t.name}))} /></div>
</div>
</div>
{isAdmin && (
<div className="bg-kt-red/10 p-3 rounded-xl border border-kt-red/30 mt-2 space-y-3">
<div><label className="text-xs font-medium text-kt-red ml-1 mb-1 block">Opening Balance (Dr)</label><input type="number" placeholder="0.00" className={`${inputClass} !border-kt-red/30 focus:!border-kt-ink`} value={form.openingBalance} onChange={e => setForm({...form, openingBalance: e.target.value})} /></div>
<div><label className="text-xs font-medium text-kt-amber ml-1 mb-1 block">Credit Limit (Rs) — 0 = no limit</label><input type="number" placeholder="0 = unlimited" className={`${inputClass} !border-kt-amber/30 !bg-kt-amber/10 focus:!border-kt-ink`} value={form.creditLimit||0} onChange={e => setForm({...form, creditLimit: e.target.value})} /></div>
</div>
)}
<button type="submit" className="w-full bg-kt-primary hover:bg-kt-primary/90 text-white font-medium py-4 rounded-xl mt-4 active:scale-[0.98] transition-colors">Save Customer Profile</button>
</form>
</ModalWrapper>
);
};
