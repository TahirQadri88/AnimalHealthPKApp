// The transactions behind a breakdown row.
//
// Every Analytics table answered "how much" and stopped there. This answers "which
// documents", for any dimension — product, brand, customer, salesperson, city, area, type.
// The arithmetic is services/analytics/drilldown.js, which reconciles to the row this was
// opened from; the job here is only to show it.
import { useState } from 'react';
import { FileText, Receipt, BookOpen, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ModalWrapper } from '../ui/ModalWrapper';
import { DIMENSIONS } from '../../services/analytics/drilldown';
import { APP_NAME, formatDateDisp, exportToCSV, getLocalDateStr } from '../../helpers';

const money = (n) => `Rs.${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export const DrillDownModal = ({ result, label, periodLabel = '', trend = [], onClose, onOpenLedger }) => {
const [openRow, setOpenRow] = useState(null);
const { dimension, rows = [], totals = {} } = result || {};
const dimLabel = DIMENSIONS[dimension]?.label || 'Breakdown';
const margin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : '0.0';

const exportRows = () => rows.map(r => ({
  'Date': r.date, 'Document': r.id, 'Type': r.docType,
  'Customer': r.customerName, 'Salesperson': r.salespersonName,
  'Qty': r.qty, 'Revenue (Rs)': r.revenue, 'Cost (Rs)': r.cost, 'Gross Profit (Rs)': r.profit,
  'Reason': r.reason || '',
}));

const handleCsv = () => exportToCSV(exportRows(), `${dimLabel}_${String(label).replace(/[^\w]+/g, '_')}.csv`, {
  title: `${APP_NAME} — ${dimLabel}: ${label}`,
  subtitle: `${periodLabel ? `Period: ${periodLabel} | ` : ''}Generated: ${getLocalDateStr()}`,
  totals: { 'Qty': totals.qty, 'Revenue (Rs)': totals.revenue, 'Cost (Rs)': totals.cost, 'Gross Profit (Rs)': totals.profit },
});

return (
<ModalWrapper title={`${dimLabel}: ${label}`} onClose={onClose} maxWidth="max-w-3xl">
<div className="space-y-3 pb-10">

  {/* What the row said, restated from the documents underneath it */}
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {[
      { k: 'Revenue', v: money(totals.revenue), cls: 'text-kt-ink' },
      { k: 'Gross Profit', v: money(totals.profit), cls: (totals.profit || 0) >= 0 ? 'text-kt-green' : 'text-kt-red' },
      { k: 'Margin', v: `${margin}%`, cls: 'text-kt-blue' },
      { k: 'Qty', v: (totals.qty || 0).toLocaleString('en-US'), cls: 'text-kt-ink' },
    ].map(c => (
      <div key={c.k} className="bg-white p-3 rounded-xl border border-kt-line">
        <p className="text-xs font-medium text-kt-muted">{c.k}</p>
        <p className={`text-base font-semibold mt-0.5 ${c.cls}`}>{c.v}</p>
      </div>
    ))}
  </div>

  {/* Is the margin eroding? Not answerable anywhere before this. All-time, deliberately —
      a trend confined to the selected period is one bar, and the header says so. */}
  {trend.length > 1 && (() => {
    const maxRev = trend.reduce((m, t) => Math.max(m, t.revenue), 0) || 1;
    const first = trend[0].marginPct, last = trend[trend.length - 1].marginPct;
    const drift = +(last - first).toFixed(1);
    return (
      <div className="bg-white rounded-xl border border-kt-line overflow-hidden">
        <div className="bg-kt-raised border-b border-kt-line p-3 flex justify-between items-center gap-2">
          <span className="text-xs font-medium text-kt-sub">Margin by month <span className="text-kt-muted normal-case font-medium">· all time, not the selected period</span></span>
          <span className={`text-xs font-semibold shrink-0 ${drift >= 0 ? 'text-kt-green' : 'text-kt-red'}`}>
            {drift >= 0 ? '↑' : '↓'} {Math.abs(drift)}pts
          </span>
        </div>
        <div className="flex items-end gap-1 p-3 overflow-x-auto">
          {trend.map(t => (
            <div key={t.month} className="flex-1 min-w-[38px] text-center">
              <div className={`text-xs font-semibold ${t.marginPct >= 20 ? 'text-kt-green' : t.marginPct >= 10 ? 'text-kt-amber' : 'text-kt-red'}`}>{t.marginPct}%</div>
              <div className="bg-kt-raised rounded mt-1" style={{ height: 40 }}>
                <div
                  className={`rounded ${t.marginPct >= 20 ? 'bg-kt-primary' : t.marginPct >= 10 ? 'bg-kt-amber' : 'bg-kt-red'}`}
                  style={{ height: `${Math.max((t.revenue / maxRev) * 40, 2)}px`, marginTop: `${40 - Math.max((t.revenue / maxRev) * 40, 2)}px` }}
                ></div>
              </div>
              <div className="text-[8px] text-kt-muted font-medium mt-1">{t.month.slice(2).replace('-', '/')}</div>
            </div>
          ))}
        </div>
        <p className="px-3 pb-3 text-xs text-kt-muted font-medium">Bar height is revenue; the figure above it is that month&apos;s margin.</p>
      </div>
    );
  })()}

  <div className="flex items-center justify-between px-1">
    <p className="text-xs font-medium text-kt-sub">
      {totals.invoices || 0} invoice{totals.invoices === 1 ? '' : 's'}
      {totals.returns > 0 && ` · ${totals.returns} return${totals.returns === 1 ? '' : 's'}`}
      {periodLabel && ` · ${periodLabel}`}
    </p>
    {rows.length > 0 && (
      <button onClick={handleCsv} title="CSV" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-kt-line rounded-lg text-xs font-medium text-kt-sub hover:bg-kt-raised">
        <Download size={12}/> CSV
      </button>
    )}
  </div>

  {rows.length === 0 && (
    <div className="bg-white p-8 rounded-xl text-center border border-kt-line">
      <p className="text-sm font-medium text-kt-muted">No transactions in this period.</p>
    </div>
  )}

  <div className="bg-white rounded-xl border border-kt-line divide-y divide-kt-line overflow-hidden">
    {rows.map(r => {
      const open = openRow === r.id;
      return (
        <div key={r.id}>
          <div className="flex items-center gap-2 p-3">
            <button
              onClick={() => setOpenRow(open ? null : r.id)}
              aria-expanded={open}
              className="flex-1 min-w-0 flex items-center gap-2 text-left"
            >
              {open ? <ChevronDown size={14} className="text-kt-muted shrink-0"/> : <ChevronRight size={14} className="text-kt-muted shrink-0"/>}
              <span className={`shrink-0 ${r.isReturn ? 'text-kt-red' : 'text-kt-muted'}`}>
                {r.isReturn ? <Receipt size={13}/> : <FileText size={13}/>}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-xs text-kt-ink truncate">
                  {r.id}
                  {r.isReturn && <span className="ml-1.5 text-xs font-semibold text-kt-red">Return</span>}
                </span>
                <span className="block text-xs text-kt-muted truncate">
                  {formatDateDisp(r.date)} · {r.customerName}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </span>
            </button>
            <div className="text-right shrink-0">
              <p className={`text-xs font-semibold ${r.revenue < 0 ? 'text-kt-red' : 'text-kt-ink'}`}>{money(r.revenue)}</p>
              <p className={`text-xs font-medium ${r.profit >= 0 ? 'text-kt-green' : 'text-kt-red'}`}>GP {money(r.profit)}</p>
            </div>
            {onOpenLedger && r.customerId !== undefined && (
              <button
                onClick={() => onOpenLedger(r.customerId)}
                title="Open customer ledger"
                className="p-1.5 bg-kt-blue/10 text-kt-blue rounded-lg hover:bg-kt-blue/10 border border-kt-blue/30 shrink-0"
              ><BookOpen size={13}/></button>
            )}
          </div>
          {open && (
            <div className="bg-kt-raised/70 px-3 pb-3 pt-1">
              <table className="w-full text-left text-xs">
                <thead className="text-kt-muted font-medium">
                  <tr><th className="py-1">Item</th><th className="py-1 text-center">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Amount</th></tr>
                </thead>
                <tbody className="font-semibold text-kt-sub">
                  {r.lines.map((l, i) => (
                    <tr key={i} className="border-t border-kt-line">
                      <td className="py-1.5 pr-2">
                        {l.name}
                        {l.isBonus && <span className="ml-1.5 text-xs font-semibold text-kt-green">Bonus</span>}
                      </td>
                      <td className="py-1.5 text-center">{l.qty}</td>
                      <td className="py-1.5 text-right">{money(l.price)}</td>
                      <td className="py-1.5 text-right font-medium text-kt-ink">{money(l.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
</ModalWrapper>
);
};
