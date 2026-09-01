// Purity of the move: node tools/extraction-diff.mjs ConfirmDialog src/components/ui/ConfirmDialog.jsx
//
// First extracted component that reads AppContext, so this is also the pattern for the
// rest: wrap it in a real Provider with a hand-built value. Nothing is mocked — the
// component gets exactly the shape App.jsx hands it.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppContext } from '../../context/AppContext';
import { ConfirmDialog } from './ConfirmDialog';

const render = (confirmDialog) => renderToStaticMarkup(
  <AppContext.Provider value={{ confirmDialog, setConfirmDialog: () => {} }}>
    <ConfirmDialog />
  </AppContext.Provider>
);

describe('ConfirmDialog', () => {
  it('renders nothing when nothing is being confirmed', () => {
    expect(render(null)).toBe('');
  });

  it('shows the question and the two buttons', () => {
    const html = render({ message: 'Delete INV-8457?', resolve: () => {} });
    expect(html).toContain('Delete INV-8457?');
    expect(html).toContain('Cancel');
    expect(html).toContain('Confirm');
  });

  it('has no reason field unless one was asked for', () => {
    expect(render({ message: 'Sure?', resolve: () => {} })).not.toContain('<input');
  });
});

// The prompt variant is what a void goes through, and a void must carry a reason.
describe('ConfirmDialog as a reason prompt', () => {
  const prompt = (over = {}) => render({
    message: 'Void INV-8457?',
    prompt: { label: 'Reason', required: true, placeholder: 'e.g. duplicate entry', ...over },
    resolve: () => {},
  });

  it('offers a labelled field', () => {
    const html = prompt();
    expect(html).toContain('<input');
    expect(html).toContain('Reason');
    expect(html).toContain('e.g. duplicate entry');
  });

  it('starts blocked when a reason is required, because the field starts empty', () => {
    const html = prompt();
    expect(html).toContain('disabled');
    expect(html).toContain('A reason is required');
  });

  it('is not blocked when the reason is optional', () => {
    const html = prompt({ required: false });
    expect(html).not.toContain('A reason is required');
    expect(html).not.toContain('disabled');
  });

  it('takes a custom confirm label', () => {
    expect(prompt({ confirmLabel: 'Void it' })).toContain('Void it');
  });

  it('leaks no undefined into the markup', () => {
    expect(prompt()).not.toMatch(/undefined|NaN/);
  });
});
