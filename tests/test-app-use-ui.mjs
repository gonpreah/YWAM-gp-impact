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
mem.useTime = { from: ago(40), time: { c1: { [today]: 3600, [ago(3)]: 1500 }, c2: { [ago(1)]: 600 }, c3: { [ago(10)]: 4000 } } };

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
  ok('a full history: no "fills in" note', !(await page.$('#adminUseNote')) && !(await page.$('#adminUseTimeNote')));
  const tm = await page.$$eval('[data-userow] .useTime', es => es.map(e => e.textContent.trim()));
  ok('each person’s time in the app in the last 30 days', JSON.stringify(tm.slice(0, 3)) === JSON.stringify(['⏱ 1 h 25 min', '⏱ 10 min', '⏱ 1 h 7 min']) && tm.includes('⏱ —'), tm.join(' | '));
  const tot = await page.$eval('#adminUseTime', e => e.textContent);
  ok('… all together, and on average for those who used it', /2 h 42 min in the app/.test(tot) && /54 min each on average/.test(tot), tot);
  await page.click('[data-usesort="time"]'); await page.waitForTimeout(300);
  const byTime = await page.$$eval('[data-userow]', rs => rs.slice(0, 3).map(r => r.getAttribute('data-userow')));
  ok('“By time in the app” puts the most time first', JSON.stringify(byTime) === '["c1","c3","c2"]', byTime.join(','));
  await page.click('[data-usesort="days"]'); await page.waitForTimeout(300);
  await page.click('[data-useband="none"]'); await page.waitForTimeout(300);
  const none = await page.$$eval('[data-userow]', rs => rs.map(r => r.getAttribute('data-userow')).sort());
  ok('a band narrows the list — Not in 30 days', JSON.stringify(none) === '["c4"]', none.join(','));
  await page.click('#adminUseAll'); await page.waitForTimeout(300);
  ok('Show everyone brings them all back', (await page.$$('[data-userow]')).length === 5);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#adminUseCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok('Download (CSV): a line for each person with their days', /Days used, last 30/.test(csv) && /Cora Every,Community Service,Cafe,20,7,[0-9-]+,85,85/.test(csv) && /Minutes in the app, last 30/.test(csv), csv.split('\n')[1]);
  await page.click('[data-userow="c2"] [data-adminperson]'); await page.waitForTimeout(600);
  ok('tapping someone opens their account', /Kanha Some/.test(await page.$eval('#main', e => e.innerText)) && !!(await page.$('#adminBack')));
  ok('… and its back button says App use', /App use/.test(await page.$eval('#adminBack', e => e.textContent)));
  await page.click('#adminBack'); await page.waitForTimeout(400);
  ok('back goes to App use, not Accounts', await page.evaluate(() => S.adminSub === 'use') && !!(await page.$('#adminUseList')));
  await page.evaluate(() => { S.adminSub = 'accounts'; render(); }); await page.waitForTimeout(600);
  await page.click('[data-adminperson="c2"]'); await page.waitForTimeout(400);
  await page.click('#adminBack'); await page.waitForTimeout(400);
  ok('opened from Accounts, back still goes to Accounts', await page.evaluate(() => S.adminSub === 'accounts'));
  mem.lastSeen.daysFrom = ago(3); mem.useTime.from = ago(3);
  await page.evaluate(() => { S.adminSub = 'use'; S.adminUse = {}; render(); });
  await page.waitForSelector('#adminUseList', { timeout: 8000 });
  ok('while the history is under 30 days old, a note says the numbers fill in', !!(await page.$('#adminUseNote')) && !!(await page.$('#adminUseTimeNote')));
  await ctx.close();
}
{
  const { ctx, page } = await open('cora');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'use'; render(); });
  await page.waitForTimeout(500);
  ok('not an admin: no Admin page at all', !(await page.$('#adminUseList')));
  await ctx.close();
}

