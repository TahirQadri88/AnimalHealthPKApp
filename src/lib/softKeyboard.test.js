import { describe, it, expect } from 'vitest';
import { keyboardInset, softKeyboardOpen } from './softKeyboard';

const win = ({ inner = 800, vh = 800, top = 0, coarse = true, screen = 800, vv = true } = {}) => ({
  innerHeight: inner, screen: { height: screen },
  visualViewport: vv ? { height: vh, offsetTop: top } : undefined,
  matchMedia: () => ({ matches: coarse }),
});
const doc = (tag = 'INPUT', type = 'text') => ({ activeElement: { tagName: tag, type } });

describe('soft keyboard', () => {
  it('iOS: the visual viewport shrinks under the keyboard', () => {
    expect(keyboardInset(win({ vh: 450 }))).toBe(350);
    expect(softKeyboardOpen(win({ vh: 450 }), doc())).toBe(true);
  });
  it('Android: the page itself shrinks while a field has focus', () => {
    expect(softKeyboardOpen(win({ inner: 420, vh: 420, screen: 800 }), doc())).toBe(true);
    expect(softKeyboardOpen(win({ inner: 420, vh: 420, screen: 800 }), doc('INPUT', 'checkbox'))).toBe(false);
  });
  it('never on a desktop, and never without the signals', () => {
    expect(softKeyboardOpen(win({ vh: 300, coarse: false }), doc())).toBe(false);
    expect(keyboardInset(win({ vv: false }))).toBe(0);
    expect(softKeyboardOpen(win({ vv: false }), doc('BODY'))).toBe(false);
    expect(softKeyboardOpen(undefined, undefined)).toBe(false);
  });
});
