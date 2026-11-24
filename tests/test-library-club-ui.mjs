/* The Library, read together, on the page (teams/18-library-plus.js): search and topics; a reading plan; finishing a
   book (the question, a weekly goal, sharing, a badge, read next); the book of the month from leadership to My Home;
   recommending a book; the campus feed; a mentor giving a plan. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('libclub-ui');
const OUT = tmpDir('libclub-ui-out');
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
mem.staff.find((s) => s.id === 'st5').mentorId = 'st2'; mem.staff.find((s) => s.id === 'st5').mentorStatus = 'approved';
const lib = async (page) => { await page.evaluate(() => libOpen_()); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined', null, { timeout: 15000 }); await page.waitForTimeout(500); };
const rec = (id) => mem.staff.find((s) => s.id === id);

/* ---------- 1. Di: search, topics, a plan, finishing a book ---------- */
{
  const { ctx, page } = await open('di');
  await lib(page);
  ok('the Library has a search box, topics and reading plans', !!(await page.$('#libFind')) && (await page.$$('#libTags .libTagBtn')).length >= 10 && (await page.$$('#libPlans [data-libplan]')).length >= 5);
  ok('… and the books still come first: a cover is on the first screen', await page.evaluate(() => [...document.querySelectorAll('.libTile')].some((e) => e.getBoundingClientRect().top < innerHeight)));
  await page.fill('#libFind', 'gottman'); await page.waitForTimeout(300);
  ok('searching an author finds the book, and keeps the typing', (await page.$$('#libFindOut .libTile')).length === 1 && !!(await page.$('#libFindOut [data-libbook="the-seven-principles-for-making-marriage-work"]')) && await page.$eval('#libFind', (e) => e.value === 'gottman' && document.activeElement === e));
  await page.fill('#libFind', 'prayer'); await page.waitForTimeout(300);
  ok('searching a topic finds its books', (await page.$$('#libFindOut .libTile')).length >= 3);
  await page.fill('#libFind', ''); await page.waitForTimeout(300);
  await page.click('[data-libshelf="tag:marriage"]'); await page.waitForTimeout(300);
  ok('a topic chip shows that topic’s books', (await page.$$('.libGrid .libTile')).length === 6);
  await page.click('[data-libshelf="all"]'); await page.waitForTimeout(300);
  await page.click('[data-libplan="habits"]'); await page.waitForTimeout(300);
  ok('a plan opens: its books in order, the next one marked', (await page.$$('#libPlanList [data-libbook]')).length === 4 && !!(await page.$('#libPlanList .libPlanItem.next[data-libbook="atomic-habits"]')));
  await page.click('#libPlanStart'); await page.waitForTimeout(900);
  ok('starting it keeps it on the account', !!(rec('st5').lib || {}).plans && !!rec('st5').lib.plans.habits && !!(await page.$('#libPlanStop')));
  await page.click('#libPlanList [data-libbook="atomic-habits"]'); await page.waitForTimeout(300);
  ok('a book’s page has its topics and a way to recommend it', (await page.$$('.libBookTags .libTagLink')).length >= 1 && !!(await page.$('#libRecOpen')) && !(await page.$('#libMonthSet')));
  await page.click('#libStart'); await page.waitForTimeout(300);
  const steps = await page.evaluate(() => libById_('atomic-habits').insights.length + 1);
  await page.evaluate((n) => libGo_(n), steps); await page.waitForTimeout(300);
  await page.click('#libFinish'); await page.waitForTimeout(500);
  const done = await page.$eval('#libDone', (e) => e.innerText);
  ok('Done: a well-done card with the first-book badge', /Well done/.test(done) && /New badge: First book/.test(done), done.slice(0, 120));
  ok('… asking for one thing to do, with a way onto the weekly goals', !!(await page.$('#libTakeText')) && !!(await page.$('#libTakeGoal')));
  ok('… asking once whether to share with the campus', !!(await page.$('#libShareAsk')));
  ok('… and what to read next: the plan’s next book first', await page.$eval('#libNextRow .libTile', (e) => e.getAttribute('data-libbook')) === 'the-power-of-habit');
  await page.click('#libShareYes'); await page.waitForTimeout(900);
  ok('saying yes shares, and the question is gone', rec('st5').lib.share === true && !(await page.$('#libShareAsk')));
  await page.fill('#libTakeText', 'Put my Bible by my bed tonight');
  await page.check('#libTakeGoal');
  await page.click('#libTakeSave'); await page.waitForTimeout(1200);
  ok('the one thing is saved on the account', rec('st5').lib.notes['atomic-habits'].text === 'Put my Bible by my bed tonight');
  ok('… and is one of this week’s goals', (mem.goals || []).some((g) => g.staffId === 'st5' && (g.items || []).some((i) => i.text === 'Put my Bible by my bed tonight')), JSON.stringify((mem.goals || []).slice(0, 1)).slice(0, 160));
  ok('… and shows on the book’s page as “My one thing”', /My one thing[\s\S]*Put my Bible by my bed tonight/i.test(await main(page)) && !(await page.$('#libDone')));
  await page.click('#libBack'); await page.waitForTimeout(400);
  ok('the reading card counts this year and shows the badge', /^1/.test((await page.$eval('#libMine .libMineN', (e) => e.innerText)).trim()) && (await page.$$('#libBadges .libBadge:not(.next)')).length === 1);
  await page.click('#libGoalOpen'); await page.waitForTimeout(200); await page.click('[data-libgoal="12"]'); await page.waitForTimeout(900);
  ok('a goal for the year: 1 of 12', rec('st5').lib.goal === 12 && /of 12 books this year/.test(await page.$eval('#libMine', (e) => e.innerText)));
  ok('the campus feed shows what Di finished', /You finished[\s\S]*Atomic Habits/.test(await page.$eval('#libFeed', (e) => e.innerText)));
  await page.screenshot({ path: OUT + '/library-home.png', fullPage: true });

  /* recommending */
  await page.click('[data-libbook="grit"]'); await page.waitForTimeout(300);
  await page.click('#libRecOpen'); await page.waitForTimeout(300);
  await page.fill('[data-ppickq="librec"]', 'Bo'); await page.waitForTimeout(200);
  await page.click('[data-ppickit="librec|st3"]'); await page.waitForTimeout(300);
  await page.fill('#libRecNote', 'Made me think of you');
  await page.click('#libRecSend'); await page.waitForTimeout(900);
  ok('Di recommends Grit to Bo', ((mem.libClub || {}).recs || []).some((r) => r.from === 'st5' && r.to === 'st3' && r.bookId === 'grit'));
  await ctx.close();
}

