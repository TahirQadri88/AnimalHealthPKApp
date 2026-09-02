// Purity of the move: node tools/extraction-diff.mjs ExpenseCategoryModal src/components/modals/ExpenseCategoryModal.jsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { ExpenseCategoryModal } from './ExpenseCategoryModal';

const CATS = [
  { id: 1, name: 'Transport', group: 'Transportation' },
  { id: 2, name: 'Staff Food/Tea', group: 'Salary' },
];
const render = (over = {}) => renderToStaticMarkup(
  <AppContext.Provider value={{
    expenseCategories: CATS, saveToFirebase: () => {}, deleteFromFirebase: () => {},
    showToast: () => {}, showConfirm: () => {}, setShowExpenseCatModal: () => {}, ...over,
  }}>
    <ExpenseCategoryModal />
  </AppContext.Provider>
);

describe('ExpenseCategoryModal', () => {
  it('lists the categories under their groups', () => {
    const html = render();
    expect(html).toContain('Transport');
    expect(html).toContain('Staff Food/Tea');
    expect(html).toContain('Transportation');
    expect(html).toContain('Salary');
  });

  it('offers every group, including ones with no categories yet', () => {
    const html = render();
    ['Transportation', 'Salary', 'Utilities', 'Office', 'Other'].forEach(g => expect(html).toContain(g));
  });

  it('says so when nothing has been set up', () => {
    expect(render({ expenseCategories: [] })).toContain('No categories');
  });

  it('survives a category whose group is not one of the five', () => {
    expect(() => render({ expenseCategories: [{ id: 9, name: 'Odd', group: 'Legacy' }] })).not.toThrow();
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
