/* Each Campus Leadership member's own My Ministry board (teams/04-ministry-strengths.js,
   LW_ROLES). Oct 2026 (Uriah): "for all the campus leadership, each person should have a
   slightly different My Ministry board. Not everyone has the same thing."
   The International Campus Director, the National Campus Director, a Director of a
   department and an untitled Campus Director each open My Ministry on their own Overview:
   their own line under "Your role", their own tab order, their own four numbers at the
   top (a department director gets their department instead, the tab named for it), and
   their own kinds first under "Log something". A tab chosen stays for that visit only; the
   next time the app is opened it starts on the role's Overview again. Names are made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('lead-roles-ui');
const OUT = tmpDir('lead-roles-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = (o) => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'icd', name: 'Ian Director', username: 'icd', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'international' }),
  mk({ id: 'ncd', name: 'Nary Director', username: 'ncd', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national' }),
  mk({ id: 'cd', name: 'Cam Director', username: 'cd', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'dcs', name: 'Chea Leader', username: 'chea', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 's1', name: 'Dara Sok', username: 'dara' }),
  mk({ id: 's2', name: 'Vanna Chan', username: 'vanna', dept: 'Youth Education', ministry: 'Kids Club' })
];
async function call(fn, args) {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return r.json();
}
await call('leadPartnerSave', ['icd', '1234', { name: 'Hope Church', org: 'A made-up church' }]);
await call('leadPartnerSave', ['icd', '1234', { name: 'Ann Giver', org: '' }]);
await call('basePlantSave', ['icd', '1234', { name: 'YWAM Somewhere', place: 'A made-up town', stage: 'planning' }]);

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
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', (r) => r.abort());
  await page.addInitScript((a) => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { S.view = 'ministry'; render(); window.scrollTo(0, 0); });
  await page.waitForTimeout(1800);
  return { ctx, page };
}
const tabs = (p) => p.$$eval('[data-lwtab]', (b) => b.filter((x) => x.closest('.lwSeg')).map((x) => x.getAttribute('data-lwtab')));
const tabOn = (p) => p.$eval('.lwSeg .campusBtn.on', (b) => b.getAttribute('data-lwtab')).catch(() => '');
const focus = (p) => p.$eval('.lwFocus', (e) => e.textContent).catch(() => '');
const tiles = (p) => p.$$eval('.lbGlance .mmTileName', (e) => e.map((x) => x.textContent.replace(/^[^A-Za-z0-9\u1780-\u17FF]+/, '').trim()));
const firstKinds = async (p) => { await p.click('[data-lwtab="week"]'); await p.waitForSelector('[data-lwkind]', { timeout: 10000 }); return p.$$eval('[data-lwkind]', (b) => b.slice(0, 3).map((x) => x.getAttribute('data-lwkind'))); };

/* ---- International Campus Director ---- */
{
  const { ctx, page } = await open('icd');
  ok('International Campus Director: opens on Overview', (await tabOn(page)) === 'base');
  ok('… “Vision, partners and new bases”', /Vision, partners and new bases/.test(await focus(page)));
  ok('… Overview, My week, Board, Finances', (await tabs(page)).join() === 'base,week,board,money', (await tabs(page)).join());
  const tl = await tiles(page);
  ok('… partners to reach, base plants, money ahead, clear leaders', tl.length === 4 && /Partners to reach/.test(tl[0]) && /Base Plants in Planning/.test(tl[1]) && /Money ahead/.test(tl[2]) && /Clear leaders/.test(tl[3]), tl.join(' | '));
  const nums = await page.$$eval('.lbGlance .mmTileNum', (e) => e.map((x) => x.textContent));
  ok('… counted from their own partners and plants', nums[0] === '2 / 2' && nums[1] === '1', nums.join(' | '));
  await page.screenshot({ path: OUT + '/1-international.png' });
  ok('… and partners first when logging', (await firstKinds(page)).join() === 'partner,church,base');
  // a tab chosen stays for the visit …
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('nav.bottom button'); await page.waitForTimeout(300);
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(800);
  ok('a tab chosen stays while the app is open', (await tabOn(page)) === 'week');
  await ctx.close();
  // … and the next time the app is opened, it's back on Overview
  const again = await open('icd');
  ok('… and the next time it’s opened, it starts on Overview again', (await tabOn(again.page)) === 'base');
  await again.ctx.close();
}

/* ---- National Campus Director ---- */
{
  const { ctx, page } = await open('ncd');
  ok('National Campus Director: opens on Overview', (await tabOn(page)) === 'base');
  ok('… “The staff and the week’s rhythm”', /The staff and the week’s rhythm/.test(await focus(page)));
  ok('… Overview, Board, My week, Finances', (await tabs(page)).join() === 'base,board,week,money', (await tabs(page)).join());
  const tl = await tiles(page);
  ok('… away this week, 1-on-1s, numbers in, Tuesday', tl.length === 4 && /Away this week/.test(tl[0]) && /1-on-1s this month/.test(tl[1]) && /Numbers in/.test(tl[2]) && /Tuesday/.test(tl[3]), tl.join(' | '));
  await page.screenshot({ path: OUT + '/2-national.png' });
  ok('… and 1-on-1s first when logging', (await firstKinds(page)).join() === 'oneonone,meeting,deptmeeting');
  await ctx.close();
}

/* ---- Director of a department ---- */
{
  const { ctx, page } = await open('chea');
  ok('Director of Community Service: opens on their department', (await tabOn(page)) === 'base' && /My department/.test(await page.$eval('.lwSeg .campusBtn.on', (b) => b.textContent)));
  ok('… “Your department: its ministries, leaders and numbers”', /Your department/.test(await focus(page)));
  ok('… their department’s week at the top, no whole-base numbers', !(await page.$('.lbGlance')) && /Community Service this week/.test(await page.$eval('#leadBase', (e) => e.innerText)) && !/Youth Education this week/.test(await page.$eval('#leadBase', (e) => e.innerText)));
  await page.screenshot({ path: OUT + '/3-department.png' });
  ok('… and department meetings first when logging', (await firstKinds(page)).join() === 'deptmeeting,oneonone,meeting');
  await ctx.close();
}

/* ---- a Campus Director with no title yet ---- */
{
  const { ctx, page } = await open('cd');
  ok('a Campus Director with no title: the whole base, as before', (await tabOn(page)) === 'base' && !(await focus(page)) && (await tiles(page)).length === 4 && /Clear leaders/.test((await tiles(page))[0]));
  await ctx.close();
}

/* ---- Khmer ---- */
{
  const { ctx, page } = await open('ncd', { km: true });
  ok('Khmer: the line and the numbers in Khmer, nothing scrolls sideways', /ចង្វាក់/.test(await focus(page)) && /អវត្តមាន/.test((await tiles(page)).join(' ')) &&
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: OUT + '/4-national-km.png' });
  await ctx.close();
}

ok('no errors on the page', !errors.length, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
