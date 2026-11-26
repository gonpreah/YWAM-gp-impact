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
  const ctx = await browser.newContext(opts.vp ? { viewport: opts.vp, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
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
  ok('a pop-up dims the app around the frame too', await page.evaluate(() => !!document.getElementById('fin2Dim') && document.getElementById('fin2Frame').classList.contains('fin2Up')));
  const clip = await page.evaluate(() => { const fe = document.getElementById('fin2Frame'), r = fe.getBoundingClientRect(), nav = document.querySelector('nav.bottom').getBoundingClientRect(), m = /inset\((\d+)px 0px (\d+)px/.exec(fe.style.clipPath) || []; return { bottom: Math.round(r.bottom - (+m[2] || 0)), navTop: Math.round(nav.top) }; });
  ok('… and on a phone the raised frame stops at the bottom bar', clip.bottom <= clip.navTop + 1, JSON.stringify(clip));
  await page.click('#fin2Dim', { position: { x: 60, y: (await page.evaluate(() => innerHeight)) - 30 } }); await page.waitForTimeout(400);
  ok('a tap on the dim closes the pop-up', await f.evaluate(() => !document.body.classList.contains('sheetOn')) && await page.evaluate(() => !document.getElementById('fin2Dim')));
  await ctx.close();
}
/* a computer: the app's bar is a rail down the left (teams.css, from 900px) — it covers none of the bottom.
   Counting its height made the visible part 0px tall: pop-ups had no room, the breakdown showed one row. */
for (const vp of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
  const { ctx, page } = await open('finance', { vp });
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(1500);
  if (!(await page.$('#fin2Frame'))) { await page.click('#mmSwitch').catch(() => {}); await page.click('[data-mmpick="Skills Training|Finances"]').catch(() => {}); await page.waitForTimeout(1200); }
  await page.click('.mmTabs [data-fintab="finput"]'); await page.waitForTimeout(2500);
  const f = await fr(page); await f.waitForSelector('#inBalances', { timeout: 10000 }); await page.waitForTimeout(600);
  const w = vp.width + '×' + vp.height;
  const v = await f.evaluate(() => { const st = document.documentElement.style; return { vh: parseFloat(st.getPropertyValue('--vh')), sh: parseFloat(st.getPropertyValue('--sh')) }; });
  ok(w + ': the page knows how much of it is on screen', v.vh > 300 && v.sh >= vp.height - 80, JSON.stringify(v));
  const lw = await f.evaluate(() => { const d = document.createElement('div'); d.className = 'ledWrap'; document.querySelector('main').appendChild(d); const m = parseFloat(getComputedStyle(d).maxHeight); d.remove(); return m; });
  ok(w + ': the breakdown’s box is most of the screen tall, not one row', lw > vp.height * 0.6, String(lw));
  ok(w + ': the page uses the width (not phone width)', await f.evaluate(() => document.querySelector('main').getBoundingClientRect().width > 700));
  await page.mouse.move(vp.width / 2, vp.height - 200); await page.mouse.wheel(0, 700); await page.waitForTimeout(500);
  ok(w + ': the mouse wheel over the finance page scrolls the app', await page.evaluate(() => scrollY > 500));
  await f.evaluate(() => ihOpen_()); await page.waitForTimeout(500);
  const sh = await page.evaluate(() => { const fe = document.getElementById('fin2Frame'), s = fe.contentDocument.getElementById('sheet'), r = s.getBoundingClientRect(), fr = fe.getBoundingClientRect(); return { top: Math.round(fr.top + r.top), bottom: Math.round(fr.top + r.bottom), vh: innerHeight }; });
  ok(w + ': a pop-up opens at the bottom of the screen', sh.top > 0 && sh.bottom <= sh.vh + 2 && sh.bottom > sh.vh - 40, JSON.stringify(sh));
  ok(w + ': … with the whole screen dimmed, not only the frame', await page.evaluate(() => { const d = document.getElementById('fin2Dim'); if (!d) return false; const r = d.getBoundingClientRect(); return r.width >= innerWidth - 1 && r.height >= innerHeight - 1; }));
  await f.evaluate(() => closeSheet()); await page.waitForTimeout(300);
  ok(w + ': the dim goes when the pop-up closes', await page.evaluate(() => !document.getElementById('fin2Dim')));
  await f.evaluate(() => { FIN.rev = FIN.rev || 1; finStatus_(); });
  const s0 = await f.evaluate(() => document.getElementById('finSave').textContent);
  await page.waitForTimeout(2900);
  ok(w + ': “Saved” shows for a moment, then goes', s0 === '✓ Saved' && await f.evaluate(() => document.getElementById('finSave').textContent === ''), s0);
  await ctx.close();
}
{
  const { ctx, page } = await open('director');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(1200);
  await page.click('[data-lwtab="money"]'); await page.waitForTimeout(2500);
  const f = await fr(page); await f.waitForSelector('#pane', { timeout: 10000 }); await page.waitForTimeout(800);
  const m = await page.evaluate(() => { const el = document.getElementById('fin2Frame'); return { h: el.offsetHeight, inner: el.contentDocument.body.scrollHeight }; });
  ok('leadership’s Finances tab is one page too', m.h >= m.inner - 2 && await f.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), JSON.stringify(m));
  /* Ministries for leadership: read-only, nothing to put in or take out */
  await page.click('[data-finlead="mins"]'); await page.waitForTimeout(2500);
  const f2 = await fr(page); await f2.waitForFunction(() => typeof S !== 'undefined' && S.tab === 'mins' && document.querySelector('[data-dashmode]'), null, { timeout: 10000 });
  ok('leadership can open Ministries (read-only)', await f2.evaluate(() => S.tab === 'mins' && document.body.classList.contains('ro')));
  ok('… without the include / take-out buttons', await f2.evaluate(() => { const b = document.createElement('button'); b.className = 'mnPlBtn'; document.body.appendChild(b); const v = getComputedStyle(b).display; b.remove(); return v === 'none'; }));
  await ctx.close();
}
/* the Finances office: Dashboard · Ministries · Input (Nov 2026: Ministries came to Impact) */
{
  const { ctx, page } = await open('finance');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(1500);
  if (!(await page.$('#fin2Frame'))) { await page.click('#mmSwitch').catch(() => {}); await page.click('[data-mmpick="Skills Training|Finances"]').catch(() => {}); await page.waitForTimeout(1200); }
  ok('the office has a Ministries tab between Dashboard and Input', await page.evaluate(() => [...document.querySelectorAll('.mmTabs [data-fintab]')].map(b => b.dataset.fintab).join() === 'fdash,fmins,finput'));
  await page.click('.mmTabs [data-fintab="fmins"]'); await page.waitForTimeout(2500);
  const f = await fr(page); await f.waitForFunction(() => typeof S !== 'undefined' && S.tab === 'mins' && document.querySelector('[data-dashmode]'), null, { timeout: 10000 });
  await f.evaluate(() => { S.dashMode = 'live'; render(); });
  ok('… it opens the finance tool on Ministries', await f.evaluate(() => S.tab === 'mins' && !document.body.classList.contains('ro') && !!document.getElementById('mnPickBtn')));
  ok('… whose own tab bar stays hidden in the app', await f.evaluate(() => getComputedStyle(document.querySelector('nav.tabs')).display === 'none'));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
