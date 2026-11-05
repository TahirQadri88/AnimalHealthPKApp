import { describe, it, expect } from 'vitest';
import { buildPdf, pageBreaks } from './pdfFile';

// A real (tiny) JPEG: SOI, JFIF, EOI. The writer only has to embed the bytes; the file's structure is what is tested.
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF, 0xD9]);
const latin = (u8) => Array.from(u8, c => String.fromCharCode(c)).join('');

describe('buildPdf', () => {
  const pdf = buildPdf([
    { jpeg: JPEG, pxW: 2382, pxH: 3000, x: 0, y: 100, w: 595.28, h: 700 },
    { jpeg: JPEG, pxW: 2382, pxH: 1000, x: 0, y: 500, w: 595.28, h: 300 },
  ], { pageW: 595.28, pageH: 841.89 });
  const text = latin(pdf);

  it('is a PDF with the right number of pages', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    expect((text.match(/\/Type \/Page /g) || []).length).toBe(2);
  });

  it('has a cross-reference table whose every offset points at its object', () => {
    const at = Number(text.match(/startxref\n(\d+)/)[1]);
    expect(text.slice(at, at + 4)).toBe('xref');
    const rows = text.slice(at).split('\n').slice(3).filter(r => /^\d{10} 00000 n/.test(r));
    expect(rows.length).toBe(8);   // catalog, pages, 3 per page x 2
    rows.forEach((r, i) => {
      const off = Number(r.slice(0, 10));
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('embeds each image untouched, with its true length', () => {
    expect(text).toContain(`/Length ${JPEG.length} >>`);
    expect(text).toContain(latin(JPEG));
    expect(text).toContain('/Filter /DCTDecode');
  });
});

describe('pageBreaks', () => {
  it('cuts on the last row boundary that fits, not through a line', () => {
    expect(pageBreaks(2000, 1000, [180, 400, 640, 960, 1200, 1500, 1980])).toEqual([[0, 960], [960, 1500], [1500, 2000]]);
  });
  it('is one page when it fits', () => {
    expect(pageBreaks(800, 1000, [100, 800])).toEqual([[0, 800]]);
  });
  it('cuts hard when a page has no boundary in its lower part', () => {
    expect(pageBreaks(2500, 1000, [])).toEqual([[0, 1000], [1000, 2000], [2000, 2500]]);
  });
  it('always makes progress', () => {
    const pages = pageBreaks(5000, 700, [10, 20, 30]);
    pages.forEach(([a, b]) => expect(b).toBeGreaterThan(a));
    expect(pages.at(-1)[1]).toBe(5000);
  });
});
