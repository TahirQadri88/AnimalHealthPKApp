import { describe, it, expect, beforeAll, vi } from 'vitest';
import { makeArrowNav } from './a11y';

// The handler focuses the element it moved to. Nothing here has a DOM, and the focus call
// is not the behaviour under test — the index arithmetic is.
beforeAll(() => { globalThis.document = { querySelector: () => null }; });

const TABS = ['analytics', 'expenses', 'masters', 'bulk'];
const press = (key, current, items = TABS) => {
  const set = vi.fn();
  const e = { key, preventDefault: vi.fn() };
  makeArrowNav(items, current, set, 'data-admintab')(e);
  return { set, e };
};

describe('makeArrowNav', () => {
  it('steps forward and back', () => {
    expect(press('ArrowRight', 'analytics').set).toHaveBeenCalledWith('expenses');
    expect(press('ArrowLeft', 'masters').set).toHaveBeenCalledWith('expenses');
    expect(press('ArrowDown', 'analytics').set).toHaveBeenCalledWith('expenses');
    expect(press('ArrowUp', 'expenses').set).toHaveBeenCalledWith('analytics');
  });

  it('wraps at both ends rather than stopping', () => {
    expect(press('ArrowRight', 'bulk').set).toHaveBeenCalledWith('analytics');
    expect(press('ArrowLeft', 'analytics').set).toHaveBeenCalledWith('bulk');
  });

  it('Home and End jump to the ends', () => {
    expect(press('Home', 'masters').set).toHaveBeenCalledWith('analytics');
    expect(press('End', 'analytics').set).toHaveBeenCalledWith('bulk');
  });

  it('ignores every other key, and does not swallow it', () => {
    const { set, e } = press('Enter', 'analytics');
    expect(set).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('claims the keys it does handle', () => {
    expect(press('ArrowRight', 'analytics').e.preventDefault).toHaveBeenCalled();
  });

  // An unknown current lands at index -1; the arithmetic must still produce a real item.
  it('recovers when the current item is not in the list', () => {
    const { set } = press('ArrowRight', 'nonexistent');
    expect(TABS).toContain(set.mock.calls[0][0]);
  });
});
