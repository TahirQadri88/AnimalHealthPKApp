import { describe, it, expect } from 'vitest';
import { buildExpenses, UNCATEGORISED, UNGROUPED } from './expenses';

const CATS = [
  { id: 1, name: 'Petrol', group: 'Transportation' },
  { id: 2, name: 'Bike Ride', group: 'Transportation' },
  { id: 3, name: 'Staff Salary', group: 'Salaries' },
];
const e = (id, date, category, amount, over = {}) => ({ id, date, category, amount, ...over });

const EXPENSES = [
  e(1, '2026-08-02', 'Petrol', 5000),
  e(2, '2026-08-10', 'Petrol', 3000),
  e(3, '2026-08-11', 'Staff Salary', 40000),
  e(4, '2026-08-12', 'Chai', 800),          // no matching category record
  e(5, '2026-07-05', 'Petrol', 2000),       // previous period
  e(6, '2026-07-06', 'Staff Salary', 40000),
];

const run = (over = {}) => buildExpenses({
  expenses: EXPENSES, expenseCategories: CATS,
  checkCustomFilter: (d) => d >= '2026-08-01' && d <= '2026-08-31',
  prevPeriod: { start: '2026-07-01', end: '2026-07-31' },
  ...over,
});

describe('buildExpenses — the headline', () => {
  it('totals the period', () => {
    expect(run().totals.amount).toBe(48800);
    expect(run().totals.count).toBe(4);
  });

  it('compares to the period before', () => {
    const t = run().totals;
    expect(t.prevAmount).toBe(42000);
    expect(t.changePct).toBe(16.2);
  });

  it('reports no change rather than Infinity when the previous period was empty', () => {
    expect(run({ prevPeriod: { start: '2026-01-01', end: '2026-01-31' } }).totals.changePct).toBeNull();
  });

  it('withholds the comparison entirely when no previous period is given', () => {
    expect(run({ prevPeriod: null }).totals.changePct).toBeNull();
  });

  it('is all zeroes on a business with no expenses', () => {
    expect(buildExpenses().totals).toMatchObject({ amount: 0, count: 0 });
  });

  it('does not produce NaN from an expense with a missing amount', () => {
    const t = run({ expenses: [...EXPENSES, e(9, '2026-08-13', 'Petrol', undefined)] }).totals;
    expect(Number.isNaN(t.amount)).toBe(false);
    expect(t.amount).toBe(48800);
  });
});

describe('buildExpenses — the breakdowns', () => {
  it('splits by category, biggest first, each with its own movement', () => {
    const c = run().byCategory;
    expect(c[0]).toMatchObject({ key: 'Staff Salary', amount: 40000, prevAmount: 40000, changePct: 0 });
    expect(c.find(x => x.key === 'Petrol')).toMatchObject({ amount: 8000, prevAmount: 2000, changePct: 300 });
  });

  it('rolls categories up into their group', () => {
    const g = Object.fromEntries(run().byGroup.map(x => [x.key, x.amount]));
    expect(g.Salaries).toBe(40000);
    expect(g.Transportation).toBe(8000);
    // A category with no record is named, not dropped.
    expect(g[UNGROUPED]).toBe(800);
  });

  it('names an expense with no category rather than losing it', () => {
    const r = run({ expenses: [e(9, '2026-08-14', undefined, 250)] });
    expect(r.byCategory[0].key).toBe(UNCATEGORISED);
    expect(r.totals.amount).toBe(250);
  });

  it('trends by month across all time, not just the selected period', () => {
    expect(run().byMonth.map(m => [m.key, m.amount]))
      .toEqual([['2026-07', 42000], ['2026-08', 48800]]);
  });

  it('keeps only the months asked for', () => {
    expect(run({ trendMonths: 1 }).byMonth.map(m => m.key)).toEqual(['2026-08']);
  });

  it('lists every expense in the period, newest first', () => {
    expect(run().rows.map(r => r.id)).toEqual([4, 3, 2, 1]);
    expect(run().rows[0]).toMatchObject({ category: 'Chai', group: UNGROUPED, amount: 800 });
  });
});
