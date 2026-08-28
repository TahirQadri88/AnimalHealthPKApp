// Loads the built app in a real browser and fails on any load-time JS error.
//
// Scope: this only exercises the FIRST screen (the login view). It catches a bundle that
// fails outright, and nothing deeper — verified against the isTransportMethod crash, which
// it passed happily because that fault lives on the billing screen, behind a login this
// sandbox cannot complete. `npm run lint` is what catches out-of-scope identifiers; treat
// this as a coarse "does the bundle boot" check, not a regression net.
//
//   npm run build
//   npx serve -s dist -l 4173 &
//   node tools/smoke-test.mjs http://localhost:4173/
//
// Set CHROMIUM_PATH to pin a browser binary (this sandbox: /opt/pw-browsers/chromium).
//
// Needs playwright (npm i -D playwright). Network calls to Firestore are expected to
// fail outside the browser sandbox; only JS errors are treated as fatal.
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173/';
const errors = [];
// Only pin a binary when one is named. Hardcoding a sandbox path makes launch throw
// ENOENT everywhere else; unset, playwright finds its own download.
const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
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
