import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const ModalWrapper = ({ title, children, onClose, maxWidth = 'max-w-lg' }) => {
const panelRef = useRef(null);
useEffect(() => {
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  // Auto-focus first focusable element
  const first = panelRef.current?.querySelectorAll(FOCUSABLE)?.[0];
  first?.focus();
  return () => { document.body.style.overflow = prev; };
}, []);
useEffect(() => {
  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab') {
      const els = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
      if (!els.length) return;
      const first = els[0]; const last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [onClose]);
return (
<div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center" onMouseDown={(e) => { if(e.target === e.currentTarget) onClose(); }}>
<div ref={panelRef} className={`bg-white w-full ${maxWidth} rounded-t-3xl sm:rounded-3xl h-[85vh] sm:h-auto max-h-[90vh] flex flex-col animate-slide-up shadow-2xl`} onMouseDown={e => e.stopPropagation()}>
<div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-3xl sm:rounded-t-3xl">
<h2 className="text-lg font-bold text-slate-800">{title}</h2>
<button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"><X size={20}/></button>
</div>
<div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">{children}</div>
</div>
</div>
);
};

// ─── Scrollable Tab Bar with Arrow Navigation ───
