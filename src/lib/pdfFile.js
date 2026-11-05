// A minimal PDF writer: one JPEG per page, placed at a given size and position.
//
// Why this exists: on an iPhone a page cannot reliably open the print sheet (inside the home-screen app it
// cannot at all), and Safari's own print adds the page address in the footer and its own margins. A PDF
// built in the app and handed to the share sheet has none of that, and the sheet offers Print, Save to
// Files and WhatsApp. Pure and dependency-free so it can be tested without a browser.

// Everything the writer emits as text is ASCII or Latin-1, so a byte per character is exact.
const enc = { encode: (str) => Uint8Array.from(str, (c) => c.charCodeAt(0) & 255) };
const num = (n) => (Math.round(n * 100) / 100).toString();

/**
 * @param {{jpeg: Uint8Array, pxW: number, pxH: number, x: number, y: number, w: number, h: number}[]} pages
 *   x, y, w, h are in PDF points, y measured from the bottom of the page
 * @param {{pageW: number, pageH: number}} size page size in points
 * @returns {Uint8Array}
 */
export const buildPdf = (pages, { pageW, pageH }) => {
  const parts = [];
  const offsets = [];          // byte offset of object n (1-based) at index n
  let length = 0;
  const push = (chunk) => { const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(b); length += b.length; };
  const startObj = (n) => { offsets[n] = length; push(`${n} 0 obj\n`); };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const pageObjs = pages.map((_, i) => 3 + i * 3);           // page, contents, image per page
  startObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjs.map(n => `${n} 0 R`).join(' ')}] >>\nendobj\n`);
  pages.forEach((p, i) => {
    const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
    startObj(pg);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW)} ${num(pageH)}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    const stream = `q ${num(p.w)} 0 0 ${num(p.h)} ${num(p.x)} ${num(p.y)} cm /Im0 Do Q`;
    startObj(ct); push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    startObj(im);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg); push('\nendstream\nendobj\n');
  });
  const count = 3 + pages.length * 3;
  const xrefAt = length;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(`${xref}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  parts.forEach((b) => { out.set(b, at); at += b.length; });
  return out;
};

/**
 * Where to cut a tall capture into pages. Cuts fall on a row or block boundary (the largest one that
 * still fits), never through a line of text; a page with no boundary in its lower 60% is cut hard.
 * @param {number} total capture height in css px
 * @param {number} usable the most css px one page can hold
 * @param {number[]} marks bottoms of rows/blocks, css px from the top of the capture
 * @returns {[number, number][]} [start, end] per page
 */
export const pageBreaks = (total, usable, marks) => {
  const pages = [];
  let start = 0;
  while (start < total - 0.5) {
    const maxEnd = Math.min(total, start + usable);
    let end = maxEnd;
    if (maxEnd < total) {
      const fits = marks.filter(m => m > start + usable * 0.4 && m <= maxEnd);
      if (fits.length) end = Math.max(...fits);
    }
    pages.push([start, end]);
    start = end;
  }
  return pages;
};
