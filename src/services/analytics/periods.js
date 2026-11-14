// Which dates a period covers, and the like-for-like window it is compared with.
//
// The comparison used to be a window of the same LENGTH ending that many days before today:
// 30 days for "This Month" whatever the date. On 14 November that compared fourteen days of
// sales with thirty, ending in mid-October, and the screen read "Revenue -89.6%" on an
// ordinary month. Every period is now compared with the same stretch of the one before:
//   Today       the same weekday last week (a Monday is compared with a Monday)
//   This Week   Sunday to today, against the same days last week
//   This Month  the 1st to today, against the 1st to the same day of last month
//               (clamped: 31 Oct is compared with 1-30 Sep)
//   This Year   1 Jan to today, against the same days last year (29 Feb -> 28 Feb)
//   Custom      the range of the same length just before it
//   All Time    nothing to compare with
// Shared by the revenue/profit trend and the expense comparison, so "vs previous period"
// cannot mean two things on one screen.
import { getLocalDateStr } from '../../helpers';

const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmt = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => { const dt = parse(s); dt.setUTCDate(dt.getUTCDate() + n); return fmt(dt); };
const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** The dates the selected period covers, as the screen's own filter counts them, or null for All Time. */
export const currentWindow = (dateFilter, customStart, customEnd, today = getLocalDateStr()) => {
  const t = parse(today);
  if (dateFilter === 'Today') return { start: today, end: today };
  if (dateFilter === 'This Week') return { start: addDays(today, -t.getUTCDay()), end: today };
  if (dateFilter === 'This Month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (dateFilter === 'This Year') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (dateFilter === 'Custom' && customStart && customEnd) return { start: customStart, end: customEnd };
  return null;
};

/** The like-for-like window before it, or null when there is nothing fair to compare with. */
export const comparisonWindow = (dateFilter, customStart, customEnd, today = getLocalDateStr()) => {
  const cur = currentWindow(dateFilter, customStart, customEnd, today);
  if (!cur) return null;
  if (dateFilter === 'Today' || dateFilter === 'This Week') return { start: addDays(cur.start, -7), end: addDays(cur.end, -7) };
  if (dateFilter === 'This Month') {
    const t = parse(today);
    const y = t.getUTCMonth() === 0 ? t.getUTCFullYear() - 1 : t.getUTCFullYear();
    const m0 = (t.getUTCMonth() + 11) % 12;
    const day = Math.min(t.getUTCDate(), daysInMonth(y, m0));
    const mm = String(m0 + 1).padStart(2, '0');
    return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(day).padStart(2, '0')}` };
  }
  if (dateFilter === 'This Year') {
    const t = parse(today);
    const y = t.getUTCFullYear() - 1;
    const m0 = t.getUTCMonth();
    const day = Math.min(t.getUTCDate(), daysInMonth(y, m0));
    return { start: `${y}-01-01`, end: `${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }
  // Custom: the same number of days, ending the day before the range starts.
  const len = Math.round((parse(cur.end) - parse(cur.start)) / 86400000) + 1;
  if (!(len > 0)) return null;
  return { start: addDays(cur.start, -len), end: addDays(cur.start, -1) };
};

// Kept under its old name for the callers that use it.
export const previousPeriod = comparisonWindow;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "1–14 Oct", "28 Oct–3 Nov", "7 Nov", "1 Jan–14 Nov 2025": what a card says it compared with. */
export const windowLabel = (w, today = getLocalDateStr()) => {
  if (!w) return '';
  const a = parse(w.start), b = parse(w.end);
  const d = (x) => x.getUTCDate(), mon = (x) => MON[x.getUTCMonth()];
  const yr = b.getUTCFullYear() !== parse(today).getUTCFullYear() ? ` ${b.getUTCFullYear()}` : '';
  if (w.start === w.end) return `${d(a)} ${mon(a)}${yr}`;
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) return `${d(a)}–${d(b)} ${mon(b)}${yr}`;
  return `${d(a)} ${mon(a)}–${d(b)} ${mon(b)}${yr}`;
};
