/* global getComputedStyle, innerWidth -- used inside page.evaluate, which runs in the browser */
// Box and tap-target sizes, measured on a phone.
//
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174
//   node tools/ui-preview/sizes.mjs [--min=44]
//
// Anything you tap must be at least --min px in both directions (44 is the common guideline
// for a fingertip). Boxes in one row of a grid should share a height. Both are reported per
// tab, so a too-small control is found by measuring rather than by squinting at a phone.
import { createRequire } from 'node:module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const min = Number((process.argv.find(a => a.startsWith('--min=')) || '--min=44').slice(6));
const tabs = ['dashboard', 'billing', 'customers', 'payments', 'products', 'admin'];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
for (const tab of tabs) {
  await page.click(`[data-sidenav="${tab}"] >> visible=true`); await page.waitForTimeout(500);
  const r = await page.evaluate((min) => {
    const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const small = {};
    for (const e of document.querySelectorAll('main button, main a[href], main input:not([type=checkbox]):not([type=radio]), main select, nav button, header button')) {
      if (!visible(e)) continue;
      const b = e.getBoundingClientRect();
      if (b.height < min || b.width < min) {
        const label = (e.getAttribute('title') || e.getAttribute('aria-label') || e.textContent || e.placeholder || e.tagName).trim().slice(0, 24) || e.tagName;
        const key = `${Math.round(b.width)}x${Math.round(b.height)} ${label}`;
        small[key] = (small[key] || 0) + 1;
      }
    }
    // Grid rows whose boxes differ in height by more than 4px.
    const uneven = [];
    for (const g of document.querySelectorAll('main .grid')) {
      const kids = [...g.children].filter(visible);
      const rows = {};
      for (const k of kids) { const b = k.getBoundingClientRect(); (rows[Math.round(b.top)] ||= []).push(Math.round(b.height)); }
      for (const hs of Object.values(rows)) if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 4) uneven.push(hs.join('/'));
    }
    return { small, uneven };
  }, min);
  const smalls = Object.entries(r.small).sort((a, b) => b[1] - a[1]);
  console.log(`\n${tab}: ${smalls.reduce((s, [, n]) => s + n, 0)} tap targets under ${min}px${r.uneven.length ? `; uneven grid rows (heights): ${r.uneven.join(', ')}` : ''}`);
  for (const [k, n] of smalls.slice(0, 8)) console.log(`  ${n}× ${k}`);
}
await browser.close();
