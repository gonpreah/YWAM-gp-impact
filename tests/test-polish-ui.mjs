/* The look-through of Nov 2026: things that only show on a small phone or in Khmer. Profile and sign-up labels and
   the pop-up messages are in Khmer; the leave dates, the Learn Khmer areas and the header fit a 320px phone; the
   holiday names on the dark allowance card can be read; a label is tied to its field. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('polish-ui');
const OUT = tmpDir('polish-ui-out');
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
  mk({ id: 'st1', name: 'Mark Hill', username: 'mark', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', mentorId: 'st2', mentorStatus: 'approved' }),
  mk({ id: 'st2', name: 'Ann Lee', username: 'ann', email: 'a@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st3', name: 'Bo Chan', username: 'bo', email: 'b@e.com', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'st4', name: 'Cy Ros', username: 'cy', email: 'c@e.com', dept: 'Campus Leadership', ministry: 'Skills Training' }),
  mk({ id: 'st5', name: 'Di Sok', username: 'di', email: 'd@e.com', dept: 'Community Service', ministry: 'Cafe' })
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }];
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
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.board) localStorage.setItem('gp-board', JSON.stringify({ user: a.board, pin: '4321' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km, board: opts.board || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user || opts.board) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);
const fits = (page, sel) => page.evaluate((sel) => { const W = innerWidth; return [...document.querySelectorAll(sel)].every((e) => { const b = e.getBoundingClientRect(); return b.left >= -1 && b.right <= W + 1; }) && document.documentElement.scrollWidth <= W + 1; }, sel);
const KH = /[ក-៿]/;
{
  const { ctx, page } = await open('mark', { small: true });
  ok('at 320px the header is one row', await page.$eval('header', (h) => h.getBoundingClientRect().height < 80));
  await page.evaluate(() => { S.view = 'leave'; render(); }); await page.waitForTimeout(900);
  ok('the leave dates fit the screen', await fits(page, '#lv_from, #lv_to'));
  const hol = await page.evaluate(() => { const b = document.querySelector('.allowCard .holidayNote b'); if (!b) return null; const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }; return { name: b.innerText, fg: lum(getComputedStyle(b).color), bg: lum(getComputedStyle(document.querySelector('.allowCard')).backgroundColor) }; });
  ok('the holiday names can be read on the dark card', !!hol && hol.name.length > 2 && hol.fg - hol.bg > 0.5, JSON.stringify(hol));
  ok('the leave boxes have names for a screen reader', await page.$eval('#lv_from', (e) => !!e.getAttribute('aria-label')) && await page.$eval('#lv_ack', (e) => e.getAttribute('role') === 'checkbox' && e.getAttribute('aria-checked') === 'false'));
  await page.evaluate(() => khOpen_()); await page.waitForTimeout(1200);
  ok('Learn Khmer does not push the page wider than the phone', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.evaluate(() => { S.view = 'mycontract'; render(); }); await page.waitForTimeout(900);
  ok('My contract: the name sits under the photo, not squeezed beside it', await page.evaluate(() => { const h = document.querySelector('.adminPersonHead'); return !!h && getComputedStyle(h).flexDirection === 'column'; }));
  await page.click('nav.bottom [data-tab="profile"]'); await page.waitForTimeout(600);
  ok('a label is tied to its box: tapping “Full name” focuses it', await page.evaluate(() => { const l = [...document.querySelectorAll('#main label.f')].find((x) => x.htmlFor === 'p_name'); if (!l) return false; l.click(); return document.activeElement && document.activeElement.id === 'p_name'; }));
  await ctx.close();
}
{
  const { ctx, page } = await open('mark', { km: true, small: true });
  await page.click('nav.bottom [data-tab="profile"]'); await page.waitForTimeout(600);
  const labels = await page.$$eval('#main label.f', (ls) => ls.map((l) => l.innerText.trim()));
  ok('in Khmer every Profile label is Khmer', labels.length > 8 && labels.every((x) => /[ក-៿]/.test(x)), labels.filter((x) => !KH.test(x)).join(' | '));
  ok('… and the photo, save and PIN buttons', KH.test(await page.$eval('#photoBtn', (e) => e.innerText)) && KH.test(await page.$eval('#saveProfBtn', (e) => e.innerText)) && KH.test(await page.$eval('#pinBtn', (e) => e.innerText)));
  await page.evaluate(() => showMsg('PIN must be 4 digits'));
  ok('a pop-up message written in English shows in Khmer', KH.test(await page.$eval('#msg', (e) => e.textContent)));
  await page.evaluate(() => showMsg('zzz not in the dictionary'));
  ok('… and one with no Khmer still shows', await page.$eval('#msg', (e) => e.textContent === 'zzz not in the dictionary'));
  await ctx.close();
}
{
  const { ctx, page } = await open('', { km: true, small: true });
  await page.goto(BASE + '/teams.html?reg=1', { waitUntil: 'load' }); await page.waitForSelector('#regBtn', { timeout: 15000 });
  const labels = await page.$$eval('#main label.f', (ls) => ls.map((l) => l.innerText.trim()));
  ok('the Create my profile form is Khmer: its heading, labels and button', KH.test(await page.$eval('#main h2', (e) => e.innerText)) && labels.every((x) => /[ក-៿]/.test(x)) && KH.test(await page.$eval('#regBtn', (e) => e.innerText)), labels.filter((x) => !KH.test(x)).join(' | '));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
