import { describe, it, expect } from 'vitest';
import { parseRgb, luminance, isBlockBackground, YELLOW } from './printTheme';

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

// Every dark slab in every document type must be caught, and nothing else may be.
describe('isBlockBackground', () => {
  // The brand blocks are yellow now and are found by their data-dk attribute instead.
  // What is left for this test is the two coloured status bars, which stay dark.
  it('catches the coloured status bars, which print as bars', () => {
    expect(isBlockBackground('rgb(124, 58, 237)')).toBe(true);  // #7c3aed estimate notice
    expect(isBlockBackground('rgb(225, 29, 72)')).toBe(true);   // #e11d48 credit note
    expect(isBlockBackground('rgb(0, 0, 0)')).toBe(true);
  });

  it('does NOT catch a yellow block — that is why every block carries data-dk', () => {
    expect(isBlockBackground('rgb(255, 242, 0)')).toBe(false);
  });

  it('leaves the page and its light panels alone', () => {
    expect(isBlockBackground('rgb(255, 255, 255)')).toBe(false);
    expect(isBlockBackground('rgb(248, 250, 252)')).toBe(false);  // #f8fafc customer card
    expect(isBlockBackground('rgb(241, 245, 249)')).toBe(false);  // #f1f5f9
    expect(isBlockBackground('rgb(236, 253, 245)')).toBe(false);  // #ecfdf5 bonus savings
    expect(isBlockBackground('rgb(240, 249, 255)')).toBe(false);  // #f0f9ff report filters
  });

  it('does not treat an unpainted element as a block', () => {
    expect(isBlockBackground('rgba(0, 0, 0, 0)')).toBe(false);
    expect(isBlockBackground('')).toBe(false);
  });
});

describe('the block palette', () => {
  it('fills with the brand yellow and writes in black', () => {
    expect(YELLOW.fill).toBe('#FFF200');
    expect(YELLOW.ink).toBe('#000000');
  });

  it('keeps every ink dark enough to read on that yellow', () => {
    const l = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return luminance({ r: n >> 16, g: (n >> 8) & 255, b: n & 255 });
    };
    [YELLOW.ink, YELLOW.inkMuted, YELLOW.edge].forEach(c => {
      expect(l(YELLOW.fill) - l(c)).toBeGreaterThan(0.5);
    });
  });
});
