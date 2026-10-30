// End-to-end check against `vite preview`: every verb page, every tab and control, mobile overflow,
// reduced motion, installability, redirects from 2.0 addresses. Supabase is mocked; tiles come from the network.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
// Playwright is preinstalled globally in the build environment; NODE_PATH points require() at it.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = 'http://localhost:4173';
const SHOTS = process.env.SHOTS || 'test-results';
mkdirSync(SHOTS, { recursive: true });
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
await new Promise(r => { server.stdout.on('data', d => { if (String(d).includes('4173')) r(); }); setTimeout(r, 8000); });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL', acceptDownloads: true });
const rpcCalls = [];
await ctx.route('**/*.supabase.co/**', async route => {
  const url = route.request().url();
  if (url.includes('/rpc/')) { rpcCalls.push({ url, body: route.request().postData() }); return route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"not_authorized"}' }); }
  if (url.includes('kr_findings') || url.includes('kr_updates')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  return route.fulfill({ status: 404, body: '{}' });
});
await ctx.route('**/nominatim.openstreetmap.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[{"lat":"31.8","lon":"34.65"}]' }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !/tiles|arcgis|fonts|Failed to load resource|WebGL|GPU/i.test(m.text())) errors.push(m.text()); });
// Every card in a row shares the same horizontal lines: same top, same height, and the n-th line of
// each card on the same y. Returns the worst misalignment in px over all .cards grids on the page.
const misalign = () => page.evaluate(() => {
  let worst = 0;
  for (const grid of document.querySelectorAll('.cards')) {
    const cards = [...grid.children].filter(c => c.getBoundingClientRect().height > 0);
    const rows = new Map();
    for (const c of cards) { const t = Math.round(c.getBoundingClientRect().top); rows.set(t, [...(rows.get(t) || []), c]); }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const h = row.map(c => c.getBoundingClientRect().height);
      worst = Math.max(worst, Math.max(...h) - Math.min(...h));
      const n = Math.min(...row.map(c => c.children.length));
      for (let k = 0; k < n; k++) {
        const ys = row.map(c => c.children[k].getBoundingClientRect().top);
        worst = Math.max(worst, Math.max(...ys) - Math.min(...ys));
      }
    }
  }
  return Math.round(worst);
});
const go = async (path, wait) => { await page.goto(BASE + path, { waitUntil: 'load' }); if (wait) await page.waitForSelector(wait, { timeout: 30000 }).catch(() => {}); };

// ---------- landing ----------
await go('/', '.hero h1');
ok((await page.locator('h1').innerText()).includes('מה הולך יחד'), 'landing headline');
ok(await page.locator('html').getAttribute('dir') === 'rtl', 'document is RTL');
await page.waitForFunction(() => document.querySelectorAll('.hero svg polygon').length > 200, null, { timeout: 15000 }).catch(() => {});
ok(await page.locator('.hero svg polygon').count() > 200, 'light table draws four layers of hexagons');
await page.waitForSelector('ai-menu .logo', { timeout: 15000 }).catch(() => {});
ok(await page.locator('ai-menu .logo').isVisible().catch(() => false), 'A&I logo button in the top bar');
ok(await page.locator('ai-menu').getAttribute('brand') === 'ashdod', 'municipal brand on the logo button');
ok(!(await page.locator('header >> text=העתקת קישור').first().isVisible().catch(() => false)), 'no loose development buttons in the bar');
ok(await page.locator('.nav a').count() === 7, 'seven steps in the navigation, in working order');
ok(await page.locator('img[alt*="עיריית אשדוד"]').first().isVisible(), 'municipal logo on the landing page');
await page.waitForSelector('.finding-row', { timeout: 30000 }).catch(() => {});
ok(await page.locator('.finding-row').count() >= 3, 'live discoveries on the landing page');
const radius = await page.evaluate(() => [...document.querySelectorAll('.btn, .seg button, .check, .nav a')].map(e => getComputedStyle(e).borderTopLeftRadius).filter(r => r !== '0px').length);
ok(radius === 0, `square buttons everywhere (${radius} rounded)`);
await page.locator('[data-testid="verbs"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
const mLanding = await misalign();
ok(mLanding <= 1, `landing cards on shared horizontal lines (${mLanding}px)`);
await page.locator('.check').first().hover();
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/01-landing.png` });
await page.click('.brand');
ok(new URL(page.url()).pathname === '/', 'app name links to the home page');

// ---------- measure ----------
await go('/measure', '[data-testid="profile"] .tone');
ok(await page.locator('[data-testid="profile"] .tone').count() === 3, 'place profile checks three walking targets');
await page.fill('#q', 'הרצל');
await page.click('button[type=submit]');
await page.waitForURL(/p=/, { timeout: 10000 }).catch(() => {});
ok(page.url().includes('n=') && (await page.locator('[data-testid="profile"]').innerText()).includes('הרצל'), 'street search moves the profile');
await page.click('text=800 מ\'');
await page.waitForURL(/r=800/);
ok((await page.locator('[data-testid="profile"]').innerText()).includes('800'), 'walking radius changes the profile');
for (const l of ['צמחייה', 'תחבורה', 'גני ילדים', 'בינוי', 'חום']) await page.click(`.mapframe .seg >> text=${l}`);
ok(page.url().includes('layer=lst'), 'map layer buttons');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${SHOTS}/02-measure.png` });
ok(await page.locator('[data-testid="measure-legend"]').isVisible(), 'map legend on the measure map');
ok(await page.locator('.tone-solution, .tone-mid, .tone-problem').count() >= 3, 'walking targets in traffic-light tones');
ok(await page.locator('[data-testid="shimur-photos"] img').count() >= 1, 'real photos of nearby conservation buildings');
await page.click('.tabs >> text=אטלס השכבות');
await page.waitForSelector('[data-testid="atlas"] svg path', { timeout: 20000 });
ok(await page.locator('[data-testid="atlas"] .card').count() >= 24, 'atlas tab inside measure');

