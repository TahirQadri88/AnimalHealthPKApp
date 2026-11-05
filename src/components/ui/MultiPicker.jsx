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
    <div className="relative sm:shrink-0">
      <button ref={btnRef} onClick={handleOpen}
        className={`h-11 sm:h-9 w-full sm:w-auto px-3 rounded-lg border font-medium text-base sm:text-xs flex items-center justify-between sm:justify-start gap-2 transition-colors ${count > 0 ? 'bg-kt-primary text-white border-kt-primary' : 'bg-white text-kt-ink border-kt-line'}`}>
        <span className="flex items-center gap-2 min-w-0">{Icon && <Icon size={14} strokeWidth={1.5} className="shrink-0"/>}<span className="truncate">{count > 0 ? `${label} (${count})` : label}</span></span> <ChevronDown size={14} strokeWidth={1.5} className="shrink-0"/>
      </button>
      {open && createPortal(
        <div ref={dropdownRef} style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
          className="bg-white border border-kt-line rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[190px] max-h-[300px] flex flex-col p-1.5">
          {items.length > 6 && (
            <div className="px-1 pb-1.5 border-b border-kt-line mb-1">
              <input autoFocus type="text" placeholder={`Search ${label}...`} value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-medium border border-kt-line rounded-lg outline-none focus:border-kt-ink bg-kt-raised" />
            </div>
          )}
          <div className="flex justify-between px-2 py-1 text-xs text-kt-sub font-semibold border-b border-kt-line mb-1">
            <button type="button" onClick={() => { if (allSelected) { onClear(); } else { items.forEach(i => { if (!selected.has(String(i.id))) onToggle(i.id); }); } }} className="hover:text-kt-blue">{allSelected ? 'Deselect All' : 'Select All'}</button>
            <button type="button" onClick={onClear} className="text-kt-red hover:text-kt-red">Clear</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredItems.map(item => (
              <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-kt-raised cursor-pointer text-xs font-medium text-kt-ink">
                <input type="checkbox" checked={selected.has(String(item.id))} onChange={() => onToggle(item.id)} className="accent-kt-primary rounded" />
                {item.name}
              </label>
            ))}
            {filteredItems.length === 0 && <p className="text-center py-3 text-xs text-kt-muted">No results</p>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