/* ---------- 1b. the phone counts the minutes and sends them ---------- */
{
  const { ctx, page } = await open('kanha');
  const day = await page.evaluate(() => todayStr());
  const local = () => page.evaluate(() => JSON.parse(localStorage.getItem('gp-use-time') || 'null'));
  await page.evaluate(() => { _gpUse.last = Date.now() - 15000; _gpUse.act = Date.now(); gpUseTick_(); });
  let L = await local();
  ok('fifteen seconds in use count toward today', L && L.u === 'kanha' && L.d[day] >= 14 && L.d[day] <= 16 && L.dirty === true, JSON.stringify(L));
  const before = L.d[day];
  await page.evaluate(() => { _gpUse.last = Date.now() - 15000; _gpUse.act = Date.now() - 5 * 60000; gpUseTick_(); });
  ok('left open with nobody using it for minutes, nothing counts', (await local()).d[day] === before);
  await page.evaluate(() => { _gpUse.last = Date.now() - 15 * 60000; _gpUse.act = Date.now(); gpUseTick_(); });
  ok('a long gap (the phone asleep) counts only one tick’s worth', (await local()).d[day] <= before + 31);
  await page.evaluate(() => { const U = JSON.parse(localStorage.getItem('gp-use-time')); U.sent = 0; localStorage.setItem('gp-use-time', JSON.stringify(U)); gpMarkSeen_(); });
  await page.waitForTimeout(800);
  L = await local();
  ok('sent with the once-a-day markSeen, even after today’s day was marked', mem.useTime.time.c2[day] === L.d[day] && L.dirty === false && L.sent > 0, JSON.stringify(mem.useTime.time.c2));
  await page.evaluate(() => { _gpUse.last = Date.now() - 15000; _gpUse.act = Date.now(); gpUseTick_();
    const U = JSON.parse(localStorage.getItem('gp-use-time')); U.sent = 0; localStorage.setItem('gp-use-time', JSON.stringify(U));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1000);
  L = await local();
  ok('going to the background sends the new total (a beacon)', mem.useTime.time.c2[day] === L.d[day] && L.d[day] > before + 20, JSON.stringify(mem.useTime.time.c2) + ' ' + JSON.stringify(L.d));
  const n0 = JSON.stringify(mem.useTime);
  await page.evaluate(() => { _gpUse.last = Date.now() - 15000; _gpUse.act = Date.now(); gpUseTick_(true); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(600);
  ok('… but not again within 20 minutes', JSON.stringify(mem.useTime) === n0);
  /* an app kept open in the background comes back the next day without a boot: that day counts */
  mem.lastSeen.days.c2 = (mem.lastSeen.days.c2 || []).filter(d => d !== day); mem.lastSeen.seen.c2 = '';
  await page.evaluate(() => { localStorage.setItem('gp-seen-day', 'yesterday|kanha');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(800);
  ok('brought back to the front on a new day, the day counts (no boot needed)', mem.lastSeen.days.c2.includes(day) && mem.lastSeen.seen.c2 === day);
  await ctx.close();
}

/* ---------- 2. the weekly health check-in, on Tuesdays ---------- */
const next = (dow) => { const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7)); return d; };
{
  const { ctx, page } = await open('kanha', next(2));
  const bell = await page.evaluate(() => visibleNotifItems_().map(x => x.text).join(' | '));
  ok('Tuesday: the bell says it is check-in day — no box on My Home', /Tuesday — answer your weekly health check-in at the staff meeting/.test(bell) && !(await page.$('#tueCheckin')), bell);
  await page.evaluate(() => { localStorage.setItem('gp-banner-test', '1'); S.bannerShowMs = 60000; gpBannerShow_(); });
  await page.waitForSelector('#gpBanner.on', { timeout: 3000 });
  ok('… and it slides down from the top', /Tuesday — answer your weekly health check-in/.test(await page.$eval('#gpBanMsg', e => e.textContent)) && /Answer it/.test(await page.$eval('#gpBanner', e => e.innerText)));
  await page.click('#gpBanMsg'); await page.waitForTimeout(500);
  ok('a tap opens this week’s check-in form', await page.evaluate(() => S.view === 'health' && !S.bellOpen) && !!(await page.$('#weekForm')));
  await page.evaluate(() => { S.weekForm = null; render(); }); await page.waitForTimeout(200);
  ok('the Health tab says it is done on Tuesdays at the staff meeting', /Tuesdays, at the staff meeting/.test(await page.$eval('#checkinTueHint', e => e.textContent)));
  await page.evaluate(() => { S.checkins = (S.checkins || []).concat([{ week: thisWeek(), source: 'weekly', clarity: 7, growth: 7, lonely: 3 }]); S.view = 'week'; render(); });
  await page.waitForTimeout(300);
  ok('answered: the bell’s nudge goes', !(await page.evaluate(() => visibleNotifItems_().some(x => /check-in/.test(x.text)))));
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