// ---------- know ----------
await go('/know', '[data-testid="discoveries"] article');
ok(await page.locator('[data-testid="discoveries"] article').count() >= 3, 'discovery engine returns cards');
await page.waitForTimeout(800);
const mKnow = await misalign();
ok(mKnow <= 1, `discovery cards on shared horizontal lines (${mKnow}px)`);
await page.screenshot({ path: `${SHOTS}/03-know.png` });
ok(await page.locator('[data-testid="discoveries"] .mini-legend').count() >= 3, 'every discovery map has a legend');
ok(await page.locator('[data-testid="discoveries"] .tl').count() >= 3, 'reliability as a traffic light');
ok(await page.locator('[data-testid="discoveries"] mark.insight').count() >= 3, 'insights in the yellow marker');
ok(await page.locator('[data-testid="discoveries"] strong .num, [data-testid="discoveries"] .num').count() >= 6, 'numbers bold and isolated');
await page.click('.seg >> text=טבלה ממוינת');
await page.waitForSelector('[data-testid="discoveries-table"] tbody tr');
const firstBefore = await page.locator('[data-testid="discoveries-table"] tbody tr:not(.group)').first().innerText();
await page.click('[data-testid="discoveries-table"] th >> text=מתאם גולמי');
const firstAfter = await page.locator('[data-testid="discoveries-table"] tbody tr:not(.group)').first().innerText();
ok(firstBefore !== firstAfter || await page.locator('[data-testid="discoveries-table"] th[aria-sort="descending"]').count() === 1, 'discoveries table sorts by column');
await page.click('.seg >> text=כרטיסים');
for (const k of ['נקודת מפנה', 'נשאר באזורים דומים', 'הכול']) await page.locator(`.seg button:has-text("${k}")`).first().click();
await page.click('text=רק בין תחומים שונים');
ok(page.url().includes('x=0'), 'cross-domain filter toggles');
await page.click('.seg >> text=רובעים');
await page.waitForSelector('[data-testid="discoveries"] article', { timeout: 30000 });
ok(page.url().includes('u=quarters'), 'discovery scale switch');
await page.click('.tabs >> text=אני בוחרת שכבות');
await page.waitForSelector('[data-testid="explore-insight"]', { timeout: 20000 });
ok(await page.locator('[data-testid="explore-insight"]').isVisible(), 'explorer explains the chosen layers');
await page.click('.check >> text=צמתים');
await page.waitForURL(/intersections/);
await page.selectOption('#tgt', 'bld_coverage');
await page.waitForURL(/t=bld_coverage/);
ok(await page.locator('text=סוגי אזורים בעיר').first().isVisible(), 'explorer area types');
await page.screenshot({ path: `${SHOTS}/04-explorer.png`, fullPage: true });
await page.click('.tabs >> text=מטריצה מלאה');
await page.waitForSelector('[data-testid="matrix"] td', { timeout: 30000 });
ok(await page.locator('[data-testid="matrix"] td').count() > 400, 'matrix tab');
await page.locator('[data-testid="matrix"] td[tabindex="0"]').nth(4).click();
await page.waitForURL(/\/lab\?x=/);
ok(true, 'matrix cell opens the lab');

