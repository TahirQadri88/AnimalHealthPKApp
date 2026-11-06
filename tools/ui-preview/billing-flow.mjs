// Walks the real billing form in the full-app preview, the way a person bills, and fails on
// anything that would cost them an invoice. Run against the preview server:
//   npx vite --config tools/ui-preview/vite.config.mjs --port 5174 --strictPort
//   node tools/ui-preview/billing-flow.mjs [--inject=<css>]
//
// Desktop, keyboard only: pick a customer, add products by typing, the quantity of the line just
// added takes focus each time, +1 on a line already there, Shift+Enter adds a bonus line, the
// pinned bar's SKUs / units / total equal what the lines on screen add up to, a refused save
// writes nothing, Ctrl+Enter pressed twice writes ONE invoice, Escape in a search keeps the form,
// Escape on a changed form asks first, and Escape on that question does not also close the form.
// Phone (360 and 390): the bar sits inside the screen, collapsed it is small, it opens and closes,
// the buttons are not under the bottom menu, the Notes field can be scrolled clear of the bar, and
// the three money fields line up.
import { createRequire } from 'node:module';
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const inject = arg('inject', '');
const URL = 'http://localhost:5174/tools/ui-preview/app.html?slow=300';
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };

const browser = await chromium.launch();

const openForm = async (page) => {
  await page.goto(URL, { waitUntil: 'networkidle' });
  if (inject) await page.addStyleTag({ content: inject });
  await page.waitForTimeout(400);
  await page.click('[data-sidenav="billing"] >> visible=true');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.click('button:has-text("New invoice") >> visible=true').catch(async () => {
    await page.click('button:text-is("New") >> visible=true');
  });
  await page.waitForSelector('[data-billing-form]');
  await page.waitForTimeout(300);
};
const focusInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { qty: a?.hasAttribute('data-item-qty'), key: a?.closest('[data-item-row]')?.getAttribute('data-key'), ph: a?.getAttribute('placeholder') };
});
const lines = (page) => page.$$eval('[data-item-row]', rows => rows.map(r => {
  const [rate] = r.querySelectorAll('input[type=number]');
  return { key: r.getAttribute('data-key'), rate: Number(rate.value), qty: Number(r.querySelector('[data-item-qty]').value), bonus: r.textContent.includes('Free') };
}));
const bar = (page) => page.$$eval('[data-summary]', els => Object.fromEntries(els.map(e => [e.getAttribute('data-summary'), e.textContent])));
const money = (t) => Number(String(t).replace(/^\D*Rs\.\s*/, '').replace(/[^0-9.-]/g, ''));

