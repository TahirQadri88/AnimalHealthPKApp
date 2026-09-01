// Purity of the move: node tools/extraction-diff.mjs ScrollableTabBar src/components/ui/ScrollableTabBar.jsx
//
// The arrows are driven by scroll measurements taken in an effect, and effects do not run
// under SSR — so both arrows render in their hidden state here. That is the correct
// first-paint state and is worth locking: an arrow that starts visible would flicker on
// every tab bar in the app.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollableTabBar } from './ScrollableTabBar';

const render = (props = {}) => renderToStaticMarkup(
  <ScrollableTabBar {...props}>
    <button data-admintab="analytics">Analytics</button>
    <button data-admintab="expenses">Expenses</button>
  </ScrollableTabBar>
);

describe('ScrollableTabBar', () => {
  it('renders its tabs', () => {
    const html = render();
    expect(html).toContain('Analytics');
    expect(html).toContain('Expenses');
  });

  it('starts with both arrows hidden and out of the tab order', () => {
    const html = render();
    expect(html.match(/opacity-0 pointer-events-none/g)).toHaveLength(2);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it('labels the arrows for screen readers', () => {
    expect(render()).toContain('aria-label="Scroll tabs left"');
    expect(render()).toContain('aria-label="Scroll tabs right"');
  });

  it('scrolls the strip rather than wrapping it', () => {
    expect(render()).toContain('overflow-x-auto');
  });

  it('takes the surrounding background so the arrows do not sit on white', () => {
    expect(render({ bgClass: 'bg-slate-200' })).toContain('bg-slate-200');
    expect(render()).toContain('bg-white');   // the default
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });
});
