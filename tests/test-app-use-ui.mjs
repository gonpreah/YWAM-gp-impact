/* In the browser, against the real api.js:
   - Admin → 📊 App use (Nov 2026, Andrew: "data on our staff team who uses the app consistently"): the four
     bands with how many in each, everyone by days used in the last 30 (a row of 30 dots each, the last 7, the
     last day), a band narrowing the list, the note while the history is under 30 days old, Download (CSV);
   - the weekly health check-in on Tuesdays, at the staff meeting (Andrew: "we want to move to every Tuesday
     during our staff meeting"): on a Tuesday My Home has a card that opens this week's form, the bell says so,
     the Health tab says when it's done; answered, the card goes; on another day there is no card. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { pinClock } from './clock.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('app-use-ui');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus', country: 'Cambodia', google: { sub: 'g-' + o.id } }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', isAdmin: true, dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'c1', name: 'Cora Every', username: 'cora' }),
  mk({ id: 'c2', name: 'Kanha Some', username: 'kanha' }),
  mk({ id: 'c3', name: 'Lina Few', username: 'lina' }),
  mk({ id: 'c4', name: 'Nary None', username: 'nary' })
];
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const ago = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const span = (from, n) => Array.from({ length: n }, (_, i) => ago(from + i)).reverse();
mem.lastSeen = { started: ago(40), daysFrom: ago(40), seen: { c1: today, c2: ago(1), c3: ago(10) },
  days: { c1: span(0, 20), c2: span(1, 8), c3: span(10, 2) } };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const r = await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {});
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(await r.text()); return;
  }
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, when) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'Asia/Phnom_Penh', acceptDownloads: true });
  if (when) await pinClock(ctx, when);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(u => { localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })); }, user);
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* ---------- 1. Admin → App use ---------- */
{
  const { ctx, page } = await open('ada');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'home'; render(); });
  await page.waitForTimeout(400);
  ok('Admin has an App use card', !!(await page.$('[data-adminsub="use"]')));
  await page.click('[data-adminsub="use"]');
  await page.waitForSelector('#adminUseList', { timeout: 8000 });
  const tiles = await page.$$eval('[data-useband]', bs => bs.map(b => b.getAttribute('data-useband') + ':' + b.querySelector('b').textContent));
  ok('four bands with how many in each (Ada opening the app just now counts as today)', JSON.stringify(tiles) === '["most:1","some:1","few:2","none:1"]', tiles.join(','));
  const rows = await page.$$eval('[data-userow]', rs => rs.map(r => r.getAttribute('data-userow') + ':' + r.querySelector('.useNum b').textContent + ':' + r.querySelectorAll('.useDots i.on').length));
  ok('everyone, most days first, each with their days as dots', JSON.stringify(rows.slice(0, 3)) === '["c1:20:20","c2:8:8","c3:2:2"]', rows.join(' | '));
  ok('a row says this week and the last day', /7 this week/.test(await page.$eval('[data-userow="c1"]', e => e.innerText)) && /last used/.test(await page.$eval('[data-userow="c2"]', e => e.innerText)));
  ok('a full history: no "fills in" note', !(await page.$('#adminUseNote')));
  await page.click('[data-useband="none"]'); await page.waitForTimeout(300);
  const none = await page.$$eval('[data-userow]', rs => rs.map(r => r.getAttribute('data-userow')).sort());
  ok('a band narrows the list — Not in 30 days', JSON.stringify(none) === '["c4"]', none.join(','));
  await page.click('#adminUseAll'); await page.waitForTimeout(300);
  ok('Show everyone brings them all back', (await page.$$('[data-userow]')).length === 5);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#adminUseCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok('Download (CSV): a line for each person with their days', /Days used, last 30/.test(csv) && /Cora Every,Community Service,Cafe,20,7,/.test(csv), csv.split('\n')[1]);
  await page.click('[data-userow="c2"] [data-adminperson]'); await page.waitForTimeout(600);
  ok('tapping someone opens their account', /Kanha Some/.test(await page.$eval('#main', e => e.innerText)) && !!(await page.$('#adminBack')));
  ok('… and its back button says App use', /App use/.test(await page.$eval('#adminBack', e => e.textContent)));
  await page.click('#adminBack'); await page.waitForTimeout(400);
  ok('back goes to App use, not Accounts', await page.evaluate(() => S.adminSub === 'use') && !!(await page.$('#adminUseList')));
  await page.evaluate(() => { S.adminSub = 'accounts'; render(); }); await page.waitForTimeout(600);
  await page.click('[data-adminperson="c2"]'); await page.waitForTimeout(400);
  await page.click('#adminBack'); await page.waitForTimeout(400);
  ok('opened from Accounts, back still goes to Accounts', await page.evaluate(() => S.adminSub === 'accounts'));
  mem.lastSeen.daysFrom = ago(3);
  await page.evaluate(() => { S.adminSub = 'use'; S.adminUse = {}; render(); });
  await page.waitForSelector('#adminUseList', { timeout: 8000 });
  ok('while the history is under 30 days old, a note says the numbers fill in', !!(await page.$('#adminUseNote')));
  await ctx.close();
}
{
  const { ctx, page } = await open('cora');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'use'; render(); });
  await page.waitForTimeout(500);
  ok('not an admin: no Admin page at all', !(await page.$('#adminUseList')));
  await ctx.close();
}

/* ---------- 2. the weekly health check-in, on Tuesdays ---------- */
const next = (dow) => { const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7)); return d; };
{
  const { ctx, page } = await open('kanha', next(2));
  ok('Tuesday: My Home says it is check-in day', !!(await page.$('#tueCheckin')) && /Tuesday/.test(await page.$eval('#tueCheckin', e => e.innerText)));
  const bell = await page.evaluate(() => visibleNotifItems_().map(x => x.text).join(' | '));
  ok('… and the bell says so', /Tuesday — answer your weekly health check-in at the staff meeting/.test(bell), bell);
  await page.click('#tueCheckinGo'); await page.waitForTimeout(500);
  ok('“Answer it now” opens this week’s check-in form', await page.evaluate(() => S.view === 'health') && !!(await page.$('#weekForm')));
  await page.evaluate(() => { S.weekForm = null; render(); }); await page.waitForTimeout(200);
  ok('the Health tab says it is done on Tuesdays at the staff meeting', /Tuesdays, at the staff meeting/.test(await page.$eval('#checkinTueHint', e => e.textContent)));
  await page.evaluate(() => { S.checkins = (S.checkins || []).concat([{ week: thisWeek(), source: 'weekly', clarity: 7, growth: 7, lonely: 3 }]); S.view = 'week'; render(); });
  await page.waitForTimeout(300);
  ok('answered: the card goes', !(await page.$('#tueCheckin')));
  await ctx.close();
}
{
  const { ctx, page } = await open('kanha', next(1));
  ok('Monday: no card, and no nudge in the bell yet', !(await page.$('#tueCheckin')) && !(await page.evaluate(() => visibleNotifItems_().some(x => /check-in/.test(x.text)))));
  await ctx.close();
}
{
  const { ctx, page } = await open('kanha', next(4));
  const bell = await page.evaluate(() => visibleNotifItems_().map(x => x.text).join(' | '));
  ok('Thursday, still not in: no card, the bell says it is due', !(await page.$('#tueCheckin')) && /Your weekly health check-in is due/.test(bell), bell);
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
