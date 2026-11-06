// The billing form's pinned bar: what the bill comes to, and the buttons that save it.
//
// It sits in the form's flex column outside the scrolling area, so it stays on screen without
// sticky or z-index and can never cover a dropdown. Two parts: a navy strip with the figures
// (the app's band colour) and a white row with the buttons.
//
// Phone: the strip is one 44px row (SKUs, units, total) that opens to the full breakdown;
// open/closed is remembered on the device. Desktop: always open. While the on-screen keyboard
// is up the bar shrinks to that one row with a Done button, so the field being typed in stays
// visible above it.
import { ChevronUp } from 'lucide-react';

const rs = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export const InvoiceSummaryBar = ({ summary: s, open, onToggle, compact, onDone, children }) => {
  const counts = (
    <span className="text-sm text-white/80 tabular-nums xl:order-1 xl:whitespace-nowrap">
      <span data-summary="skus">{s.skus}</span> SKU{s.skus === 1 ? '' : 's'}
      {' · '}<span data-summary="units">{s.units}</span> unit{s.units === 1 ? '' : 's'}
      {s.bonusUnits > 0 && <> <span className="text-white/60">(+<span data-summary="bonusUnits">{s.bonusUnits}</span> free)</span></>}
    </span>
  );
  const total = <span data-summary="total" className="font-display text-2xl sm:text-3xl text-kt-yellow leading-none tabular-nums whitespace-nowrap">{rs(s.total)}</span>;
  const rows = [
    ['subtotal', 'Items', rs(s.subtotal)],
    s.delivery > 0 && ['delivery', 'Delivery', `+ ${rs(s.delivery)}`],
    s.discount > 0 && ['discount', 'Discount', `− ${rs(s.discount)}`],
    s.bonusGiven > 0 && ['bonusGiven', 'Bonus given', rs(s.bonusGiven)],
    s.showReceived && ['received', 'Received', rs(s.received)],
    s.showReceived && ['balanceDue', 'Balance due', rs(s.balanceDue)],
    s.accountAfter !== null && ['accountAfter', 'Account after this bill', rs(s.accountAfter)],
  ].filter(Boolean);

  return (
    <div data-summary-bar="1" className="font-ui shrink-0 bg-white border-t border-kt-line">
      {/* From 1280px the figures share one line: counts, breakdown, total. */}
      <div className="bg-kt-band text-white xl:flex xl:items-center xl:gap-6 xl:px-6 xl:py-2.5">
        {compact ? (
          <div className="min-h-11 px-4 flex items-center justify-between gap-3">
            {counts}
            <span className="flex items-center gap-3">{total}
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={onDone} className="h-11 px-3 -mr-2 text-sm font-medium text-white">Done</button>
            </span>
          </div>
        ) : (
          <>
            <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="invoice-summary-detail"
              className="w-full min-h-11 px-4 sm:px-6 py-1.5 sm:py-3 xl:contents flex items-center justify-between gap-3 text-left sm:cursor-default">
              {counts}
              <span className="flex items-center gap-2 xl:order-3 xl:ml-auto">
                <span className="hidden sm:inline text-sm text-white/80">Grand total</span>
                {total}
                <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" className={`sm:hidden text-white/70 transition-transform ${open ? '' : 'rotate-180'}`} />
              </span>
            </button>
            <dl id="invoice-summary-detail" className={`${open ? 'grid' : 'hidden'} sm:flex grid-cols-1 sm:flex-wrap gap-x-6 gap-y-1 px-4 sm:px-6 pb-3 -mt-1 xl:order-2 xl:p-0 xl:m-0 text-sm`}>
              {rows.map(([key, label, value]) => (
                <div key={key} className="flex justify-between sm:justify-start gap-2 min-w-0">
                  <dt className="text-white/70">{label}</dt>
                  <dd data-summary={key} className="text-white tabular-nums whitespace-nowrap">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {!compact && (
        <div className="px-4 sm:px-6 pt-3 space-y-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      )}
    </div>
  );
};
