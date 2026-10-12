/* 1-on-1s with a little structure (Oct 2026): the mentee's check-in (six areas
   of life and the five FIGHT values, 1-5), the mentor's sheet — check-in, goals,
   last time's follow-ups, notes — marking it done, the two-a-month count, and
   the mentee landing on their check-in after accepting. Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('oo-ui');
const OUT = tmpDir('oo-ui-out');
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
  mk({ id: 'st1', name: 'Andrew Mentor', username: 'andrew', email: 'a@e.com', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st2', name: 'Sokha Chan', username: 'sokha', email: 's@e.com', mentorId: 'st1', mentorStatus: 'approved' }),
  mk({ id: 'st3', name: 'Mealea Stranger', username: 'mealea', email: 'm@e.com' })
];
const YR = new Date().getFullYear();
mem.smartGoals = [{ id: 'g1', staffId: 'st2', year: YR, category: 'Faith', title: 'Read the whole Bible this year', pct: 40, smart: {}, steps: [] }];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
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
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const rows = () => mem.oneOnOnes || [];

/* ---------- 1. the mentee asks, with their check-in ---------- */
{
  const { ctx, page } = await open('sokha');
  ok('My Home shows the month: 0 of 2 1-on-1s', /0 of 2 1-on-1s this month/.test(await main(page)));
  await page.click('[data-request121="st1"]'); await page.waitForTimeout(300);
  let txt = await main(page);
  ok('☕ opens the check-in: six areas and the five FIGHT values, 1-5',
    (await page.$$('[data-ooarea]')).length === 30 && (await page.$$('[data-ooval]')).length === 25 && /Fundraising & finances/.test(txt) && /Tenacious/.test(txt) && /Living our values — FIGHT/i.test(txt));
  await page.click('#ooSend'); await page.waitForTimeout(300);
  ok('it will not send until every area and value is rated', rows().length === 0);
  const areas = { money: 2, language: 3, physical: 4, emotional: 2, relational: 5, spiritual: 4 };
  for (const [k, n] of Object.entries(areas)) await page.click('[data-ooarea="' + k + '|' + n + '"]');
  for (const [k, n] of Object.entries({ faithful: 4, innovative: 3, generous: 5, humble: 4, tenacious: 2 })) await page.click('[data-ooval="' + k + '|' + n + '"]');
  await page.fill('[data-oodraft="helpWith"]', 'Writing my support letters');
  await page.click('[data-ooarea="physical|5"]');   // a re-render must not lose the typing
  await page.fill('[data-oodraft="workingOn"]', 'Pass Khmer level 2');
  ok('typing survives tapping a score', (await page.inputValue('[data-oodraft="helpWith"]')) === 'Writing my support letters');
  await page.screenshot({ path: OUT + '/checkin.png', fullPage: true });
  await page.click('#ooSend'); await page.waitForTimeout(500);
  const r0 = rows()[0] || {};
  ok('… then the request goes, carrying the check-in', rows().length === 1 && r0.prep && r0.prep.areas.money === 2 && r0.prep.areas.physical === 5 && r0.prep.values.tenacious === 2 && r0.prep.helpWith === 'Writing my support letters' && r0.prep.workingOn === 'Pass Khmer level 2', JSON.stringify(r0.prep));
  ok('back on My Home it is "coming up", and the ☕ now opens it', /1-on-1s coming up/i.test(await main(page)) && !!(await page.$('[data-ooopen="' + r0.id + '"]')));
  await ctx.close();
}

