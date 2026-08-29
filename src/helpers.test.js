import { describe, it, expect, vi, afterEach } from 'vitest';
import { getPKTDate, getLocalDateStr, formatDateDisp, checkDateFilter } from './helpers';

// The business runs on Karachi time. These tests pin the clock so they mean the same thing
// wherever they run — otherwise they would pass in Karachi and fail in CI, which is worse
// than having no tests at all.
const atUtc = (iso) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => vi.useRealTimers());

describe('getPKTDate', () => {
  it('shifts UTC to Karachi (+5)', () => {
    const pkt = getPKTDate(new Date('2026-08-28T10:00:00Z'));
    expect(pkt.getHours()).toBe(15);
  });

  it('rolls into the next day late in the UTC evening', () => {
    // 21:00 UTC on the 28th is 02:00 on the 29th in Karachi — the case that makes an
    // invoice raised late at night land on the wrong day if PKT is not applied.
    const pkt = getPKTDate(new Date('2026-08-28T21:00:00Z'));
    expect(pkt.getDate()).toBe(29);
    expect(pkt.getHours()).toBe(2);
  });
});

describe('getLocalDateStr', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(getLocalDateStr(new Date('2026-08-28T10:00:00Z'))).toBe('2026-08-28');
  });

  it('uses the Karachi day, not the UTC day', () => {
    expect(getLocalDateStr(new Date('2026-08-28T21:00:00Z'))).toBe('2026-08-29');
  });

  it('pads single-digit months and days', () => {
    expect(getLocalDateStr(new Date('2026-01-05T06:00:00Z'))).toBe('2026-01-05');
  });
});

describe('formatDateDisp', () => {
  it('renders the display format used on documents', () => {
    expect(formatDateDisp('2026-08-28')).toBe('28-Aug-26');
  });

  it('passes through anything that is not a date', () => {
    expect(formatDateDisp('')).toBe('');
    expect(formatDateDisp(undefined)).toBe('');
    expect(formatDateDisp('not-a-date')).toBe('not-a-date');
  });
});

describe('checkDateFilter', () => {
  it('All Time accepts everything', () => {
    atUtc('2026-08-28T10:00:00Z');
    expect(checkDateFilter('2019-01-01', 'All Time')).toBe(true);
  });

  it('Today matches only the Karachi today', () => {
    atUtc('2026-08-28T10:00:00Z');
    expect(checkDateFilter('2026-08-28', 'Today')).toBe(true);
    expect(checkDateFilter('2026-08-27', 'Today')).toBe(false);
  });

  it('Today follows Karachi past UTC midnight', () => {
    // 20:00 UTC = 01:00 on the 29th in Karachi, so the 29th is "today" and the 28th is not.
    atUtc('2026-08-28T20:00:00Z');
    expect(checkDateFilter('2026-08-29', 'Today')).toBe(true);
    expect(checkDateFilter('2026-08-28', 'Today')).toBe(false);
  });

  it('This Month matches month and year', () => {
    atUtc('2026-08-28T10:00:00Z');
    expect(checkDateFilter('2026-08-01', 'This Month')).toBe(true);
    expect(checkDateFilter('2026-07-31', 'This Month')).toBe(false);
    expect(checkDateFilter('2025-08-15', 'This Month')).toBe(false);
  });

  it('This Year matches the year', () => {
    atUtc('2026-08-28T10:00:00Z');
    expect(checkDateFilter('2026-01-01', 'This Year')).toBe(true);
    expect(checkDateFilter('2025-12-31', 'This Year')).toBe(false);
  });

  it('This Week runs from Sunday', () => {
    atUtc('2026-08-28T10:00:00Z'); // a Friday
    expect(checkDateFilter('2026-08-23', 'This Week')).toBe(true);  // that Sunday
    expect(checkDateFilter('2026-08-22', 'This Week')).toBe(false); // the Saturday before
  });

  it('keeps malformed dates rather than hiding them', () => {
    atUtc('2026-08-28T10:00:00Z');
    expect(checkDateFilter('garbage', 'Today')).toBe(true);
  });

  // Documents current behaviour rather than endorsing it: a future-dated document inside
  // the current month passes "This Month". Worth knowing before trusting month totals.
  it('This Month includes future dates in the same month', () => {
    atUtc('2026-08-10T10:00:00Z');
    expect(checkDateFilter('2026-08-28', 'This Month')).toBe(true);
  });
});
