import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export const ConfirmDialog = () => {
const { confirmDialog, setConfirmDialog } = useContext(AppContext);
// Reason text for the prompt variant. Declared BEFORE the early return: hooks may not sit
// behind a conditional, and this component already had its effect below one.
const [reason, setReason] = useState('');
const prompt = confirmDialog?.prompt || null;
// A void must say why. Cancel always resolves null/false so callers can tell the two apart.
const blocked = !!(prompt?.required && !reason.trim());
const handle = (val) => {
  setConfirmDialog(null);
  setReason('');
  if (confirmDialog) confirmDialog.resolve(val);
};
const accept = () => { if (!blocked) handle(prompt ? reason.trim() : true); };
useEffect(() => {
  if (!confirmDialog) return undefined;
  const onKey = (e) => {
    if (e.key === 'Escape') handle(prompt ? null : false);
    if (e.key === 'Enter') accept();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
});
if (!confirmDialog) return null;
const cancelValue = prompt ? null : false;
return (
<div className="fixed inset-0 bg-slate-900/70 z-[200] flex items-center justify-center p-6" onClick={() => handle(cancelValue)}>
  <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
    <p className="text-slate-800 font-semibold text-sm leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
    {prompt && (
      <div className="mt-4">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{prompt.label}</label>
        <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder={prompt.placeholder || ''}
          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500" />
        {blocked && <p className="text-[10px] text-rose-500 font-bold mt-1">A reason is required — it goes in the audit log.</p>}
      </div>
    )}
    <div className="flex gap-3 mt-5">
      <button type="button" onClick={() => handle(cancelValue)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">Cancel</button>
      <button type="button" onClick={accept} disabled={blocked} className={`flex-1 py-2.5 text-white font-bold rounded-xl text-sm transition-colors ${blocked ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600'}`}>{prompt?.confirmLabel || 'Confirm'}</button>
    </div>
  </div>
</div>
);
};
