import { describe, it, expect } from 'vitest';
import { currentWindow, comparisonWindow, windowLabel } from './periods';

const cmp = (f, today, s, e) => comparisonWindow(f, s, e, today);

describe('like-for-like comparison windows', () => {
  it('This Month: the 1st to the same day of last month (the -89% case)', () => {
    // 14 Nov used to be compared with a 30-day window, 16 Sep to 15 Oct.
    expect(cmp('This Month', '2026-11-14')).toEqual({ start: '2026-10-01', end: '2026-10-14' });
    expect(currentWindow('This Month', '', '', '2026-11-14')).toEqual({ start: '2026-11-01', end: '2026-11-14' });
  });
  it('This Month clamps to a shorter month, and crosses the year in January', () => {
    expect(cmp('This Month', '2026-10-31')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(cmp('This Month', '2026-03-31')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(cmp('This Month', '2028-03-30')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(cmp('This Month', '2027-01-09')).toEqual({ start: '2026-12-01', end: '2026-12-09' });
  });
  it('Today: the same weekday last week', () => {
    expect(cmp('Today', '2026-11-14')).toEqual({ start: '2026-11-07', end: '2026-11-07' });
  });
  it('This Week: Sunday to today against the same days last week', () => {
    // 14 Nov 2026 is a Saturday; the week started Sunday 8 Nov.
    expect(currentWindow('This Week', '', '', '2026-11-14')).toEqual({ start: '2026-11-08', end: '2026-11-14' });
    expect(cmp('This Week', '2026-11-14')).toEqual({ start: '2026-11-01', end: '2026-11-07' });
  });
  it('This Year: the same days last year, 29 Feb becoming 28 Feb', () => {
    expect(cmp('This Year', '2026-11-14')).toEqual({ start: '2025-01-01', end: '2025-11-14' });
    expect(cmp('This Year', '2028-02-29')).toEqual({ start: '2027-01-01', end: '2027-02-28' });
  });
  it('Custom: the same number of days just before; nothing for an open or empty range', () => {
    expect(cmp('Custom', '2026-11-14', '2026-11-01', '2026-11-10')).toEqual({ start: '2026-10-22', end: '2026-10-31' });
    expect(cmp('Custom', '2026-11-14', '', '2026-11-10')).toBeNull();
  });
  it('All Time compares with nothing', () => {
    expect(cmp('All Time', '2026-11-14')).toBeNull();
    expect(currentWindow('All Time', '', '', '2026-11-14')).toBeNull();
  });
});

describe('windowLabel', () => {
  it('says what was compared, short', () => {
    expect(windowLabel({ start: '2026-10-01', end: '2026-10-14' }, '2026-11-14')).toBe('1–14 Oct');
    expect(windowLabel({ start: '2026-10-28', end: '2026-11-03' }, '2026-11-14')).toBe('28 Oct–3 Nov');
    expect(windowLabel({ start: '2026-11-07', end: '2026-11-07' }, '2026-11-14')).toBe('7 Nov');
    expect(windowLabel({ start: '2025-01-01', end: '2025-11-14' }, '2026-11-14')).toBe('1 Jan–14 Nov 2025');
    expect(windowLabel(null)).toBe('');
  });
});
