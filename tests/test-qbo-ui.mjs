/* QuickBooks on the page (teams/09-finance.js, the card at the top of Finances → Reports).
   The Finances office, before the keys are set: told an admin must add them. After: the
   Connect button opens Intuit's sign-in in a window of its own (a stand-in Intuit here —
   tests/qbo-fixtures.mjs); coming back through quickbooks.js says it's connected, and the
   app, shown again, finds the numbers in: the company, when they came in, the Locations
   to choose from; the P&L and the ageing listed as from QuickBooks. A Campus Director's
   dashboard says the month is from QuickBooks and still has no name on it. Disconnecting
   asks first. On a small phone nothing scrolls sideways; Khmer and dark render. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fakeIntuit, LAST } from './qbo-fixtures.mjs';

const TMP = tmpDir('qbo-ui');
const OUT = tmpDir('qbo-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const stores={};
export function getStore(o){
  const name=(typeof o==='string') ? o : o.name;
  const mem=stores[name]||(stores[name]={});
  return {
    get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
    setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
    delete: async (k)=>{ delete mem[k]; },
  };
}
export const __stores=stores;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.URL = 'https://example-gp.netlify.app';
delete process.env.QBO_CLIENT_ID; delete process.env.QBO_CLIENT_SECRET; delete process.env.QBO_ENV;
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const cb = await import(TMP + '/quickbooks.js');
const I = fakeIntuit();
blobs.getStore({ name: 'gp-data' });
const mem = blobs.__stores['gp-data'];
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = (o) => Object.assign({ active: true, campus: 'poipet', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st_fin', name: 'Bopha Keo', username: 'bopha', dept: 'Skills Training', ministry: 'Finances' }),
  mk({ id: 'st_cd', name: 'Mark Hill', username: 'mark', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st_dara', name: 'Dara Sok', username: 'dara', dept: 'Community Service', ministry: 'Cafe' }),
  mk({ id: 'st_vanna', name: 'Vanna Chan', username: 'vanna', dept: 'Youth Education', ministry: 'Kids Club' })
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const r = await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {});
    const t = await r.text(); res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(t); return;
  }
  if (req.url.indexOf('/.netlify/functions/quickbooks') === 0) {
    const r = await cb.default(new Request('https://example-gp.netlify.app' + req.url));
    res.writeHead(r.status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(await r.text()); return;
  }
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh', colorScheme: opts.dark ? 'dark' : 'light' }
    : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh', colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', (d) => { page.lastDialog = d.message(); d.accept(); });
  await ctx.route('**fonts.g**', (r) => r.abort());
  // Intuit's sign-in page: a stand-in that just shows where it was sent
  await ctx.route('https://appcenter.intuit.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Intuit</title><p>Sign in to QuickBooks</p>' }));
  await page.addInitScript((a) => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.lw) localStorage.setItem('gp-lw-tab', a.lw); if (a.km) localStorage.setItem('gp-lang', 'km'); localStorage.setItem('gp-fin-tab', a.tab || 'reports'); },
    { u: user, lw: opts.lw || '', km: !!opts.km, tab: opts.tab || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { S.view = 'ministry'; render(); window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const card = (p) => p.$eval('.finQbo', (e) => e.innerText).catch(() => '');
const noSideways = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* ---- before the keys ---- */
{
  const { ctx, page } = await open('bopha');
  const c = await card(page);
  ok('before the keys: the office is told an admin must add them, and there’s nothing to press', /once an admin has added/.test(c) && !(await page.$('#finQboConnect')), c.split('\n').slice(0, 2).join(' / '));
  await ctx.close();
}
process.env.QBO_CLIENT_ID = 'cid-test'; process.env.QBO_CLIENT_SECRET = 'csecret-test';

