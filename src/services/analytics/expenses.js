// Where the money goes.
//
// Analytics had one thing on expenses: a bar list by category on the Insights page. No
// trend, no comparison to the period before, and no way to reach the expenses themselves —
// so "operational expenses are up Rs 40,000" was a dead end rather than a question with an
// answer.
//
// Categories carry a `group` (Transportation, Salaries, and so on) on the expenseCategories
// collection. Grouping is joined by category NAME because that is what an expense record
// stores; a category with no matching record is reported as Ungrouped rather than dropped.
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const UNCATEGORISED = 'Uncategorised';
export const UNGROUPED = 'Ungrouped';

const tally = (map, key, amount) => {
  if (!map[key]) map[key] = { key, amount: 0, count: 0 };
  map[key].amount += amount;
  map[key].count += 1;
};

const sorted = (map) => Object.values(map).sort((a, b) => b.amount - a.amount);

export const buildExpenses = ({
  expenses = [], expenseCategories = [],
  checkCustomFilter = () => true,
  prevPeriod = null,
  trendMonths = 12,
} = {}) => {
  const groupOf = {};
  expenseCategories.forEach(c => { groupOf[c.name] = c.group || UNGROUPED; });

  const rows = expenses
    .filter(e => checkCustomFilter(e.date))
    .map(e => ({
      id: e.id, date: e.date,
      category: e.category || UNCATEGORISED,
      group: groupOf[e.category] || UNGROUPED,
      amount: num(e.amount),
      note: e.note || e.description || '',
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

  const byCategory = {}, byGroup = {}, byMonthMap = {};
  let total = 0;
  rows.forEach(r => {
    total += r.amount;
    tally(byCategory, r.category, r.amount);
    tally(byGroup, r.group, r.amount);
    const m = String(r.date || '').slice(0, 7);
    if (m.length === 7) tally(byMonthMap, m, r.amount);
  });

  // The comparison. Same window length, ending one window ago — periods.js decides that, so
  // this and the revenue trend cannot disagree about what "previous period" means.
  const prevByCategory = {};
  let prevTotal = 0;
  if (prevPeriod?.start && prevPeriod?.end) {
    expenses
      .filter(e => e.date >= prevPeriod.start && e.date <= prevPeriod.end)
      .forEach(e => {
        const amt = num(e.amount);
        prevTotal += amt;
        tally(prevByCategory, e.category || UNCATEGORISED, amt);
      });
  }

  const changePct = (now, before) =>
    before > 0 ? +(((now - before) / before) * 100).toFixed(1) : null;

  return {
    rows,
    totals: {
      amount: total, count: rows.length,
      prevAmount: prevTotal,
      changePct: prevPeriod ? changePct(total, prevTotal) : null,
    },
    // Each category carries what it was last period and by how much it moved, because "up
    // 40%" is the finding and the absolute figure alone hides it.
    byCategory: sorted(byCategory).map(c => ({
      ...c,
      prevAmount: prevByCategory[c.key]?.amount || 0,
      changePct: prevPeriod ? changePct(c.amount, prevByCategory[c.key]?.amount || 0) : null,
    })),
    byGroup: sorted(byGroup),
    // Trend ignores the period filter on purpose — a month-by-month line confined to one
    // month is a single point. Every screen that draws it says so.
    byMonth: (() => {
      const all = {};
      expenses.forEach(e => {
        const m = String(e.date || '').slice(0, 7);
        if (m.length === 7) tally(all, m, num(e.amount));
      });
      return Object.values(all).sort((a, b) => a.key.localeCompare(b.key)).slice(-trendMonths);
    })(),
  };
};
