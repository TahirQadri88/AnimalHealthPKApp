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
 * @param {{images: {jpeg: Uint8Array, pxW: number, pxH: number, x: number, y: number, w: number, h: number}[], footer?: string}[]} pages
 *   an image is placed at x, y with size w x h in PDF points, y measured from the bottom of the page;
 *   a page may hold several (a repeated table header above the body), and an optional footer line
 * @param {{pageW: number, pageH: number}} size page size in points
 * @returns {Uint8Array}
 */
export const buildPdf = (pages, { pageW, pageH }) => {
  const parts = [];
  const offsets = [];          // byte offset of object n (1-based) at index n
  let length = 0;
  const push = (chunk) => { const b = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(b); length += b.length; };
  const startObj = (n) => { offsets[n] = length; push(`${n} 0 obj\n`); };
  // Text in the footer is plain Latin-1 in a built-in font, so no font file is embedded.
  const esc = (t) => String(t).replace(/[^\x20-\x7E]/g, '-').replace(/([\\()])/g, '\\$1');

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // Object numbers: 1 catalog, 2 pages, 3 font, then for each page its page, its contents, its images.
  let next = 4;
  const layout = pages.map((p) => { const pg = next, ct = next + 1, ims = p.images.map((_, i) => next + 2 + i); next += 2 + p.images.length; return { pg, ct, ims }; });
  startObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${layout.map(l => `${l.pg} 0 R`).join(' ')}] >>\nendobj\n`);
  startObj(3); push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  pages.forEach((p, i) => {
    const { pg, ct, ims } = layout[i];
    const xobjs = ims.map((n, k) => `/Im${k} ${n} 0 R`).join(' ');
    startObj(pg);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW)} ${num(pageH)}] /Resources << /XObject << ${xobjs} >> /Font << /F1 3 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    let stream = p.images.map((im, k) => `q ${num(im.w)} 0 0 ${num(im.h)} ${num(im.x)} ${num(im.y)} cm /Im${k} Do Q`).join('\n');
    if (p.footer) stream += `\nBT /F1 8 Tf 0.45 0.45 0.45 rg ${num(pageW / 2 - p.footer.length * 2)} 14 Td (${esc(p.footer)}) Tj ET`;
    startObj(ct); push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
    p.images.forEach((im, k) => {
      startObj(ims[k]);
      push(`<< /Type /XObject /Subtype /Image /Width ${im.pxW} /Height ${im.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
      push(im.jpeg); push('\nendstream\nendobj\n');
    });
  });
  const count = next;
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
 * A page that starts inside the table gets the table's header row repeated above it, which costs it
 * `headerH` of room; the first page, and pages after the table, do not.
 * @param {number} total capture height in css px
 * @param {number} usable the most css px one page can hold
 * @param {number[]} marks bottoms of rows/blocks, css px from the top of the capture
 * @param {{headerH?: number, tableStart?: number, tableEnd?: number}} table header height, and where the table's body starts and ends
 * @returns {[number, number, boolean][]} [start, end, repeatHeader] per page
 */
export const pageBreaks = (total, usable, marks, { headerH = 0, tableStart = 0, tableEnd = 0 } = {}) => {
  const pages = [];
  let start = 0;
  while (start < total - 0.5) {
    const repeat = headerH > 0 && start > tableStart && start < tableEnd;
    const room = repeat ? usable - headerH : usable;
    const maxEnd = Math.min(total, start + room);
    let end = maxEnd;
    if (maxEnd < total) {
      const fits = marks.filter(m => m > start + room * 0.4 && m <= maxEnd);
      if (fits.length) end = Math.max(...fits);
    }
    pages.push([start, end, repeat]);
    start = end;
  }
  return pages;
};
