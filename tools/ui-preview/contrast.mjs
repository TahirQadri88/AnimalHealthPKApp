/* global getComputedStyle -- used inside page.evaluate, which runs in the browser */
// Measures the contrast of every piece of text on a preview screen against what is actually
// behind it, and fails below WCAG AA: 4.5:1 for body text, 3:1 for large text (24px, or
// 18.66px bold). Reading colours off the code is how a pale label on a tinted chip gets
// through, so this composites each background layer the way the browser paints it.
//
//   npx vite --port 5173   (in another shell)
//   node tools/ui-preview/contrast.mjs [palette,palette,...]
import { createRequire } from 'node:module';

// The project's own playwright if installed, else a machine-wide one (require honours NODE_PATH).
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const palettes = (process.argv[2] || 'ledger').split(',');
const pages = [['list', 1280], ['form', 1280], ['list', 390], ['form', 390]];

const browser = await chromium.launch();
let failures = 0;
for (const palette of palettes) {
  const worst = [];
  for (const [view, width] of pages) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://localhost:5173/tools/ui-preview/billing.html?view=${view}&palette=${palette}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const found = await page.evaluate(() => {
      const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
      const lum = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const backdrop = (el) => {
        const layers = [];
        for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) layers.push(c); if (c.a === 1) break; }
        return layers.reverse().reduce((under, top) => over(top, under), { r: 255, g: 255, b: 255, a: 1 });
      };
      const out = [];
      const check = (el, text, colour) => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (!r.width || !r.height || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
        const bg = backdrop(el), fg = over(parse(colour), bg);
        const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
        const v = ratio(fg, bg);
        out.push({ text: text.trim().slice(0, 40), ratio: Math.round(v * 100) / 100, need: large ? 3 : 4.5, px,
          // The serif must stay clearly larger than the sans beside it; see index.css.
          smallSerif: !!el.closest('.font-display') && !el.closest('.font-ui:not(.font-display) .font-ui') && cs.fontFamily.includes('Garamond') && px < 24 });
      };
      for (const el of document.querySelectorAll('body *')) {
        const own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent).join(' ');
        if (own) check(el, own, getComputedStyle(el).color);
        if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'radio') {
          if (el.value) check(el, el.value, getComputedStyle(el).color);
          else if (el.placeholder) check(el, `placeholder: ${el.placeholder}`, getComputedStyle(el, '::placeholder').color);
        }
        if (el.tagName === 'SELECT') check(el, el.options[el.selectedIndex]?.text || '', getComputedStyle(el).color);
      }
      return out;
    });
    for (const f of found) worst.push({ ...f, where: `${view} @${width}` });
    await page.close();
  }
  const small = worst.filter(f => f.smallSerif);
  failures += small.length;
  for (const f of small) console.log(`  FAIL serif at ${f.px}px, under the 24px minimum  "${f.text}"  (${f.where})`);
  const bad = worst.filter(f => f.ratio < f.need);
  failures += bad.length;
  const min = worst.reduce((m, f) => (f.ratio / f.need < m.ratio / m.need ? f : m), worst[0]);
  console.log(`\n${palette}: ${worst.length} text items checked, ${bad.length} below AA. Closest to the line: "${min.text}" ${min.ratio}:1 (needs ${min.need})`);
  for (const f of bad) console.log(`  FAIL ${f.ratio}:1 < ${f.need}  ${f.px}px  "${f.text}"  (${f.where})`);
}
await browser.close();
process.exit(failures ? 1 : 0);
