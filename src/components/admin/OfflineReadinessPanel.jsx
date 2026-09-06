// "If the internet dies right now, am I covered?"
//
// Everything the offline work built is invisible until it fails. This makes it visible —
// and in particular it is how you discover that the browser REFUSED to keep the cache,
// which is a refusal nobody would otherwise notice until a day's data had gone.
//
// The judgement is services/offline/readiness.js; this gathers the facts and shows them.
import { useState, useEffect, useContext } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, WifiOff } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { assessReadiness } from '../../services/offline/readiness';
import { isStoragePersisted, storageEstimate, requestPersistentStorage } from '../../lib/offlineStorage';
// From the pure module, deliberately: ../../lib/claimDocNumber imports ../firebase, which
// initialises Auth on import and takes every test that touches this screen down with it.
import { readBlock, PREFIXES } from '../../lib/docNumberBlock';
import { useSyncStatus } from '../../hooks/useSyncStatus';

const ICON = {
  ready:       { Icon: ShieldCheck,   cls: 'text-emerald-600', box: 'bg-emerald-50 border-emerald-200' },
  partial:     { Icon: AlertTriangle, cls: 'text-amber-600',   box: 'bg-amber-50 border-amber-200' },
  'not-ready': { Icon: XCircle,       cls: 'text-rose-600',    box: 'bg-rose-50 border-rose-200' },
};

export const OfflineReadinessPanel = () => {
const { invoices, customers, products, payments, expenses, companies } = useContext(AppContext);
const sync = useSyncStatus();
const [env, setEnv] = useState({ serviceWorker: null, persistentStorage: null, estimate: null });
const [asking, setAsking] = useState(false);

const gather = async () => {
  // getRegistration rather than `controller`, which is null on the very first load after an
  // install and would report a perfectly good worker as missing.
  let serviceWorker = null;
  try {
    if (navigator.serviceWorker?.getRegistration) {
      serviceWorker = Boolean(await navigator.serviceWorker.getRegistration());
    }
  } catch { serviceWorker = null; }
  setEnv({
    serviceWorker,
    persistentStorage: await isStoragePersisted(),
    estimate: await storageEstimate(),
  });
};

useEffect(() => { gather(); }, []);

const blocks = Object.fromEntries(PREFIXES.map(p => [p, readBlock(p)]));
const result = assessReadiness({
  ...env,
  collections: {
    invoices: invoices.length, customers: customers.length, products: products.length,
    payments: payments.length, expenses: expenses.length, brands: companies.length,
  },
  blocks,
  syncState: sync.state,
  pending: sync.pending,
  lastSyncedAt: sync.lastSyncedAt,
});
const { Icon, cls, box } = ICON[result.level];

const ask = async () => {
  setAsking(true);
  await requestPersistentStorage();
  await gather();
  setAsking(false);
};

return (
<div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
  <h3 className="font-black text-slate-800 text-base mb-1 flex items-center gap-2"><WifiOff size={16}/> Ready for Offline</h3>
  <p className="text-xs text-slate-400 mb-4">If the internet fails right now, this is what would and would not work.</p>

  <div className={`flex items-center gap-3 p-3 rounded-xl border mb-3 ${box}`}>
    <Icon size={22} className={`${cls} shrink-0`}/>
    <div className="min-w-0">
      <p className={`font-black text-sm ${cls}`}>{result.summary}</p>
      {result.lastSyncedAt && (
        <p className="text-[10px] text-slate-500 mt-0.5">
          Last in touch with the server at {new Date(result.lastSyncedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  </div>

  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
    {result.checks.map(c => (
      <li key={c.key} className="p-3 flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 text-xs font-black ${c.ok ? 'text-emerald-600' : c.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'}`}>
          {c.ok ? '✓' : c.severity === 'critical' ? '✗' : '!'}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-700">{c.label}</span>
          <span className="block text-[11px] text-slate-500 leading-relaxed">{c.detail}</span>
        </span>
      </li>
    ))}
  </ul>

  <div className="flex flex-wrap gap-2 mt-3">
    <button onClick={gather} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
      <RefreshCw size={13}/> Check again
    </button>
    {env.persistentStorage === false && (
      <button onClick={ask} disabled={asking} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:bg-slate-300">
        {asking ? 'Asking…' : 'Ask again to keep storage'}
      </button>
    )}
  </div>

  <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
    Signing in always needs the internet — your password is checked on Firebase&apos;s server, so
    do not sign out if you expect to work offline. Adding or editing users needs it too.
  </p>
</div>
);
};
