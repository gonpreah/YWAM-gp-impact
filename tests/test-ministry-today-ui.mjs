/* My Ministry → Today (teams/31-today.js) — against the real api.js.

   Nov 2026 (Uriah): every ministry's page opens on one screen, under a minute a day — tap counters for the daily
   counts (three quick taps are ONE save of the day's value), the week's ring, the team streak, the win of the day, the
   Friday wrap — with faith numbers counted in a plain row and never part of the game. Checked: it opens on Today; +1,
   undo, a long press to type; a week typed as one total is kept; offline then back; the Friday wrap; read-only; an
   admin on another ministry; a ministry with its own daily home keeps it with the strip; Khmer; 320px.
   Every name is made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { testNow, pinClock, weekOf, weekYearOf } from './clock.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('ministry-today-ui');
const SHOTS = process.env.GP_SHOTS || tmpDir('ministry-today-ui-out');
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
  mk({ id: 'ada', name: 'Ada Min', username: 'ada', dept: 'Skills Training', ministry: 'Technical', isAdmin: true }),
  mk({ id: 'cora', name: 'Cora Cup', username: 'cora', dept: 'Community Service', ministry: 'Cafe' }),
  mk({ id: 'vee', name: 'Vee Film', username: 'vee', dept: 'Youth Education', ministry: 'GP Media' })
];
/* the page's clock: the Wednesday of this very week (so Monday and Tuesday are behind it), and its Friday for the wrap.
   The server keeps the real clock — the same week, which is all it needs. */
