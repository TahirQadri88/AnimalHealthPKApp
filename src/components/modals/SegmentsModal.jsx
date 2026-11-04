import { useState, useContext } from 'react';
import { Edit, Trash2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ModalWrapper } from '../ui/ModalWrapper';

export const SegmentsModal = () => {
const { cities, areas, customerTypes, saveToFirebase, deleteFromFirebase, showToast, setShowSegmentsModal, showConfirm } = useContext(AppContext);
const [tab, setTab] = useState('cities');
const [expandedCityId, setExpandedCityId] = useState(null);
const [newCityName, setNewCityName] = useState('');
const [newAreaName, setNewAreaName] = useState('');
const [newAreaCityName, setNewAreaCityName] = useState('');
const [newTypeName, setNewTypeName] = useState('');
const [editingId, setEditingId] = useState(null);
const [editVal, setEditVal] = useState('');
const [editCityName, setEditCityName] = useState('');

const addCity = async () => {
  if (!newCityName.trim()) return;
  if (cities.some(c => c.name.toLowerCase() === newCityName.toLowerCase())) return showToast('City already exists', 'error');
  const id = Date.now();
  await saveToFirebase('cities', id, { id, name: newCityName.trim() });
  setNewCityName('');
};
const addArea = async (cityName) => {
  if (!newAreaName.trim()) return;
  if (areas.some(a => a.name.toLowerCase() === newAreaName.toLowerCase() && (a.cityName||'') === cityName)) return showToast('Area already exists in this city', 'error');
  const id = Date.now();
  await saveToFirebase('areas', id, { id, name: newAreaName.trim(), cityName });
  setNewAreaName('');
};
const addType = async () => {
  if (!newTypeName.trim()) return;
  if (customerTypes.some(t => t.name.toLowerCase() === newTypeName.toLowerCase())) return showToast('Type already exists', 'error');
  const id = Date.now();
  await saveToFirebase('customerTypes', id, { id, name: newTypeName.trim() });
  setNewTypeName('');
};
const saveEdit = async (item, col) => {
  if (!editVal.trim()) return;
  if (col === 'areas' && !editCityName) return showToast('Select a City for this Area', 'error');
  await saveToFirebase(col, item.id, { ...item, name: editVal.trim(), ...(col === 'areas' ? { cityName: editCityName } : {}) });
  setEditingId(null);
};

const unassignedAreas = areas.filter(a => !a.cityName);

return (
<ModalWrapper title="Manage Segments" onClose={() => setShowSegmentsModal(false)}>
<div className="space-y-4 pb-10">
<div className="flex bg-kt-raised p-1 rounded-xl gap-1">
{[['cities','Cities'],['types','Types']].map(([t,l]) => (
<button key={t} onClick={() => { setTab(t); setEditingId(null); }} className={`flex-1 py-2 px-2 rounded-lg font-medium text-xs transition-colors ${tab===t?'bg-white text-kt-blue ':'text-kt-sub'}`}>{l}</button>
))}
</div>

{/* ── Cities Tab ── */}
{tab === 'cities' && <>
  <div className="flex gap-2">
    <input type="text" placeholder="New City..." className="flex-1 p-3 bg-kt-raised border border-kt-line rounded-xl font-semibold outline-none focus:border-kt-ink text-sm" value={newCityName} onChange={e=>setNewCityName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addCity();}} />
    <button onClick={addCity} className="bg-kt-primary text-white px-4 rounded-xl font-medium hover:bg-kt-primary/90 transition-colors">Add</button>
  </div>
  <div className="space-y-2">
  {cities.length === 0 && <p className="text-center py-6 text-sm text-kt-muted">No cities yet.</p>}
  {cities.map(city => {
    const cityAreas = areas.filter(a => (a.cityName||'') === city.name);
    const isOpen = expandedCityId === city.id;
    return (
    <div key={city.id} className="bg-white border border-kt-line rounded-xl overflow-hidden">
      {/* City row */}
      <div className="flex items-center gap-2 p-3 hover:bg-kt-raised">
        <button className="flex-1 flex items-center gap-2 text-left" onClick={()=>setExpandedCityId(isOpen ? null : city.id)}>
          {isOpen ? <ChevronDown size={15} className="text-kt-blue shrink-0"/> : <ChevronRight size={15} className="text-kt-muted shrink-0"/>}
          {editingId === city.id ? (
            <input autoFocus className="flex-1 p-1.5 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(city,'cities');if(e.key==='Escape')setEditingId(null);}} onClick={e=>e.stopPropagation()} />
          ) : (
            <span className="font-medium text-kt-ink text-sm flex-1">{city.name}</span>
          )}
          <span className="text-xs font-medium text-kt-muted bg-kt-raised px-1.5 py-0.5 rounded shrink-0">{cityAreas.length} area{cityAreas.length!==1?'s':''}</span>
        </button>
        {editingId === city.id ? (
          <>
            <button onClick={()=>saveEdit(city,'cities')} className="text-xs font-medium text-kt-blue px-2 py-1 bg-kt-blue/10 rounded-lg">Save</button>
            <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1 bg-kt-raised rounded-lg">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={()=>{setEditingId(city.id);setEditVal(city.name);}} className="p-1.5 text-kt-muted hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg transition-colors"><Edit size={14}/></button>
            <button onClick={async()=>{if(await showConfirm(`Delete "${city.name}"? Areas under it will become unassigned.`))await deleteFromFirebase('cities',city.id);}} className="p-1.5 text-kt-muted hover:text-kt-red hover:bg-kt-red/10 rounded-lg transition-colors"><Trash2 size={14}/></button>
          </>
        )}
      </div>
      {/* Expanded: areas list + add area */}
      {isOpen && (
        <div className="border-t border-kt-line bg-kt-raised">
          {cityAreas.length === 0 && <p className="text-center py-3 text-xs text-kt-muted">No areas yet — add one below.</p>}
          {cityAreas.map(area => (
            <div key={area.id} className="flex items-center gap-2 px-4 py-2 border-b border-kt-line last:border-0 hover:bg-white">
              <span className="w-2 h-2 rounded-full bg-kt-blue/20 shrink-0"/>
              {editingId === area.id ? (
                <>
                  <select value={editCityName} onChange={e=>setEditCityName(e.target.value)} className="p-1.5 text-xs font-semibold border border-kt-blue/30 rounded-lg outline-none bg-white shrink-0">
                    <option value="">City...</option>
                    {cities.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <input autoFocus className="flex-1 p-1.5 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(area,'areas');if(e.key==='Escape')setEditingId(null);}} />
                  <button onClick={()=>saveEdit(area,'areas')} className="text-xs font-medium text-kt-blue px-2 py-1 bg-kt-blue/10 rounded-lg">Save</button>
                  <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1 bg-kt-raised rounded-lg">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold text-kt-ink">{area.name}</span>
                  <button onClick={()=>{setEditingId(area.id);setEditVal(area.name);setEditCityName(area.cityName||city.name);}} className="p-1.5 text-kt-muted hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg transition-colors"><Edit size={13}/></button>
                  <button onClick={async()=>{if(await showConfirm(`Delete "${area.name}"?`))await deleteFromFirebase('areas',area.id);}} className="p-1.5 text-kt-muted hover:text-kt-red hover:bg-kt-red/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
                </>
              )}
            </div>
          ))}
          {/* Add area inline */}
          <div className="flex gap-2 p-3">
            <input type="text" placeholder={`New area in ${city.name}...`} className="flex-1 p-2 bg-white border border-kt-line rounded-lg font-semibold outline-none focus:border-kt-ink text-sm" value={expandedCityId === city.id ? newAreaName : ''} onChange={e=>setNewAreaName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addArea(city.name);}} />
            <button onClick={()=>addArea(city.name)} className="bg-kt-primary text-white px-3 rounded-lg font-medium text-xs hover:bg-kt-primary transition-colors">Add</button>
          </div>
        </div>
      )}
    </div>
    );
  })}
  {/* Unassigned areas */}
  {unassignedAreas.length > 0 && (
    <div className="bg-kt-amber/10 border border-kt-amber/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-kt-amber/30">
        <AlertCircle size={13} className="text-kt-amber"/>
        <span className="text-xs font-medium text-kt-amber">{unassignedAreas.length} area(s) not assigned to any city</span>
      </div>
      {unassignedAreas.map(area => (
        <div key={area.id} className="flex items-center gap-2 px-4 py-2 border-b border-kt-amber/30 last:border-0">
          {editingId === area.id ? (
            <>
              <select value={editCityName} onChange={e=>setEditCityName(e.target.value)} className="p-1.5 text-xs font-semibold border border-kt-blue/30 rounded-lg outline-none bg-white shrink-0">
                <option value="">City...</option>
                {cities.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <input autoFocus className="flex-1 p-1.5 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(area,'areas');if(e.key==='Escape')setEditingId(null);}} />
              <button onClick={()=>saveEdit(area,'areas')} className="text-xs font-medium text-kt-blue px-2 py-1 bg-kt-blue/10 rounded-lg">Save</button>
              <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1 bg-kt-raised rounded-lg">Cancel</button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm font-semibold text-kt-ink">{area.name}</span>
              <button onClick={()=>{setEditingId(area.id);setEditVal(area.name);setEditCityName('');}} className="p-1.5 text-kt-amber hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg transition-colors"><Edit size={13}/></button>
              <button onClick={async()=>{if(await showConfirm(`Delete "${area.name}"?`))await deleteFromFirebase('areas',area.id);}} className="p-1.5 text-kt-amber hover:text-kt-red hover:bg-kt-red/10 rounded-lg transition-colors"><Trash2 size={13}/></button>
            </>
          )}
        </div>
      ))}
    </div>
  )}
  </div>
</>}

{/* ── Types Tab ── */}
{tab === 'types' && <>
  <div className="flex gap-2">
    <input type="text" placeholder="New Type..." className="flex-1 p-3 bg-kt-raised border border-kt-line rounded-xl font-semibold outline-none focus:border-kt-ink text-sm" value={newTypeName} onChange={e=>setNewTypeName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addType();}} />
    <button onClick={addType} className="bg-kt-primary text-white px-4 rounded-xl font-medium hover:bg-kt-primary/90 transition-colors">Add</button>
  </div>
  <div className="bg-white border border-kt-line rounded-xl overflow-hidden">
    {customerTypes.length === 0 && <p className="text-center py-6 text-sm text-kt-muted">No types yet.</p>}
    <ul className="divide-y divide-kt-line">
    {customerTypes.map(item => (
      <li key={item.id} className="flex items-center gap-2 p-3 hover:bg-kt-raised">
        {editingId === item.id ? (
          <>
            <input autoFocus className="flex-1 p-2 text-sm font-semibold border border-kt-blue/30 rounded-lg outline-none" value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(item,'customerTypes');if(e.key==='Escape')setEditingId(null);}} />
            <button onClick={()=>saveEdit(item,'customerTypes')} className="text-xs font-medium text-kt-blue px-3 py-1.5 bg-kt-blue/10 rounded-lg">Save</button>
            <button onClick={()=>setEditingId(null)} className="text-xs font-medium text-kt-sub px-2 py-1.5 bg-kt-raised rounded-lg">Cancel</button>
          </>
        ) : (
          <>
            <span className="flex-1 font-semibold text-kt-ink text-sm">{item.name}</span>
            <button onClick={()=>{setEditingId(item.id);setEditVal(item.name);}} className="p-1.5 text-kt-muted hover:text-kt-blue hover:bg-kt-blue/10 rounded-lg transition-colors"><Edit size={14}/></button>
            <button onClick={async()=>{if(await showConfirm(`Delete "${item.name}"?`))await deleteFromFirebase('customerTypes',item.id);}} className="p-1.5 text-kt-muted hover:text-kt-red hover:bg-kt-red/10 rounded-lg transition-colors"><Trash2 size={14}/></button>
          </>
        )}
      </li>
    ))}
    </ul>
  </div>
</>}

</div>
</ModalWrapper>
);
};

// — Tabs —
