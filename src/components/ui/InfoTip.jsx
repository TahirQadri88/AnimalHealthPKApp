// The ⓘ next to a figure: what it means and how it is worked out, from metricInfo.js.
//
// A 44px tap target around a small icon. On a phone it opens as a sheet along the bottom of
// the screen (a popover pinned to a tiny icon falls off the edge at 360px); from `sm` up it is
// a popover under the icon. Escape or a tap outside closes it, and Escape stops there so it
// does not also close the screen behind.
import { useState, useEffect, useRef } from 'react';
import { Info, X } from 'lucide-react';
import { infoFor } from '../../services/analytics/metricInfo';

export const InfoTip = ({ k, tone = 'muted', align = 'left' }) => {
  const info = infoFor(k);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc, true); };
  }, [open]);
  if (!info) return null;
  const iconTone = tone === 'light' ? 'text-white/70 hover:text-white' : 'text-kt-muted hover:text-kt-ink';
  return (
    <span ref={ref} data-info={k} className="relative inline-flex align-middle">
      {/* data-hitarea: a transparent 44px tap area around a 13px icon, overhanging its label on
          purpose (layout.mjs does not count it as spill). */}
      <button type="button" data-hitarea="1" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} aria-expanded={open}
        aria-label={`What is ${info.label}?`} title={`What is ${info.label}?`}
        className={`-m-3 w-11 h-11 inline-flex items-center justify-center rounded-full ${iconTone} transition-colors`}>
        <Info size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <span role="dialog" aria-label={info.label}
          className={`font-ui fixed inset-x-3 bottom-3 z-[150] sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 ${align === 'right' ? 'sm:right-0' : 'sm:left-0'} sm:w-72 block bg-white text-left text-kt-ink border border-kt-line rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.14)] p-4 pr-11`}>
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-label="Close"
            className="absolute top-0 right-0 w-11 h-11 inline-flex items-center justify-center text-kt-muted hover:text-kt-ink"><X size={16} strokeWidth={1.5} /></button>
          <span className="block text-sm font-medium">{info.label}</span>
          <span className="block text-sm text-kt-sub mt-1 leading-snug normal-case font-normal">{info.means}</span>
          <span className="block text-xs text-kt-sub mt-2 leading-snug normal-case font-normal"><span className="font-medium text-kt-ink">How: </span>{info.how}</span>
        </span>
      )}
    </span>
  );
};
