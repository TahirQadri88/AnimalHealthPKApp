// One indicator, always visible, saying whether what you see has reached the server.
//
// Deliberately quiet when there is nothing to say — brief §34 warns against an app that
// shouts OFFLINE at you, and a badge that is always lit stops being read. Live shows a small
// dot and no words; the other three states earn their space.
import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSyncStatus } from '../../hooks/useSyncStatus';

const LOOK = {
  live:    { Icon: Cloud,         cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', label: '' },
  syncing: { Icon: RefreshCw,     cls: 'bg-indigo-50 text-indigo-600 border-indigo-100',    label: 'Syncing' },
  offline: { Icon: CloudOff,      cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Offline' },
  stale:   { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'No connection' },
};

const EXPLAIN = {
  live: 'Everything on this screen has reached the server.',
  syncing: 'Saved on this device and on its way to the server. You can carry on working.',
  offline: 'You are working from data saved on this device. New invoices, receipts and edits are saved here and will send themselves when the connection returns.',
  stale: 'The device thinks it is online but nothing is reaching the server. Your work is being saved on this device and will send itself when the connection genuinely returns.',
};

export const SyncPill = ({ className = '' }) => {
const { state, pending, lastSyncedAt } = useSyncStatus();
const [open, setOpen] = useState(false);
const { Icon, cls, label } = LOOK[state] || LOOK.live;
const text = pending > 0 ? `${label} ${pending}` : label;

return (
<div className={`relative ${className}`}>
  <button
    onClick={() => setOpen(v => !v)}
    aria-label={`Connection: ${state}${pending > 0 ? `, ${pending} changes waiting to sync` : ''}`}
    aria-expanded={open}
    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${cls}`}
  >
    <Icon size={13} className={state === 'syncing' ? 'animate-spin' : ''}/>
    {text && <span className="uppercase tracking-wider">{text}</span>}
  </button>

  {open && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true"></div>
      <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 text-left">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Connection</p>
        <p className="text-sm font-bold text-slate-800 mb-2">
          {state === 'live' ? 'Everything is saved' : (label + (pending > 0 ? ` · ${pending} waiting` : ''))}
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed">{EXPLAIN[state]}</p>

        {lastSyncedAt && (
          <p className="text-[10px] text-slate-400 mt-2">
            Last in touch with the server at {new Date(lastSyncedAt).toLocaleTimeString()}
          </p>
        )}

        {(state === 'offline' || state === 'stale') && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">While there is no connection</p>
            <p className="text-[11px] text-emerald-700">✓ Billing, receipts, returns, expenses, customers and products</p>
            <p className="text-[11px] text-emerald-700">✓ Ledgers, balances, receivables and printing</p>
            {/* The two that catch people out, and the reason this panel exists. */}
            <p className="text-[11px] text-rose-700">✗ Signing in — your password is checked on the server, so do not sign out</p>
            <p className="text-[11px] text-rose-700">✗ Adding or editing users and permissions</p>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
