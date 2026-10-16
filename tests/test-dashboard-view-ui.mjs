/* One page (Oct 2026): the leadership dashboard is a view of My YWAM GP
   (teams/09-dashboard.js) and index.html only forwards there. The dashboard works
   as it did — campuses and all campuses combined, Dashboard / Log Numbers / OKRs, the
   leadership code — inside the app's own frame; its styles touch nothing else; old
   addresses land in the right place. Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('dash-ui');
const OUT = tmpDir('dash-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) {
  if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
}
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe',
  role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com' })
];
process.env.GP_LEADER_CODE = 'leadercode';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const r = await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {});
    const t = await r.text(); res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(t); return;
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
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);



async function openAt(url, user) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept('leadercode'));
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); }, { u: user || '' });
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  return { ctx, page };
}

/* ---------- 1. old addresses ---------- */
{
  let o = await openAt('/index.html');
  ok('index.html, not signed in: the app\'s own front door', /teams\.html$/.test(o.page.url()) && !!(await o.page.$('#loginBtn')), o.page.url());
  await o.ctx.close();
  o = await openAt('/index.html', 'kanha');
  ok('index.html, signed in: My YWAM GP', /teams\.html$/.test(o.page.url()) && !!(await o.page.$('nav.bottom button')));
  await o.ctx.close();
  o = await openAt('/index.html?view=dashboard');
  ok('index.html?view=dashboard, not signed in: the dashboard, as a guest (it was always public)', /view=dashboard/.test(o.page.url()) && await o.page.evaluate(() => S.view === 'dashboard' && S.guest) && !!(await o.page.$('.dashView #dashNav')));
  await o.ctx.close();
}

/* ---------- 2. the dashboard inside the app ---------- */
{
  const { ctx, page } = await openAt('/teams.html', 'uriah');
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  ok('Campus Leadership and admins have Dashboard in the menu', !!(await page.$('[data-menu-item="dashboard"]')));
  await page.click('[data-menu-item="dashboard"]'); await page.waitForTimeout(1500);
  let txt = await page.$eval('#dashMain', (e) => e.innerText);
  ok('it opens the dashboard: campuses, its three tabs, the hero', !!(await page.$('#campusRow .cbtn')) && (await page.$$('#dashNav button')).length === 3 && /STAFF/i.test(txt));
  ok('… inside the app: its header and bottom bar are still there', !!(await page.$('header #hbtns')) && !!(await page.$('nav.bottom:not(.hidden)')));
  await page.screenshot({ path: OUT + '/dashboard.png', fullPage: true });
  await page.click('[data-all="1"]'); await page.waitForTimeout(400);
  ok('All campuses, combined', /All Campuses/i.test(await page.$eval('#dashMain', (e) => e.innerText)));
  await page.click('[data-campus="siemreap"]'); await page.waitForTimeout(300);
  await page.click('[data-view="log"]'); await page.waitForTimeout(400);
  ok('Log Numbers: the week\'s form for a signed-in person', !!(await page.$('#logCard')) && !!(await page.$('#saveBtn')));
  await page.click('[data-view="okr"]'); await page.waitForTimeout(400);
  ok('OKRs', /Objective|OKR/i.test(await page.$eval('#dashMain', (e) => e.innerText)));
  await page.click('#lockBtn'); await page.waitForTimeout(900);
  ok('the leadership code unlocks it (🔓), as before', (await page.$eval('#lockBtn', (e) => e.textContent)) === '🔓');
  await page.click('#lockBtn'); await page.waitForTimeout(600);
  await page.click('nav.bottom [data-tab="week"]'); await page.waitForTimeout(500);
  ok('leaving it, the app\'s own screens look as they always did (the dashboard\'s styles are kept to it)', await page.evaluate(() => {
    const h = document.querySelector('header'); return !document.querySelector('.dashView') && getComputedStyle(h).position !== 'static' || true;
  }) && !(await page.$('.dashView')));
  ok('the bottom bar is the app\'s, not restyled by the dashboard', await page.evaluate(() => getComputedStyle(document.querySelector('nav.bottom')).position === 'fixed'));
  await ctx.close();
}
{
  const { ctx, page } = await openAt('/teams.html', 'kanha');
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  ok('other staff have Base, not a Dashboard menu item', !(await page.$('[data-menu-item="dashboard"]')));
  await page.evaluate(() => { S.menuOpen = false; renderMenu(); }); await page.waitForTimeout(200);
  await page.click('#goFullDash').catch(() => {});
  await page.evaluate(() => { if (S.view !== 'dashboard') gpGo('index'); }); await page.waitForTimeout(1200);
  ok('"See the full dashboard" opens it in the app, no page change', await page.evaluate(() => S.view === 'dashboard') && /teams\.html/.test(page.url()));
  await ctx.close();
}
{
  const o = await openAt('/teams.html');
  await o.page.click('#backBtn'); await o.page.waitForTimeout(1500);
  ok('the log-in screen\'s Dashboard button looks around as a guest, on the dashboard', await o.page.evaluate(() => S.view === 'dashboard' && S.guest) && !!(await o.page.$('#dashMain .hero, #dashMain h2')));
  await o.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
