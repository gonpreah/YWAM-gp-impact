/* The week’s board in the page (teams/20-game.js): the line on My Home, Team → This week. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('game-ui');
const OUT = tmpDir('game-ui-out');
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
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
mem.staff[0].isAdmin = true;
mem.staff[0].isAdmin = true;
const KH = /[ក-៿]/;
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const day = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const nowIso = new Date().toISOString();
mem.staff.push(mk({ id: 'st6', name: 'Pich Poipet', username: 'pich', email: 'p@e.com', campus: 'poipet' }));
mem.staff.push(mk({ id: 'st7', name: 'Ev Sixth', username: 'ev', email: 'e@e.com' }));
mem.lastSeen = { started: '2026-01-01', seen: {}, days: { st1: [day(today, -1), today], st5: [day(today, -2), day(today, -1), today], st2: [today], st7: [today], st6: [today] } };
mem.staff.find(x => x.id === 'st5').libRead = { 'atomic-habits': today };
mem.dailyLogs = [{ staffId: 'st5', date: today, habits: { bible: true, prayer: true }, updated: nowIso }, { staffId: 'st7', date: today, habits: { bible: true }, updated: nowIso }];

/* ---------- 1. My Home ---------- */
{
  const { ctx, page } = await open('mark');
  const line = await page.$eval('#gameHome', e => e.innerText).catch(() => '');
  ok('My Home has my streak, points and place', /🔥 2/.test(line) && new RegExp('⭐ ' + (new Date(today + 'T00:00:00Z').getUTCDay() === 1 ? 5 : 10) + '\\b').test(line) && /#2 of 6/.test(line), line.replace(/\n/g, ' | '));
  const above = await page.evaluate(() => { const g = document.getElementById('gameHome'), h = document.querySelector('.myHero'); return g && h ? g.getBoundingClientRect().top < h.getBoundingClientRect().top : null; });
  ok('it sits above the summary card', above === true, String(above));
  ok('seven dots for the week', await page.$$eval('#gameHome .gameDots i', e => e.length) === 7);
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/home.png' });
  const rd = await page.evaluate(() => { const c = document.getElementById('libHome'), g = document.getElementById('sec-goals') || document.querySelector('.goalsCard'), h = document.querySelector('.myHero'); return c ? { text: c.innerText.replace(/\s+/g, ' '), belowHero: h ? c.getBoundingClientRect().top > h.getBoundingClientRect().top : null, aboveAbout: c.getBoundingClientRect().top < document.getElementById('sec-ptype').getBoundingClientRect().top - 200 } : null; });
  ok('the Reading card is always on My Home, high up, and says what a book is worth', !!rd && /Read a book in ten minutes|This month|Continue/.test(rd.text) && /50 points/.test(rd.text) && rd.aboveAbout, JSON.stringify(rd));
  await page.click('#gameHome'); await page.waitForTimeout(300);
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/board.png', fullPage: true });

  /* ---------- 2. the board ---------- */
  const txt = await main(page);
  ok('it opens Team on This week', /This week/i.test(txt) && await page.$('[data-teammode="game"].on') !== null);
  ok('the campus together comes first', /4 of 6 active this week/.test(await page.$eval('#gameCampus', e => e.innerText)), await page.$eval('#gameCampus', e => e.innerText));
  const rows = await page.$$eval('#gameList .gameRow', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  ok('Di leads, then me', /Di Sok/.test(rows[0]) && /🥇/.test(rows[0]) && /Mark Hill/.test(rows[1]) && /you/.test(rows[1]), rows.join(' / '));
  ok('my row is marked', await page.$('#gameList .gameRow.me') !== null);
  ok('everyone with points is there; the other campus is not', /Ev Sixth/.test(rows.join(' ')) && !/Pich Poipet/.test(rows.join(' ')));
  ok('people with no points are a count, not a list', /2 more have no points yet/.test(txt), '');
  ok('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.click('#gameHow summary'); await page.waitForTimeout(150);
  const how = await page.$eval('#gameHow', e => e.innerText);
  ok('where my points came from', /Opened the app/.test(how) && /check-in gives no points/.test(how), '');
  await page.click('[data-gametab="books"]'); await page.waitForTimeout(200);
  const bk = await page.$eval('#gameBooks', e => e.innerText.replace(/\s+/g, ' '));
  ok('Readers: books this year, and what a book is worth', /Di Sok/.test(bk) && /📚 1/.test(bk) && /50 points/.test(bk) && !/Mark Hill/.test(bk), bk.slice(0, 120));
  await page.click('[data-gametab="min"]'); await page.waitForTimeout(200);
  ok('ministries by average', /Average points a person/.test(await main(page)) || /No ministry has two people/.test(await main(page)));
  await page.click('[data-gametab="people"]'); await page.waitForTimeout(200);
  await page.click('[data-gamecampus="poipet"]'); await page.waitForSelector('#gameList', { timeout: 5000 }); await page.waitForTimeout(200);
  const pp = await main(page);
  ok('the other campus loads on demand', /Pich Poipet/.test(pp) && !/Di Sok/.test(pp) && await page.$('#gameMe') === null);
  await page.click('[data-gamecampus="siemreap"]'); await page.waitForTimeout(300);

  ok('there is no switch to step off', await page.$('#gameShowMe') === null && !/Show me on the board/.test(await main(page)));
  await page.click('#gameList .gameRow:first-child'); await page.waitForTimeout(400);
  ok('a row opens the person', /Di Sok/.test(await main(page)) && await page.$('#gameList') === null);
  await ctx.close();
}

/* ---------- 4. Khmer, a small phone, and who gets none of it ---------- */
{
  const { ctx, page } = await open('mark', { km: true, small: true });
  const line = await page.$eval('#gameHome', e => e.innerText);
  ok('Khmer on My Home', KH.test(line) && !/points this week|in a row/.test(line), line.replace(/\n/g, ' | '));
  await page.click('#gameHome'); await page.waitForTimeout(300);
  const txt = await main(page);
  ok('Khmer on the board', !/active this week|People\b|Ministries/.test(txt), '');
  ok('fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
{
  const { ctx, page } = await open('', { board: 'mary' });
  ok('a board member has no board line', await page.$('#gameHome') === null && await page.$('[data-teammode="game"]') === null);
  await ctx.close();
}
ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
