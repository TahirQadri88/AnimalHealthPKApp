import { useState, useContext } from 'react';
import { Search, Edit, Trash2, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import { TransportCompaniesManager } from './TransportCompaniesManager';

export const SegmentsAdminView = () => {
const { cities, areas, customerTypes, vehicleTypes, transportCompanies, riders, customers, invoices, saveToFirebase, deleteFromFirebase, showToast, getCustomerBalance, setShowSegmentsModal, showConfirm } = useContext(AppContext);
const [tab, setTab] = useState('cities');
// Which non-rider transport type has its courier list open.
const [expandedVt, setExpandedVt] = useState(null);
const [newVal, setNewVal] = useState('');
const [newVtRequiresRider, setNewVtRequiresRider] = useState(false);
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const [segSearch, setSegSearch] = useState('');
const colMap = { cities, areas, customerTypes, vehicleTypes };
const fireMap = { cities: 'cities', areas: 'areas', customerTypes: 'customerTypes', vehicleTypes: 'vehicleTypes' };
const labelMap = { cities: 'City', areas: 'Area', customerTypes: 'Type', vehicleTypes: 'Vehicle / Transport Method' };
const list = colMap[tab]; const col = fireMap[tab];
const add = async () => {
  if (!newVal.trim()) return;
  if (list.some(i => i.name.toLowerCase() === newVal.toLowerCase())) return showToast('Already exists', 'error');
  const id = Date.now();
  const item = tab === 'vehicleTypes'
    ? { id, name: newVal.trim(), requiresRider: newVtRequiresRider }
    : { id, name: newVal.trim() };
  await saveToFirebase(col, id, item);
  setNewVal(''); setNewVtRequiresRider(false);
};
const saveEdit = async (item) => {
  if (!editVal.trim()) return;
  const newName = editVal.trim();
  // Riders and transport companies point at their type by NAME, not id, so renaming a
  // type would orphan them — they'd drop out of the invoice pickers and their inline
  // list without any warning. Cascade the rename to keep them attached. Invoices keep
  // the old name on purpose: they record the method used at the time.
  if (tab === 'vehicleTypes' && newName !== item.name) {
    await Promise.all([
      ...riders.filter(r => r.vehicleType === item.name)
        .map(r => saveToFirebase('riders', r.id, { ...r, vehicleType: newName })),
      ...transportCompanies.filter(c => c.transportType === item.name)
        .map(c => saveToFirebase('transportCompanies', c.id, { ...c, transportType: newName })),
    ]);
  }
  await saveToFirebase(col, item.id, { ...item, name: newName });
  setEditingId(null);
};
// Compute sales per segment value
const segKey = tab === 'cities' ? 'city' : tab === 'areas' ? 'area' : 'customerType';
const custMap = {}; customers.forEach(c => { custMap[c.name] = c[segKey] || ''; });
const segStats = {};
invoices.filter(o => o.status === 'Billed').forEach(o => {
  const seg = custMap[o.customerName] || '';
  if (!seg) return;
  if (!segStats[seg]) segStats[seg] = { orders: 0, revenue: 0, customers: new Set() };
  segStats[seg].orders += 1;
  segStats[seg].revenue += o.total;
  segStats[seg].customers.add(o.customerName);
});
return (
<div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
<div className="flex justify-between items-center">
<h3 className="text-xs font-medium text-kt-ink">Customer Segments</h3>
</div>
<div className="bg-kt-line p-1 rounded-xl">
<ScrollableTabBar bgClass="bg-kt-line">
{['cities','areas','customerTypes','vehicleTypes'].map(t => (
<button key={t} onClick={() => { setTab(t); setNewVal(''); setEditingId(null); setSegSearch(''); setNewVtRequiresRider(false); }} className={`py-2 px-3 rounded-lg font-medium text-xs whitespace-nowrap transition-colors ${tab===t?'bg-white text-kt-blue ':'text-kt-sub'}`}>{t==='vehicleTypes'?'Transport':labelMap[t]+'s'}</button>
))}
</ScrollableTabBar>
</div>
<div className="flex gap-2 items-center">
<input type="text" placeholder={`New ${labelMap[tab]}...`} className="flex-1 p-3 bg-white border border-kt-line rounded-xl font-semibold outline-none focus:border-kt-ink text-sm" value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} />
{tab === 'vehicleTypes' && (
  <button type="button" onClick={() => setNewVtRequiresRider(p => !p)} title="Requires Rider Assignment"
    className={`shrink-0 px-3 py-3 rounded-xl font-medium text-xs border transition-colors ${newVtRequiresRider ? 'bg-kt-primary text-white border-kt-blue/30' : 'bg-white text-kt-sub border-kt-line'}`}>
    <Truck size={14}/>
  </button>
)}
<button onClick={add} className="bg-kt-primary text-white px-4 rounded-xl font-medium hover:bg-kt-primary/90 transition-colors shrink-0">Add</button>
</div>
{tab === 'vehicleTypes' && <p className="text-xs text-kt-muted -mt-2">Tap <span className="font-medium">🚛</span> before adding if riders should be assignable (local delivery). Leave off for intercity/self-pickup types.</p>}
<div className="relative"><Search className="absolute left-3 top-2.5 text-kt-muted" size={14}/><input placeholder={`Search ${labelMap[tab]}s...`} className="w-full pl-8 pr-3 py-2 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm focus:border-kt-ink" value={segSearch} onChange={e=>setSegSearch(e.target.value)} /></div>
<div className="bg-white border border-kt-line rounded-xl overflow-hidden">
{list.length === 0 && <p className="text-center py-6 text-sm text-kt-muted">No {labelMap[tab]}s yet.</p>}
<ul className="divide-y divide-kt-line">
{list.filter(item => !segSearch || item.name.toLowerCase().includes(segSearch.toLowerCase())).map(item => {
  const stats = segStats[item.name] || { orders: 0, revenue: 0, customers: new Set() };
  return (
  <li key={item.id} className="p-3 hover:bg-kt-raised">
  {editingId === item.id ? (
  <div className="flex gap-2 items-center flex-wrap">
  <input autoFocus className="flex-1 min-w-0 p-2 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(item);if(e.key==='Escape')setEditingId(null);}} />
  {tab === 'vehicleTypes' && <button type="button" onClick={() => saveToFirebase(col, item.id, { ...item, requiresRider: !item.requiresRider })} className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${item.requiresRider ? 'bg-kt-primary text-white border-kt-blue/30' : 'bg-white text-kt-sub border-kt-line'}`}><Truck size={12}/></button>}
  <button onClick={()=>saveEdit(item)} className="text-xs font-medium text-kt-blue px-3 py-1.5 bg-kt-blue/10 rounded-lg shrink-0">Save</button>
  <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1.5 bg-kt-raised rounded-lg shrink-0">Cancel</button>
  </div>
  ) : (
  <div className="flex items-center gap-2">
  <div className="flex-1">
  <div className="flex items-center gap-2"><span className="font-medium text-kt-ink text-sm">{item.name}</span>{tab==='vehicleTypes' ? <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${item.requiresRider ? 'bg-kt-blue/10 text-kt-blue border-kt-blue/30' : 'bg-kt-raised text-kt-muted border-kt-line'}`}>{item.requiresRider ? 'Rider' : 'No Rider'}</span> : stats.orders > 0 && <span className="text-xs font-medium bg-kt-blue/10 text-kt-blue px-1.5 py-0.5 rounded border border-kt-blue/30">{stats.orders} orders</span>}</div>
  {tab !== 'vehicleTypes' && stats.orders > 0 && <p className="text-xs text-kt-muted mt-0.5">{stats.customers.size} clients · Rs.{stats.revenue.toLocaleString('en-US')} revenue</p>}
  </div>
  {tab==='vehicleTypes' && !item.requiresRider && item.name !== 'Self-Pickup' && (
    <button onClick={()=>setExpandedVt(p=>p===item.id?null:item.id)} title="Transport companies" className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-kt-amber bg-kt-amber/10 border border-kt-amber/30 rounded-lg hover:bg-kt-amber/10 shrink-0">
      {transportCompanies.filter(c=>c.transportType===item.name).length} Cos {expandedVt===item.id ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
    </button>
  )}
  <button onClick={()=>{setEditingId(item.id);setEditVal(item.name);setExpandedVt(tab==='vehicleTypes' && !item.requiresRider ? item.id : null);}} className="p-1.5 text-kt-muted hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg"><Edit size={14}/></button>
  <button onClick={async()=>{
    const attached = tab==='vehicleTypes'
      ? riders.filter(r=>r.vehicleType===item.name).length + transportCompanies.filter(c=>c.transportType===item.name).length
      : 0;
    const msg = attached
      ? `Delete "${item.name}"?\n\n${attached} rider(s) / transport company(ies) are attached and will be left unassigned.`
      : `Delete "${item.name}"?`;
    if(await showConfirm(msg))await deleteFromFirebase(col,item.id);
  }} className="p-1.5 text-kt-muted hover:text-kt-red hover:bg-kt-red/10 rounded-lg"><Trash2 size={14}/></button>
  </div>
  )}
  {tab==='vehicleTypes' && !item.requiresRider && item.name !== 'Self-Pickup' && (expandedVt===item.id || editingId===item.id) && (
    <TransportCompaniesManager lockedType={item.name} compact />
  )}
  </li>
  );
})}
</ul>
</div>
</div>
);
};
