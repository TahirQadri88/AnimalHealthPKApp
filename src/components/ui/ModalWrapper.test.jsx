// The first render test of a component extracted from App.jsx.
//
// It cannot be written before the move — a component still inside App.jsx is unreachable
// from a test, because App.jsx imports src/firebase.js, which initialises Auth at import
// time and throws without credentials. The proof that the move itself changed nothing is
// `node tools/extraction-diff.mjs ModalWrapper src/components/ui/ModalWrapper.jsx`, which
// compares the source against the previous commit. This file is the net from here on.
//
// useEffect does not run under SSR, so the focus trap and the scroll lock are not
// exercised here; the markup and the props contract are.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModalWrapper, FOCUSABLE } from './ModalWrapper';

const render = (props = {}) => renderToStaticMarkup(
  <ModalWrapper title="Edit Team Member" onClose={() => {}} {...props}>
    <p>body</p>
  </ModalWrapper>
);

describe('ModalWrapper', () => {
  it('renders its title and its children', () => {
    const html = render();
    expect(html).toContain('Edit Team Member');
    expect(html).toContain('<p>body</p>');
  });

  it('defaults to max-w-lg and honours an override', () => {
    expect(render()).toContain('max-w-lg');
    expect(render({ maxWidth: 'max-w-3xl' })).toContain('max-w-3xl');
    expect(render({ maxWidth: 'max-w-3xl' })).not.toContain('max-w-lg');
  });

  it('is a modal layer above the app, not a panel in the flow', () => {
    expect(render()).toContain('fixed inset-0');
    expect(render()).toContain('z-[60]');
  });

  it('leaks no undefined into the markup', () => {
    expect(render()).not.toMatch(/undefined|NaN/);
  });

  it('does not call onClose while merely rendering', () => {
    const onClose = vi.fn();
    render({ onClose });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// The selector the focus trap depends on. It is exported, so it is part of the contract.
describe('FOCUSABLE', () => {
  it('covers the controls a form modal actually contains', () => {
    ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]'].forEach(bit => {
      expect(FOCUSABLE).toContain(bit);
    });
  });

  it('excludes disabled controls and tabindex="-1"', () => {
    expect(FOCUSABLE).toContain(':not([disabled])');
    expect(FOCUSABLE).toContain(':not([tabindex="-1"])');
  });
});
