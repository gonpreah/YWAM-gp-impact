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
  ok('My Home keeps a short Mentorship card that opens the page', !!(await page.$('#goMentorshipHome')) && !(await page.$('#main [data-request121]')));
  await page.click('.heroRow[data-gomentorship]'); await page.waitForTimeout(300);
  let txt = await main(page);
  ok('tapping Mentor on the dashboard opens the Mentorship page: your mentor, people you mentor', /🤝 Mentorship/.test(txt) && /Your mentor/i.test(txt) && /You mentor/.test(txt) && /Nobody has chosen you as their mentor yet/.test(txt), txt.slice(0, 200));
  ok('… with a plain button: Ask Andrew for a 1-on-1', /Ask Andrew for a 1-on-1/.test(await page.$eval('#myMentorCard [data-request121="st1"]', b => b.textContent)));
  await page.click('#myMentorCard [data-request121="st1"]'); await page.waitForTimeout(300);
  txt = await main(page);
  ok('the sheet says who is asking whom', /You are asking Andrew, your mentor, for a 1-on-1/.test(txt) && /Andrew is your mentor/.test(txt) && /Send my request to Andrew/.test(await page.$eval('#ooSend', b => b.textContent)));
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
  ok('back on Mentorship, under Your mentor: you asked Andrew, waiting for him to set a time — and it opens', /You asked Andrew for a 1-on-1 — waiting for them to set a time/.test(await page.$eval('#myMentorCard', e => e.innerText)) && !!(await page.$('#myMentorCard [data-ooopen="' + r0.id + '"]')));
  await ctx.close();
}

