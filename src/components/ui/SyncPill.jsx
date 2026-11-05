// One indicator, always visible, saying whether what you see has reached the server.
//
// Deliberately quiet when there is nothing to say — brief §34 warns against an app that
// shouts OFFLINE at you, and a badge that is always lit stops being read. Live shows a small
// dot and no words; the other three states earn their space.
import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSyncStatus } from '../../hooks/useSyncStatus';

// White so it reads on the green phone header and the white desktop bar alike; the colour
// of the icon and word carries the state.
const LOOK = {
  live:    { Icon: Cloud,         cls: 'bg-white text-kt-green border-kt-line',     label: '' },
  syncing: { Icon: RefreshCw,     cls: 'bg-white text-kt-blue border-kt-line',      label: 'Syncing' },
  offline: { Icon: CloudOff,      cls: 'bg-white text-kt-amber border-kt-amber/40', label: 'Offline' },
  stale:   { Icon: AlertTriangle, cls: 'bg-white text-kt-amber border-kt-amber/40', label: 'No connection' },
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
    className={`flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors ${cls}`}
  >
    <Icon size={16} strokeWidth={1.5} className={state === 'syncing' ? 'animate-spin' : ''}/>
    {text && <span>{text}</span>}
  </button>

  {open && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true"></div>
      <div className="font-ui absolute right-0 mt-2 w-72 bg-white border border-kt-line rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.08)] z-50 p-4 text-left text-kt-ink">
        <p className="text-xs text-kt-sub mb-1">Connection</p>
        <p className="text-sm font-medium text-kt-ink mb-2">
          {state === 'live' ? 'Everything is saved' : (label + (pending > 0 ? ` · ${pending} waiting` : ''))}
        </p>
        <p className="text-sm text-kt-sub leading-relaxed">{EXPLAIN[state]}</p>

        {lastSyncedAt && (
          <p className="text-xs text-kt-muted mt-2">
            Last in touch with the server at {new Date(lastSyncedAt).toLocaleTimeString()}
          </p>
        )}

        {(state === 'offline' || state === 'stale') && (
          <div className="mt-3 pt-3 border-t border-kt-line space-y-1.5">
            <p className="text-xs text-kt-sub">While there is no connection</p>
            <p className="text-sm text-kt-green">✓ Billing, receipts, returns, expenses, customers and products</p>
            <p className="text-sm text-kt-green">✓ Ledgers, balances, receivables and printing</p>
            {/* The two that catch people out, and the reason this panel exists. */}
            <p className="text-sm text-kt-red">✗ Signing in — your password is checked on the server, so do not sign out</p>
            <p className="text-sm text-kt-red">✗ Adding or editing users and permissions</p>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