// ---------- lab ----------
await go('/lab', '[data-testid="r-value"]');
ok(await page.locator('[data-testid="scatter"] circle').count() > 30, 'lab scatter');
ok(await page.locator('[data-testid="reliability"]').isVisible(), 'lab reliability index');
ok(await page.locator('[data-testid="story"] .tone-insight mark.insight, [data-testid="story"] mark.insight').count() >= 1, 'lab story has a marked insight');
ok(await page.locator('.explain').first().isVisible(), 'lab explanation sentence under the insight line');
ok(await page.locator('.explain br').count() >= 1, 'every sentence starts on a new line');
await page.selectOption('#vx', 'bld_coverage');
await page.waitForURL(/x=bld_coverage/);
await page.selectOption('#vc', 'dist_water');
await page.waitForSelector('text=כשמשווים רק מקומות עם', { timeout: 20000 }).catch(() => {});
ok(await page.locator('text=כשמשווים רק מקומות עם').first().isVisible(), 'lab compares like with like');
for (const u of ['רובעים', 'משושים קטנים', 'משושים גדולים']) { await page.click(`.side .seg >> text=${u}`); await page.waitForTimeout(300); }
for (const m of ['מוקדים חריגים', 'רק ', 'שתי השכבות יחד']) await page.locator(`.mapbox .seg button:has-text("${m}")`).first().click();
await page.click('.mapbox .seg >> text=תלת-ממד');
await page.waitForTimeout(1500);
ok(page.url().includes('d=1'), 'lab 3D');
await page.click('.mapbox .seg >> text=תלת-ממד');
await page.waitForSelector('[data-testid="r-value"]', { timeout: 30000 });
await page.click('text=שמירת הממצא');
await page.waitForSelector('.toast', { timeout: 8000 });
ok((await page.locator('.toast').innerText()).includes('נשמר'), 'save finding falls back to this browser');

