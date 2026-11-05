/* global document, getComputedStyle -- used inside page.evaluate, which runs in the browser */
// Left edge of the Admin title and tab bar against the leftmost content box, for every Admin
// view at phone, tablet and desktop width. A heading and the cards below it that start at
// different x are a misalignment no per-element check sees.
//
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174
//   node tools/ui-preview/admin-edges.mjs
import { createRequire } from 'node:module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const b = await chromium.launch();
let bad = 0;
  const views = ['analytics','receivables','expenses','masters','bulk','segments','users','settings','riders','transportCos','audit'];
  for (const w of [390, 768, 1280]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
    await p.click('[data-sidenav="admin"] >> visible=true'); await p.waitForTimeout(400);
    const rows = [];
    for (const v of views) {
      await p.click(`[data-admintab="${v}"]`); await p.waitForTimeout(350);
      const r = await p.evaluate(() => {
        const title = document.querySelector('main h2').getBoundingClientRect().left;
        const bar = document.querySelector('[data-admintab="analytics"]').closest('.border').getBoundingClientRect();
        const boxes = [...document.querySelectorAll('main [class*="rounded-"]')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return e.offsetParent && r.width > 150 && r.top > bar.bottom && (parseFloat(cs.borderTopWidth) > 0 || cs.backgroundColor !== 'rgba(0, 0, 0, 0)'); });
        const lefts = boxes.map(e => Math.round(e.getBoundingClientRect().left)).sort((a, b) => a - b);
        return { title: Math.round(title), bar: Math.round(bar.left), content: lefts[0] };
      });
      const off = Math.abs(r.title - r.content) > 2 || Math.abs(r.bar - r.content) > 2; if (off) bad++;
      rows.push(`${v}: title ${r.title}, tab bar ${r.bar}, content ${r.content}` + (off ? '   <-- NOT ALIGNED' : ''));
    }
    console.log(`@${w}px\n  ` + rows.join('\n  ')); await p.close();
  }
await b.close();
console.log(bad ? `${bad} misaligned` : 'all Admin views aligned');
process.exit(bad ? 1 : 0);
