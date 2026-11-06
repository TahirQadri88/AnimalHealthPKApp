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
// misaligned  an icon off the centre line of its label or field; controls side by side (pills,
//          filters, button rows) of different heights; a scrolling row that starts with dead space.
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
    const [t, ...thens] = tab.split('@');
    await page.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
    await page.click(`[data-sidenav="${t}"] >> visible=true`); await page.waitForTimeout(500);
    for (const then of thens) { await page.click(`${then} >> nth=0`); await page.waitForTimeout(600); }
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
        // A display:contents wrapper has no box of its own (its children lay out in the one
        // above it), so measure against the nearest ancestor that does.
        let box = e.parentElement;
        while (box && getComputedStyle(box).display === 'contents') box = box.parentElement;
        const b = e.getBoundingClientRect(), p = box?.getBoundingClientRect();
        if (p && box && !clips(box) && (b.right > p.right + 2 || b.left < p.left - 2) && getComputedStyle(e).position !== 'absolute' && getComputedStyle(e).position !== 'fixed')
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
        // A grid laid out in columns on purpose (xl:grid-cols-2) is not a stack.
        const lcs = getComputedStyle(list);
        if (lcs.display === 'grid' && lcs.gridTemplateColumns.trim().split(/\s+/).length > 1) continue;
        const kids = [...list.children].filter(vis);
        if (kids.length < 2) continue;
        const lefts = kids.map(k => Math.round(k.getBoundingClientRect().left));
        if (Math.max(...lefts) - Math.min(...lefts) > 2) off.add(`list of ${kids.length} under ${name(list).slice(0, 40)}: left edges ${[...new Set(lefts)].join('/')}px`);
      }
      // ── Alignment: icons against their text, controls in a row against each other ─────────────
      const textRect = (el) => {
        for (const n of el.childNodes) {
          const target = n.nodeType === 3 ? (n.textContent.trim() ? n : null) : (n.nodeType === 1 && !n.matches('svg, kbd') && n.textContent.trim() ? n : null);
          if (!target) continue;
          if (target.nodeType === 1) {
            const pos = getComputedStyle(target).position;
            if (pos === 'absolute' || pos === 'fixed') continue;           // a count badge, not the label
            if (target.getBoundingClientRect().height > 30) return false;  // a multi-line block: the icon centres on the whole
          }
          const r = document.createRange(); r.selectNodeContents(target);
          const rects = [...r.getClientRects()].filter(x => x.width > 0);
          if (rects.length) return rects[0];
        }
        return null;
      };
      const mis = new Set();
      for (const svg of document.querySelectorAll('main svg.lucide, header svg.lucide, nav svg.lucide, aside svg.lucide, [role="dialog"] svg.lucide')) {
        if (!vis(svg)) continue;
        const sb = svg.getBoundingClientRect(), par = svg.parentElement, pb = par.getBoundingClientRect();
        const sy = sb.top + sb.height / 2;
        if (getComputedStyle(svg).position === 'absolute') {
          // an icon laid over a field: it must sit on the field's centre line
          const field = par.querySelector('input, select, textarea, button');
          if (field) { const fb = field.getBoundingClientRect(); const d = Math.abs(sy - (fb.top + fb.height / 2)); if (d > 1.5) mis.add(`icon over a field is ${d.toFixed(1)}px off its centre: ${name(par).slice(0, 50)}`); }
          continue;
        }
        const t = textRect(par);
        if (t && t.height < 40 && sb.bottom > t.top + 2) {  // an icon stacked ABOVE its text (an empty state) is not beside it
          const d = Math.abs(sy - (t.top + t.height / 2)); if (d > 2.5) mis.add(`icon ${d.toFixed(1)}px off its label's centre: ${name(par).slice(0, 50)}`);
          // a leading icon stays beside its label: auto margins once threw it to the far edge of the button
          const gapX = t.left - sb.right;
          if (par.firstElementChild === svg && gapX > 18) mis.add(`icon ${Math.round(gapX)}px away from its label: ${name(par).slice(0, 50)}`);
        }
        else if (!par.textContent.trim() && par.children.length === 1 && par.matches('button, a')) {
          const dx = Math.abs(sb.left + sb.width / 2 - (pb.left + pb.width / 2)), dy = Math.abs(sy - (pb.top + pb.height / 2));
          if (dx > 1.5 || dy > 1.5) mis.add(`icon-only button's icon is off-centre by ${dx.toFixed(1)}/${dy.toFixed(1)}px: ${par.getAttribute('title') || par.getAttribute('aria-label') || name(par).slice(0, 30)}`);
        }
      }
      // controls side by side that should be one height: pills, filters, button rows
      // The control a child stands for: itself, or the one button/select/input inside a plain wrapper
      // (the date pill is a wrapper around a select; measuring the wrapper missed its height).
      const controlOf = (c) => {
        const styled = (e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0 || getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)';
        if (c.matches('button, a[href], select, input')) return styled(c) ? c : null;
        const inner = c.querySelectorAll('button, select, input');
        if (inner.length === 1 && !c.querySelector('p, h1, h2, h3, h4') && styled(inner[0])) return inner[0];
        // a bordered pill built from a few parts (the searchable pills): a control if it is pill-sized
        if (styled(c) && c.getBoundingClientRect().height <= 60 && !c.querySelector('p, h1, h2, h3, h4') && inner.length >= 1) return c;
        return null;
      };
      for (const row of document.querySelectorAll('main *, header *, [role="dialog"] *')) {
        if (!/(flex|grid)/.test(getComputedStyle(row).display) || row.closest('table')) continue;
        const kids = [...row.children].filter(vis).map(c => [c, controlOf(c)]).filter(x => x[1]);
        if (kids.length < 2) continue;
        const lines = {};
        for (const [k, ctl] of kids) { const b = ctl.getBoundingClientRect(); (lines[Math.round(b.top / 8)] ||= []).push([k, b.height]); }
        for (const g of Object.values(lines)) {
          if (g.length < 2) continue;
          const hs = g.map(x => x[1]);
          if (Math.max(...hs) - Math.min(...hs) > 3) mis.add(`controls in one row differ in height (${hs.map(Math.round).join('/')}px): ${g.map(x => name(x[0]).slice(0, 18)).join(', ')}`);
        }
      }
      // scroll rows that start with dead space
      for (const sc of document.querySelectorAll('.scrollbar-hide, .overflow-x-auto')) {
        if (!vis(sc) || sc.tagName === 'TABLE' || sc.scrollLeft > 0) continue;
        const first = [...sc.children].find(vis); if (!first) continue;
        const root = sc.parentElement.getBoundingClientRect();
        // from the parent's content edge: a card's own padding is not dead space
        const gap = first.getBoundingClientRect().left - (root.left + parseFloat(getComputedStyle(sc.parentElement).paddingLeft));
        if (gap > 14) mis.add(`scrolling row starts ${Math.round(gap)}px in from its edge: ${name(first).slice(0, 30)}`);
      }
      return { spill: [...spill], big: [...big], off: [...off], mis: [...mis] };
    });
    const n = r.spill.length + r.big.length + r.off.length + r.mis.length; total += n;
    if (n) {
      console.log(`\n${tab} @${w}px:`);
      for (const [k, list] of [['spill', r.spill], ['too big', r.big], ['out of line', r.off], ['misaligned', r.mis]]) for (const x of list.slice(0, 6)) console.log(`  ${k.padEnd(11)} ${x}`);
      for (const [k, list] of [['spill', r.spill], ['too big', r.big], ['out of line', r.off], ['misaligned', r.mis]]) if (list.length > 6) console.log(`  ${k.padEnd(11)} ...and ${list.length - 6} more`);
    }
  }
  await page.close();
}
console.log(`\n${total} findings across ${tabs.length} screens at ${widths.join(', ')}px`);
await browser.close();
process.exit(total ? 1 : 0);
