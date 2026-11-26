/* The Worship rota on the page (teams/26-worship.js), against the real api.js.
   The worship team: My Ministry's tabs (This week · Rota · Team · Songs · Dashboard, then Numbers · Tasks ·
   OKRs), filling a role with the people picker and a typed guest, a song in the library and on the setlist,
   publishing, the Numbers tab asking only for what the rota can't count. Someone on the team sees the line
   on My Home's card; the bell says it the day before; anyone on the campus reads the published week from
   ☰ → Worship rota. A phone at 320px doesn't slide sideways. Every name here is made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('worship-ui');
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
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st_w', name: 'Wren Worship', username: 'wren', email: 'w@e.com', dept: 'Youth Education', ministry: 'Worship', leads: ['Youth Education|Worship'] }),
  mk({ id: 'st_k', name: 'Kai Keys', username: 'kai', email: 'k@e.com', dept: 'Community Service', ministry: 'Cafe', ministries: ['Youth Education|Worship'] }),
  mk({ id: 'st_r', name: 'Rae Reader', username: 'rae', email: 'r@e.com', dept: 'Skills Training', ministry: 'Culinary' }),
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
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
  page.on('pageerror', e => errors.push(user + ' PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|404/.test(m.text())) errors.push(user + ' CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}
async function toWorship(page, tab) {
  await page.evaluate(t => { S.view = 'ministry'; S.mmBrowseDept = 'Youth Education'; S.mmBrowseMinistry = 'Worship'; if (t) { S.mmTab = t; S.mmTabTouched = true; } render(); window.scrollTo(0, 0); }, tab || '');
  await page.waitForTimeout(800);
}
async function tab(page, key) { await page.click('[data-mmtab="' + key + '"]'); await page.waitForTimeout(700); }

console.log('=== the worship team ===');
let { ctx, page } = await open('wren');
await toWorship(page);
const tabs = await page.$$eval('.mmTabs [data-mmtab]', els => els.map(e => e.getAttribute('data-mmtab')).join(' '));
ok('Worship’s tabs: This week · Rota · Team · Songs · Dashboard · Scorecard · Tasks · Rocks', tabs === 'wsweek wsrota wsteam wssongs wsdash numbers tasks okr', tabs);
ok('This week opens first, the four services and how many are filled', await page.locator('.wsSvc').count() === 4 && /0 of 4 services filled/.test(await page.textContent('#wsStatus')));

await tab(page, 'wssongs');
await page.click('#wsSongNew'); await page.waitForTimeout(200);
await page.fill('#wsSgTitle', 'Example Praise'); await page.fill('#wsSgKey', 'D'); await page.fill('#wsSgLink', 'https://example.org/chords');
await page.click('#wsSongSave'); await page.waitForTimeout(800);
ok('a song goes in the library', /Example Praise/.test(await page.textContent('#wsSongs')));

await tab(page, 'wsrota');
ok('the Rota shows the weeks ahead', await page.locator('#wsAhead [data-wsweek]').count() === 9);
await page.click('#wsNextWeek'); await page.waitForTimeout(900);
await page.click('[data-wspick="monpm|lead"]'); await page.waitForTimeout(300);
await page.fill('[data-ppickq="ws.monpm.lead"]', 'Kai'); await page.waitForTimeout(200);
await page.click('[data-ppickit="ws.monpm.lead|st_k"]'); await page.waitForTimeout(900);
ok('the people picker puts Kai on as worship leader', /Kai Keys/.test(await page.textContent('[data-wssvc="monpm"]')) && !(await page.$('[data-wspick="monpm|lead"]')), 'single role: no + once filled');
await page.click('[data-wspick="monpm|vocals"]'); await page.waitForTimeout(300);
await page.fill('[data-wsname="monpm|vocals"]', 'Guest Singer');
await page.click('[data-wsnameadd="monpm|vocals"]'); await page.waitForTimeout(900);
ok('a guest’s typed name on vocals; the service is filled', /Guest Singer/.test(await page.textContent('[data-wssvc="monpm"]')) && /1 of 4 services filled/.test(await page.textContent('#wsStatus')));
const songId = await page.evaluate(() => S.ws.songs[0].id);
await page.selectOption('[data-wsaddsong="monpm"]', songId); await page.waitForTimeout(900);
ok('a song from the library on the setlist', /Example Praise/.test(await page.textContent('[data-wssvc="monpm"] .wsSetlist')));
const draft = await call('worshipBoard', ['rae', '1234', await page.evaluate(() => S.ws.week)]);
ok('a draft is the team’s alone', draft.rec === null);
await page.click('#wsPublish'); await page.waitForTimeout(900);
ok('published', await page.locator('#wsStatus.pub').count() === 1);
await tab(page, 'numbers');
const numTxt = await page.textContent('.mmPane');
ok('the Numbers tab says what counts itself', await page.locator('#wsAutoHint').count() === 1);
ok('…and asks for none of it', !/Worship Nights Hosted|Attendance at Gatherings/.test(await page.evaluate(() => [].map.call(document.querySelectorAll('.mmPane input'), i => (i.closest('label,.kpiRow,div') || {}).textContent || '').join(' '))), numTxt.slice(0, 80));
await tab(page, 'wsteam');
await page.fill('#wsTeamName', 'Typed Drummer'); await page.click('#wsTeamAdd'); await page.waitForTimeout(800);
await page.click('[data-wsteamrole$="|drums"]'); await page.waitForTimeout(800);
ok('the team: a typed name, and the drums ticked', /Typed Drummer/.test(await page.textContent('#wsTeam')) && await page.locator('[data-wsteamrole$="|drums"].blue').count() === 1);
await tab(page, 'wsdash');
ok('the Dashboard draws', await page.locator('.mmPane .mmTile').count() === 4 && await page.locator('#wsServed').count() === 1);
const mondayDate = await page.evaluate(() => S.ws.thisWeek);
await ctx.close();

console.log('=== someone on it, and the campus ===');
({ ctx, page } = await open('kai'));
await page.waitForTimeout(400);
ok('My Home’s card says Kai is on (the line from the boot)', /Worship leader/.test((await page.textContent('#wsMine').catch(() => '')) || ''), await page.textContent('#wsMine').catch(() => 'no line'));
const bell = await page.evaluate(d => { const t = new Date(); t.setDate(t.getDate() + 1); const tom = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  S.worship = { mine: [{ week: d, date: tom, svc: 'monpm', name: 'Monday night worship', time: '19:00', place: '', roles: ['Keys'] }] }; return wsNotifItems_().map(x => x.text); }, mondayDate);
ok('the bell says it the day before', bell.length === 1 && /Tomorrow: you’re on Keys — Monday night worship/.test(bell[0]), bell.join());
await ctx.close();

({ ctx, page } = await open('rae', { small: true }));
await page.click('#menuBtn'); await page.waitForTimeout(300);
await page.click('[data-menu-item="worship"]'); await page.waitForTimeout(900);
ok('☰ → Worship rota opens this week for anyone', /Worship rota/.test(await page.textContent('#main')));
await page.click('#wsNextWeek'); await page.waitForTimeout(900);
ok('the published week reads with its people and setlist, nothing to edit', /Kai Keys/.test(await page.textContent('#main')) && /Example Praise/.test(await page.textContent('#main')) && !(await page.$('[data-wspick]')) && !(await page.$('#wsGoEdit')));
const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok('320px: nothing slides sideways', wide <= 1, String(wide));
await ctx.close();

console.log('=== Khmer ===');
({ ctx, page } = await open('wren', { km: true, small: true }));
await toWorship(page, 'wsrota');
const kmTxt = await page.textContent('.mmPane');
ok('the Rota in Khmer', /កម្មវិធី/.test(kmTxt) && !/services filled|Publish this week|Services and roles/.test(kmTxt));
const wideKm = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok('Khmer at 320px: nothing slides sideways', wideKm <= 1, String(wideKm));
await ctx.close();

ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json();
}
