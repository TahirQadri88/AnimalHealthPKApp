// "Needs attention": one line per question the owner asked, each opening its list.
//
// The lists come from services/analytics/attention.js and reconcile with the screen's other
// figures (attention.test.js). A line with nothing to show says "None" and does not open.
import { useState } from 'react';
import { ChevronRight, PhoneCall } from 'lucide-react';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { InfoTip } from '../../ui/InfoTip';
import { formatDateDisp as fmt } from '../../../helpers';

// Non-breaking hyphens, so "30-Oct-26" never splits across two lines.
const formatDateDisp = (d) => fmt(d).replace(/-/g, '\u2011');

const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const waLink = (phone, text) => {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '');
  return digits ? `https://wa.me/92${digits}?text=${encodeURIComponent(text)}` : null;
};
const Wa = ({ phone, text }) => {
  const href = waLink(phone, text);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp"
      className="shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-lg bg-kt-green/10 text-kt-green border border-kt-green/30 hover:bg-kt-green/15">
      <PhoneCall size={15} strokeWidth={1.5} />
    </a>
  );
};

const Row = ({ title, sub, figure, figureTone = 'text-kt-ink', action }) => (
  <div className="bg-white border border-kt-line rounded-xl px-4 py-3 flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-kt-ink break-words">{title}</p>
      {sub && <p className="text-xs text-kt-sub mt-0.5 break-words">{sub}</p>}
    </div>
    {figure && <span className={`shrink-0 text-sm font-medium tabular-nums text-right ${figureTone}`}>{figure}</span>}
    {action}
  </div>
);