/* ---------- 2. Mark (Campus Director): the book of the month ---------- */
{
  const { ctx, page } = await open('mark');
  page.removeAllListeners('dialog'); page.on('dialog', (d) => d.accept('Our habits month'));
  await lib(page);
  ok('with none chosen, leadership sees how to choose one', /None chosen yet/.test(await page.$eval('#libMonth', (e) => e.innerText)));
  await page.click('[data-libbook="atomic-habits"]'); await page.waitForTimeout(300);
  await page.click('#libMonthSet'); await page.waitForTimeout(1000);
  ok('leadership makes a book the book of the month', (mem.libClub.month.siemreap || {}).bookId === 'atomic-habits' && mem.libClub.month.siemreap.note === 'Our habits month' && !!(await page.$('#libMonthClear')));
  await page.click('#libBack'); await page.waitForTimeout(400);
  const m = await page.$eval('#libMonth', (e) => e.innerText);
  ok('the Library leads with it: the note, and 1 of 5 have read it', /Book of the month/i.test(m) && /Our habits month/.test(m) && /1 of 5 at .* have read it/.test(m), m.replace(/\s+/g, ' ').slice(0, 140));
  await ctx.close();
}

/* ---------- 3. Bo: My Home says so; the recommendation is waiting ---------- */
{
  const { ctx, page } = await open('bo');
  ok('My Home has no Reading row any more (Nov 2026: this month’s book and recommendations come now and then as notes)', !(await page.$('#libHome')));
  /* the month's book on one day in LIB_NUDGE_EVERY, the person's own; a recommendation every day until read or cleared */
  const nudge = await page.evaluate(() => { const on = notifItems_().map((i) => i.text); LIB_NUDGE_EVERY = 1; const every = notifItems_().map((i) => i.text); LIB_NUDGE_EVERY = 3; return { on, every, day: libNudgeDay_() }; });
  ok('the bell carries this month’s book as a note — on the person’s own days, not every day', nudge.every.some((x) => /This month’s book: Atomic Habits/.test(x)) && (nudge.day === nudge.on.some((x) => /This month’s book/.test(x))), JSON.stringify(nudge));
  ok('… and Di’s recommendation', nudge.every.some((x) => /Di Sok recommends a book to you: Grit/.test(x)));
  await page.evaluate(() => { LIB_NUDGE_EVERY = 1; S.bellOpen = true; renderNotifPanel(); });
  await page.waitForSelector('#notifRoot [data-libgo="atomic-habits"]');
  await page.click('#notifRoot [data-libgo="atomic-habits"]'); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined'); await page.waitForTimeout(500);
  ok('Read it opens that book', await page.evaluate(() => S.view === 'library' && S.libBook === 'atomic-habits' && !S.bellOpen));
  await page.evaluate(() => { LIB_NUDGE_EVERY = 3; });
  await page.click('#libBack'); await page.waitForTimeout(400);
  const recs = await page.$eval('#libRecs', (e) => e.innerText);
  ok('the Library shows it: Grit, from Di, with her note', /Grit/.test(recs) && /from Di Sok/.test(recs) && /Made me think of you/.test(recs));
  ok('Bo, who has not shared, is not in the feed — Di is', /Di[\s\S]*Atomic Habits/.test(await page.$eval('#libFeed', (e) => e.innerText)) && !/Bo /.test(await page.$eval('#libFeed', (e) => e.innerText)));
  await page.click('[data-librecdone]'); await page.waitForTimeout(900);
  ok('clearing the recommendation removes it', !(await page.$('#libRecs')) && !mem.libClub.recs.some((r) => r.to === 'st3'));
  await ctx.close();
}

