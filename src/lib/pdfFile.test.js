import { describe, it, expect } from 'vitest';
import { buildPdf, pageBreaks } from './pdfFile';

// A real (tiny) JPEG: SOI, JFIF, EOI. The writer only has to embed the bytes; the file's structure is what is tested.
const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xFF, 0xD9]);
const latin = (u8) => Array.from(u8, c => String.fromCharCode(c)).join('');

describe('buildPdf', () => {
  const pdf = buildPdf([
    { images: [{ jpeg: JPEG, pxW: 2382, pxH: 3000, x: 0, y: 100, w: 595.28, h: 700 }], footer: 'INV-8812 · Page 1 of 2' },
    { images: [{ jpeg: JPEG, pxW: 2382, pxH: 120, x: 0, y: 760, w: 595.28, h: 30 }, { jpeg: JPEG, pxW: 2382, pxH: 1000, x: 0, y: 450, w: 595.28, h: 300 }], footer: 'INV-8812 (Page 2 of 2)' },
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
    expect(rows.length).toBe(10);  // catalog, pages, font, then page + contents + images (1 and 2) per page
    rows.forEach((r, i) => {
      const off = Number(r.slice(0, 10));
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('puts a page-number footer on each page, escaped and in plain Latin-1', () => {
    expect(text).toContain('(INV-8812 - Page 1 of 2) Tj');   // the middle dot is not Latin-1 safe, so it becomes a dash
    expect(text).toContain('(INV-8812 \\(Page 2 of 2\\)) Tj');   // parentheses inside the string are escaped
    expect(text).toContain('/BaseFont /Helvetica');
  });

  it('can place two images on one page (a repeated header over the body)', () => {
    expect((text.match(/\/Im1 Do/g) || []).length).toBe(1);
  });

  it('embeds each image untouched, with its true length', () => {
    expect(text).toContain(`/Length ${JPEG.length} >>`);
    expect(text).toContain(latin(JPEG));
    expect(text).toContain('/Filter /DCTDecode');
  });
});

describe('pageBreaks', () => {
  it('cuts on the last row boundary that fits, not through a line', () => {
    expect(pageBreaks(2000, 1000, [180, 400, 640, 960, 1200, 1500, 1980])).toEqual([[0, 960, false], [960, 1500, false], [1500, 2000, false]]);
  });
  it('is one page when it fits', () => {
    expect(pageBreaks(800, 1000, [100, 800])).toEqual([[0, 800, false]]);
  });
  it('cuts hard when a page has no boundary in its lower part', () => {
    expect(pageBreaks(2500, 1000, [])).toEqual([[0, 1000, false], [1000, 2000, false], [2000, 2500, false]]);
  });
  it('always makes progress', () => {
    const pages = pageBreaks(5000, 700, [10, 20, 30]);
    pages.forEach(([a, b]) => expect(b).toBeGreaterThan(a));
    expect(pages.at(-1)[1]).toBe(5000);
  });

  // A table from y=200 (body starts) to y=2600; its header is 40 tall. Rows every 50.
  const rows = Array.from({ length: 48 }, (_, i) => 250 + i * 50);
  const table = { headerH: 40, tableStart: 200, tableEnd: 2650 };
  it('repeats the header on a page that starts inside the table, and gives up room for it', () => {
    const pages = pageBreaks(3200, 1000, [...rows, 2900, 3200], table);
    expect(pages[0][2]).toBe(false);                       // the first page already has it
    expect(pages[1][2]).toBe(true);                        // starts mid-table
    expect(pages[1][1] - pages[1][0]).toBeLessThanOrEqual(1000 - 40);
  });
  it('does not repeat it on a page that starts after the table (totals, policy)', () => {
    const pages = pageBreaks(3200, 1000, [...rows, 2900, 3200], table);
    expect(pages.at(-1)[2]).toBe(false);
  });
});
