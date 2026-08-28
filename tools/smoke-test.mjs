// Loads the built app in a real browser and fails on any load-time JS error.
//
// Exists because a green `vite build` does not mean the page runs: a helper was once
// inserted inside a component body instead of at module scope, which compiles fine and
// then throws ReferenceError for every other component at runtime. The app shipped
// broken. This catches that class of error in about ten seconds.
//
//   npm run build
//   npx serve -s dist -l 4173 &
//   node tools/smoke-test.mjs http://localhost:4173/
//
// Needs playwright (npm i -D playwright). Network calls to Firestore are expected to
// fail outside the browser sandbox; only JS errors are treated as fatal.
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173/';
const errors = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
await page.goto(base, { waitUntil: 'load' });
await page.waitForTimeout(6000);
const bodyLen = (await page.textContent('body') || '').trim().length;
await browser.close();

const fatal = errors.filter(e =>
  /ReferenceError|is not defined|Can't find variable|is not a function|Cannot read/.test(e));

console.log('rendered text length:', bodyLen);
console.log('fatal errors:', fatal.length);
fatal.forEach(e => console.log('  ' + e));
if (bodyLen < 20) console.log('WARNING: page rendered almost nothing');
process.exit(fatal.length || bodyLen < 20 ? 1 : 0);
