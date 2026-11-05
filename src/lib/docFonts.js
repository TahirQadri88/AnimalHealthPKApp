// Poppins, embedded as data so the shared HTML file carries its own typeface.
//
// "Save / Share" hands over a standalone HTML file, built apart from the live page, so it cannot
// reach the app's self-hosted font files: opened on another phone or computer it fell back to the
// system font while the preview, and the image taken from it, were in Poppins. Print is a
// different matter: it never embeds this (paper stays in the app's Inter), see buildHtmlDoc.
//
// The files are fetched once and turned into data URIs ahead of time, because the share handler
// has to run synchronously inside the tap (navigator.share loses its permission across an await).
// `?inline` does not do this job: Vite leaves a woff2 as a URL, which the shared file cannot reach.
import u400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import u500 from '@fontsource/poppins/files/poppins-latin-500-normal.woff2?url';
import u600 from '@fontsource/poppins/files/poppins-latin-600-normal.woff2?url';
import u700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import u800 from '@fontsource/poppins/files/poppins-latin-800-normal.woff2?url';

export const DOC_FONT_STACK = "'Poppins',system-ui,-apple-system,sans-serif";

const FILES = [[400, u400], [500, u500], [600, u600], [700, u700], [800, u800]];

export const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export const faceCss = (weight, b64) =>
  `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;

let cached = '';
let pending = null;

/** Start (once) fetching the faces. Safe to call on every mount; never throws. */
export const preloadDocFonts = () => {
  if (cached || pending) return pending;
  pending = Promise.all(FILES.map(async ([w, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font ${w}: ${res.status}`);
    return faceCss(w, toBase64(await res.arrayBuffer()));
  })).then(css => { cached = css.join(''); return cached; })
    .catch(() => { pending = null; return ''; });
  return pending;
};

/** The embedded faces, or '' if they are not ready (the shared file then keeps the system font). */
export const getDocFontCss = () => cached;
