/* Rocks and the Scorecard on the page (teams/28-rocks.js) — against the real api.js.

   Nov 2026 (Uriah): "Across the whole app we're going to move away from OKRs and move to rocks and
   scorecard." A ministry's My Ministry has a Scorecard tab (its weekly numbers, each against a
   weekly goal, ✓ / ✗) and a Rocks tab (the quarter's few priorities: add in one line, tap on track /
   off track / done, a note). Campus Leadership's Rocks are the ones the leadership meeting shows.
   A teammate's page shows their rocks. Nothing on screen says OKR any more; what was there before
   sits folded under "Earlier objectives". Checked in English and Khmer, at 320px, and in the dark
   theme (contrast of the new marks). Every name is made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { testNow, weekOf, quarterOf, weekYearOf } from './clock.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('rocks-ui');
const SHOTS = process.env.GP_SHOTS || tmpDir('rocks-ui-out');
fs.mkdirSync(SHOTS, { recursive: true });
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
const mk = (o) => Object.assign({ active: true, campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'kim', name: 'Kim Coach', username: 'kim', leads: ['Youth Education|Sports'] }),
  mk({ id: 'dara', name: 'Dara Sok', username: 'dara' }),
  mk({ id: 'dee', name: 'Dee Director', username: 'dee', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'oli', name: 'Oli Overseer', username: 'oli', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'ada', name: 'Ada Min', username: 'ada', dept: 'Skills Training', ministry: 'Technical', isAdmin: true }),
  mk({ id: 'pat', name: 'Pat Poipet', username: 'pat', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director' })
];
const now = testNow(), wk = weekOf(now), year = weekYearOf(now), q = quarterOf(wk) + 1;
const nq = q === 4 ? { year: year + 1, q: 1 } : { year, q: q + 1 };
const rock = (id, dept, ministry, owner, title, status, note, extra) => Object.assign({ id, campus: 'siemreap', dept, ministry, owner, year, q, title, status, note, by: 'kim', at: now.toISOString(), updated: now.toISOString() }, extra || {});
mem.rocks = { seeded: 'test', rocks: [
  rock('r1', 'Youth Education', 'Sports', 'dara', 'Start a girls’ football league', 'on', 'Six teams signed up'),
  rock('r2', 'Youth Education', 'Sports', '', 'Train four new coaches', 'off', 'Only one so far'),
  rock('r3', 'Youth Education', '', '', 'Every ministry visits one school', 'on', '• Sports — 60%\n• Worship — 20%\n• YDC — 100%\n• Media — 0%'),
  rock('r4', 'Campus Leadership', '', 'dee', 'Open the new dorm', 'on', 'Roof first'),
  rock('r5', 'Campus Leadership', '', '', 'One staff retreat', 'done', ''),
  rock('r6', 'Campus Leadership', '', '', 'Poipet: a new well', 'on', '', { campus: 'poipet' }),
  rock('r7', 'Youth Education', 'Sports', 'kim', 'Next quarter: a summer camp', 'on', '', { year: nq.year, q: nq.q })
] };
/* what was there before rocks: stored objectives, shown folded and read only */
mem.okrs = [{ campus: 'siemreap', quarter: q === 1 ? 2 : q - 1, dept: 'Youth Education', id: 'o_old', objective: 'An objective from before rocks', kr: 'A key result', metricKey: '', target: 0, manualPct: 70, group: '', kind: '', current: 0, updated: '2026-08-10T03:00:00.000Z' }];
const weeks = []; for (let w = Math.max(1, wk - 3); w <= wk; w++) weeks.push(w);
const ent = (metric, vals) => weeks.map((w, i) => ({ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', metric, week: w, year, value: vals[vals.length - weeks.length + i], updated: now.toISOString(), by: 'dara' }));
mem.entries = [].concat(ent('Games Played', [2, 6, 3, 5]), ent('Youth Participating', [30, 44, 38, 20]), ent('Salvations', [0, 1, 0, 2]));
mem.metricOverrides = [{ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', hidden: [], custom: [], cadence: {}, goals: { 'Games Played': { goal: 4, dir: 'gte' }, 'Youth Participating': { goal: 40, dir: 'gte' } } }];

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
await new Promise((r) => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh', ...(opts.width ? { viewport: { width: opts.width, height: 700 } } : {}), ...(opts.dark ? { colorScheme: 'dark' } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', (r) => r.abort());
  await page.addInitScript((a) => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); localStorage.setItem('gp-ask-test', '1'); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { S.view = 'ministry'; render(); window.scrollTo(0, 0); });
  await page.waitForTimeout(900);
  return { ctx, page };
}
/* a whole-page picture, without the bar that is fixed to the bottom of the screen lying across the middle of it */
const shot = async (p, file) => { await p.addStyleTag({ content: 'nav.bottom{display:none!important}' }).then(async (h) => { await p.screenshot({ path: file, fullPage: true }); await h.evaluate((e) => e.remove()); }); };
const txt = (p, sel) => p.$eval(sel, (e) => e.innerText).catch(() => '');
const tabLabels = (p) => p.$$eval('.mmTabs .gtTab', (b) => b.map((x) => x.textContent.trim()));
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const rocksIn = (p, sel) => p.$$eval(sel + ' .lmRock .lmName', (e) => e.map((x) => x.textContent));
const stored = (id) => mem.rocks.rocks.find((r) => r.id === id);

/* ---------- a ministry's Scorecard ---------- */
console.log('=== a ministry’s Scorecard ===');
{
  const { ctx, page } = await open('kim');
  const labels = await tabLabels(page);
  ok('the tabs are Scorecard · Tasks · Rocks — no “Numbers”, no “OKRs”', labels.join() === 'Scorecard,Tasks,Rocks', labels.join());
  ok('it opens on the Scorecard, the board on top of the week card', (await page.$eval('.mmTabs .gtTab.on', (b) => b.getAttribute('data-mmtab'))) === 'numbers'
    && await page.evaluate(() => { const a = document.getElementById('scoreBoard'), b = document.getElementById('mmWeekCard'); return !!a && !!b && a.getBoundingClientRect().top < b.getBoundingClientRect().top; }));
  ok('the headline counts what is on target this week (5 games ≥ 4 ✓, 20 youth ≥ 40 ✗)', /1 of 2 on target this week/.test(await txt(page, '#sbdHeadline')), await txt(page, '#sbdHeadline'));
  const row = (m) => page.$eval('[data-sbdrow="' + m + '"]', (e) => ({ cls: e.className, goal: (e.querySelector('.sbdGoal') || {}).textContent || '', val: e.querySelector('.sbdVal').textContent, mark: (e.querySelector('.sbdMark') || {}).textContent || '', label: e.querySelector('.sbdMark') ? e.querySelector('.sbdMark').getAttribute('aria-label') : '', cells: [...e.querySelectorAll('.sbdC')].map((c) => c.textContent || ' ').join('') }));
  const gp = await row('Games Played'), yp = await row('Youth Participating'), sv = await row('Salvations');
  ok('a number on target: its goal, the figure, ✓ — a mark with words, not colour alone', / on/.test(gp.cls) && gp.goal === '≥ 4' && gp.val === '5' && gp.mark === '✓' && gp.label === 'On target', gp);
  ok('a number off target: ✗', / off/.test(yp.cls) && yp.goal === '≥ 40' && yp.val === '20' && yp.mark === '✗' && yp.label === 'Off target', yp);
  ok('thirteen weeks of marks, the newest last (✗ ✓ ✗ ✓ for games)', gp.cells.length === 13 && gp.cells.endsWith(weeks.length === 4 ? '✗✓✗✓' : '✓') && yp.cells.endsWith(weeks.length === 4 ? '✗✓✗✗' : '✗'), [gp.cells, yp.cells]);
  ok('a number with no goal shows its figure and how it moved, no mark and no cells', / plain/.test(sv.cls) && sv.val === '2' && sv.mark === '' && sv.cells === '' && (weeks.length < 2 || /last week/.test(await txt(page, '[data-sbdrow="Salvations"] .sbdSub'))), sv);
  ok('numbers with a goal come first; six rows, the rest one tap away', (await page.$$eval('[data-sbdrow]', (e) => e.map((x) => x.getAttribute('data-sbdrow')))).slice(0, 2).join() === 'Games Played,Youth Participating' && (await page.$$('[data-sbdrow]')).length === 6 && /Show all 8 numbers/.test(await txt(page, '#sbdAll')));
  ok('the month / quarter / year totals are folded away under it', await page.$eval('#mmGlance', (d) => !d.open && !!d.querySelector('.mmGrid')));
  await page.click('#mmGlance > summary'); await page.waitForTimeout(200);
  ok('… and open with a tap', await page.$eval('#mmGlance', (d) => d.open) && await page.isVisible('#mmGlance .mmTile'));
  await shot(page, SHOTS + '/scorecard-390.png');

  /* the leader sets the goals */
  await page.click('#sbdEdit'); await page.waitForTimeout(200);
  ok('the ministry’s leader opens the goals: a direction and a box for every number', (await page.$$('[data-sbdgoal]')).length === 8 && await page.$eval('[data-sbdgoal="Games Played"]', (i) => i.value) === '4');
  await page.fill('[data-sbdgoal="Salvations"]', '1');
  await page.fill('[data-sbdgoal="Youth Participating"]', '15');
  await page.evaluate(() => render()); await page.waitForTimeout(100);
  ok('what is typed survives a redraw', await page.$eval('[data-sbdgoal="Salvations"]', (i) => i.value) === '1' && await page.$eval('[data-sbdgoal="Youth Participating"]', (i) => i.value) === '15');
  await page.selectOption('[data-sbddir="Youth Participating"]', 'gte');
  await page.click('#sbdSave'); await page.waitForTimeout(600);
  const goals = mem.metricOverrides[0].goals;
  ok('saved on the server', goals.Salvations && goals.Salvations.goal === 1 && goals['Youth Participating'].goal === 15 && goals['Games Played'].goal === 4, goals);
  ok('the board follows: three goals, all on target', /3 of 3 on target this week/.test(await txt(page, '#sbdHeadline')) && (await row('Salvations')).mark === '✓', await txt(page, '#sbdHeadline'));
  ok('the box where the number is typed says what it is held against', await page.evaluate(() => { S.kpiInputOpen = true; S.dbAcc.kpiDay = true; S.dbAcc.kpiWeek = true; render(); return /goal ≥ 4/.test(document.getElementById('main').innerText); }));
  ok('nothing on the Scorecard says OKR or KPI', !/OKR|KPI|[Kk]ey result/.test(await txt(page, '#main')));
  await ctx.close();
}
{
  const { ctx, page } = await open('dara');
  ok('someone who is not the leader sees the board but cannot set goals', !!(await page.$('#scoreBoard')) && !(await page.$('#sbdEdit')));
  await ctx.close();
}

/* ---------- a ministry's Rocks ---------- */
console.log('=== a ministry’s Rocks ===');
{
  const { ctx, page } = await open('dara');
  await page.click('[data-mmtab="okr"]'); await page.waitForTimeout(300);
  const S1 = '[data-rkscope="siemreap|Youth Education|Sports"]', S2 = '[data-rkscope="siemreap|Youth Education|"]';
  ok('the Rocks tab: this quarter’s rocks for the ministry', (await rocksIn(page, S1)).join(' | ') === 'Start a girls’ football league | Train four new coaches', (await rocksIn(page, S1)).join(' | '));
  ok('… “1 of 2 on track”, whose each is, and its note', /1 of 2 on track/.test(await txt(page, S1 + ' .rkCount')) && /Dara/.test(await txt(page, '[data-rock="r1"]')) && /Six teams signed up/.test(await txt(page, '[data-rock="r1"]')) && /The team/.test(await txt(page, '[data-rock="r2"]')));
  ok('the department’s own rocks sit under it, a long note folded to its first line', (await rocksIn(page, S2)).join() === 'Every ministry visits one school' && await page.$eval('[data-rock="r3"] .rkNoteFold', (d) => !d.open && /Sports — 60%/.test(d.querySelector('summary').textContent) && /\+3 more/.test(d.querySelector('summary').textContent)));
  ok('three buttons a rock, and a slider for how far along (Nov 2026, Andrew) — no targets', (await page.$$('[data-rock="r1"] .lmSt')).length === 3 && !!(await page.$('[data-rock="r1"] input[type=range][data-rockpct="r1"]')) && !(await page.$('#rocksTab .krSlider')));
  /* slide it: the figure follows the finger, one save on release */
  await page.$eval('[data-rockpct="r1"]', (sl) => { sl.value = '35'; sl.dispatchEvent(new Event('input', { bubbles: true })); });
  ok('… the figure follows the slider', /35%/.test(await txt(page, '[data-rock="r1"] .rkPctVal')));
  await page.$eval('[data-rockpct="r1"]', (sl) => sl.dispatchEvent(new Event('change', { bubbles: true }))); await page.waitForTimeout(500);
  ok('… and is saved on release', stored('r1').pct === 35 && stored('r1').status !== 'done', stored('r1'));
  ok('… the group shows how far along it is together', /% done/.test(await txt(page, S1 + ' .rkCount')), await txt(page, S1 + ' .rkCount'));
  await page.fill('[data-rkadd="siemreap|Youth Education|Sports"]', 'Buy twenty footballs');
  await page.evaluate(() => render()); await page.waitForTimeout(100);
  ok('a half-typed rock survives a redraw', await page.$eval('[data-rkadd="siemreap|Youth Education|Sports"]', (i) => i.value) === 'Buy twenty footballs');
  await page.press('[data-rkadd="siemreap|Youth Education|Sports"]', 'Enter'); await page.waitForTimeout(600);
  const added = mem.rocks.rocks.find((r) => r.title === 'Buy twenty footballs');
  ok('one line adds a rock — this quarter’s, the ministry’s, mine, on track', added && added.dept === 'Youth Education' && added.ministry === 'Sports' && added.owner === 'dara' && added.status === 'on' && added.year === year && added.q === q && added.by === 'dara', added);
  ok('… and it is on the page, the box empty again', (await rocksIn(page, S1)).includes('Buy twenty footballs') && await page.$eval('[data-rkadd="siemreap|Youth Education|Sports"]', (i) => i.value) === '');
  await page.click('[data-rockst="r1|off"]'); await page.waitForTimeout(500);
  ok('a tap says where it stands: off track', stored('r1').status === 'off' && stored('r1').updatedBy === 'dara' && await page.$eval('[data-rockst="r1|off"]', (b) => b.classList.contains('sel') && b.getAttribute('aria-pressed') === 'true' && /✗/.test(b.textContent)));
  await page.click('[data-rockst="r2|done"]'); await page.waitForTimeout(500);
  ok('… or done', stored('r2').status === 'done' && /2 of 3 on track/.test(await txt(page, S1 + ' .rkCount')), await txt(page, S1 + ' .rkCount'));
  await page.click('[data-rockedit="r1"]'); await page.waitForTimeout(200);
  await page.fill('[data-rkf="note"]', 'Eight teams now\nFirst games in two weeks');
  await page.fill('[data-rkf="title"]', 'Start a girls’ football league in Siem Reap');
  await page.evaluate(() => render()); await page.waitForTimeout(100);
  ok('the form keeps what is typed through a redraw', await page.$eval('[data-rkf="note"]', (i) => i.value) === 'Eight teams now\nFirst games in two weeks');
  await page.click('#rkSave'); await page.waitForTimeout(500);
  ok('Edit changes its title and note', stored('r1').title === 'Start a girls’ football league in Siem Reap' && stored('r1').note === 'Eight teams now\nFirst games in two weeks' && stored('r1').status === 'off' && stored('r1').owner === 'dara');
  await page.click('[data-rkaddopen]'); await page.waitForTimeout(200);
  await page.fill('[data-rkadd="siemreap|Youth Education|"]', 'A department rock'); await page.click('[data-rkaddbtn="siemreap|Youth Education|"]'); await page.waitForTimeout(500);
  ok('“A rock for the whole department” adds one with no ministry', !!mem.rocks.rocks.find((r) => r.title === 'A department rock' && r.ministry === '' && r.dept === 'Youth Education'));
  /* leadership's rocks: to see, not to change */
  ok('Leadership’s rocks are there to read — my campus first, both campuses', (await page.$$eval('[data-leadrocks]', (e) => e.map((x) => x.getAttribute('data-leadrocks')))).join() === 'siemreap,poipet' && /Open the new dorm/.test(await txt(page, '[data-leadrocks="siemreap"]')) && /a new well/.test(await txt(page, '[data-leadrocks="poipet"]')));
  ok('… with a badge for where each stands and nothing to press', (await page.$$('[data-leadrocks] button')).length === 0 && /On track/.test(await txt(page, '[data-leadrocks="siemreap"] [data-rock="r4"] .rkBadge')) && /Done/.test(await txt(page, '[data-leadrocks="siemreap"] [data-rock="r5"] .rkBadge')));
  ok('what was there before is folded at the foot: its title and where it ended, nothing to change', await page.$eval('#rkEarlier', (d) => !d.open && /Earlier objectives \(1\)/.test(d.querySelector('summary').textContent) && /An objective from before rocks/.test(d.textContent) && /70%/.test(d.textContent) && !d.querySelector('button, input, select')));
  /* next quarter */
  await page.click('[data-rkq="next"]'); await page.waitForTimeout(200);
  ok('next quarter is one tap away', (await rocksIn(page, S1)).join() === 'Next quarter: a summer camp' && new RegExp('Q' + nq.q).test(await txt(page, '#rocksTab h3')));
  await page.fill('[data-rkadd="siemreap|Youth Education|Sports"]', 'Planned ahead'); await page.click('[data-rkaddbtn="siemreap|Youth Education|Sports"]'); await page.waitForTimeout(500);
  ok('… and a rock added there is next quarter’s', (() => { const r = mem.rocks.rocks.find((x) => x.title === 'Planned ahead'); return r && r.year === nq.year && r.q === nq.q; })());
  await page.click('[data-rkq="now"]'); await page.waitForTimeout(200);
  ok('nothing on the Rocks tab says OKR or key result (but for the folded history’s own words)', !/OKR|[Kk]ey result|KPI/.test(await txt(page, '#main')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, SHOTS + '/rocks-390.png');
  /* a rock is deleted from its form */
  await page.click('[data-rockedit="' + added.id + '"]'); await page.waitForTimeout(200);
  await page.click('#rkDel'); await page.waitForTimeout(300);
  if (await page.$('#askYes')) { await page.click('#askYes'); await page.waitForTimeout(600); }
  ok('Delete asks in the app’s own sheet, then removes it', !mem.rocks.rocks.find((r) => r.id === added.id) && !(await rocksIn(page, S1)).includes('Buy twenty footballs'));
  await ctx.close();
}
{
  /* the page only offers what the server would take (rkCanWrite_ mirrors canWriteRock_) */
  const { ctx, page } = await open('dara');
  const can = await page.evaluate(() => [rkCanWrite_('siemreap', 'Youth Education', 'Sports'), rkCanWrite_('siemreap', 'Youth Education', ''), rkCanWrite_('siemreap', 'Skills Training', 'Technical'), rkCanWrite_('poipet', 'Youth Education', 'Sports'), rkCanWrite_('siemreap', 'Campus Leadership', '')]);
  await page.click('[data-mmtab="okr"]'); await page.waitForTimeout(300);
  ok('someone who is not an admin gets no “Every department’s rocks”', !(await page.$('#adminRocks')) && !(await page.$('#rkAdmAdd')));
  ok('the page offers a staff member their own department’s rocks to change, and no other', can.join() === 'true,true,false,false,false', can.join());
  await ctx.close();
}

/* ---------- Campus Leadership ---------- */
console.log('=== Campus Leadership ===');
{
  const { ctx, page } = await open('dee');
  ok('the leadership tabs say Rocks', /Rocks/.test(await txt(page, '[data-lwtab="okrs"]')) && !/OKR/.test(await txt(page, '.lwSeg')));
  ok('the Overview tile: rocks on track of all', /Q\d Rocks/.test(await txt(page, '#lbOkrTile')) && /2\/2/.test(await txt(page, '#lbOkrTile .mmTileNum')) && /on track/.test(await txt(page, '#lbOkrTile')), await txt(page, '#lbOkrTile'));
  await page.click('#lbOkrTile'); await page.waitForTimeout(300);
  const L = '[data-rkscope="siemreap|Campus Leadership|"]';
  ok('it opens leadership’s rocks, the team’s first, then each person’s', (await page.$$eval(L + ' .goalCardTitle', (e) => e.map((x) => x.textContent))).map((x) => x.replace(/^\S+\s/, '')).join(' | ') === 'The whole team | Dee Director', (await page.$$eval(L + ' .goalCardTitle', (e) => e.map((x) => x.textContent))).join(' | '));
  await page.fill('[data-rkadd="siemreap|Campus Leadership|"]', 'A new kitchen'); await page.press('[data-rkadd="siemreap|Campus Leadership|"]', 'Enter'); await page.waitForTimeout(600);
  const kit = mem.rocks.rocks.find((r) => r.title === 'A new kitchen');
  ok('a rock added here is the leadership team’s', kit && kit.dept === 'Campus Leadership' && kit.ministry === '' && kit.owner === '' && kit.campus === 'siemreap', kit);
  ok('Poipet’s leadership rocks are not offered for changing here', !(await page.$('[data-rock="r6"]')));
  /* the same rocks in the leadership meeting */
  await page.click('[data-lwtab="board"]'); await page.waitForTimeout(300);
  await page.click('[data-leadtab="meet"]'); await page.waitForSelector('#leadMeet [data-lmsec]', { timeout: 10000 });
  ok('the meeting’s numbers part is the Scorecard', /Scorecard/.test(await txt(page, '[data-lmsec="score"]')) && !/Scoreboard/i.test(await txt(page, '#leadMeet')));
  await page.click('[data-lmsec="rocks"]'); await page.waitForTimeout(300);
  ok('the meeting shows the very same rocks', !!(await page.$('#lmRocks [data-lmrock="r4"]')) && !!(await page.$('#lmRocks [data-lmrock="' + kit.id + '"]')) && !(await page.$('#lmRocks select[data-lmrf="okrId"]')));
  await page.click('[data-lmrockst="' + kit.id + '|off"]'); await page.waitForTimeout(600);
  await page.click('[data-lwtab="okrs"]'); await page.waitForTimeout(300);
  ok('off track in the meeting is off track on the Rocks tab', stored(kit.id).status === 'off' && await page.$eval('[data-rockst="' + kit.id + '|off"]', (b) => b.classList.contains('sel')));
  ok('nothing on leadership’s pages says OKR', !/OKR|[Kk]ey result/.test(await txt(page, '#main')));
  await ctx.close();
}
{
  const { ctx, page } = await open('oli');
  await page.click('[data-lwtab="okrs"]'); await page.waitForTimeout(300);
  ok('a department’s director also carries that department’s rocks, each ministry’s named', /Every ministry visits one school/.test(await txt(page, '[data-rkscope="siemreap|Youth Education|"]')) && /Sports/.test(await txt(page, '[data-rkscope="siemreap|Youth Education|"] [data-rock="r1"]')));
  await page.click('[data-lwtab="base"]'); await page.waitForTimeout(1500);
  ok('the department pulse counts its rocks on track', /Rocks/.test(await txt(page, '.pulseCard')) && !/OKR/.test(await txt(page, '.pulseCard')), (await txt(page, '.pulseCard')).slice(0, 200));
  await ctx.close();
}
{
  const { ctx, page } = await open('ada');
  await page.evaluate(() => { S.mmBrowseDept = 'Youth Education'; S.mmBrowseMinistry = 'Sports'; S.mmTab = 'okr'; render(); });
  await page.waitForTimeout(300);
  ok('an admin has “Every department’s rocks”, both campuses', !!(await page.$('#adminRocks')) && (await page.$$('[data-accbucket="adminRockAcc"]')).length >= 3);
  await page.selectOption('#rkAdmCampus', 'poipet'); await page.waitForTimeout(200);
  await page.selectOption('#rkAdmDept', 'Community Service');
  await page.fill('#rkAdmTitle', 'An admin’s rock for Poipet'); await page.click('#rkAdmAdd'); await page.waitForTimeout(600);
  ok('… and adds one for any campus and department', !!mem.rocks.rocks.find((r) => r.title === 'An admin’s rock for Poipet' && r.campus === 'poipet' && r.dept === 'Community Service'));
  await ctx.close();
}

/* ---------- a teammate's page ---------- */
console.log('=== a teammate’s page ===');
{
  const { ctx, page } = await open('kim');
  await page.evaluate(() => new Promise((res) => run('staffProfile', [S.auth.user, S.auth.pin, 'dara'], (d) => { S.person = d; S.view = 'team'; render(); res(); })));
  await page.waitForTimeout(400);
  const t = await txt(page, '#main');
  ok('their page shows their own rocks, then their ministry’s — to read', /Dara’s rocks/.test(t) && /Start a girls’ football league/.test(t) && /Sports’s rocks|Sports/.test(t) && /Train four new coaches/.test(t) && (await page.$$('[data-rockst]')).length === 0, t.slice(0, 300));
  ok('… under what their ministry is for, and no OKRs', /Their focus/i.test(t) && !/OKR|[Kk]ey result/.test(t), t.slice(0, 600));
  await ctx.close();
}

/* ---------- Khmer, 320px, dark ---------- */
console.log('=== Khmer, a small phone, the dark theme ===');
{
  const { ctx, page } = await open('kim', { km: true, width: 320 });
  const labels = await tabLabels(page);
  ok('Khmer: the tabs are តារាងពិន្ទុ and ថ្មធំ', labels[0] === 'តារាងពិន្ទុ' && labels[labels.length - 1] === 'ថ្មធំ', labels.join());
  ok('Khmer at 320px: the Scorecard does not slide sideways', (await sideways(page)) <= 0, String(await sideways(page)));
  ok('… and is in Khmer', /ដល់គោលដៅ/.test(await txt(page, '#scoreBoard')) && !/on target|Scorecard/.test(await txt(page, '#scoreBoard')), (await txt(page, '#scoreBoard')).slice(0, 120));
  await page.click('#sbdEdit'); await page.waitForTimeout(200);
  ok('… nor the goals form', (await sideways(page)) <= 0, String(await sideways(page)));
  await page.click('#sbdCancel');
  await page.click('[data-mmtab="okr"]'); await page.waitForTimeout(300);
  ok('Khmer at 320px: the Rocks tab does not slide sideways, three buttons a rock still', (await sideways(page)) <= 0 && (await page.$$('[data-rock="r1"] .lmSt')).length === 3, String(await sideways(page)));
  const rt = await txt(page, '#rocksTab');
  ok('… and is in Khmer', /ថ្មធំ/.test(rt) && /ដើរតាមផែនការ/.test(rt) && !/On track|Off track|Rocks|Add a rock/.test(rt), rt.slice(0, 160));
  await page.click('[data-rockedit="r1"]'); await page.waitForTimeout(200);
  ok('… nor its form', (await sideways(page)) <= 0);
  await ctx.close();
}
{
  const { ctx, page } = await open('dara', { width: 320 });
  ok('English at 320px: the Scorecard fits', (await sideways(page)) <= 0, String(await sideways(page)));
  await page.click('[data-mmtab="okr"]'); await page.waitForTimeout(300);
  ok('English at 320px: the Rocks tab fits', (await sideways(page)) <= 0, String(await sideways(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('dara', { dark: true });
  const contrast = (sel) => page.evaluate((sel) => {
    const lum = (c) => { const a = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const out = [];
    document.querySelectorAll(sel).forEach((el) => {
      if (!el.textContent.trim() || !el.getClientRects().length) return;
      const fg = rgb(getComputedStyle(el).color); let bg = null, n = el;
      while (n && n.nodeType === 1) { const b = rgb(getComputedStyle(n).backgroundColor); if (b && b.a >= 0.99) { bg = b.c; break; } n = n.parentElement; }
      if (!fg || !bg) return;
      const a = lum(fg.c), b = lum(bg); out.push(Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 100) / 100);
    });
    return out;
  }, sel);
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const sb = await contrast('#scoreBoard .sbdName, #scoreBoard .sbdGoal, #scoreBoard .sbdVal, #scoreBoard .sbdMark, #scoreBoard .sbdC.on, #scoreBoard .sbdC.off, #scoreBoard .sbdLine b, #scoreBoard .sbdSub');
  ok('dark theme: every word and mark on the Scorecard reads (4.5:1 or better)', sb.length >= 10 && Math.min(...sb) >= 4.5, dark + ' ' + JSON.stringify(sb));
  await shot(page, SHOTS + '/scorecard-390-dark.png');
  await page.click('[data-mmtab="okr"]'); await page.waitForTimeout(300);
  const rk = await contrast('#rocksTab .lmName, #rocksTab .lmSt, #rocksTab .rkCount, #rocksTab .rkNote, #rocksTab .rkBadge, #rocksTab .rkOld span, #rocksTab .rkOld b, #rocksTab .leadSeg');
  ok('dark theme: the Rocks tab reads too', rk.length >= 10 && Math.min(...rk) >= 4.5, JSON.stringify(rk));
  await shot(page, SHOTS + '/rocks-390-dark.png');
  await ctx.close();
}

ok('no script errors anywhere', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
