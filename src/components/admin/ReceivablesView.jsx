import { useState, useMemo, useContext } from 'react';
import { Search, FileSpreadsheet, FileDown } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { APP_NAME, getLocalDateStr, formatDateDisp, exportToCSV } from '../../helpers';

// Each age bucket is topped by a strip in its colour, green through amber to red, so the
// age of the money reads before its figure does (the bright --kt-icon-* tones, graphics only).
const BUCKET_STRIP = { current: 'border-t-kt-icon-green', d31_60: 'border-t-kt-icon-amber', d61_90: 'border-t-kt-amber', d90plus: 'border-t-kt-icon-red' };
import { buildAgingReport, summariseAging, AGING_BUCKETS } from '../../services/analytics/receivables';

export const ReceivablesView = () => {
const { customers, invoices, payments, setSelectedLedgerId, setShowLedgerModal,
        setSelectedCustomerForPayment, setShowPaymentModal, setEditingPayment, isAdmin,
        setPrintConfig, showToast } = useContext(AppContext);
const [bucket, setBucket] = useState('all');
const [search, setSearch] = useState('');

const asOf = getLocalDateStr();
const report = useMemo(
  () => buildAgingReport({ customers, invoices, payments, asOf }),
  [customers, invoices, payments, asOf]);

const rows = report.rows
  .filter(r => bucket === 'all' || r.buckets[bucket] > 0)
  .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.phone || '').includes(search));

const money = (n) => 'Rs. ' + Math.round(n).toLocaleString('en-US');

// ── Export ────────────────────────────────────────────────────────────────
// Everything below exports what is ON SCREEN — the bucket chip and the search box both
// hide rows, and a sheet that foots to the unfiltered report would contradict the screen
// it was printed from. Totals are recomputed over the filtered rows for the same reason.
const shown = summariseAging(rows);
const scopeLabel = [
  bucket === 'all' ? 'All buckets' : AGING_BUCKETS.find(b => b.key === bucket)?.label,
  search && `Search: "${search}"`,
].filter(Boolean).join(' | ');

const csvRows = () => rows.map(r => {
  const row = { 'Customer': r.name, 'Phone': r.phone || '', 'Oldest (Days)': r.oldestAgeDays };
  AGING_BUCKETS.forEach(b => { row[`${b.label} (Rs)`] = Math.round(r.buckets[b.key] || 0); });
  row['Total Due (Rs)'] = Math.round(r.totalOutstanding);
  return row;
});

const exportCsv = () => {
  if (rows.length === 0) return showToast('Nothing to export', 'error');
  const totals = {};
  AGING_BUCKETS.forEach(b => { totals[`${b.label} (Rs)`] = Math.round(shown.totals[b.key]); });
  totals['Total Due (Rs)'] = Math.round(shown.grandTotal);
  exportToCSV(csvRows(), `Receivables_Aging_${asOf.replace(/-/g, '')}.csv`, {
    title: `${APP_NAME} — Receivables Aging`,
    subtitle: `As at ${formatDateDisp(asOf)} | ${scopeLabel} | Generated: ${asOf}`,
    totals,
  });
};

// One config drives print, PDF, image and WhatsApp text — PrintView already owns all four,
// plus the A4 / A5 / thermal switcher. A4 opens first because the table is seven columns.
const openPrintView = () => {
  if (rows.length === 0) return showToast('Nothing to export', 'error');
  setPrintConfig({
    docType: 'report',
    format: 'a4',
    data: {
      title: 'Receivables Aging',
      dateFilter: `As at ${formatDateDisp(asOf)}`,
      view: 'Aging',
      generatedOn: asOf,
      appliedFilters: { scope: scopeLabel },
      aging: {
        asOf,
        buckets: AGING_BUCKETS.map(b => ({ key: b.key, label: b.label })),
        rows: rows.map(r => ({
          name: r.name, phone: r.phone || '',
          oldestAgeDays: r.oldestAgeDays, buckets: r.buckets,
          totalOutstanding: r.totalOutstanding,
        })),
        totals: shown.totals,
        grandTotal: shown.grandTotal,
        customerCount: shown.customerCount,
      },
    },
  });
};
// Anything past 60 days is the reason to open this screen.
const ageTone = (d) => d > 90 ? 'text-kt-red bg-kt-red/10 border-kt-red/30'
  : d > 60 ? 'text-kt-amber bg-kt-amber/10 border-kt-amber/30'
  : 'text-kt-sub bg-kt-raised border-kt-line';