// ── Desktop, keyboard only ───────────────────────────────────────────────────────────────
// A step that cannot run is a failure too, and the run carries on to the next section.
const section = async (name, fn) => { try { await fn(); } catch (e) { check(false, `${name}: stopped: ${e.message.split('\n')[0]}`); } };
for (const dw of [1280, 1920]) await section(`desktop ${dw}`, async () => {
  const page = await browser.newPage({ viewport: { width: dw, height: 900 } });
  page.setDefaultTimeout(5000); page.on('pageerror', e => fails.push(`page error: ${e.message}`));
  await openForm(page);
  await page.keyboard.type('cash sale');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check((await focusInfo(page)).ph === 'Search products', 'picking a customer moves to product search');

  const picks = [['Trifas Suspension', '101', '3'], ['Hepta Sef', '102', '10'], ['Tylosin 20', '108', '4'], ['MILK POWDER 20KG', '109', '2'], ['ivermectin', '105', '6']];
  for (const [q, id, n] of picks) {
    await page.keyboard.type(q);
    await page.waitForTimeout(80);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const f = await focusInfo(page);
    check(f.qty && f.key === id, `"${q}" + Enter adds it and focuses its quantity (${f.key})`);
    await page.keyboard.type(n);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  check((await focusInfo(page)).ph === 'Search products', 'Enter on a quantity returns to product search');

  await page.keyboard.type('Trifas Suspension'); await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  let L = await lines(page);
  const f1 = await focusInfo(page);
  check(L.find(l => l.key === '101')?.qty === 4 && f1.key === '101' && L.length === 5, 'adding a product already on the bill adds one and focuses that line');
  await page.keyboard.press('Enter');

  await page.keyboard.type('Hepta Sef'); await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(120);
  L = await lines(page);
  check(L.some(l => l.key === '102_bonus' && l.bonus), 'Shift+Enter adds a bonus line');
  await page.keyboard.press('Enter');

  const b = await bar(page);
  const paid = L.filter(l => !l.bonus);
  // Delivery carries over from the customer's last bill; discount is whatever the form holds.
  const [dlv, , dsc] = await page.$$eval('[data-billing-form] .grid input[type=number]', els => els.slice(-3).map(e => Number(e.value) || 0));
  const exp = { skus: L.length, units: paid.reduce((s, l) => s + l.qty, 0), total: paid.reduce((s, l) => s + l.rate * l.qty, 0) + dlv - dsc };
  check(Number(b.skus) === exp.skus && Number(b.units) === exp.units && money(b.total) === exp.total,
    `bar shows ${b.skus} SKUs, ${b.units} units, ${b.total}; lines add up to ${exp.skus}, ${exp.units}, Rs. ${exp.total}`);
  check(Number(b.bonusUnits) === 1, 'bar counts the free units apart');

  await page.keyboard.type('zzzz');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check(!!(await page.$('[data-billing-form]')) && (await page.inputValue('input[placeholder="Search products"]')) === ''
    && !(await page.isVisible('text=Discard the changes to this bill?')), 'Escape in the search clears it, keeps the form, and asks nothing');

  // A refused bill writes nothing and points at the fault.
  const qty = page.locator('[data-item-row][data-key="105"] [data-item-qty]');
  await qty.fill('0');
  await page.evaluate(() => { window.__writes = []; });
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(700);
  const w0 = await page.evaluate(() => (window.__writes || []).filter(w => w.collection === 'invoices').length);
  const inval = await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'));
  check(w0 === 0 && !!(await page.$('[data-billing-form]')), 'quantity 0: Ctrl+Enter writes nothing and the form stays');
  check(inval === 'true', 'the faulty field takes focus');
  await qty.fill('6');

  // Two presses, one invoice.
  await page.evaluate(() => { window.__writes = []; });
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(2000);
  const inv = await page.evaluate(() => (window.__writes || []).filter(w => w.collection === 'invoices'));
  check(inv.length === 1, `Ctrl+Enter twice writes exactly one invoice (${inv.length}: ${inv.map(w => w.id).join(', ')})`);
  check(inv[0] && money(b.total) === inv[0].value.total, `the saved total equals the bar (${inv[0]?.value.total})`);
  check(!(await page.$('[data-billing-form]')), 'the form closes after saving');

  // Escape on a changed draft asks; Escape on the question cancels only the question.
  await page.click('button:has-text("New invoice") >> visible=true');
  await page.waitForSelector('[data-billing-form]');
  await page.waitForTimeout(250);
  await page.keyboard.type('cash sale'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.keyboard.type('Meloxicam'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(await page.isVisible('text=Discard the changes to this bill?'), 'Escape on a changed bill asks before discarding');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(!(await page.isVisible('text=Discard the changes to this bill?')) && !!(await page.$('[data-billing-form]')), 'Escape on the question keeps the bill');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.click('button:has-text("Confirm")'); await page.waitForTimeout(200);
  check(!(await page.$('[data-billing-form]')), 'confirming discards and closes');

  // Ctrl+S on a new bill saves a Draft Order.
  await page.click('button:has-text("New invoice") >> visible=true');
  await page.waitForSelector('[data-billing-form]'); await page.waitForTimeout(250);
  await page.keyboard.type('cash sale'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.keyboard.type('Meloxicam'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.evaluate(() => { window.__writes = []; });
  await page.keyboard.press('Control+s'); await page.waitForTimeout(1500);
  const d = await page.evaluate(() => (window.__writes || []).filter(w => w.collection === 'invoices'));
  check(d.length === 1 && d[0].value.status === 'Booked' && d[0].id.startsWith('ORD-'), `Ctrl+S saves a Draft Order (${d.map(x => x.id)})`);
  await page.close();
});

// ── Phone ────────────────────────────────────────────────────────────────────────────────
for (const width of [360, 390]) await section(`phone ${width}`, async () => {
  const page = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true });
  page.setDefaultTimeout(5000); page.on('pageerror', e => fails.push(`page error: ${e.message}`));
  await openForm(page);
  await page.keyboard.type('cash sale'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  for (const q of ['Trifas', 'MILK POWDER', 'Tylosin']) {
    await page.fill('input[placeholder="Search products"]', q);
    await page.waitForTimeout(100);
    await page.tap('[data-prod-idx="0"] button >> nth=0');
    await page.waitForTimeout(150);
  }
  check((await lines(page)).length === 3, `${width}: three products added by tapping`);
  check((await focusInfo(page)).ph === 'Search products', `${width}: after a tap the search keeps focus for the next product`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(200);
  const r = await page.$eval('[data-summary-bar]', el => { const b = el.getBoundingClientRect(); const s = el.firstElementChild.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, strip: s.height, h: b.height }; });
  check(r.bottom <= 740 + 0.5 && r.top > 0, `${width}: bar is inside the screen (${Math.round(r.top)}-${Math.round(r.bottom)})`);
  check(r.strip <= 48, `${width}: collapsed figures strip is one row (${Math.round(r.strip)}px)`);
  check(r.h <= 130, `${width}: whole bar collapsed is ${Math.round(r.h)}px`);
  const hit = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('[data-summary-bar] button')].find(b => b.textContent.includes('Issue Invoice'));
    const bb = btn.getBoundingClientRect();
    const at = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
    return btn.contains(at);
  });
  check(hit, `${width}: Issue Invoice is not under anything (bottom menu)`);
  await page.tap('[data-summary-bar] button[aria-expanded]');
  await page.waitForTimeout(150);
  const open = await page.$eval('#invoice-summary-detail', el => window.getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 20);
  check(open, `${width}: tapping the strip opens the breakdown`);
  const r2 = await page.$eval('[data-summary-bar]', el => el.getBoundingClientRect().top);
  check(r2 > 740 * 0.4, `${width}: opened bar still leaves most of the screen (${Math.round(r2)})`);
  await page.tap('[data-summary-bar] button[aria-expanded]');
  await page.waitForTimeout(150);
  const notes = await page.evaluate(() => {
    const t = document.querySelector('[data-billing-form] textarea');
    t.scrollIntoView({ block: 'end' });
    const barTop = document.querySelector('[data-summary-bar]').getBoundingClientRect().top;
    return { bottom: t.getBoundingClientRect().bottom, barTop };
  });
  check(notes.bottom <= notes.barTop + 0.5, `${width}: Notes scroll clear of the bar (${Math.round(notes.bottom)} <= ${Math.round(notes.barTop)})`);
  const lefts = await page.$$eval('[data-billing-form] .grid input[type=number]', els => els.slice(-3).map(e => Math.round(e.getBoundingClientRect().left)));
  check(lefts.length === 3 && new Set(lefts).size === 1, `${width}: Delivery / Driver / Discount stacked in line (${lefts})`);
  const spill = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(spill <= 0, `${width}: nothing spills sideways (${spill}px)`);
  await page.screenshot({ path: `tools/ui-preview/shots/billing-flow-${width}.png` });
  await page.close();
});

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