/* ---------- 2. the mentor reads it, accepts, and marks it done ---------- */
let firstId;
{
  const { ctx, page } = await open('andrew');
  firstId = rows()[0].id;
  ok('My Home tells the mentor something is waiting', /1 request waiting for you/.test(await main(page)));
  await page.click('#goMentorshipHome'); await page.waitForTimeout(300);
  ok('Mentorship puts the request with Sokha, under You mentor: Sokha asked you — pick a day and time', /Sokha asked you for a 1-on-1\. Pick a day and time/.test(await page.$eval('#mentee-st2', e => e.innerText)) && !!(await page.$('#mentee-st2 [data-ooset="' + firstId + '"]')), (await main(page)).slice(0, 300));
  const bell = await page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('the bell says it plainly too: Sokha (you mentor them) asked you for a 1-on-1', /Sokha Chan \(you mentor them\) asked you for a 1-on-1/.test(bell), bell);
  await page.click('#main .mentorRow [data-ooopen="' + firstId + '"]'); await page.waitForTimeout(800);
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
  ok('a mentee\'s page has their 1-on-1 history', /1-on-1 history/.test(await main(page)) && !!(await page.$('#ooHistory')) && !!(await page.$('#main [data-ooopen="' + firstId + '"]')) && /0 of 2 follow-ups done/.test(await main(page)));
  ok('… with Ask Sokha for a 1-on-1, and Log one you already had', /Ask Sokha for a 1-on-1/.test(await main(page)) && !!(await page.$('#main [data-oolog="st2"]')) && /← Mentorship/.test(await main(page)));
  await page.click('#main [data-oolog="st2"]'); await page.waitForTimeout(300);
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
  await a.page.click('.heroRow[data-gomentorship]'); await a.page.waitForTimeout(300);
  await a.page.click('#main [data-mentee="st2"]'); await a.page.waitForTimeout(900);
  const hist = await a.page.$eval('#ooHistory + .card', e => e.innerText);
  ok('the history shows both held 1-on-1s, newest first, with how the follow-ups went', (hist.match(/✓ Done/g) || []).length === 2 && !/\d{4}-\d{2}-\d{2}/.test(hist) && /1 of 2 follow-ups done/.test(hist) && /Coffee after church/.test(hist), hist);
  await a.page.screenshot({ path: OUT + '/mentee-history.png', fullPage: true });
  await a.page.click('.mentorBack, #menteeBack'); await a.page.waitForTimeout(300);
  await a.page.screenshot({ path: OUT + '/mentorship.png', fullPage: true });
  await a.page.click('#main [data-mentee="st2"]'); await a.page.waitForTimeout(900);
  await a.page.click('#main [data-request121="st2"]'); await a.page.waitForTimeout(300);
  ok('the mentor\'s sheet says who is asking whom', /You are asking Sokha, who you mentor, to meet/.test(await main(a.page)) && /Send Sokha a 1-on-1 request/.test(await a.page.$eval('#ooAsk', b => b.textContent)));
  await a.page.click('#ooAsk'); await a.page.waitForTimeout(500);
  const askId = rows()[2] && rows()[2].id;
  ok('the mentor\'s request goes, with no check-in yet, and the sheet says it is waiting', rows().length === 3 && rows()[2].status === 'pending' && !rows()[2].prep && /Waiting for Sokha to fill in their check-in/.test(await main(a.page)));
  await a.ctx.close();
  const { ctx, page } = await open('sokha', { small: true });
  await page.click('#goMentorshipHome'); await page.waitForTimeout(300);
  ok('the mentee is told, under Your mentor: Andrew asked you — pick a day and time', /Andrew asked you for a 1-on-1\. Pick a day and time/.test(await page.$eval('#myMentorCard', e => e.innerText)));
  ok('the Mentorship page fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.click('#main [data-ooset="' + askId + '"]'); await page.waitForTimeout(300);
  ok('it won\'t set without a day and a time', rows()[2].status === 'pending');
  const soon = new Date(Date.now() + 7 * 3600e3 + 2 * 864e5).toISOString().slice(0, 10);
  await page.fill('[data-oodate="' + askId + '"]', soon); await page.fill('[data-ootime="' + askId + '"]', '16:30');
  await page.click('#main [data-ooset="' + askId + '"]'); await page.waitForTimeout(700);
  ok('setting the day and time accepts it, with the time', rows()[2].status === 'accepted' && rows()[2].when === soon + 'T16:30' && rows()[2].whenBy === 'st2');
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

/* ---------- 7. two people who mentor each other (Oct 2026, Uriah) ---------- */
mem.staff.push(mk({ id: 'st4', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', mentorId: 'st5', mentorStatus: 'approved' }),
  mk({ id: 'st5', name: 'Naomie Lee', username: 'naomie', email: 'n@e.com', mentorId: 'st4', mentorStatus: 'approved' }));
const nowIso = new Date().toISOString();
mem.oneOnOnes.push({ id: 'ooU', fromId: 'st4', toId: 'st5', menteeId: 'st4', note: '', status: 'pending', created: nowIso, updated: nowIso, decidedAt: '' },
  { id: 'ooN', fromId: 'st5', toId: 'st4', menteeId: 'st5', note: '', status: 'pending', created: nowIso, updated: nowIso, decidedAt: '' });
{
  const { ctx, page } = await open('naomie');
  await page.evaluate(() => { S.view = 'mentor'; S.mentee = null; render(); }); await page.waitForTimeout(400);
  const asMentor = await page.$eval('#mentee-st4', e => e.innerText), asMentee = await page.$eval('#myMentorCard', e => e.innerText);
  ok('mentoring each other: under You mentor, Uriah asked you (set a time)', /Uriah asked you for a 1-on-1/.test(asMentor) && !!(await page.$('#mentee-st4 [data-ooset="ooU"]')), asMentor);
  ok('… and under Your mentor, you asked Uriah (waiting for him)', /You asked Uriah for a 1-on-1 — waiting/.test(asMentee) && !(await page.$('#myMentorCard [data-ooset]')), asMentee);
  ok('… no separate “coming up” list to mix them up', !/1-on-1s coming up/i.test(await main(page)));
  const soon = new Date(Date.now() + 7 * 3600e3 + 3 * 864e5).toISOString().slice(0, 10);
  await page.fill('[data-oodate="ooU"]', soon); await page.fill('[data-ootime="ooU"]', '09:00');
  await page.click('[data-ooset="ooU"]'); await page.waitForTimeout(700);
  ok('Naomie sets the time for the one Uriah asked for', mem.oneOnOnes.find(o => o.id === 'ooU').when === soon + 'T09:00' && /📅/.test(await page.$eval('#mentee-st4', e => e.innerText)));
  await ctx.close();
  const u = await open('uriah');
  const bell = await u.page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('Uriah\'s bell: Naomie set your 1-on-1 for the day and 9:00', /Naomie Lee set your 1-on-1 for .*9:00/.test(bell), bell);
  await u.page.evaluate(() => { S.view = 'mentor'; S.mentee = null; render(); }); await u.page.waitForTimeout(400);
  ok('… and on his Mentorship page it sits under Your mentor, with the time', /📅/.test(await u.page.$eval('#myMentorCard', e => e.innerText)) && /Naomie set it/.test(await u.page.$eval('#myMentorCard', e => e.innerText)));
  await u.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