const real = testNow(), mon = new Date(real); mon.setHours(10, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
const day = (n) => { const d = new Date(mon); d.setDate(d.getDate() + n); return d; };
const iso = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const WED = day(2), FRI = day(4), wk = weekOf(WED), year = weekYearOf(WED);
const E = (metric, week, value) => ({ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', metric, week, year, value, updated: day(-3).toISOString(), by: 'kim' });
const D = (metric, d, value) => ({ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', metric, date: iso(d), week: weekOf(d), year: weekYearOf(d), value, staffId: 'kim', updated: d.toISOString() });
mem.entries = [E('Current Coaches', wk - 1, 6), E('Coaches in Training', wk - 1, 2), E('Games Won', wk, 5), E('Sessions / Leagues Run', wk, 3)];
mem.kpiDaily = [D('Sessions / Leagues Run', day(0), 1), D('Sessions / Leagues Run', day(1), 2)];
mem.metricOverrides = [{ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', hidden: [], custom: [], cadence: {}, goals: { 'Games Played': { goal: 3, dir: 'gte' }, 'Sessions / Leagues Run': { goal: 9, dir: 'gte' }, 'Salvations': { goal: 1, dir: 'gte' } } }];

const calls = [];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    try { calls.push(JSON.parse(b).fn); } catch (e) { /* not ours */ }
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
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh', ...(opts.width ? { viewport: { width: opts.width, height: 700 } } : {}) });
  await pinClock(ctx, opts.at || WED);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', (r) => r.abort());
  await page.addInitScript((a) => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); localStorage.setItem('gp-ask-test', '1'); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate((m) => { S.view = 'ministry'; if (m) { S.mmBrowseDept = m[0]; S.mmBrowseMinistry = m[1]; } render(); window.scrollTo(0, 0); }, opts.min || null);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const shot = async (p, file) => { await p.addStyleTag({ content: 'nav.bottom{display:none!important}' }).then(async (h) => { await p.screenshot({ path: file, fullPage: true }); await h.evaluate((e) => e.remove()); }); };
const txt = (p, sel) => p.$eval(sel, (e) => e.innerText).catch(() => '');
const tabLabels = (p) => p.$$eval('.mmTabs .gtTab', (b) => b.map((x) => x.textContent.trim()));
const onTab = (p) => p.$eval('.mmTabs .gtTab.on', (b) => b.textContent.trim()).catch(() => '');
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const tile = (m) => '[data-tdtile="' + m + '"]';
const num = (p, m) => txt(p, tile(m) + ' .tdNum');
const weekN = (p, m) => txt(p, tile(m) + ' .tdWkN');
const saves = () => calls.filter((f) => f === 'saveMyKpiDay' || f === 'saveKpiDayFor').length;
const dayRow = (metric, d) => (mem.kpiDaily || []).find((r) => r.ministry === 'Sports' && r.metric === metric && r.date === iso(d));
const weekRow = (metric, w) => (mem.entries || []).find((r) => r.ministry === 'Sports' && r.metric === metric && Number(r.week) === (w || wk) && r.year === year);

/* ---------- it opens on Today ---------- */
console.log('=== My Ministry opens on Today ===');
{
  const { ctx, page } = await open('dara');
  ok('Today is the first tab, then the Scorecard, Tasks and Rocks', JSON.stringify(await tabLabels(page)) === JSON.stringify(['Today', 'Scorecard', 'Tasks', 'Rocks']), await tabLabels(page));
  ok('… and it is the one that opens', await onTab(page) === 'Today' && !!(await page.$('#tdToday')) && !(await page.$('#scoreBoard')));
  const tiles = await page.$$eval('[data-tdtile]', (e) => e.map((x) => x.getAttribute('data-tdtile')));
  ok('a tile for each daily count, the ones with a goal first, four at most', tiles.length >= 2 && tiles.length <= 4 && tiles[0] === 'Sessions / Leagues Run' && tiles[1] === 'Games Played', tiles);
  ok('no faith number is a tile', !tiles.some((m) => /salvation|discipl/i.test(m)));
  ok('faith numbers sit in a plain row: Also today', /Also today/.test(await txt(page, '#tdAlso')) && !!(await page.$('[data-tdalso="Salvations"]')));
  ok('nothing but a count is a tile (no headcount)', !tiles.includes('Current Coaches'));
  ok('the counters need no scrolling on a 390px phone', await page.$eval('#tdTiles', (e) => e.getBoundingClientRect().bottom <= window.innerHeight), await page.$eval('#tdTiles', (e) => e.getBoundingClientRect().bottom + ' of ' + window.innerHeight));
  ok('nothing runs off the side', (await sideways(page)) <= 0, await sideways(page));
  ok('every tap target is 44px or more', await page.$$eval('#tdToday button.tdTap, #tdToday .tdMini, #tdWinSave', (b) => b.every((x) => x.getBoundingClientRect().height >= 44)));

  console.log('=== tap +1 ===');
  await page.evaluate(() => { document.getElementById('mmBanner').setAttribute('data-kept', '1'); window.scrollTo(0, 40); });
  const before = saves();
  for (let i = 0; i < 3; i++) await page.click('[data-tdtap="Games Played"]', { delay: 20 });
  ok('three quick taps show 3 at once', await num(page, 'Games Played') === '3', await num(page, 'Games Played'));
  ok('… with nothing sent yet', saves() === before);
  ok('… and no page redraw (the header is the same node, the scroll stayed)', await page.evaluate(() => document.getElementById('mmBanner').getAttribute('data-kept') === '1' && window.scrollY === 40));
  await page.waitForTimeout(1700);
  ok('… then ONE save', saves() === before + 1, saves() - before);
  ok('… of the day’s own value, 3', (dayRow('Games Played', WED) || {}).value === 3, dayRow('Games Played', WED));
  ok('… and the week is 3', (weekRow('Games Played') || {}).value === 3 && await weekN(page, 'Games Played') === '3', weekRow('Games Played'));
  ok('the ring counts goals on target — and never a faith number’s goal', /1 of 2 goals on target/.test(await txt(page, '#tdRing')), await txt(page, '#tdRing'));
  ok('the streak: Monday, Tuesday and today', await page.$eval('#tdStreakN', (e) => e.getAttribute('data-n')) === '3', await txt(page, '#tdStreak'));
  ok('seven dots — Monday, Tuesday and today done', (await page.$$('.tdDot')).length === 7 && await page.$$eval('.tdDot', (d) => d.slice(0, 3).every((x) => x.classList.contains('on')) && d[2].classList.contains('now')));

  console.log('=== a week somebody typed as one total is kept ===');
  await page.click('[data-tdtap="Sessions / Leagues Run"]');
  ok('today is 1 and the week 4 at once (3 typed for the week + 1)', await num(page, 'Sessions / Leagues Run') === '1' && await weekN(page, 'Sessions / Leagues Run') === '4', [await num(page, 'Sessions / Leagues Run'), await weekN(page, 'Sessions / Leagues Run')]);
  await page.waitForTimeout(1900);
  ok('… and it stays 4 on the server: the days are 1 + 2 + 1', (weekRow('Sessions / Leagues Run') || {}).value === 4, weekRow('Sessions / Leagues Run'));

  console.log('=== undo, and typing the number ===');
  await page.click('[data-tdminus="Games Played"]');
  ok('− takes one off', await num(page, 'Games Played') === '2');
  await page.dispatchEvent('[data-tdtap="Games Played"]', 'pointerdown');
  await page.waitForTimeout(750);
  ok('a long press opens the box to type today’s number', !!(await page.$('#tdTypeBox')));
  await page.fill('#tdTypeBox', '12'); await page.click('#tdTypeOk');
  ok('… 12', await num(page, 'Games Played') === '12', await num(page, 'Games Played'));
  await page.click('[data-tdedit="Games Played"]');
  ok('the small ✎ opens it too', await page.$eval('#tdTypeBox', (e) => e.value) === '12');
  await page.click('#tdTypeCancel');
  const b2 = saves();
  await page.waitForTimeout(1700);
  ok('one more save, of 12', saves() === b2 + 1 && dayRow('Games Played', WED).value === 12, [saves() - b2, dayRow('Games Played', WED)]);
  await page.evaluate(() => tdFlush_()); await page.waitForTimeout(500);
  ok('sending again changes nothing (the value is absolute)', dayRow('Games Played', WED).value === 12 && weekRow('Games Played').value === 12);

  console.log('=== faith numbers: counted, plainly ===');
  await page.fill('[data-tdalso="Salvations"]', '2'); await page.dispatchEvent('[data-tdalso="Salvations"]', 'change');
  await page.waitForTimeout(1700);
  ok('saved for today', (dayRow('Salvations', WED) || {}).value === 2, dayRow('Salvations', WED));
  ok('no tile, no confetti, no bump for it', !(await page.$(tile('Salvations'))) && !(await page.$('.confettiWrap')) && !(await page.$('#tdAlso .bump')));
  ok('the ring did not move for it', /goals on target/.test(await txt(page, '#tdRing')) && /of 2 goals/.test(await txt(page, '#tdRing')));

  console.log('=== win of the day ===');
  await page.fill('#tdWinText', 'Two   new girls joined\nthe league'); await page.click('#tdWinSave');
  await page.waitForSelector('#tdWinList li');
  ok('it shows in the feed with who wrote it', /Two new girls joined the league/.test(await txt(page, '#tdWinList')) && /Dara/.test(await txt(page, '#tdWinList')), await txt(page, '#tdWinList'));
  ok('… and is kept for the campus', ((mem['mwins:siemreap'] || {})['Youth Education|Sports'] || []).length === 1);
  ok('the reminder about names is there', /No child’s full name/.test(await txt(page, '#tdWin')));
  ok('badges are the ministry’s, with "goals set" earned', !!(await page.$('#tdBadges [data-tdbadge="goals"].on')) && !(await page.$('#tdBadges [data-tdbadge="streak10"].on')));
  await shot(page, SHOTS + '/today-390.png');

  console.log('=== the Scorecard is one tap away, as it was ===');
  await page.click('[data-mmtab="numbers"]'); await page.waitForTimeout(300);
  ok('the board and the week card', !!(await page.$('#scoreBoard')) && await onTab(page) === 'Scorecard');
  ok('the tab is kept for this visit only (not on the phone)', await page.evaluate(() => !localStorage.getItem('gp-mm-tab') && JSON.parse(sessionStorage.getItem('gp-mm-tab'))['Youth Education|Sports'] === 'numbers'));
  await page.click('[data-mmtab="mmtoday"]'); await page.waitForTimeout(300);

  console.log('=== offline: kept on the phone, sent once ===');
  await ctx.setOffline(true);
  const b3 = saves();
  await page.click('[data-tdtap="Games Won"]'); await page.click('[data-tdtap="Games Won"]');
  await page.waitForTimeout(1500);
  ok('the tile moved', await num(page, 'Games Won') === '2', await num(page, 'Games Won'));
  ok('it says, quietly, that it is saved on this phone', /Saved on this phone/.test(await txt(page, '#tdNote')), await txt(page, '#tdNote'));
  ok('nothing was sent', saves() === b3);
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(2500);
  ok('back online: the week typed earlier (5) is kept on Monday, then today’s 2', (dayRow('Games Won', day(0)) || {}).value === 5 && (dayRow('Games Won', WED) || {}).value === 2 && weekRow('Games Won').value === 7, [dayRow('Games Won', day(0)), dayRow('Games Won', WED), weekRow('Games Won')]);
  ok('… each day sent once', saves() === b3 + 2, saves() - b3);
  ok('… and the note is gone', (await txt(page, '#tdNote')) === '');
  ok('nothing left waiting on the phone', await page.evaluate(() => tdPendCount_()) === 0);
  await ctx.close();
}

/* ---------- a fresh open is Today again ---------- */
{
  const { ctx, page } = await open('dara');
  ok('opened again: Today, with what was saved', await onTab(page) === 'Today' && await num(page, 'Games Played') === '12' && await num(page, 'Games Won') === '2');
  console.log('=== somebody who can look but not log ===');
  await page.evaluate(() => { window.canLogForClient_ = function () { return false; }; render(); });
  ok('read-only: no taps, no boxes, no win box', !(await page.$('[data-tdtap]')) && !(await page.$('[data-tdalso]')) && !(await page.$('#tdWinText')) && !!(await page.$('#tdReadOnly')));
  ok('… the figures and the wins still show', await num(page, 'Games Played') === '12' && /league/.test(await txt(page, '#tdWinList')));
  await ctx.close();
}

/* ---------- the Friday wrap ---------- */
console.log('=== the Friday wrap ===');
{
  const { ctx, page } = await open('dara', { at: FRI });
  ok('on Friday the card is there', /Wrap up the week/.test(await txt(page, '#tdWrap')));
  await page.click('#tdWrapOpen');
  ok('the weekly numbers, with last week’s carried forward', await page.$eval('#tdWrap [data-tdweek="Current Coaches"]', (e) => e.value) === '6' && await page.$eval('#tdWrap [data-tdweek="Current Coaches"]', (e) => e.hasAttribute('data-carried')));
  await page.fill('#tdWrap [data-tdweek="Coaches in Training"]', '3');
  await shot(page, SHOTS + '/today-friday-wrap.png');
  const b = calls.filter((f) => f === 'saveMyMinistry').length;
  await page.click('#tdWrapSave');
  await page.waitForSelector('#tdWrapDone');
  ok('saved by the weekly form’s own path', calls.filter((f) => f === 'saveMyMinistry').length === b + 1);
  ok('the carried headcount is written for this week, and the changed one', (weekRow('Current Coaches') || {}).value === 6 && (weekRow('Coaches in Training') || {}).value === 3, [weekRow('Current Coaches'), weekRow('Coaches in Training')]);
  ok('"Week n complete"', new RegExp('Week ' + wk + ' complete').test(await txt(page, '#tdWrapDone')), await txt(page, '#tdWrapDone'));
  ok('the first full week is a badge now', !!(await page.$('#tdBadges [data-tdbadge="week1"].on')));
  await ctx.close();
}

/* ---------- another ministry's page (an admin): the other daily path ---------- */
console.log('=== an admin on a ministry that is not their own ===');
{
  const { ctx, page } = await open('ada', { min: ['Youth Education', 'Sports'] });
  await page.waitForSelector('#tdToday [data-tdtile]');
  ok('Today, with the day so far', await onTab(page) === 'Today' && await num(page, 'Games Played') === '12');
  const b = calls.filter((f) => f === 'saveKpiDayFor').length;
  await page.click('[data-tdtap="Games Played"]'); await page.waitForTimeout(1700);
  ok('a tap saves through saveKpiDayFor, once', calls.filter((f) => f === 'saveKpiDayFor').length === b + 1 && dayRow('Games Played', WED).value === 13);
  await ctx.close();
}

/* ---------- a ministry with its own daily home keeps it ---------- */
console.log('=== the Cafe keeps its own Today, with the strip on top ===');
{
  const { ctx, page } = await open('cora');
  const tabs = await tabLabels(page);
  ok('the Cafe’s own tabs, its Today first', tabs[0] === 'Today' && tabs.includes('Till') && tabs.filter((x) => x === 'Today').length === 1, tabs);
  ok('… and it is the Cafe’s tool that opens', !!(await page.$('.mmTabs [data-cafetab="today"].on')));
  ok('the shared strip sits on top: streak, ring, win of the day', !!(await page.$('#tdToday[data-tdstrip] #tdStreak')) && !!(await page.$('#tdToday #tdRing')) && !!(await page.$('#tdToday #tdWinText')));
  ok('… with no tap counters (its numbers come from the till)', !(await page.$('#tdToday [data-tdtile]')));
  await page.fill('#tdWinText', 'A regular asked for prayer'); await page.click('#tdWinSave');
  await page.waitForSelector('#tdWinList li');
  ok('a win can be shared from the strip', ((mem['mwins:siemreap'] || {})['Community Service|Cafe'] || []).length === 1);
  await shot(page, SHOTS + '/today-tool-strip.png');
  await page.click('.mmTabs [data-cafetab="till"]'); await page.waitForTimeout(300);
  ok('the strip is only on the first tab', !(await page.$('#tdToday')));
  await ctx.close();
}

/* ---------- Khmer, and a narrow phone ---------- */
console.log('=== Khmer, 320px ===');
{
  const { ctx, page } = await open('dara', { km: true, width: 320 });
  const all = await txt(page, '#tdToday');
  ok('the screen is in Khmer', /[ក-៿]/.test(await txt(page, '#tdHow')) && /[ក-៿]/.test(await txt(page, '#tdStreak')) && /[ក-៿]/.test(await txt(page, '#tdWin')));
  ok('no English sentence is left on it', !/Tap a tile|Win of the day|Also today|goals on target|team streak|This week|Our badges|Share\b/.test(all), all.slice(0, 300));
  ok('nothing runs off a 320px phone', (await sideways(page)) <= 0, await sideways(page));
  ok('the tabs fit their row or scroll inside it', await page.$eval('.mmTabs', (e) => e.getBoundingClientRect().right <= window.innerWidth + 1 || getComputedStyle(e).overflowX !== 'visible'));
  await page.click('[data-tdtap="Games Won"]');
  ok('a tap works there too', await num(page, 'Games Won') === '3');
  await page.waitForTimeout(1500);
  await shot(page, SHOTS + '/today-320-km.png');
  await ctx.close();
}

ok('no script errors anywhere', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
