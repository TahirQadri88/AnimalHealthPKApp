// The document's typefaces, embedded as data so the shared HTML file carries them.
//
// A4/A5 documents use the app's own faces: DM Sans for everything, with EB Garamond kept for the
// business name alone, where it is large enough to read. Figures are plain DM Sans (tabular,
// lining): Garamond's numerals are thin and small at table sizes and were hard to read.
//
// "Save / Share" hands over a standalone HTML file, built apart from the live page, so it cannot
// reach the app's self-hosted font files. Opened on another phone or computer it fell back to the
// system font. Print never embeds any of this: paper stays in the app's Inter, see buildHtmlDoc.
//
// The files are fetched once and turned into data URIs ahead of time, because the share handler
// has to run synchronously inside the tap (navigator.share loses its permission across an await).
// `?inline` does not do this job: Vite leaves a woff2 as a URL, which the shared file cannot reach.
import sans400 from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url';
import sans500 from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
import sans600 from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2?url';
import serif500 from '@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2?url';

/** The shared file: only faces it embeds. */
export const DOC_FONT_STACK = "'DM Sans',system-ui,-apple-system,sans-serif";
/** The live page: the app's faces are loaded, Inter is the safety net. */
export const DOC_FONT_STACK_LIVE = "'DM Sans', 'Inter', system-ui, sans-serif";
/** The business name. The class is in index.css for the page and in the shared file's own style. */
export const DOC_SERIF_RULE = ".doc-serif{font-family:'EB Garamond',Georgia,serif!important;font-weight:500!important;letter-spacing:.5px!important}";

const FILES = [['DM Sans', 400, sans400], ['DM Sans', 500, sans500], ['DM Sans', 600, sans600], ['EB Garamond', 500, serif500]];

export const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const faceCss = (family, weight, b64) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;

let cached = '';
let pending = null;

/** Start (once) fetching the faces. Safe to call on every mount; never throws. */
export const preloadDocFonts = () => {
  if (cached || pending) return pending;
  pending = Promise.all(FILES.map(async ([family, w, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font ${family} ${w}: ${res.status}`);
    return faceCss(family, w, toBase64(await res.arrayBuffer()));
  })).then(css => { cached = css.join('') + DOC_SERIF_RULE; return cached; })
    .catch(() => { pending = null; return ''; });
  return pending;
};

/** The embedded faces plus the serif rule, or '' if not ready (the shared file then keeps the system font). */
export const getDocFontCss = () => cached;
