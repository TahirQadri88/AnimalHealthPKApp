// "If the internet dies right now, am I covered?"
//
// Everything the offline work built is invisible until it fails. This makes it visible —
// and in particular it is how you discover that the browser REFUSED to keep the cache,
// which is a refusal nobody would otherwise notice until a day's data had gone.
//
// The judgement is services/offline/readiness.js; this gathers the facts and shows them.
import { useState, useEffect, useContext } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, WifiOff, Download } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { assessReadiness } from '../../services/offline/readiness';
import { isStoragePersisted, storageEstimate, requestPersistentStorage } from '../../lib/offlineStorage';
// From the pure module, deliberately: ../../lib/claimDocNumber imports ../firebase, which
// initialises Auth on import and takes every test that touches this screen down with it.
import { readBlock, PREFIXES } from '../../lib/docNumberBlock';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import {
  subscribeInstallPrompt, hasInstallPrompt, promptInstall, isStandalone, isIOS, installAdvice,
} from '../../lib/installPrompt';

const ICON = {
  ready:       { Icon: ShieldCheck,   cls: 'text-kt-green', box: 'bg-kt-green/10 border-kt-green/30' },
  partial:     { Icon: AlertTriangle, cls: 'text-kt-amber',   box: 'bg-kt-amber/10 border-kt-amber/30' },
  'not-ready': { Icon: XCircle,       cls: 'text-kt-red',    box: 'bg-kt-red/10 border-kt-red/30' },
};

export const OfflineReadinessPanel = () => {
const { invoices, customers, products, payments, expenses, companies } = useContext(AppContext);
const sync = useSyncStatus();
const [env, setEnv] = useState({ serviceWorker: null, persistentStorage: null, estimate: null });
const [asking, setAsking] = useState(false);
// The offer arrives on its own schedule, so re-render when it does.
const [canPrompt, setCanPrompt] = useState(false);
useEffect(() => {
  setCanPrompt(hasInstallPrompt());
  return subscribeInstallPrompt(() => setCanPrompt(hasInstallPrompt()));
}, []);

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

const advice = installAdvice({ standalone: isStandalone(), canPrompt, ios: isIOS() });

const install = async () => {
  const outcome = await promptInstall();
  // Installing is what earns the storage grant, so ask for it again straight away rather
  // than making them press two buttons.
  if (outcome === 'accepted') { await requestPersistentStorage(); }
  await gather();
};

const ask = async () => {
  setAsking(true);
  await requestPersistentStorage();
  await gather();
  setAsking(false);
};

return (
<div className="bg-white rounded-xl p-5 border border-kt-line">
  <h3 className="font-semibold text-kt-ink text-base mb-1 flex items-center gap-2"><WifiOff size={16}/> Ready for Offline</h3>
  <p className="text-xs text-kt-muted mb-4">If the internet fails right now, this is what would and would not work.</p>

  <div className={`flex items-center gap-3 p-3 rounded-xl border mb-3 ${box}`}>
    <Icon size={22} className={`${cls} shrink-0`}/>
    <div className="min-w-0">
      <p className={`font-semibold text-sm ${cls}`}>{result.summary}</p>
      {result.lastSyncedAt && (
        <p className="text-xs text-kt-sub mt-0.5">
          Last in touch with the server at {new Date(result.lastSyncedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  </div>

  <ul className="divide-y divide-kt-line border border-kt-line rounded-xl overflow-hidden">
    {result.checks.map(c => (
      <li key={c.key} className="p-3 flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 text-xs font-semibold ${c.ok ? 'text-kt-green' : c.severity === 'critical' ? 'text-kt-red' : 'text-kt-amber'}`}>
          {c.ok ? '✓' : c.severity === 'critical' ? '✗' : '!'}
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-kt-ink">{c.label}</span>
          <span className="block text-xs text-kt-sub leading-relaxed">{c.detail}</span>
        </span>
      </li>
    ))}
  </ul>

  {/* The refusal is the one finding here a person can actually act on, and telling them to
      "install the app" without a way to do it is advice, not a fix. Chrome grants persistent
      storage to an installed app and refuses it to a tab. */}
  {env.persistentStorage === false && advice.mode !== 'installed' && (
    <div className="mt-3 bg-kt-amber/10 border border-kt-amber/30 rounded-xl p-3">
      <p className="text-xs font-medium text-kt-amber mb-1">How to fix the warning above</p>
      <p className="text-xs text-kt-amber leading-relaxed">{advice.text}</p>
      {advice.mode === 'prompt' && (
        <button onClick={install} className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-kt-primary text-white hover:bg-kt-primary/90">
          <Download size={13}/> Install app
        </button>
      )}
    </div>
  )}

  <div className="flex flex-wrap gap-2 mt-3">
    <button onClick={gather} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-kt-line text-kt-ink hover:bg-kt-raised">
      <RefreshCw size={13}/> Check again
    </button>
    {env.persistentStorage === false && (
      <button onClick={ask} disabled={asking} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-kt-amber text-white hover:bg-kt-amber disabled:bg-kt-line">
        {asking ? 'Asking…' : 'Ask again to keep storage'}
      </button>
    )}
  </div>

  <p className="text-xs text-kt-muted mt-3 leading-relaxed">
    Signing in always needs the internet — your password is checked on Firebase&apos;s server, so
    do not sign out if you expect to work offline. Adding or editing users needs it too.
  </p>
</div>
);
};
