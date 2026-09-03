// The period immediately before the one on screen.
//
// Lifted verbatim out of reportEngine so the expense comparison uses the same window the
// revenue comparison does. Two definitions of "vs previous period" on one screen is a
// disagreement waiting to be found by a person, not by a test.
//
// The window is the same LENGTH as the selected period, ending that many days before today.
// For a custom range it is the range's own length. This is the behaviour that shipped; it is
// approximate for months of unequal length and deliberately left that way.
import { getPKTDate, getLocalDateStr } from '../../helpers';

export const periodLengthDays = (dateFilter, customStart, customEnd) => {
  if (dateFilter === 'Today') return 1;
  if (dateFilter === 'This Week') return 7;
  if (dateFilter === 'This Year') return 365;
  if (dateFilter === 'Custom' && customStart) {
    const ms = new Date(customEnd) - new Date(customStart);
    return Math.ceil(ms / 86400000) + 1;
  }
  return 30;
};

export const previousPeriod = (dateFilter, customStart, customEnd) => {
  const now = getPKTDate();
  const days = periodLengthDays(dateFilter, customStart, customEnd);
  const end = new Date(now); end.setDate(end.getDate() - days);
  const start = new Date(end); start.setDate(start.getDate() - days);
  return { start: getLocalDateStr(start), end: getLocalDateStr(end) };
};