/* ---------- 4. Ann mentors Di: sees her reading, gives a plan ---------- */
{
  const { ctx, page } = await open('ann');
  await page.evaluate(() => new Promise((res) => run('getMenteeLogs', [S.auth.user, S.auth.pin, 'st5'], (d) => { S.view = 'mentor'; S.mentee = d.mentee; S.menteeWeek = null; S.menteeLogs = d.logs; S.menteeGoals = d.goals || []; S.menteeProfile = d.profile; S.menteeCheckins = d.checkins || []; S.menteeSupport = d.support || null; S.menteeLib = d.library || null; S.menteeHabits = d.habits || []; S.menteeMinistry = d.ministry || null; S.menteeTrips = d.trips || null; S.menteeSmart = d.smartGoals || []; libLoad_(); render(); res(); })));
  await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined'); await page.evaluate(() => render()); await page.waitForTimeout(400);
  const card = await page.$eval('#libMentee', (e) => e.innerText);
  ok('a mentor sees her mentee’s reading: this year, her goal, her plan’s progress', /of 12 books this year/.test(card) && /Better habits/.test(card) && /1 of 4 read/.test(card), card.replace(/\s+/g, ' ').slice(0, 160));
  ok('… never her note in the reading card', !/Bible by my bed/.test(card));
  await page.selectOption('#libGiveSel', 'pre-marriage'); await page.click('#libGive'); await page.waitForTimeout(900);
  ok('… and gives her a reading plan', (rec('st5').lib.plans['pre-marriage'] || {}).by === 'st2' && /Getting ready for marriage/.test(await page.$eval('#libMentee', (e) => e.innerText)));
  await ctx.close();
}
{
  const { ctx, page } = await open('di', { km: true });
  await lib(page);
  await page.click('[data-libplan="pre-marriage"]'); await page.waitForTimeout(300);
  ok('Di sees the plan her mentor gave, and it ends in the couple check-up (in Khmer too)', !!(await page.$('#libPlanCouple')) && !(await page.$('#libPlanStop')) && /[ក-៿]/.test(await page.$eval('h2', (e) => e.innerText)));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
