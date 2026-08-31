import { describe, it, expect } from 'vitest';
import { darkColorFor, parseRgb, DARK } from './printTheme';

describe('parseRgb', () => {
  it('reads the shapes getComputedStyle actually returns', () => {
    expect(parseRgb('rgb(15, 23, 42)')).toEqual({ r: 15, g: 23, b: 42, a: 1 });
    expect(parseRgb('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(parseRgb('rgba(255, 242, 0, 0.5)').a).toBe(0.5);
  });

  it('is null for anything it cannot read, so callers leave the element alone', () => {
    expect(parseRgb('')).toBeNull();
    expect(parseRgb(undefined)).toBeNull();
    expect(parseRgb('none')).toBeNull();
  });
});

describe('darkColorFor — backgrounds', () => {
  it('drops paper white into the page rather than leaving a slab', () => {
    expect(darkColorFor('background', 'rgb(255, 255, 255)')).toBe('transparent');
  });

  it('turns the light cards and zebra rows into a panel', () => {
    expect(darkColorFor('background', 'rgb(248, 250, 252)')).toBe(DARK.panel); // #f8fafc
    expect(darkColorFor('background', 'rgb(241, 245, 249)')).toBe(DARK.panel); // #f1f5f9
    expect(darkColorFor('background', 'rgb(226, 232, 240)')).toBe(DARK.panel); // #e2e8f0
  });

  it('lifts the navy blocks just off the page black', () => {
    expect(darkColorFor('background', 'rgb(15, 23, 42)')).toBe(DARK.block);  // #0f172a
    expect(darkColorFor('background', 'rgb(30, 41, 59)')).toBe(DARK.block);  // #1e293b
  });

  it('leaves a transparent background transparent', () => {
    expect(darkColorFor('background', 'rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('darkColorFor — text', () => {
  it('keeps the brand yellow exactly as it is', () => {
    expect(darkColorFor('text', 'rgb(255, 242, 0)')).toBe(DARK.brand);
  });

  it('turns near-black copy into the soft yellow', () => {
    expect(darkColorFor('text', 'rgb(15, 23, 42)')).toBe(DARK.body);
    expect(darkColorFor('text', 'rgb(51, 65, 85)')).toBe(DARK.body);   // #334155
  });

  it('keeps secondary labels secondary', () => {
    expect(darkColorFor('text', 'rgb(148, 163, 184)')).toBe(DARK.muted); // #94a3b8
    expect(darkColorFor('text', 'rgb(100, 116, 139)')).toBe(DARK.muted); // #64748b
  });

  it('promotes white-on-dark text to the yellow', () => {
    expect(darkColorFor('text', 'rgb(255, 255, 255)')).toBe(DARK.brand);
  });

  // Money that is green or red must not be flattened into the yellow — the colour is the
  // information.
  it('keeps the accounting colours legible instead of yellowing them', () => {
    expect(darkColorFor('text', 'rgb(21, 128, 61)')).toBe(DARK.good);   // payment received
    expect(darkColorFor('text', 'rgb(5, 150, 105)')).toBe(DARK.good);   // #059669
    expect(darkColorFor('text', 'rgb(220, 38, 38)')).toBe(DARK.bad);    // #dc2626
    expect(darkColorFor('text', 'rgb(225, 29, 72)')).toBe(DARK.bad);    // #e11d48 credit note
    expect(darkColorFor('text', 'rgb(29, 78, 216)')).toBe(DARK.info);   // #1d4ed8
  });
});

describe('darkColorFor — borders', () => {
  it('promotes a dark rule to the yellow so it still divides', () => {
    expect(darkColorFor('border', 'rgb(15, 23, 42)')).toBe(DARK.brand);
    expect(darkColorFor('border', 'rgb(30, 41, 59)')).toBe(DARK.brand);
  });

  it('leaves a hairline as a hairline', () => {
    expect(darkColorFor('border', 'rgb(226, 232, 240)')).toBe(DARK.edge);
    expect(darkColorFor('border', 'rgb(203, 213, 225)')).toBe(DARK.edge);
  });

  it('does not paint an edge onto something that had none', () => {
    expect(darkColorFor('border', 'rgba(0, 0, 0, 0)')).toBeNull();
  });
});

describe('the palette itself', () => {
  // A slab the same colour as the page is not a slab. The table header bar disappeared
  // entirely the first time this was tuned too dark.
  it('keeps dark blocks visibly off the page black', () => {
    const v = (hex) => parseInt(hex.slice(1), 16);
    expect(v(DARK.block)).toBeGreaterThan(v('#141414'));
    expect(v(DARK.block)).toBeGreaterThan(v(DARK.panel));
  });

  it('is yellow on black, not black on yellow', () => {
    expect(DARK.page).toBe('#000000');
    expect(DARK.brand).toBe('#FFF200');
    // Every text colour must be lighter than the page it sits on.
    const l = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    };
    [DARK.brand, DARK.body, DARK.muted, DARK.good, DARK.bad, DARK.info].forEach(c => {
      expect(l(c)).toBeGreaterThan(l(DARK.block) + 0.3);
    });
  });
});