return (
<div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
  <div className="flex items-start justify-between gap-3 flex-wrap">
    <div className="min-w-0">
      <h3 className="text-xs font-medium text-kt-ink">Receivables Aging</h3>
      <p className="text-xs text-kt-sub mt-0.5">
        {report.customerCount} customer{report.customerCount !== 1 ? 's' : ''} owing {money(report.grandTotal)} · as at {formatDateDisp(asOf)}
      </p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={exportCsv} title="Download as CSV (Excel)"
        className="h-11 sm:h-9 flex items-center gap-2 px-3 rounded-lg border border-kt-line bg-white text-kt-ink font-medium text-sm sm:text-xs hover:bg-kt-raised transition-colors">
        <FileSpreadsheet size={16} strokeWidth={1.5}/> CSV
      </button>
      <button onClick={openPrintView} title="Print, PDF, image or WhatsApp text — A4, A5 or thermal"
        className="h-11 sm:h-9 flex items-center gap-2 px-3 rounded-lg border border-kt-line bg-white text-kt-ink font-medium text-sm sm:text-xs hover:bg-kt-raised transition-colors">
        <FileDown size={16} strokeWidth={1.5}/> PDF / Print
      </button>
    </div>
    <p className="w-full text-xs text-kt-muted -mt-1">
      Exports follow the bucket and search below. PDF / Print opens A4, A5 or thermal, and can also share as an image or WhatsApp text.
    </p>
  </div>

  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
    {[{ key: 'all', label: 'All', amount: report.grandTotal }, ...AGING_BUCKETS.map(b => ({ key: b.key, label: b.label, amount: report.totals[b.key] }))]
      .map(b => (
      <button key={b.key} onClick={() => setBucket(b.key)}
        className={`text-left p-3 rounded-xl border border-t-4 transition-colors ${BUCKET_STRIP[b.key] || 'border-t-kt-primary'} ${bucket === b.key ? 'bg-kt-band text-white border-kt-line' : 'bg-white border-kt-line hover:border-kt-line'}`}>
        <p className={`text-xs font-medium   ${bucket === b.key ? 'text-white/70' : 'text-kt-muted'}`}>{b.label}</p>
        <p className={`text-sm font-semibold mt-0.5 ${bucket === b.key ? 'text-white' : b.key === 'd90plus' && b.amount > 0 ? 'text-kt-red' : 'text-kt-ink'}`}>{money(b.amount)}</p>
      </button>
    ))}
  </div>

  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-kt-muted" size={14}/>
    <input placeholder="Search customer or phone..." value={search} onChange={e => setSearch(e.target.value)}
      className="w-full pl-8 pr-3 py-2 bg-white border border-kt-line rounded-xl font-semibold outline-none text-sm focus:border-kt-ink" />
  </div>

  {rows.length === 0 && (
    <p className="text-center py-10 text-sm text-kt-muted font-medium">
      {report.customerCount === 0 ? 'Nothing outstanding. Everyone is settled.' : 'No customers in this bucket.'}
    </p>
  )}

  <div className="space-y-2">
    {rows.map(r => (
      <div key={r.customerId} className="bg-white border border-kt-line rounded-xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-kt-blue text-base truncate">{r.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-semibold   px-1.5 py-0.5 rounded border ${ageTone(r.oldestAgeDays)}`}>
                oldest {r.oldestAgeDays}d
              </span>
              {r.phone && <span className="text-xs text-kt-sub">{r.phone}</span>}
            </div>
          </div>
          <p className="text-base font-semibold text-kt-ink shrink-0">{money(r.totalOutstanding)}</p>
        </div>

        <div className="flex gap-1 mt-2 flex-wrap">
          {AGING_BUCKETS.filter(b => r.buckets[b.key] > 0).map(b => (
            <span key={b.key} className={`text-xs font-medium px-1.5 py-0.5 rounded border ${b.key === 'd90plus' ? 'bg-kt-red/10 text-kt-red border-kt-red/30' : b.key === 'd61_90' ? 'bg-kt-amber/10 text-kt-amber border-kt-amber/30' : 'bg-kt-raised text-kt-sub border-kt-line'}`}>
              {b.label}: {money(r.buckets[b.key])}
            </span>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={() => { setSelectedLedgerId(r.customerId); setShowLedgerModal(true); }}
            className="flex-1 bg-kt-raised hover:bg-kt-line text-kt-ink font-medium text-xs py-2 rounded-lg transition-colors">Ledger</button>
          {isAdmin && (
            <button onClick={() => { setEditingPayment(null); setSelectedCustomerForPayment(r.customerId); setShowPaymentModal(true); }}
              className="flex-1 bg-kt-primary hover:bg-kt-primary/90 text-white font-medium text-xs py-2 rounded-lg transition-colors">Receive</button>
          )}
          {r.phone && (
            <a href={`tel:${r.phone}`} className="px-3 bg-kt-blue/10 hover:bg-kt-blue/10 text-kt-blue font-medium text-xs py-2 rounded-lg flex items-center transition-colors">Call</a>
          )}
        </div>
      </div>
    ))}
  </div>
</div>
);
};

// Activity log and voided records. Admin only — firestore.rules already restricts
// auditLogs reads to admins, so this mirrors what the database will actually hand over.
