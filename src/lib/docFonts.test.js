import { describe, it, expect } from 'vitest';
import { toBase64, faceCss, getDocFontCss, DOC_FONT_STACK } from './docFonts';

describe('embedded document typeface', () => {
  it('encodes bytes to base64 the way btoa would, including past one chunk', () => {
    const bytes = new Uint8Array(70000).map((_, i) => i % 251);
    const expected = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
    expect(toBase64(bytes.buffer)).toBe(expected);
  });

  it('builds a self-contained @font-face rule', () => {
    const css = faceCss(600, 'AAAA');
    expect(css).toContain("font-family:'Poppins'");
    expect(css).toContain('font-weight:600');
    expect(css).toContain('url(data:font/woff2;base64,AAAA)');
  });

  it('claims nothing until the faces are loaded', () => {
    // The shared file only switches to Poppins when this is non-empty, so an empty answer
    // means it keeps the system font instead of naming a face it does not carry.
    expect(getDocFontCss()).toBe('');
    expect(DOC_FONT_STACK).toContain('Poppins');
  });
});