// ---------- plan ----------
await go('/plan', '[data-testid="rules"] article');
ok(await page.locator('[data-testid="rules"] article').count() >= 3, 'candidate rules');
ok(await page.locator('[data-testid="rules"] .tone-solution').first().isVisible(), 'each rule says what to do');
await page.locator('text=אימוץ הכלל').first().click();
await page.waitForSelector('.toast', { timeout: 8000 });
ok((await page.locator('.toast').innerText()).includes('נשמר'), 'adopting a rule saves it');
await page.screenshot({ path: `${SHOTS}/05-plan.png` });
await page.click('.tabs >> text=תאום עירוני');
await page.waitForSelector('text=כל רבע היחידות הגרוע', { timeout: 20000 });
await page.click('text=כל רבע היחידות הגרוע');
await page.locator('input[type=range]').first().fill('15');
await page.waitForTimeout(300);
ok((await page.locator('[data-testid="twin-effect"]').innerText()).includes('טווח סביר'), 'twin computes a scenario with a range');
await page.click('.seg >> text=משושים קטנים');
await page.waitForURL(/u=h3-9/);
ok(true, 'twin scale switch');
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/06-twin.png` });

// ---------- act: rules of thumb ----------
await go('/act', '[data-testid="thumbs"] article');
ok(await page.locator('[data-testid="directive"]').count() >= 3, 'rules of thumb written as instructions');
const firstDirective = await page.locator('[data-testid="directive"]').first().innerText();
ok(/^(במקומות|לפני|בדקו|הוסיפו|צמצמו|כשמתכננים|אל)/.test(firstDirective.trim()), `a rule of thumb starts with an action (${firstDirective.slice(0, 30)})`);
ok(await page.locator('[data-testid="next-step"]').isVisible(), 'every page ends with the next step');
await page.waitForTimeout(600);
const mAct = await misalign();
ok(mAct <= 1, `rule cards on shared horizontal lines (${mAct}px)`);

// ---------- plain language ----------
for (const path of ['/lab', '/know', '/plan']) {
  await go(path, path === '/lab' ? '[data-testid="story"]' : path === '/know' ? '[data-testid="discoveries"] article' : '[data-testid="rules"] article');
  const text = await page.locator('main').innerText();
  const jargon = ['משתנה X', 'משתנה Y', 'X ו-Y', 'תיקון מרחבי', 'אוטוקורלציה', 'ניטרול', 'מובהק'].filter(w => text.includes(w));
  ok(jargon.length === 0, `${path}: no jargon (${jargon.join(', ')})`);
}

// ---------- learn ----------
await go('/learn', '[data-testid="tours"] article');
ok(await page.locator('[data-testid="tours"] article').count() === 4, 'four learning tours');
const dupSteps = await page.evaluate(() => [...document.querySelectorAll('[data-testid="tours"] article')].some(a => { const t = [...a.querySelectorAll('[aria-label="התקדמות"] button')].map(b => b.textContent); return new Set(t).size !== t.length; }));
ok(!dupSteps, 'no tour has two buttons with the same name');
await page.waitForTimeout(800);
const mLearn = await misalign();
ok(mLearn <= 1, `tour cards on shared horizontal lines (${mLearn}px)`);
await page.locator('text=לשלב הבא').first().click();
await page.fill('#note-sea', 'הים מקרר יותר מהעצים');
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#note-sea');
ok(await page.inputValue('#note-sea') === 'הים מקרר יותר מהעצים', 'learning note is saved and reloads');
await page.click('.tabs >> text=שיטה ומקורות');
await page.waitForSelector('input[type=range]');
const before = await page.locator('.r-big').innerText();
await page.locator('input[type=range]').fill('-0.8');
await page.waitForTimeout(300);
ok(before !== await page.locator('.r-big').innerText(), 'method demo slider');

// ---------- use ----------
await go('/use', '[data-testid="findings"] h3');
ok((await page.locator('[data-testid="findings"]').innerText()).includes('בדפדפן בלבד'), 'saved findings and rules listed');
await page.click('.tabs >> text=נתונים להורדה');
await page.waitForSelector('[data-testid="downloads"] button');
await page.waitForTimeout(600);
const mUse = await misalign();
ok(mUse <= 1, `download cards on shared horizontal lines (${mUse}px)`);
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('text=CSV לאקסל').first().click()]);
ok(dl.suggestedFilename().endsWith('.csv'), 'CSV download');
ok(await page.locator('[data-testid="dictionary"] tr').count() > 25, 'data dictionary');
await page.click('[data-testid="dictionary"] th >> text=מקור');
ok(await page.locator('[data-testid="dictionary"] th[aria-sort]:not([aria-sort="none"])').count() === 1, 'dictionary sorts by any column');
await page.click('text=רשימה אחת');
ok(await page.locator('[data-testid="dictionary"] tr.group').count() === 0, 'dictionary groups toggle');
await page.click('.tabs >> text=מה חדש');
await page.waitForSelector('[data-testid="updates"] h3');
ok(await page.locator('[data-testid="updates"] h3').count() >= 6, 'release notes');

// ---------- redirects, editor key ----------
await page.goto(BASE + '/matrix?u=quarters', { waitUntil: 'load' });
await page.waitForURL(/\/know\?/);
ok(page.url().includes('tab=matrix') && page.url().includes('u=quarters'), '2.0 address redirects and keeps its state');
await page.goto(BASE + '/?edit=test-key', { waitUntil: 'domcontentloaded' });
ok(!page.url().includes('edit='), 'edit key removed from the address');
await page.waitForTimeout(2500);
ok(rpcCalls.some(c => c.url.includes('kr_editor')), 'editor key is verified with the server');

// ---------- installability ----------
await go('/', '.hero h1');
await page.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
ok(inst.installabilityErrors.length === 0, 'installable: ' + JSON.stringify(inst.installabilityErrors));

// ---------- reduced motion ----------
const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
await rm.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
const rp = await rm.newPage();
await rp.goto(BASE + '/', { waitUntil: 'load' });
await rp.waitForTimeout(1500);
ok(await rp.locator('.hero svg polygon').count() > 200, 'reduced motion still shows the full light table');
await rm.close();

// ---------- mobile ----------
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await m.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
const mp = await m.newPage();
for (const path of ['/', '/measure', '/know', '/know?tab=pick', '/lab', '/plan', '/plan?tab=twin', '/learn', '/use?tab=data']) {
  await mp.goto(BASE + path, { waitUntil: 'load' });
  await mp.waitForTimeout(path === '/lab' || path === '/measure' ? 3500 : 1800);
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `mobile ${path}: no horizontal scroll (${over}px)`);
  if (['/', '/measure', '/know'].includes(path)) await mp.screenshot({ path: `${SHOTS}/m${path.replace(/\W/g, '-') || '-home'}.png` });
}

ok(errors.length === 0, 'no page errors: ' + errors.slice(0, 5).join(' | '));
await browser.close();
server.kill();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
