// End-to-end check against `vite preview`: every page, every control, mobile overflow, installability.
// Supabase is mocked; map tiles and the ai-menu script come from the network.
import { createRequire } from 'node:module';
// Playwright is preinstalled globally in the build environment; NODE_PATH points require() at it.
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173';
const SHOTS = process.env.SHOTS || 'test-results';
mkdirSync(SHOTS, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
await new Promise(r => { server.stdout.on('data', d => { if (String(d).includes('4173')) r(); }); setTimeout(r, 8000); });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
const rpcCalls = [];
await ctx.route('**/*.supabase.co/**', async route => {
  const url = route.request().url();
  if (url.includes('/rpc/')) { rpcCalls.push({ url, body: route.request().postData() }); return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"not found"}' }); }
  if (url.includes('kr_findings') || url.includes('kr_updates')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  return route.fulfill({ status: 404, body: '{}' });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/tiles|arcgis|fonts|Failed to load resource|WebGL|GPU/i.test(m.text())) errors.push(m.text()); });

// ---------- landing ----------
await page.goto(BASE + '/', { waitUntil: 'load' });
ok(await page.locator('h1').innerText().then(t => t.includes('מה הולך יחד')), 'landing headline');
ok(await page.locator('html').getAttribute('dir') === 'rtl', 'document is RTL');
await page.waitForFunction(() => document.querySelectorAll('.hero-stage polygon').length > 50, null, { timeout: 15000 }).catch(() => {});
ok(await page.locator('.hero-stage polygon').count() > 50, 'hero animation draws the city hexagons');
await page.waitForSelector('ai-menu .logo', { timeout: 15000 }).catch(() => {});
ok(await page.locator('ai-menu .logo').isVisible().catch(() => false), 'A&I logo button in the top bar');
ok(await page.locator('ai-menu').getAttribute('brand') === 'ashdod', 'municipal brand on the logo button');
ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
ok(await page.locator('img[alt*="עיריית אשדוד"]').first().isVisible(), 'municipal logo on the landing page');
await page.waitForSelector('.finding-row', { timeout: 20000 }).catch(() => {});
ok(await page.locator('.finding-row').count() >= 3, 'live findings computed on the landing page');
await page.waitForTimeout(2600);
await page.screenshot({ path: `${SHOTS}/01-landing.png` });
await page.screenshot({ path: `${SHOTS}/02-landing-full.png`, fullPage: true });

// brand link returns home
await page.click('.nav >> text=שיטה');
await page.waitForURL('**/method');
await page.click('.brand');
await page.waitForURL(BASE + '/');
ok(true, 'app name links to the home page');

// ---------- lab ----------
await page.goto(BASE + '/lab', { waitUntil: 'load' });
await page.waitForSelector('[data-testid="r-value"]', { timeout: 30000 });
ok(await page.locator('[data-testid="r-value"]').isVisible(), 'lab computes r');
ok(await page.locator('[data-testid="scatter"] circle').count() > 30, 'scatter points drawn');
ok(await page.locator('[data-testid="reliability"]').isVisible(), 'reliability index shown');
ok(await page.locator('.maplibregl-canvas').count() === 1, 'map canvas present');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/03-lab.png` });

await page.selectOption('#vx', 'bld_coverage');
await page.waitForURL(/x=bld_coverage/);
await page.waitForFunction(() => document.querySelector('[data-testid="headline"]')?.textContent?.includes('תכסית'), null, { timeout: 20000 }).catch(() => {});
ok((await page.locator('[data-testid="headline"]').innerText()).includes('תכסית'), 'changing X updates the finding and the address');
await page.click('text=החלפת X ו-Y');
await page.waitForURL(/x=lst/);
ok(page.url().includes('y=bld_coverage'), 'swap X and Y');
await page.selectOption('#vc', 'dist_water');
await page.waitForURL(/c=dist_water/);
await page.waitForSelector('text=r חלקי', { timeout: 20000 }).catch(() => {});
ok(await page.locator('text=r חלקי').first().isVisible(), 'control variable gives a partial correlation');
for (const u of ['רובעים', 'משושים קטנים', 'משושים גדולים']) {
  await page.click(`.side .seg >> text=${u}`);
  await page.waitForTimeout(400);
}
await page.waitForSelector('[data-testid="r-value"]', { timeout: 30000 });
ok(page.url().includes('u=h3-8'), 'unit switch updates the address');
for (const m of ['אשכולות', 'משתנה X', 'משתנה Y', 'דו-משתני']) { await page.click(`.mapbox .seg >> text=${m}`); await page.waitForTimeout(250); }
ok(page.url().includes('m=bivar'), 'map modes switch');
await page.click('.mapbox .seg >> text=אשכולות');
await page.click('.mapbox .seg >> text=לוויין');
await page.click('.mapbox .seg >> text=תלת-ממד');
await page.waitForTimeout(2500);
ok(page.url().includes('d=1') && page.url().includes('b=satellite'), '3D and satellite basemap');
await page.screenshot({ path: `${SHOTS}/04-lab-3d-lisa.png` });
await page.click('.mapbox .seg >> text=תלת-ממד');
await page.click('.mapbox .seg >> text=בהירה');
// scatter point opens a unit card
await page.locator('[data-testid="scatter"] circle').nth(3).click({ force: true });
ok(await page.locator('text=סגירה').isVisible(), 'clicking a scatter point opens the unit card');
await page.click('text=סגירה');
await page.click('text=שמירת הממצא');
await page.waitForSelector('.toast', { timeout: 8000 });
ok((await page.locator('.toast').innerText()).includes('נשמר'), 'save finding falls back to this browser when not an editor');

// ---------- matrix ----------
await page.click('.nav >> text=מטריצה');
await page.waitForSelector('[data-testid="matrix"] td', { timeout: 30000 });
ok(await page.locator('[data-testid="matrix"] td').count() > 400, 'matrix cells rendered');
await page.click('.seg >> text=הכול');
await page.screenshot({ path: `${SHOTS}/05-matrix.png` });
await page.locator('[data-testid="matrix"] td[tabindex="0"]').nth(5).click();
await page.waitForURL(/\/lab\?x=/);
ok(true, 'matrix cell opens the lab');

// ---------- atlas, findings, method, updates ----------
await page.click('.nav >> text=אטלס');
await page.waitForSelector('[data-testid="atlas"] svg path', { timeout: 20000 });
ok(await page.locator('[data-testid="atlas"] .card').count() === 24, 'atlas shows 24 maps');
await page.screenshot({ path: `${SHOTS}/06-atlas.png` });
await page.click('.nav >> text=ממצאים');
await page.waitForSelector('[data-testid="findings"] h3', { timeout: 10000 });
ok((await page.locator('[data-testid="findings"]').innerText()).includes('בדפדפן בלבד'), 'saved finding listed');
await page.screenshot({ path: `${SHOTS}/07-findings.png` });
await page.click('.nav >> text=שיטה');
const before = await page.locator('.r-big').innerText();
await page.locator('input[type=range]').fill('-0.8');
await page.waitForTimeout(300);
ok(before !== await page.locator('.r-big').innerText(), 'method demo slider changes r');
await page.click('.nav >> text=מה חדש');
await page.waitForSelector('[data-testid="updates"] h3');
ok(await page.locator('[data-testid="updates"] h3').count() >= 4, 'release notes listed');

// ---------- editor link ----------
await page.goto(BASE + '/?edit=test-key', { waitUntil: 'domcontentloaded' });
ok(!page.url().includes('edit='), 'edit key removed from the address');
await page.waitForTimeout(2500);
ok(rpcCalls.some(c => c.url.includes('kr_editor')), 'editor key is verified with the server');

// ---------- installability ----------
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
ok(inst.installabilityErrors.length === 0, 'installable: ' + JSON.stringify(inst.installabilityErrors));

// ---------- mobile ----------
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
const mp = await m.newPage();
for (const path of ['/', '/lab', '/matrix', '/atlas', '/findings', '/method', '/updates']) {
  await mp.goto(BASE + path, { waitUntil: 'load' });
  await mp.waitForTimeout(path === '/lab' ? 3000 : 800);
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `mobile ${path}: no horizontal scroll (${over}px)`);
  if (path === '/' || path === '/lab') await mp.screenshot({ path: `${SHOTS}/m-${path === '/' ? 'landing' : 'lab'}.png`, fullPage: path === '/lab' });
}

ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 5).join(' | '));
await browser.close();
server.kill();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
