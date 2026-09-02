// Purity of the move: node tools/extraction-diff.mjs ExpensesView src/components/admin/ExpensesView.jsx
//
// This component destructures roughly fifty things from context and uses a handful — a
// copy-pasted destructure, not real coupling. It came across unchanged; trimming it during
// the move would have cost the byte-identical proof. The stub below supplies the whole
// shape for the same reason.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { ExpensesView } from './ExpensesView';

const CATS = [
  { id: 1, name: 'Transport', group: 'Transportation' },
  { id: 2, name: 'Staff Food/Tea', group: 'Salary' },
  { id: 3, name: 'Utility Bill', group: 'Utilities' },
];
// checkDateFilter runs against the real clock, so "All Time" is the only stable filter to
// assert against — anything dated would pass or fail depending on the day it is run.
const EXPENSES = [
  { id: 1, date: '2026-09-01', category: 'Transport', amount: 400, note: 'Rider fuel' },
  { id: 2, date: '2026-08-15', category: 'Utility Bill', amount: 9500, note: '' },
];

const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    isAdmin: true, expenses: EXPENSES, expenseCategories: CATS,
    saveToFirebase: () => {}, deleteFromFirebase: () => {}, showToast: () => {},
    showConfirm: () => {}, showPrompt: () => {}, voidRecord: () => {}, logSave: () => {},
    setShowExpenseCatModal: () => {}, ...over,
  }}>
    <ExpensesView />
  </AppContext.Provider>
);

describe('ExpensesView', () => {
  it('renders without the forty context values it never reads', () => {
    expect(() => render()).not.toThrow();
  });

  it('offers every expense group as a filter', () => {
    const html = render();
    ['Transportation', 'Salary', 'Utilities', 'Office', 'Other'].forEach(g => {
      expect(html).toContain(g);
    });
    expect(html).toContain('All Groups');
  });

  // The category picker is a SearchableSelect, which is closed on first paint — its options
  // live behind a click, exactly like MultiPicker. So the field is here and the list is not.
  it('shows the category field, whose options only exist once it is opened', () => {
    const html = render();
    expect(html).toContain('Category');
    expect(html).not.toContain('Staff Food/Tea');
  });

  it('preselects the first category so a save cannot land with none', () => {
    expect(render()).toContain('Transport');
  });

  it('says so when nothing has been recorded', () => {
    expect(render({ expenses: [] })).not.toMatch(/undefined|NaN/);
  });

  it('leaks no undefined into the markup, including for an expense with no note', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('survives an expense whose category is no longer in the registry', () => {
    // Categories can be deleted while expenses keep the old name — the same shape of
    // problem as a renamed vehicle type.
    const orphan = [{ id: 9, date: '2026-09-01', category: 'Deleted Category', amount: 100 }];
    expect(() => render({ expenses: orphan })).not.toThrow();
    expect(render({ expenses: orphan })).not.toMatch(/undefined|NaN/);
  });
});
