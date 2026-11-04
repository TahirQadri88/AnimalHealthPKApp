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
<div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-6" onClick={() => handle(cancelValue)}>
  <div className="font-ui bg-white rounded-xl p-6 max-w-sm w-full shadow-[0_8px_24px_rgba(0,0,0,0.12)]" onClick={e => e.stopPropagation()}>
    <p className="text-kt-ink text-base leading-relaxed whitespace-pre-line">{confirmDialog.message}</p>
    {prompt && (
      <div className="mt-4">
        <label className="text-xs font-medium text-kt-sub block mb-1">{prompt.label}</label>
        <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder={prompt.placeholder || ''}
          className="w-full p-2.5 bg-white border border-kt-line rounded-xl text-sm font-semibold outline-none focus:border-kt-blue/30" />
        {blocked && <p className="text-xs text-kt-red font-medium mt-1">A reason is required — it goes in the audit log.</p>}
      </div>
    )}
    <div className="flex gap-3 mt-5">
      <button type="button" onClick={() => handle(cancelValue)} className="flex-1 py-2.5 bg-kt-raised hover:bg-kt-line text-kt-ink font-medium rounded-xl text-sm transition-colors">Cancel</button>
      <button type="button" onClick={accept} disabled={blocked} className={`flex-1 py-2.5 text-white font-medium rounded-xl text-sm transition-colors ${blocked ? 'bg-kt-red/20 cursor-not-allowed' : 'bg-kt-red hover:bg-kt-red'}`}>{prompt?.confirmLabel || 'Confirm'}</button>
    </div>
  </div>
</div>
);
};
