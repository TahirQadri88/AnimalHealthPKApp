import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export const MultiPicker = ({ label, Icon, items, selected, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false);
        setPickerSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(o => !o);
    if (open) setPickerSearch('');
  };
  const count = selected.size;
  const filteredItems = pickerSearch ? items.filter(i => i.name.toLowerCase().includes(pickerSearch.toLowerCase())) : items;
  const allSelected = items.length > 0 && items.every(i => selected.has(String(i.id)));
  return (
    <div className="relative shrink-0">
      <button ref={btnRef} onClick={handleOpen}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-sm font-bold text-[11px] transition-colors ${count > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>
        {Icon && <Icon size={12}/>} {count > 0 ? `${label} (${count})` : label} <ChevronDown size={10}/>
      </button>
      {open && createPortal(
        <div ref={dropdownRef} style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl min-w-[190px] max-h-[300px] flex flex-col p-1.5">
          {items.length > 6 && (
            <div className="px-1 pb-1.5 border-b border-slate-100 mb-1">
              <input autoFocus type="text" placeholder={`Search ${label}...`} value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-slate-50" />
            </div>
          )}
          <div className="flex justify-between px-2 py-1 text-[10px] text-slate-500 font-semibold border-b border-slate-100 mb-1">
            <button type="button" onClick={() => { if (allSelected) { onClear(); } else { items.forEach(i => { if (!selected.has(String(i.id))) onToggle(i.id); }); } }} className="hover:text-indigo-600">{allSelected ? 'Deselect All' : 'Select All'}</button>
            <button type="button" onClick={onClear} className="text-rose-500 hover:text-rose-700">Clear</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredItems.map(item => (
              <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] font-medium text-slate-700">
                <input type="checkbox" checked={selected.has(String(item.id))} onChange={() => onToggle(item.id)} className="accent-indigo-600 rounded" />
                {item.name}
              </label>
            ))}
            {filteredItems.length === 0 && <p className="text-center py-3 text-[10px] text-slate-400">No results</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
