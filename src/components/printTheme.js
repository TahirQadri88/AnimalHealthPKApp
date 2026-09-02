// The document's block palette, and the test that finds a block on paper.
//
// The strong blocks — masthead, INVOICE pill, table headers, Net Balance bar, policy strip
// — are yellow with black lettering. They were navy with yellow lettering, and the shared
// image repainted them on its own clone; that made the image the odd one out against the
// preview, the PDF and the HTML share. The colours now live in the document itself, so
// every screen destination agrees and there is nothing to repaint.
//
// Paper is the exception and always was: buildHtmlDoc bakes monochrome for print, and
// finds the blocks by the `data-dk` attribute they each carry. That attribute is now the
// ONLY way a block can be recognised — a yellow block is light, so the luminance test
// below no longer finds one. isBlockBackground still catches the two coloured status bars
// (the purple estimate notice and the rose credit-note bar), which keep their own colour
// because they carry meaning rather than branding.

export const YELLOW = {
  fill: '#FFF200',        // the brand yellow, now the background
  ink: '#000000',         // block text
  inkMuted: '#4a4a35',    // the tagline and other secondary text, still readable on yellow
  edge: '#000000',        // a block's own border
};

// Anything darker than this is treated as a block. #1e293b (the table header) sits at 0.16
// and #64748b — a muted label, not a block — sits at 0.45, so the line falls between them.
export const BLOCK_MAX_LUM = 0.45;

export const parseRgb = (s) => {
  const m = String(s || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
};

export const luminance = ({ r, g, b }) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Is this computed background one of the document's dark blocks? */
export const isBlockBackground = (css) => {
  const rgb = parseRgb(css);
  if (!rgb || rgb.a === 0) return false;
  return luminance(rgb) < BLOCK_MAX_LUM;
};
