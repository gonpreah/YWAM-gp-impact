/* Looking around without an account (Nov 2026: the preview — the app itself on a made-up campus, demoCall) — on the page, on the real backend.
   Older notes: in the menu; the books load
   only when it opens; the home is swipeable rows (Start here, each shelf, See all)
   of tiles with drawn covers — one series look, nothing fetched, neighbours never
   the same pattern; a book page has every part; the reader goes one key idea per
   screen (Next, swipe, Close keeps your place, Continue reading, Done marks it
   read); Khmer at 320px; a failed load offers Try again. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('guest-ui');
const OUT = tmpDir('guest-ui-out');
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
  mk({ id: 'st1', name: 'Real Rina', username: 'rina', email: 'd@e.com', libRead: { 'atomic-habits': '2026-10-01', 'grit': '2026-10-02' } }),
  mk({ id: 'st2', name: 'Emma Hill', username: 'emma', email: 'e@e.com' }),
  mk({ id: 'st3', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true })
];
const PDF64 = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
mem.reqDocs = [
  { id: 'rd_cpp', title: 'Child Protection Policy', fileId: 'rf_cpp', fileName: 'cpp.pdf', mime: 'application/pdf', size: 900, version: 1, updated: '2026-10-01T00:00:00Z', order: 0 },
  { id: 'rd_man', title: 'Staff Manual', url: 'https://drive.example.org/manual', version: 1, updated: '2026-10-01T00:00:00Z', order: 1 }
];
mem['reqfile:rf_cpp'] = { id: 'rf_cpp', docId: 'rd_cpp', name: 'cpp.pdf', mime: 'application/pdf', data: PDF64 };
const CALLS = [];
mem.entries = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 40, year: 2026, value: 12 }];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    try { const j = JSON.parse(b || '{}'); CALLS.push({ fn: j.fn, args: j.args || [] }); } catch (e) {}
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
async function open(opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  if (opts.km) await page.addInitScript(() => localStorage.setItem('gp-lang', 'km'));
  await page.goto(BASE + '/teams.html' + (opts.qs || ''), { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page };
}
const credCalls = () => CALLS.filter(c => JSON.stringify(c.args).indexOf('1234') > -1 || JSON.stringify(c.args).indexOf('"rina"') > -1);
const realBefore = JSON.stringify(mem);

{
  { const { ctx, page } = await open();
    ok('the log-in screen offers a look around first (Nov 2026, Andrew: "view it as a guest … a mock-up")', !!(await page.$('#toGuest')) && /Look around first/.test(await page.$eval('#toGuest', e => e.innerText)));
    await page.click('#toGuest'); await page.waitForSelector('#demoBar', { timeout: 15000 }); await page.waitForTimeout(600);
    ok('it opens the app itself, as a made-up person — not a tour', await page.evaluate(() => S.demo === true && !S.guest && S.me && S.me.name === 'Dara Sok') && !!(await page.$('.myHero')) && !(await page.$('.guestHero')));
    await ctx.close(); }
  const { ctx, page } = await open({ qs: '?guest=1' });
  await page.waitForSelector('#demoBar', { timeout: 15000 }); await page.waitForTimeout(600);
  ok('?guest=1 opens the preview, saying so on top with Create my profile and Log in', /made up/.test(await page.$eval('#demoBar', e => e.innerText)) && !!(await page.$('#demoReg')) && !!(await page.$('#demoLogin')));
  ok('My Home is the real My Home: the dashboard card, this week’s goals, habits', !!(await page.$('#qaBar')) && /Pray with a customer/.test(await page.$eval('#main', e => e.innerText)) && !!(await page.$('#sec-habits')));
  ok('the bottom bar is the real one — My Home, My Ministry, Team, Health, Profile', (await page.$$eval('nav.bottom button', bs => bs.map(b => b.getAttribute('data-tab')))).join() === 'week,ministry,team,health,profile');
  await page.screenshot({ path: OUT + '/preview-home.png', fullPage: true });

  await page.click('nav.bottom button[data-tab="team"]'); await page.waitForTimeout(900);
  const team = await page.$eval('#main', e => e.innerText);
  ok('Team shows the made-up team — and none of the real people', /Grace Miller/.test(team) && /Sophea Chan/.test(team) && !/Real Rina|Emma Hill|Uriah Lyford/.test(team), team.slice(0, 200).replace(/\s+/g, ' '));
  await page.click('nav.bottom button[data-tab="health"]'); await page.waitForTimeout(900);
  ok('Health shows check-ins (made-up ones)', /check-in/i.test(await page.$eval('#main', e => e.innerText)) && !/needs an account/.test(await page.$eval('#main', e => e.innerText)));
  await page.click('nav.bottom button[data-tab="ministry"]'); await page.waitForTimeout(1200);
  ok('My Ministry opens on the made-up Cafe', /Cafe/.test(await page.$eval('#main', e => e.innerText)));
  await page.screenshot({ path: OUT + '/preview-ministry.png' });
  await page.click('nav.bottom button[data-tab="week"]'); await page.waitForTimeout(600);

  /* a change: shown, said to be a preview, and kept nowhere */
  const tile = await page.$('[data-habit]');
  const was = tile ? await tile.evaluate(e => e.classList.contains('on')) : null;
  if (tile) await tile.click(); await page.waitForTimeout(1500);
  ok('a habit ticks like the real thing', tile && (await page.$eval('[data-habit]', e => e.classList.contains('on'))) !== was);
  ok('… and the page says nothing in the preview is kept', await page.evaluate(() => /preview/.test(document.body.innerText)) && CALLS.some(c => c.fn === 'demoCall' && c.args[0] === 'saveDaily'));

  await page.click('#menuBtn'); await page.waitForTimeout(250);
  const menu = await page.$$eval('[data-menu-item]', bs => bs.map(b => b.getAttribute('data-menu-item')));
  ok('the menu is an ordinary staff member’s — no Admin or HR', menu.includes('library') && !menu.includes('admin') && !menu.includes('hr'), menu.join());
  await page.click('[data-menu-item="library"]'); await page.waitForTimeout(1200);
  ok('the Library is the real one, all of it', await page.evaluate(() => S.view === 'library' && typeof GP_LIBRARY !== 'undefined') && (await page.$$('.libTile')).length > 40);
  await page.click('.libRow [data-libbook="atomic-habits"]'); await page.waitForTimeout(400);
  await page.click('#libStart'); await page.waitForTimeout(300); await page.click('#libNext'); await page.waitForTimeout(300);
  ok('… a whole book to read', /Key idea 1 of/i.test(await page.$eval('#libReader', e => e.innerText)));
  await page.click('#libClose'); await page.waitForTimeout(300);

  ok('every call is the preview’s — none with anyone’s real sign-in', CALLS.every(c => ['demoCall', 'libAudioIndex', 'portalAuthConfig'].indexOf(c.fn) > -1) && credCalls().length === 0, [...new Set(CALLS.map(c => c.fn))].join(','));
  ok('… and the real store is exactly as it was: nothing read into the page, nothing written', JSON.stringify(mem) === realBefore);
  ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#demoBar', { timeout: 15000 });
  ok('opening the app again stays in the preview', await page.evaluate(() => S.demo === true));
  await page.click('#demoLogin'); await page.waitForTimeout(500);
  ok('"Log in" goes to the log-in screen and ends the preview', !!(await page.$('#li_user')) && await page.evaluate(() => !S.demo && !S.me && !localStorage.getItem('gp-app-guest') && !localStorage.getItem('gp-staff')));
  CALLS.length = 0;
  await page.fill('#li_user', 'rina'); await page.fill('#li_pin', '1234'); await page.click('#loginBtn'); await page.waitForTimeout(2000);
  ok('logging in works as before', await page.evaluate(() => !!S.me && !S.demo && S.me.id === 'st1' && !document.getElementById('demoBar')));
  await ctx.close();
}
{
  const { ctx, page } = await open({ qs: '?guest=1' });
  await page.waitForSelector('#demoReg', { timeout: 15000 });
  await page.click('#demoReg'); await page.waitForTimeout(500);
  ok('"Create my profile" opens the sign-up', await page.evaluate(() => S.regMode === true && !S.demo) && /Create my profile/.test(await page.$eval('#main', e => e.innerText)));
  await ctx.close();
}
{
  const { ctx, page } = await open({ small: true, km: true, qs: '?guest=1' });
  await page.waitForSelector('#demoBar', { timeout: 15000 }); await page.waitForTimeout(500);
  ok('in Khmer at 320px the preview’s bar is Khmer and fits', /[ក-៿]{4}/.test(await page.$eval('#demoBar', e => e.innerText)) && await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
