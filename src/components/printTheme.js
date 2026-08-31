// Yellow-block repaint for the shared image.
//
// The document's strong blocks — the masthead, the INVOICE pill, the table header, the Net
// Balance bar, the policy strip — are navy slabs carrying yellow text. On a phone, shared
// into a WhatsApp thread, they read as heavy dark bands. Flipping them puts the yellow on
// the outside: a yellow block with black text, which is the louder half of the brand and
// carries much better at thumbnail size.
//
// Scope is deliberately narrow. Only the blocks change; the page stays white and the body
// copy stays black, because an invoice still has to look like an invoice. And it repaints
// the *image* clone only — print keeps its own monochrome pass in buildHtmlDoc, and the PDF
// clones the live document, which this never touches.
//
// The blocks are found by colour, not by selector: anything whose computed background is
// dark is one. That way a new dark section added to any document type is picked up without
// coming back here.
//
// The mapping is pure and unit-tested (printTheme.test.js). Only the DOM walk needs a
// browser.

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

/**
 * What a piece of text inside a block becomes once the block is yellow.
 * Pure; `css` is any colour string from getComputedStyle.
 */
export const blockTextColor = (css) => {
  const rgb = parseRgb(css);
  if (!rgb) return YELLOW.ink;
  // Secondary text was a mid grey against the navy. Pure black would promote it to the same
  // weight as the heading it sits under, so it stays a step down — just dark enough to read.
  const l = luminance(rgb);
  if (l >= 0.45 && l < 0.85) return YELLOW.inkMuted;
  return YELLOW.ink;
};

/**
 * Repaint an element tree's dark blocks in place. Must be in the document — it reads
 * computed styles. Only writes inline styles.
 */
export const applyYellowBlocks = (root, view = (typeof window !== 'undefined' ? window : null)) => {
  if (!root || !view) return root;

  // Read every computed style FIRST. Writing as we walk would have nested elements report
  // the yellow we just set instead of the navy the document actually had.
  const all = [root, ...root.querySelectorAll('*')];
  const blocks = all.filter(el => {
    if (el.hasAttribute('data-dk')) return true;
    return isBlockBackground(view.getComputedStyle(el).backgroundColor);
  });
  const inkFor = new Map();
  blocks.forEach(el => {
    [el, ...el.querySelectorAll('*')].forEach(child => {
      if (!inkFor.has(child)) inkFor.set(child, blockTextColor(view.getComputedStyle(child).color));
    });
  });

  blocks.forEach(el => {
    el.style.setProperty('background-color', YELLOW.fill, 'important');
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('border-color', YELLOW.edge, 'important');
  });
  inkFor.forEach((ink, el) => {
    el.style.setProperty('color', ink, 'important');
  });

  return root;
};
