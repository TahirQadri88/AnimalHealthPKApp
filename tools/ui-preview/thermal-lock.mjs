// Golden-master lock on what the THERMAL buttons actually write: Print (the popup that reaches the
// printer) and Save / Share (the standalone file). The SSR test in
// src/components/PrintView.thermal.lock.test.jsx locks the document markup; this locks the path
// from that markup to the printer, buildHtmlDoc, which needs a real browser.
//
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174 --strictPort
//   node tools/ui-preview/thermal-lock.mjs            # compare, exit 1 on any difference
//   node tools/ui-preview/thermal-lock.mjs --update   # only after printing the change on the real printer
//
// Dates are normalised (the sample data is dated today). A failure means a change reached the
// receipt: fix the change, do not update the golden files to match it.
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// The project's own playwright if installed, else a machine-wide one (require honours NODE_PATH).
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'golden');
const update = process.argv.includes('--update');
const norm = (h) => h.replace(/\d{8}/g, 'YYYYMMDD').replace(/\d{2}-[A-Za-z]{3}-\d{2}/g, 'DD-Mon-YY').replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD');

const browser = await chromium.launch();
let bad = 0;
for (const [btn, name] of [['Print', 'thermal-print'], ['Save / Share', 'thermal-share']]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    window.__w = [];
    Object.defineProperty(navigator, 'canShare', { value: undefined });
    Object.defineProperty(navigator, 'share', { value: undefined });
    window.open = () => ({ document: { open() {}, write(h) { window.__w.push(h); }, close() {} }, focus() {}, print() {}, close() {}, set onafterprint(v) {}, set onload(v) {} });
  });
  await page.goto('http://localhost:5174/tools/ui-preview/app.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('[data-sidenav="billing"] >> visible=true'); await page.waitForTimeout(400);
  await page.click('button[title="Print"] >> nth=0'); await page.waitForTimeout(400);
  await page.evaluate(() => [...document.querySelectorAll('#print-root button')].find(x => x.textContent.trim() === 'Thermal')?.click());
  await page.waitForTimeout(500);
  await page.evaluate((t) => [...document.querySelectorAll('#print-root button')].find(x => x.textContent.includes(t))?.click(), btn);
  await page.waitForTimeout(600);
  const html = norm(await page.evaluate(() => window.__w.join('\n----\n')));
  await page.close();
  const file = join(dir, `${name}.html`);
  if (update || !existsSync(file)) { mkdirSync(dir, { recursive: true }); writeFileSync(file, html); console.log(`wrote ${name} (${html.length} bytes)`); continue; }
  const gold = readFileSync(file, 'utf8');
  if (gold === html) console.log(`${name}: identical`);
  else { bad++; console.log(`${name}: DIFFERS (${gold.length} -> ${html.length} bytes)`); }
}
await browser.close();
process.exit(bad ? 1 : 0);
