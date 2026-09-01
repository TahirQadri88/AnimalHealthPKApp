// Purity of the move: node tools/extraction-diff.mjs MultiPicker src/components/ui/MultiPicker.jsx
//
// The dropdown is rendered through createPortal into document.body and only when open, so
// SSR sees the closed button and nothing else. That is the whole of the first paint, and
// it is what these lock: the Analytics filter bar renders three of these on every visit.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Filter } from 'lucide-react';
import { MultiPicker } from './MultiPicker';

const ITEMS = [{ id: 1, name: 'Al Shaheer' }, { id: 2, name: 'Ghousia Farms' }, { id: 3, name: 'Karachi Vet' }];
const render = (selected = new Set(), items = ITEMS) => renderToStaticMarkup(
  <MultiPicker label="Client" Icon={Filter} items={items} selected={selected}
    onToggle={() => {}} onClear={() => {}} />
);

describe('MultiPicker', () => {
  it('shows its label when nothing is picked', () => {
    expect(render()).toContain('Client');
  });

  // It counts, it does not name — "Client (1)", never "Ghousia Farms". Worth pinning:
  // three of these sit in the Analytics filter bar and a name would blow the row's width.
  it('counts the selection beside the label', () => {
    expect(render(new Set(['2']))).toContain('Client (1)');
    expect(render(new Set(['1', '2']))).toContain('Client (2)');
    expect(render(new Set(['2']))).not.toContain('Ghousia Farms');
  });

  it('drops the count entirely when nothing is picked', () => {
    expect(render()).not.toContain('(0)');
  });

  it('goes solid once something is picked, so an active filter is visible', () => {
    expect(render(new Set(['1']))).toContain('bg-indigo-600');
    expect(render()).not.toContain('bg-indigo-600');
  });

  it('starts closed — the list is portalled and only exists while open', () => {
    const html = render();
    expect(html).not.toContain('Al Shaheer');
    expect(html).not.toContain('Karachi Vet');
  });

  it('survives an empty item list', () => {
    expect(() => render(new Set(), [])).not.toThrow();
    expect(render(new Set(), [])).toContain('Client');
  });

  it('leaks no undefined into the markup', () => {
    expect(render(new Set(['1']))).not.toMatch(/undefined|NaN/);
  });
});