export const NeedsAttention = ({ data, vsLabel, businessName = '' }) => {
  const [open, setOpen] = useState(null);
  const sign = businessName ? `\n\n${businessName}` : '';
  const { debts, lapsed, margins, products, brands } = data;
  const remind = (r) => `Assalam o Alaikum ${r.name},\n\nYour outstanding balance is *${rs(r.balance)}*. Kindly arrange payment at your earliest.${sign}`;

  const lines = [
    { key: 'late', info: 'debtLate', label: 'Late over 30 days', count: debts.late.length, note: debts.late.length ? `${plural(debts.late.length, 'client', 'clients')} · ${rs(debts.late.reduce((s, r) => s + r.overdue, 0))}` : null, tone: 'text-kt-red',
      list: () => debts.late.map(r => <Row key={r.id} title={r.name} sub={`Oldest unpaid ${r.oldestDays} days · owes ${rs(r.balance)}${r.lastPayment ? ` · last paid ${formatDateDisp(r.lastPayment)}` : ' · never paid'}`} figure={rs(r.overdue)} figureTone="text-kt-red" action={<Wa phone={r.phone} text={remind(r)} />} />) },
    { key: 'growing', info: 'debtGrowing', label: 'Debt growing', count: debts.growing.length, note: debts.growing.length ? `${plural(debts.growing.length, 'client', 'clients')} · up ${rs(debts.growing.reduce((s, r) => s + r.change, 0))}` : null, tone: 'text-kt-amber',
      list: () => debts.growing.map(r => <Row key={r.id} title={r.name} sub={`${rs(r.then)} at the start → ${rs(r.balance)} now`} figure={`+ ${rs(r.change)}`} figureTone="text-kt-amber" action={<Wa phone={r.phone} text={remind(r)} />} />) },
    { key: 'quiet', info: 'debtQuiet', label: 'Owing and not paying', count: debts.quiet.length, note: debts.quiet.length ? `${plural(debts.quiet.length, 'client', 'clients')} · ${rs(debts.quiet.reduce((s, r) => s + r.balance, 0))}` : null, tone: 'text-kt-amber',
      list: () => debts.quiet.map(r => <Row key={r.id} title={r.name} sub={r.daysSincePayment === null ? 'No payment on record' : `Last paid ${r.daysSincePayment} days ago (${formatDateDisp(r.lastPayment)})`} figure={rs(r.balance)} action={<Wa phone={r.phone} text={remind(r)} />} />) },
    { key: 'lapsed', info: 'lapsed', label: 'Stopped buying', count: lapsed.length, note: lapsed.length ? `${plural(lapsed.length, 'regular', 'regulars')} · about ${rs(lapsed.reduce((s, r) => s + r.monthlyValue, 0))} a month` : null, tone: 'text-kt-amber',
      list: () => lapsed.map(r => <Row key={r.id} title={r.name} sub={`Last bill ${formatDateDisp(r.lastBill)} (${r.lastBillId}), ${r.daysSince} days ago · usually every ${r.usualGap} days · ${r.bills} bills`} figure={`${rs(r.monthlyValue)}/mo`} action={<Wa phone={r.phone} text={`Assalam o Alaikum ${r.name},\n\nWe have not received your order for some time. Is there anything you need? We are happy to help.${sign}`} />} />) },
    { key: 'below', info: 'belowCost', label: 'Sold below cost', count: margins.below.length, note: margins.below.length ? `${plural(margins.below.length, 'line', 'lines')} · lost ${rs(-margins.belowLoss)}` : null, tone: 'text-kt-red',
      list: () => margins.below.map((r, i) => <Row key={i} title={r.name} sub={`${r.invoiceId} · ${formatDateDisp(r.date)} · ${r.customer} · ${r.qty} at ${rs(r.price)}, cost ${rs(r.cost)}`} figure={`− ${rs(-r.gap)}`} figureTone="text-kt-red" />) },
    { key: 'thin', info: 'thinMargin', label: 'Thin margin, under 5%', count: margins.thin.length, note: margins.thin.length ? plural(margins.thin.length, 'line', 'lines') : null, tone: 'text-kt-amber',
      list: () => margins.thin.map((r, i) => <Row key={i} title={r.name} sub={`${r.invoiceId} · ${formatDateDisp(r.date)} · ${r.customer} · ${r.qty} at ${rs(r.price)}, cost ${rs(r.cost)}`} figure={`${r.marginPct}%`} figureTone="text-kt-amber" />) },
    ...(products ? [
      { key: 'falling', info: 'fallingProducts', label: 'Falling products', count: products.falling.length, note: products.falling.length ? `${plural(products.falling.length, 'product', 'products')} ${vsLabel}` : null, tone: 'text-kt-red',
        list: () => products.falling.map(r => <Row key={r.key} title={r.key} sub={`Gross profit ${rs(r.prevProfit)} → ${rs(r.profit)} · sales ${rs(r.prevRevenue)} → ${rs(r.revenue)}`} figure={`− ${rs(-r.change)}`} figureTone="text-kt-red" />) },
      { key: 'rising', info: 'risingProducts', label: 'Rising products', count: products.rising.length, note: products.rising.length ? `${plural(products.rising.length, 'product', 'products')} ${vsLabel}` : null, tone: 'text-kt-green',
        list: () => products.rising.map(r => <Row key={r.key} title={r.key} sub={`Gross profit ${rs(r.prevProfit)} → ${rs(r.profit)} · sales ${rs(r.prevRevenue)} → ${rs(r.revenue)}`} figure={`+ ${rs(r.change)}`} figureTone="text-kt-green" />) },
      { key: 'fallingBrands', info: 'fallingBrands', label: 'Falling brands', count: brands.falling.length, note: brands.falling.length ? `${plural(brands.falling.length, 'brand', 'brands')} ${vsLabel}` : null, tone: 'text-kt-red',
        list: () => brands.falling.map(r => <Row key={r.key} title={r.key} sub={`Gross profit ${rs(r.prevProfit)} → ${rs(r.profit)} · sales ${rs(r.prevRevenue)} → ${rs(r.revenue)}`} figure={`− ${rs(-r.change)}`} figureTone="text-kt-red" />) },
    ] : []),
  ];
  const current = lines.find(l => l.key === open);

  return (
    <section data-attention="1" className="bg-white rounded-xl border border-kt-line">
      <h3 className="px-4 pt-3 pb-1 text-sm font-medium text-kt-ink">Needs attention</h3>
      <ul className="divide-y divide-kt-line">
        {lines.map(l => (
          <li key={l.key} className="flex items-center">
            <button type="button" disabled={!l.count} onClick={() => setOpen(l.key)} data-attention-line={l.key}
              className="flex-1 min-w-0 min-h-11 pl-4 pr-2 py-2 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 text-left enabled:hover:bg-kt-raised disabled:cursor-default">
              <span className="text-sm text-kt-ink">{l.label}</span>
              <span className={`text-xs sm:text-sm tabular-nums sm:text-right ${l.count ? l.tone : 'text-kt-muted'}`}>{l.note || 'None'}</span>
            </button>
            <span className="pr-3 pl-1 flex items-center gap-1"><InfoTip k={l.info} align="right" />{l.count ? <ChevronRight size={16} strokeWidth={1.5} className="text-kt-muted" aria-hidden="true" /> : <span className="w-4" />}</span>
          </li>
        ))}
      </ul>
      {!products && <p className="px-4 pb-3 pt-1 text-xs text-kt-sub">Rising and falling products need a period to compare with: pick This Month, This Week, This Year or a custom range.</p>}
      {current && (
        <ModalWrapper title={current.label} onClose={() => setOpen(null)} maxWidth="max-w-2xl">
          <p className="text-sm text-kt-sub mb-3">{current.note}</p>
          <div className="space-y-2">{current.list()}</div>
        </ModalWrapper>
      )}
    </section>
  );
};
