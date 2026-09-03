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
      { k: 'Revenue', v: money(totals.revenue), cls: 'text-slate-800' },
      { k: 'Gross Profit', v: money(totals.profit), cls: (totals.profit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600' },
      { k: 'Margin', v: `${margin}%`, cls: 'text-indigo-600' },
      { k: 'Qty', v: (totals.qty || 0).toLocaleString('en-US'), cls: 'text-slate-800' },
    ].map(c => (
      <div key={c.k} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{c.k}</p>
        <p className={`text-base font-black mt-0.5 ${c.cls}`}>{c.v}</p>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Margin by month <span className="text-slate-400 normal-case font-medium">· all time, not the selected period</span></span>
          <span className={`text-[10px] font-black shrink-0 ${drift >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {drift >= 0 ? '↑' : '↓'} {Math.abs(drift)}pts
          </span>
        </div>
        <div className="flex items-end gap-1 p-3 overflow-x-auto">
          {trend.map(t => (
            <div key={t.month} className="flex-1 min-w-[38px] text-center">
              <div className={`text-[9px] font-black ${t.marginPct >= 20 ? 'text-emerald-600' : t.marginPct >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>{t.marginPct}%</div>
              <div className="bg-slate-100 rounded mt-1" style={{ height: 40 }}>
                <div
                  className={`rounded ${t.marginPct >= 20 ? 'bg-emerald-400' : t.marginPct >= 10 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ height: `${Math.max((t.revenue / maxRev) * 40, 2)}px`, marginTop: `${40 - Math.max((t.revenue / maxRev) * 40, 2)}px` }}
                ></div>
              </div>
              <div className="text-[8px] text-slate-400 font-bold mt-1">{t.month.slice(2).replace('-', '/')}</div>
            </div>
          ))}
        </div>
        <p className="px-3 pb-3 text-[9px] text-slate-400 font-medium">Bar height is revenue; the figure above it is that month&apos;s margin.</p>
      </div>
    );
  })()}

  <div className="flex items-center justify-between px-1">
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
      {totals.invoices || 0} invoice{totals.invoices === 1 ? '' : 's'}
      {totals.returns > 0 && ` · ${totals.returns} return${totals.returns === 1 ? '' : 's'}`}
      {periodLabel && ` · ${periodLabel}`}
    </p>
    {rows.length > 0 && (
      <button onClick={handleCsv} title="CSV" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
        <Download size={12}/> CSV
      </button>
    )}
  </div>

  {rows.length === 0 && (
    <div className="bg-white p-8 rounded-2xl text-center border border-slate-200">
      <p className="text-sm font-bold text-slate-400">No transactions in this period.</p>
    </div>
  )}

  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
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
              {open ? <ChevronDown size={14} className="text-slate-400 shrink-0"/> : <ChevronRight size={14} className="text-slate-400 shrink-0"/>}
              <span className={`shrink-0 ${r.isReturn ? 'text-rose-500' : 'text-slate-400'}`}>
                {r.isReturn ? <Receipt size={13}/> : <FileText size={13}/>}
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-xs text-slate-800 truncate">
                  {r.id}
                  {r.isReturn && <span className="ml-1.5 text-[9px] font-black text-rose-600 uppercase tracking-wider">Return</span>}
                </span>
                <span className="block text-[10px] text-slate-400 truncate">
                  {formatDateDisp(r.date)} · {r.customerName}
                  {r.reason ? ` · ${r.reason}` : ''}
                </span>
              </span>
            </button>
            <div className="text-right shrink-0">
              <p className={`text-xs font-black ${r.revenue < 0 ? 'text-rose-600' : 'text-slate-800'}`}>{money(r.revenue)}</p>
              <p className={`text-[10px] font-bold ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>GP {money(r.profit)}</p>
            </div>
            {onOpenLedger && r.customerId !== undefined && (
              <button
                onClick={() => onOpenLedger(r.customerId)}
                title="Open customer ledger"
                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-100 shrink-0"
              ><BookOpen size={13}/></button>
            )}
          </div>
          {open && (
            <div className="bg-slate-50/70 px-3 pb-3 pt-1">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 uppercase font-bold tracking-wider">
                  <tr><th className="py-1">Item</th><th className="py-1 text-center">Qty</th><th className="py-1 text-right">Rate</th><th className="py-1 text-right">Amount</th></tr>
                </thead>
                <tbody className="font-semibold text-slate-600">
                  {r.lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-200/70">
                      <td className="py-1.5 pr-2">
                        {l.name}
                        {l.isBonus && <span className="ml-1.5 text-[9px] font-black text-emerald-600 uppercase">Bonus</span>}
                      </td>
                      <td className="py-1.5 text-center">{l.qty}</td>
                      <td className="py-1.5 text-right">{money(l.price)}</td>
                      <td className="py-1.5 text-right font-bold text-slate-800">{money(l.revenue)}</td>
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
