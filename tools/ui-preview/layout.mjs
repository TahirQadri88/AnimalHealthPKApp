/* global getComputedStyle, innerWidth, document */
// Boxes measured at phone, tablet and desktop widths: what spills, what is too big for its
// content, and what is out of line.
//
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174
//   node tools/ui-preview/layout.mjs [--widths=390,768,1024,1280] [--tabs=dashboard,...]
//
// spill    a child sticks out past its box's edge, or text overflows its box, where the box
//          does not clip or scroll on purpose (truncate, overflow-x-auto). Also the page itself
//          scrolling sideways.
// too big  a bordered box at least 96px tall whose contents fill under 40% of its height.
// aligned  boxes stacked in one list whose left edges differ by more than 2px.
import { createRequire } from 'node:module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const widths = arg('widths', '390,768,1024,1280').split(',').map(Number);
const tabs = arg('tabs', 'dashboard,billing,customers,payments,products,admin').split(',');
const browser = await chromium.launch();
let total = 0;
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  for (const tab of tabs) {
    // tab@selector opens something from the tab first, as in contrast.mjs.
    const [t, then] = tab.split('@');
    await page.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.click(`[data-sidenav="${t}"] >> visible=true`); await page.waitForTimeout(500);
    if (then) { await page.click(`${then} >> nth=0`); await page.waitForTimeout(600); }
    // --inject=<css> plants a fault, to prove the checker catches what it claims to.
    if (arg('inject', '')) { await page.addStyleTag({ content: arg('inject', '') }); await page.waitForTimeout(200); }
    const r = await page.evaluate(() => {
      const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      // Deliberate only: text cut with an ellipsis, or a row built to scroll sideways. NOT any
      // overflow-y-auto list: the browser then reports overflow-x as auto too, which had this
      // excusing every spill inside every scrolling list (found by planting one).
      const clips = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n), c = String(n.className || '');
        if (cs.textOverflow === 'ellipsis' || /overflow-x-(auto|scroll)|(^|\s)overflow-(auto|scroll)(\s|$)|scrollbar-hide|truncate/.test(c) || n.tagName === 'TABLE') return true;
      } return false; };
      const name = (e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`;
      const spill = new Set(), big = new Set(), off = new Set();
      if (document.documentElement.scrollWidth > innerWidth + 1) spill.add(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
      for (const e of document.querySelectorAll('main *, header *, nav *, [role="dialog"] *, .font-ui.absolute *')) {
        if (!vis(e) || e.closest('svg')) continue;
        const b = e.getBoundingClientRect(), p = e.parentElement?.getBoundingClientRect();
        if (p && e.parentElement && !clips(e.parentElement) && (b.right > p.right + 2 || b.left < p.left - 2) && getComputedStyle(e).position !== 'absolute' && getComputedStyle(e).position !== 'fixed')
          spill.add(`${name(e)} past its box by ${Math.round(Math.max(b.right - p.right, p.left - b.left))}px`);
        if (e.scrollWidth > e.clientWidth + 2 && !clips(e) && getComputedStyle(e).overflowX === 'visible' && e.children.length === 0)
          spill.add(`${name(e)} text wider than its box`);
        const cs = getComputedStyle(e);
        if (parseFloat(cs.borderTopWidth) > 0 && /rounded/.test(e.className) && b.height >= 96 && e.children.length) {
          const kids = [...e.children].filter(vis).map(k => k.getBoundingClientRect());
          if (kids.length) { const top = Math.min(...kids.map(k => k.top)), bot = Math.max(...kids.map(k => k.bottom)); const fill = (bot - top) / (b.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
            if (fill < 0.4) big.add(`${name(e)} ${Math.round(b.height)}px tall, contents fill ${Math.round(fill * 100)}%`); }
        }
      }
      // A label wider than its own button or tab, wherever it sits, scrolling rows included:
      // the 44px min-width once let tab buttons shrink below their labels, which then ran into
      // each other, and the spill check above excused scrolling rows.
      for (const e of document.querySelectorAll('main button, main a, header button, nav button, [role="dialog"] button')) {
        if (!vis(e) || e.closest('.truncate') || getComputedStyle(e).textOverflow === 'ellipsis') continue;
        const box = e.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(e);
        const t = range.getBoundingClientRect();
        if (t.width > box.width + 2) spill.add(`${name(e)} label ${Math.round(t.width)}px in a ${Math.round(box.width)}px button`);
      }
      for (const list of document.querySelectorAll('main [class*="space-y-"], main .divide-y, [role="dialog"] [class*="space-y-"]')) {
        const kids = [...list.children].filter(vis);
        if (kids.length < 2) continue;
        const lefts = kids.map(k => Math.round(k.getBoundingClientRect().left));
        if (Math.max(...lefts) - Math.min(...lefts) > 2) off.add(`list of ${kids.length} under ${name(list).slice(0, 40)}: left edges ${[...new Set(lefts)].join('/')}px`);
      }
      return { spill: [...spill], big: [...big], off: [...off] };
    });
    const n = r.spill.length + r.big.length + r.off.length; total += n;
    if (n) {
      console.log(`\n${tab} @${w}px:`);
      for (const [k, list] of [['spill', r.spill], ['too big', r.big], ['out of line', r.off]]) for (const x of list.slice(0, 6)) console.log(`  ${k.padEnd(11)} ${x}`);
      for (const [k, list] of [['spill', r.spill], ['too big', r.big], ['out of line', r.off]]) if (list.length > 6) console.log(`  ${k.padEnd(11)} ...and ${list.length - 6} more`);
    }
  }
  await page.close();
}
console.log(`\n${total} findings across ${tabs.length} screens at ${widths.join(', ')}px`);
await browser.close();
process.exit(total ? 1 : 0);
