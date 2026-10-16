/* Your first 30 days (Oct 2026): on My Home for someone whose account is new, the
   things that make a good start, ticked off by themselves from what the app already
   knows; each row goes where it is done; gone when done, after 45 days, or hidden.
   Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('f30-ui');
const OUT = tmpDir('f30-ui-out');
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
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
mem.staff = [
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, created: daysAgo(400) }),
  mk({ id: 'st2', name: 'Nita New', username: 'nita', email: 'n@e.com', created: daysAgo(3), staffType: '', country: '' }),
  mk({ id: 'st3', name: 'Sam Started', username: 'sam', email: 's@e.com', created: daysAgo(5), photo: 'data:image/png;base64,iVBORw0KGgo=', staffType: 'campus', country: 'Cambodia', mentorId: 'st1', mentorStatus: 'approved',
    gstrengths: { top: ['careful', 'coordinator', 'hardworker', 'fairminded', 'valuesdriven'] }, personality: { type: 'ISTJ' }, libRead: { 'fight-our-values': '2026-10-10' } })
];
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



{
  const { ctx, page } = await open('nita');
  let txt = await main(page);
  ok('someone new sees Your first 30 days on My Home', /Your first 30 days/.test(txt) && /Choose a mentor/.test(txt) && /Read FIGHT: Our Values/.test(txt) && /Read Keeping Each Other Safe/.test(txt));
  const n = await page.$$eval('.f30Row', (r) => r.length), d = await page.$$eval('.f30Row.done', (r) => r.length);
  ok('… with nothing done yet', d === 0 && n >= 7, d + ' of ' + n);
  await page.screenshot({ path: OUT + '/first30.png', fullPage: true });
  await page.click('[data-f30go="lib:keeping-each-other-safe"]');
  await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined', null, { timeout: 15000 }); await page.waitForTimeout(300);
  ok('a row goes where it is done (the safeguarding guide)', await page.evaluate(() => S.view === 'library' && S.libBook === 'keeping-each-other-safe'));
  await page.evaluate(() => { S.view = 'week'; render(); }); await page.waitForTimeout(300);
  await page.click('[data-f30go="profile"]'); await page.waitForTimeout(300);
  ok('… and the profile row opens Profile & settings', await page.evaluate(() => S.view === 'profile'));
  await page.evaluate(() => { S.view = 'week'; render(); }); await page.waitForTimeout(300);
  await page.click('#f30Hide'); await page.waitForTimeout(300);
  ok('Hide this hides it on this phone', !/Your first 30 days/.test(await main(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('sam');
  const d = await page.$$eval('.f30Row.done', (r) => [...r].map((x) => x.textContent));
  ok('what is already true is ticked by itself: profile, mentor, FIGHT, strengths, type', d.length >= 5 && d.some((x) => /photo/.test(x)) && d.some((x) => /FIGHT/.test(x)) && d.some((x) => /strengths/.test(x)) && d.some((x) => /personality/.test(x)), d.join(' | '));
  ok('… and what isn\'t is not', !(await page.$$eval('.f30Row.done', (r) => [...r].some((x) => /Keeping Each Other Safe/.test(x.textContent)))));
  await ctx.close();
}
{
  const { ctx, page } = await open('uriah');
  ok('someone who has been here a year does not see it', !/Your first 30 days/.test(await main(page)));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
