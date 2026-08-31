// Dark ("yellow on black") repaint for the shared image.
//
// A document shared to WhatsApp is read on a phone, usually in a dark chat. The printed
// document is the opposite problem — white paper, black toner — so the two cannot share a
// palette. Print keeps the monochrome pass in buildHtmlDoc; this repaints the *image* clone
// only, on its way to the canvas. Nothing here touches the live document, so the PDF and
// the printer are unaffected.
//
// It works by remapping whatever colour an element already has rather than by threading a
// theme through 1,600 lines of inline styles. That keeps the light document the single
// source of truth: add a new section and it goes dark for free.
//
// The mapping is pure and unit-tested (printTheme.test.js). Only the DOM walk needs a
// browser.

export const DARK = {
  page: '#000000',        // true black — sits flush in a WhatsApp thread
  panel: '#141519',       // what a light grey card becomes
  // Dark blocks must read as slabs against a pure-black page. #111 and darker vanish: the
  // table header lost its bar entirely at that value and the column titles floated.
  block: '#1d1e24',       // what a dark navy block becomes
  edge: '#3a3a3a',        // ordinary hairline
  brand: '#FFF200',       // the yellow, unchanged — headings, figures, block outlines
  body: '#FDE68A',        // soft yellow for running text; pure #FFF200 everywhere is a wall
  muted: '#a1a1aa',
  good: '#4ade80',
  bad: '#f87171',
  info: '#93c5fd',
};

export const parseRgb = (s) => {
  const m = String(s || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
};

const lum = ({ r, g, b }) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const isBrandYellow = ({ r, g, b }) => r > 200 && g > 180 && b < 130;
const isGreen = ({ r, g, b }) => g > 110 && g >= r + 30 && g >= b + 30;
const isRed = ({ r, g, b }) => r > 110 && r >= g + 45 && r >= b + 45;
const isBlue = ({ r, g, b }) => b > 110 && b >= r + 40 && b >= g + 25;

/**
 * The whole colour decision, as a pure function.
 * @param role  'background' | 'text' | 'border'
 * @param css   any CSS colour string as reported by getComputedStyle
 * @returns a replacement colour, or null to leave the element alone
 */
export const darkColorFor = (role, css) => {
  const rgb = parseRgb(css);
  if (!rgb) return null;
  // Fully transparent stays transparent: painting it would box in elements that were never
  // meant to have an edge.
  if (rgb.a === 0) return null;
  const l = lum(rgb);

  if (role === 'background') {
    // Paper white disappears into the page rather than becoming a light slab on black.
    // The cut is deliberately just below pure white: #f8fafc is 0.979 and is a real card,
    // so a 0.96 threshold would swallow every panel in the document.
    if (l >= 0.99) return 'transparent';
    if (l >= 0.80) return DARK.panel;      // #f8fafc / #f1f5f9 / #e2e8f0 cards and zebra rows
    if (l >= 0.45) return '#242428';
    return DARK.block;                      // the navy header / table head / net balance bar
  }

  if (role === 'border') {
    // A dark rule on white paper is a strong divider; on black it vanishes, so it becomes
    // the brand yellow and goes on doing its job.
    if (isBrandYellow(rgb)) return DARK.brand;
    return l < 0.45 ? DARK.brand : DARK.edge;
  }

  // text
  if (isBrandYellow(rgb)) return DARK.brand;
  if (isGreen(rgb)) return DARK.good;
  if (isRed(rgb)) return DARK.bad;
  if (isBlue(rgb)) return DARK.info;
  if (l >= 0.85) return DARK.brand;        // white-on-dark text becomes the yellow
  // 0.40, not 0.45: slate-500 (#64748b) lands at 0.446 and is a label, not body copy.
  if (l >= 0.40) return DARK.muted;        // slate-400/500 labels stay secondary
  return DARK.body;                        // ordinary near-black copy
};

/**
 * Repaint an element tree in place. Must be in the document — it reads computed styles.
 * Safe to call once per clone; it only writes inline styles.
 */
export const applyDarkTheme = (root, view = (typeof window !== 'undefined' ? window : null)) => {
  if (!root || !view) return;
  root.style.setProperty('background-color', DARK.page, 'important');
  root.style.boxShadow = 'none';

  const all = [root, ...root.querySelectorAll('*')];
  // Read every computed style FIRST. Writing as we walk would have later elements inherit
  // the colours we just set instead of the ones the light document actually had.
  const read = all.map(el => {
    const cs = view.getComputedStyle(el);
    return { el, bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, dark: el.hasAttribute('data-dk') };
  });

  read.forEach(({ el, bg, color, border, dark }) => {
    const nextBg = darkColorFor('background', bg);
    if (nextBg) el.style.setProperty('background-color', nextBg, 'important');
    el.style.backgroundImage = 'none';
    el.style.boxShadow = 'none';

    const nextColor = darkColorFor('text', color);
    if (nextColor) el.style.setProperty('color', nextColor, 'important');

    const nextBorder = darkColorFor('border', border);
    if (nextBorder) el.style.setProperty('border-color', nextBorder, 'important');

    // The header, the table head and the Net Balance bar were dark slabs on white paper.
    // On a black page they need an outline to stay separate blocks rather than merging
    // into the background.
    if (dark) {
      el.style.setProperty('background-color', DARK.block, 'important');
      el.style.setProperty('border', `1.5px solid ${DARK.brand}`, 'important');
    }
  });

  return root;
};
