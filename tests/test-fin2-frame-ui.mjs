/* The finance tool inside My Ministry is ONE page with the app (Nov 2026: "it does not act as one single
   page — everything under Dashboard scrolls independently from the tabs at the top"):
     - the frame is as tall as the finance page, so nothing in it scrolls on its own and the app's tabs
       scroll away with it;
     - scrolled down, the "Reports as of" bar stays at the top of the screen;
     - a pop-up sheet opens on screen, not at the far bottom of the tall frame;
     - leadership's Finances tab is the same. All names and figures are made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('fin2-frame-ui');
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
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe',
  role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Sreilea Chan', username: 'sreilea', email: 's@e.com' }),
  mk({ id: 'st2', name: 'Mealea Sok', username: 'mealea', email: 'm@e.com', ministry: 'Ponlork School' }),
  mk({ id: 'st3', name: 'Dara Pen', username: 'dara', email: 'd@e.com', ministry: 'GP Education' }),
  mk({ id: 'cs', name: 'Chea Leader', username: 'chea', email: 'c@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'cd', name: 'Dir Ector', username: 'director', email: 'x@e.com', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'fi', name: 'Fin Ance', username: 'finance', email: 'f@e.com', dept: 'Skills Training', ministry: 'Finances' })
];const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
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
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  if (opts.at) await page.clock.setFixedTime(opts.at);
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => {
    localStorage.setItem('gp-cafe-view', 'numbers'); sessionStorage.setItem('gp-lw-tab', 'base');
    localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' }));
    if (a.km) localStorage.setItem('gp-lang', 'km');
  }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.click('nav.bottom button[data-tab="week"]');
  await page.waitForTimeout(400);
  return { ctx, page };
}




const fr = async page => { const h = await page.$('#fin2Frame'); return h.contentFrame(); };
{
  const { ctx, page } = await open('finance');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(1500);
  if (!(await page.$('#fin2Frame'))) { await page.click('#mmSwitch').catch(() => {}); await page.click('[data-mmpick="Skills Training|Finances"]').catch(() => {}); await page.waitForTimeout(1200); }
  await page.click('.mmTabs [data-fintab="finput"]'); await page.waitForTimeout(2500);
  const f = await fr(page);
  await f.waitForSelector('#inBalances', { timeout: 10000 });
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => { const el = document.getElementById('fin2Frame'); return { h: el.offsetHeight, inner: el.contentDocument.body.scrollHeight, page: document.documentElement.scrollHeight, vh: innerHeight }; });
  ok('the frame is as tall as the finance page', Math.abs(m.h - Math.max(m.inner, m.h)) < 4 && m.h >= m.inner - 2, JSON.stringify(m));
  ok('… so the app scrolls the two as one (the page is taller than the screen)', m.page > m.vh + 200, JSON.stringify(m));
  ok('nothing scrolls inside the frame', await f.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2 && getComputedStyle(document.body).overflow === 'hidden'));
  const tabsTop0 = await page.$eval('.mmTabs', e => e.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('fin2Frame').getBoundingClientRect().top + scrollY + 600)); await page.waitForTimeout(600);
  const tabsTop1 = await page.$eval('.mmTabs', e => e.getBoundingClientRect().top);
  ok('the app’s tabs scroll away with the page', tabsTop1 < tabsTop0 - 300, tabsTop0 + ' → ' + tabsTop1);
  const stick = await page.evaluate(() => { const fe = document.getElementById('fin2Frame'), b = fe.contentDocument.querySelector('.inDay'), r = b.getBoundingClientRect(), fr = fe.getBoundingClientRect(); return Math.round(fr.top + r.top); });
  ok('scrolled down, the “Reports as of” bar is still at the top of the screen', stick >= -2 && stick < 40, 'top ' + stick);
  await f.click('.inDay #inHistBtn').catch(() => {});
  await f.evaluate(() => { const b = document.getElementById('inHistBtn'); if (b && b.disabled) { ihOpen_(); } });
  await page.waitForTimeout(500);
  const sh = await page.evaluate(() => { const fe = document.getElementById('fin2Frame'), s = fe.contentDocument.getElementById('sheet'), r = s.getBoundingClientRect(), fr = fe.getBoundingClientRect(); return { top: Math.round(fr.top + r.top), bottom: Math.round(fr.top + r.bottom), vh: innerHeight }; });
  ok('a pop-up sheet opens on the screen', sh.top >= 0 && sh.bottom <= sh.vh + 2 && sh.bottom > sh.vh - 160, JSON.stringify(sh));
  await page.screenshot({ path: '/tmp/fin2-frame.png' }).catch(() => {});
  await ctx.close();
}
{
  const { ctx, page } = await open('director');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(1200);
  await page.click('[data-lwtab="money"]'); await page.waitForTimeout(2500);
  const f = await fr(page); await f.waitForSelector('#pane', { timeout: 10000 }); await page.waitForTimeout(800);
  const m = await page.evaluate(() => { const el = document.getElementById('fin2Frame'); return { h: el.offsetHeight, inner: el.contentDocument.body.scrollHeight }; });
  ok('leadership’s Finances tab is one page too', m.h >= m.inner - 2 && await f.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), JSON.stringify(m));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