/* ---------- 2. the mentor reads it, accepts, and marks it done ---------- */
let firstId;
{
  const { ctx, page } = await open('andrew');
  firstId = rows()[0].id;
  await page.click('#main [data-ooopen="' + firstId + '"]'); await page.waitForTimeout(800);
  let txt = await main(page);
  ok('the mentor sees the check-in: areas, FIGHT values, what they want help with',
    /Sokha’s check-in/.test(txt) && /Fundraising & finances[\s\S]*2\/5/.test(txt) && /Writing my support letters/.test(txt) && /Pass Khmer level 2/.test(txt) && (await page.$$('.ooVal')).length === 5);
  ok('… beside their goals for the year', /Read the whole Bible this year/.test(txt));
  await page.screenshot({ path: OUT + '/mentor-sheet.png', fullPage: true });
  await page.click('#main [data-121accept="' + firstId + '"]'); await page.waitForTimeout(500);
  ok('accepting it from the sheet', rows()[0].status === 'accepted');
  await page.fill('[data-oonote="notes"]', 'Talked through the support letters; prayed.');
  await page.fill('[data-oofu="0"]', 'Send five letters');
  await page.click('#ooFuAdd'); await page.waitForTimeout(200);
  ok('adding a follow-up keeps the notes typed so far', (await page.inputValue('[data-oonote="notes"]')) === 'Talked through the support letters; prayed.');
  await page.fill('[data-oofu="1"]', 'Book a Khmer tutor');
  await page.click('#ooSaveNotes'); await page.waitForTimeout(500);
  const r = rows()[0];
  ok('Mark as done: held today, with notes and two follow-ups', r.status === 'held' && r.heldOn === today && r.notes === 'Talked through the support letters; prayed.' && r.followUps.length === 2, JSON.stringify(r));
  ok('… and it counts: 1 of 2 this month', /1 of 2 1-on-1s this month/.test(await main(page)));
  /* a second one, logged straight from the mentee's page */
  await page.evaluate(() => { S.view = 'mentor'; S.mentee = null; render(); }); await page.waitForTimeout(300);
  ok('the Mentor page shows the month on each mentee', /1 of 2 1-on-1s this month/.test(await main(page)));
  await page.click('#main [data-mentee="st2"]'); await page.waitForTimeout(900);
  ok('a mentee\'s page lists their 1-on-1s', /1-on-1s/.test(await main(page)) && !!(await page.$('#main [data-ooopen="' + firstId + '"]')));
  await page.click('#main [data-request121="st2"]'); await page.waitForTimeout(300);
  txt = await main(page);
  ok('a new one for a mentee: ask them, or log one that already happened — with last time\'s follow-ups', !!(await page.$('#ooAsk')) && !!(await page.$('#ooLog')) && /From last time/.test(txt) && /Send five letters/.test(txt));
  await page.fill('[data-oonote="notes"]', 'Coffee after church');
  await page.click('#ooLog'); await page.waitForTimeout(500);
  ok('logging it counts as the second: 2 this month ✓', rows().length === 2 && rows()[1].status === 'held' && /2 1-on-1s this month ✓/.test(await main(page)));
  await ctx.close();
}

/* ---------- 3. the mentee sees the notes and ticks a follow-up ---------- */
{
  const { ctx, page } = await open('sokha');
  ok('the mentee\'s month is full too', /2 1-on-1s this month ✓/.test(await main(page)));
  await page.evaluate(id => ooGo_(id), firstId); await page.waitForTimeout(300);
  const txt = await main(page);
  ok('they see the notes and what to follow up', /Talked through the support letters/.test(txt) && /Book a Khmer tutor/.test(txt) && !(await page.$('#ooSaveNotes')));
  await page.click('[data-ootick="' + firstId + '|1"]'); await page.waitForTimeout(500);
  ok('… and can tick one done', rows()[0].followUps[1].done === true);
  await ctx.close();
}

/* ---------- 4. the mentor asks; the mentee accepts and lands on the check-in ---------- */
{
  const a = await open('andrew');
  await a.page.click('#main [data-request121="st2"]'); await a.page.waitForTimeout(300);
  await a.page.click('#ooAsk'); await a.page.waitForTimeout(500);
  const askId = rows()[2] && rows()[2].id;
  ok('the mentor\'s request goes, with no check-in yet, and the sheet says it is waiting', rows().length === 3 && rows()[2].status === 'pending' && !rows()[2].prep && /Waiting for Sokha to fill in their check-in/.test(await main(a.page)));
  await a.ctx.close();
  const { ctx, page } = await open('sokha', { small: true });
  await page.click('#main [data-121accept="' + askId + '"]'); await page.waitForTimeout(600);
  ok('accepting takes the mentee straight to their check-in', !!(await page.$('#ooSavePrep')) && (await page.$$('[data-ooarea]')).length === 30);
  ok('… started from last time\'s answers', !!(await page.$('[data-ooarea="money|2"].on')) && !!(await page.$('[data-ooval="tenacious|2"].on')));
  ok('the check-in fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.click('[data-ooarea="money|4"]');
  await page.click('#ooSavePrep'); await page.waitForTimeout(500);
  ok('saving it lets the mentor see it, with the change since last time', rows()[2].prep && rows()[2].prep.areas.money === 4 && /▲2/.test(await main(page)));
  await page.screenshot({ path: OUT + '/mentee-summary.png', fullPage: true });
  await ctx.close();
}

/* ---------- 5. nobody else sees any of it ---------- */
{
  const { ctx, page } = await open('mealea');
  const seen = await page.evaluate(() => (S.oneOnOnes || []).length);
  ok('someone outside the pair gets none of their 1-on-1s', seen === 0);
  await ctx.close();
}

/* ---------- 6. in Khmer ---------- */
{
  const { ctx, page } = await open('sokha', { km: true });
  await page.evaluate(id => ooGo_(id), firstId); await page.waitForTimeout(400);
  const txt = await main(page);
  ok('the sheet is in Khmer (the FIGHT letters stay)', /[ក-៿]{4}/.test(txt) && !/Notes and follow-ups|How I’m doing|From last time/i.test(txt) && /F/.test(txt));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
