import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * SearchableSelect — drop-in replacement for native <select> for large dynamic lists.
 *
 * Props:
 *   value        - current value (string or number)
 *   onChange(e)  - called with { target: { value } }, same API as native <select>
 *   options      - flat:   [{ value, label }]
 *                  grouped: [{ group: 'Name', options: [{ value, label }] }]
 *   placeholder  - text shown when nothing is selected (default '– Select –')
 *   className    - applied to the trigger button (pass your inputClass here)
 *   disabled     - bool
 *
 * Keyboard support:
 *   Enter / Space / ArrowDown  — open
 *   ArrowUp / ArrowDown        — navigate items
 *   Enter                      — select highlighted item
 *   Escape / Tab               — close without selecting
 */
const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = '– Select –',
  className = '',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(-1); // highlighted index in filtered list
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const isGrouped = options.length > 0 && options[0]?.group !== undefined;

  // Flat list used for search + keyboard navigation
  const flatItems = useMemo(() =>
    options.flatMap(o => o.group ? o.options.map(i => ({ ...i, _group: o.group })) : [o]),
    [options]
  );

  const filtered = useMemo(() =>
    search
      ? flatItems.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
      : flatItems,
    [flatItems, search]
  );

  const selectedLabel = useMemo(() =>
    flatItems.find(i => String(i.value) === String(value))?.label,
    [flatItems, value]
  );

  const emit = useCallback((v) => {
    onChange({ target: { value: v } });
    setOpen(false); setSearch(''); setHi(-1);
  }, [onChange]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Flip upward if not enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(filtered.length * 36 + 60, 260); // rough estimate
    const top = spaceBelow < dropH && rect.top > dropH
      ? rect.top - dropH - 4
      : rect.bottom + 4;
    setPos({ top, left: rect.left, width: rect.width });
    setOpen(true);
  }, [disabled, filtered.length]);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target)) {
        setOpen(false); setSearch(''); setHi(-1);
      }
    };
    const closeOnScroll = () => { setOpen(false); setSearch(''); setHi(-1); };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', closeOnScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', closeOnScroll, { capture: true });
    };
  }, [open]);

  // Auto-focus search input when opened
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (hi < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-si="${hi}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault(); openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false); setSearch(''); setHi(-1);
        triggerRef.current?.querySelector('button')?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHi(h => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHi(h => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (hi >= 0 && filtered[hi]) emit(filtered[hi].value);
        else if (hi === -1 && filtered.length === 1) emit(filtered[0].value);
        break;
      case 'Tab':
        setOpen(false); setSearch(''); setHi(-1);
        break;
      default:
        break;
    }
  };

  const itemClass = (v, idx) =>
    `w-full text-left px-3 py-2 text-sm font-semibold transition-colors ${
      String(v) === String(value)
        ? 'bg-indigo-50 text-indigo-700'
        : idx === hi
          ? 'bg-slate-100 text-slate-800'
          : 'text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div ref={triggerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={openMenu}
        onKeyDown={handleKeyDown}
        className={`${className} flex items-center justify-between gap-1 text-left ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selectedLabel || placeholder}
      >
        <span className={`flex-1 truncate ${selectedLabel ? '' : 'text-slate-400'}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown portal — position:fixed escapes overflow:hidden ancestors (modals) */}
      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
          onMouseDown={e => e.preventDefault()} // keep focus in search input
        >
          {/* Search input */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              value={search}
              onChange={e => { setSearch(e.target.value); setHi(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search…"
              className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-medium placeholder-slate-400"
            />
          </div>

          {/* Options list */}
          <div ref={listRef} className="overflow-y-auto max-h-52">
            {/* Clear / placeholder option */}
            <button
              type="button"
              onClick={() => emit('')}
              className="w-full text-left px-3 py-2 text-[11px] text-slate-400 hover:bg-slate-50 font-medium border-b border-slate-100"
            >
              {placeholder}
            </button>

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-400 font-medium">
                No results for &ldquo;{search}&rdquo;
              </div>
            )}

            {/* When searching or flat list: render flat */}
            {(search || !isGrouped) && filtered.map((item, idx) => (
              <button
                type="button"
                key={String(item.value)}
                data-si={idx}
                onClick={() => emit(item.value)}
                className={itemClass(item.value, idx)}
              >
                {item.label}
                {search && item._group && (
                  <span className="ml-1.5 text-[10px] font-normal text-slate-400">
                    · {item._group}
                  </span>
                )}
              </button>
            ))}

            {/* When not searching and grouped: render with group headers */}
            {!search && isGrouped && options.map(grp => (
              <div key={grp.group}>
                <div className="px-3 pt-2 pb-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/80">
                  {grp.group}
                </div>
                {grp.options.map(item => (
                  <button
                    type="button"
                    key={String(item.value)}
                    onClick={() => emit(item.value)}
                    className={`w-full text-left px-4 py-1.5 text-sm font-semibold transition-colors ${
                      String(item.value) === String(value)
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelect;
