import { describe, it, expect } from 'vitest';
import { parseRgb, luminance, isBlockBackground, blockTextColor, YELLOW } from './printTheme';

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
  it('catches the blocks the documents actually use', () => {
    expect(isBlockBackground('rgb(15, 23, 42)')).toBe(true);   // #0f172a masthead, pill, net balance
    expect(isBlockBackground('rgb(30, 41, 59)')).toBe(true);   // #1e293b table header, policy strip
    expect(isBlockBackground('rgb(0, 0, 0)')).toBe(true);
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

describe('blockTextColor', () => {
  it('turns the yellow lettering black — that is the whole point', () => {
    expect(blockTextColor('rgb(255, 242, 0)')).toBe(YELLOW.ink);
  });

  it('turns white lettering black too', () => {
    expect(blockTextColor('rgb(255, 255, 255)')).toBe(YELLOW.ink);
  });

  it('keeps secondary text a step below the heading it sits under', () => {
    expect(blockTextColor('rgb(148, 163, 184)')).toBe(YELLOW.inkMuted);  // #94a3b8 tagline
    expect(blockTextColor('rgb(203, 213, 225)')).toBe(YELLOW.inkMuted);  // #cbd5e1
  });

  it('falls back to black rather than leaving text unreadable', () => {
    expect(blockTextColor('')).toBe(YELLOW.ink);
    expect(blockTextColor('inherit')).toBe(YELLOW.ink);
  });
});

describe('the result is black on yellow', () => {
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
