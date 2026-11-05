import { useState, useEffect, useContext } from 'react';
import { Activity, Search } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
// Pure constants module — no firebase import, so this stays testable.
import { LOG_PAGE } from '../../lib/constants';
import { formatDateDisp } from '../../helpers';
import { describeEntry, isVoided } from '../../services/audit/auditLog';

export const AuditView = () => {
const { adminView, invoicesRaw, paymentsRaw, expensesRaw, customers, restoreRecord, showConfirm, showToast, fetchAuditLog } = useContext(AppContext);
const [tab, setTab] = useState('activity');
const [entries, setEntries] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [search, setSearch] = useState('');

// The read itself lives in the provider with the rest of the data access. Not a style
// choice: importing ../firebase here initialises Auth at module load, which throws without
// credentials and makes this component impossible to import from a test.
const load = async () => {
  setLoading(true); setError('');
  const rows = await fetchAuditLog();
  if (rows === null) setError('Could not load the activity log.');
  setEntries(rows || []);
  setLoading(false);
};
useEffect(() => { if (adminView === 'audit' && entries === null && !loading) load(); }, [adminView]);

const custName = (id) => customers.find(c => c.id === id)?.name || '';
const money = (n) => 'Rs. ' + Math.round(Number(n) || 0).toLocaleString('en-US');

// Everything voided, across the three financial collections, worst-recent first.
const voided = [
  ...invoicesRaw.filter(isVoided).map(r => ({ ...r, kind: r.status === 'CreditNote' ? 'Credit Note' : r.status === 'Estimate' ? 'Estimate' : 'Invoice', collection: 'invoices', amount: r.total, who: custName(r.customerId) })),
  ...paymentsRaw.filter(isVoided).map(r => ({ ...r, kind: 'Payment', collection: 'payments', amount: r.amount, who: custName(r.customerId) })),
  ...expensesRaw.filter(isVoided).map(r => ({ ...r, kind: 'Expense', collection: 'expenses', amount: r.amount, who: r.category || '' })),
].sort((a, b) => String(b.voidedAt || '').localeCompare(String(a.voidedAt || '')));

const q = search.trim().toLowerCase();
const matches = (hay) => !q || String(hay || '').toLowerCase().includes(q);
const shownVoided = voided.filter(v => matches(v.id) || matches(v.who) || matches(v.voidReason) || matches(v.voidedBy));
const shownEntries = (entries || []).filter(e => matches(e.recordId) || matches(e.label) || matches(e.userName) || matches(e.reason) || matches(e.collection));

const restore = async (v) => {
  if (!await showConfirm(`Restore ${v.kind} ${v.id}?\n\nIt goes back into every balance and report.`)) return;
  await restoreRecord(v.collection, v, { label: v.id });
  showToast(`${v.id} restored`);
};

const tone = { create: 'bg-kt-green/10 text-kt-green border-kt-green/30', update: 'bg-kt-amber/10 text-kt-amber border-kt-amber/30',
  void: 'bg-kt-red/10 text-kt-red border-kt-red/30', restore: 'bg-kt-blue/10 text-kt-blue border-kt-blue/30',
  delete: 'bg-kt-raised text-kt-sub border-kt-line' };

return (
<div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
  <div className="flex items-start justify-between gap-3 flex-wrap">
    <div>
      <h3 className="text-xs font-medium text-kt-ink">Activity &amp; Voided Records</h3>
      <p className="text-xs text-kt-sub mt-0.5">
        {voided.length} voided record{voided.length !== 1 ? 's' : ''} · log shows the last {LOG_PAGE}
      </p>
    </div>
    <button onClick={load} disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-kt-band disabled:bg-kt-line text-white rounded-lg font-medium text-xs hover:bg-kt-band transition-colors">
      <Activity size={13}/> {loading ? 'Loading…' : 'Refresh'}
    </button>
  </div>

  <div className="bg-kt-line p-1 rounded-xl flex gap-1">
    {[['activity', 'Activity'], ['voided', `Voided (${voided.length})`]].map(([k, label]) => (
      <button key={k} onClick={() => setTab(k)}
        className={`flex-1 py-2 rounded-lg font-medium text-xs transition-colors ${tab === k ? 'bg-white text-kt-ink ' : 'text-kt-sub'}`}>{label}</button>
    ))}
  </div>

  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted" size={14}/>
    <input placeholder="Search id, client, user or reason..." value={search} onChange={e => setSearch(e.target.value)}
      className="w-full pl-8 pr-3 py-2 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm focus:border-kt-ink" />
  </div>

  {error && <p className="text-center py-6 text-sm text-kt-red font-medium">{error}</p>}

  {tab === 'activity' && !error && (
    <div className="space-y-2">
      {entries === null && <p className="text-center py-10 text-sm text-kt-muted font-medium">Loading…</p>}
      {entries !== null && shownEntries.length === 0 && (
        <p className="text-center py-10 text-sm text-kt-muted font-medium">
          {entries.length === 0 ? 'Nothing logged yet. Entries appear as invoices, payments and expenses are created, edited or voided.' : 'No entries match that search.'}
        </p>
      )}
      {shownEntries.map((e, i) => (
        <div key={e.id || i} className="bg-white border border-kt-line rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold   px-1.5 py-0.5 rounded border ${tone[e.action] || tone.delete}`}>{e.action}</span>
                <span className="font-medium text-kt-ink text-sm truncate">{e.label || e.recordId}</span>
                <span className="text-xs text-kt-muted">{e.collection}</span>
              </div>
              <p className="text-xs text-kt-sub mt-1">{describeEntry(e)}</p>
              {(e.changes || []).length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {e.changes.slice(0, 6).map((c, j) => (
                    <div key={j} className="text-xs text-kt-sub">
                      <span className="font-medium">{c.field}</span>: <span className="text-kt-muted">{c.from}</span> → <span className="text-kt-ink font-semibold">{c.to}</span>
                    </div>
                  ))}
                  {e.changes.length > 6 && <div className="text-xs text-kt-muted">…and {e.changes.length - 6} more field{e.changes.length - 6 !== 1 ? 's' : ''}</div>}
                </div>
              )}
            </div>
            <span className="text-xs text-kt-muted shrink-0 text-right">{formatDateDisp((e.at || '').slice(0, 10))}<br/>{(e.at || '').slice(11, 16)}</span>
          </div>
        </div>
      ))}
    </div>
  )}

  {tab === 'voided' && (
    <div className="space-y-2">
      {shownVoided.length === 0 && (
        <p className="text-center py-10 text-sm text-kt-muted font-medium">
          {voided.length === 0 ? 'Nothing voided. Deleting an invoice, payment or expense voids it instead of removing it.' : 'No voided records match that search.'}
        </p>
      )}
      {shownVoided.map(v => (
        <div key={`${v.collection}-${v.id}`} className="bg-white border border-kt-red/30 rounded-xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded border bg-kt-red/10 text-kt-red border-kt-red/30">{v.kind}</span>
                <span className="font-medium text-kt-ink text-sm truncate">{v.id}</span>
              </div>
              {v.who && <p className="text-xs text-kt-sub mt-0.5 truncate">{v.who}</p>}
              <p className="text-xs text-kt-sub mt-1">
                Voided by <span className="font-medium">{v.voidedBy || 'Unknown'}</span> on {formatDateDisp(String(v.voidedAt || '').slice(0, 10))}
              </p>
              {v.voidReason && <p className="text-xs text-kt-ink font-semibold mt-0.5">“{v.voidReason}”</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-kt-muted line-through">{money(v.amount)}</p>
              <button onClick={() => restore(v)} className="mt-2 px-2.5 py-1.5 bg-kt-blue/10 hover:bg-kt-blue/10 text-kt-blue font-medium text-xs rounded-lg transition-colors">Restore</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
);
};