/* ---- connecting ---- */
{
  const { ctx, page } = await open('bopha');
  ok('with the keys: Connect QuickBooks', /Connect your QuickBooks company/.test(await card(page)) && !!(await page.$('#finQboConnect')));
  await page.screenshot({ path: OUT + '/1-connect.png', fullPage: false });
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('#finQboConnect')]);
  await pop.waitForURL(/appcenter\.intuit\.com/, { timeout: 10000 }).catch(() => {});
  const au = new URL(pop.url());
  ok('Intuit’s sign-in opens in a window of its own', au.host === 'appcenter.intuit.com' && au.searchParams.get('client_id') === 'cid-test' && !!au.searchParams.get('state'), pop.url().slice(0, 60));
  await page.waitForTimeout(300);
  ok('the app says to finish there and come back', /Finish signing in to QuickBooks/.test(await card(page)));
  // Intuit sends the window back to the app's quickbooks function
  await pop.goto(BASE + '/.netlify/functions/quickbooks?code=' + I.code + '&state=' + au.searchParams.get('state') + '&realmId=4620816365');
  const back = await pop.innerText('body');
  ok('the window says it’s connected, with a way back', /QuickBooks is connected/.test(back) && /Back to the app/.test(back));
  await pop.screenshot({ path: OUT + '/2-back-from-intuit.png' });
  await pop.close();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(1500);
  const c = await card(page);
  ok('back in the app: connected, and the numbers in', /Connected to Made-up Mission Org/.test(c) && /Last brought in .*2 months of the Profit and Loss, 3 names owing/.test(c), c.split('\n').slice(1, 3).join(' / '));
  ok('… the Locations to choose from', (await page.$$eval('#finQboFilter option', (o) => o.map((x) => x.textContent))).join() === 'The whole company,Poipet,Siem Reap');
  const all = await page.$eval('#finReports', (e) => e.innerText);
  ok('the saved P&L months and the staff debt say they’re from QuickBooks', (all.match(/from QuickBooks/g) || []).length >= 3 && /Bring the numbers in now/.test(all));
  await page.screenshot({ path: OUT + '/3-connected.png', fullPage: true });
  await page.click('#finQboSync'); await page.waitForTimeout(1500);
  ok('“Bring the numbers in now” does', /Brought in from QuickBooks/.test(await page.evaluate(() => document.body.innerText)));
  await page.selectOption('#finQboFilter', 'department|7'); await page.waitForTimeout(1500);
  ok('choosing this campus’s Location narrows the P&L', mem['finance:poipet'].pl[LAST].lines.find((l) => l.code === '50300').amt === 600 && (await page.$eval('#finQboFilter', (s) => s.value)) === 'department|7');
  await page.click('[data-fintab="dash"]'); await page.waitForTimeout(1000);
  ok('the office’s dashboard: the month is from QuickBooks', /From QuickBooks · brought in/.test(await page.$eval('#finDash', (e) => e.innerText)));
  await ctx.close();
}

/* ---- leadership ---- */
{
  const { ctx, page } = await open('mark', { lw: 'money' });
  await page.waitForTimeout(800);
  const d = await page.$eval('#finDash', (e) => e.innerText).catch(() => '');
  ok('a Campus Director’s dashboard says it’s from QuickBooks', /From QuickBooks · brought in/.test(d), d.split('\n').slice(0, 3).join(' / '));
  ok('… with no QuickBooks card and no name on the page', !(await page.$('.finQbo')) && !/Dara Sok|Vanna Chan|Someone Gone/.test(await page.evaluate(() => document.body.innerText)));
  await page.screenshot({ path: OUT + '/4-leadership.png', fullPage: true });
  await ctx.close();
}

/* ---- small, dark, Khmer ---- */
for (const o of [{ small: true }, { small: true, dark: true }, { km: true }]) {
  const { ctx, page } = await open('bopha', o);
  const c = await card(page);
  ok((o.km ? 'Khmer' : o.dark ? 'dark, 320px' : '320px') + ': the card renders' + (o.km ? ' in Khmer' : '') + ', nothing scrolls sideways',
    !!c && (await noSideways(page)) && (!o.km || /បានភ្ជាប់ទៅ/.test(c)));
  await page.screenshot({ path: OUT + '/5-' + (o.km ? 'km' : o.dark ? 'dark' : 'small') + '.png', fullPage: false });
  await ctx.close();
}

/* ---- disconnecting ---- */
{
  const { ctx, page } = await open('bopha');
  await page.click('#finQboOff'); await page.waitForTimeout(1500);
  ok('disconnecting asks first, then the card offers to connect again', /Disconnect QuickBooks\?/.test(page.lastDialog || '') && !!(await page.$('#finQboConnect')) && I.revoked.length === 1);
  ok('… and the numbers stay', !!(mem['finance:poipet'].pl[LAST]) && /Profit and Loss/.test(await page.$eval('#finReports', (e) => e.innerText)));
  await ctx.close();
}

ok('no errors on the page', !errors.length, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
