/* Beside the box a number is typed in, My Ministry says what the number is held against.

   Until Nov 2026 that line said which OKR objective the number fed (metricOkrNote_). The app moved
   from OKRs to rocks, which have no numbers behind them, so the question "does typing this number
   move anything?" is now answered by the Scorecard: the ministry's weekly goal for that number
   (metricGoalNote_ in teams/04-ministry-strengths.js, from sbdGoals_). Scoped to the number's own
   campus and ministry — another campus's goal for the same number must not show. (The file keeps
   its old name; it is the same row of the same form.) */
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const ROOT = PUBLIC;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((q, res) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(res => srv.listen(4420, res));

const ME = { id: 'st1', name: 'Sokha', username: 'sokha', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', role: '', photo: '', mentorId: '', isAdmin: false };
const GOALS = [
  { campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', hidden: [], custom: [], cadence: {}, goals: { 'Cups Sold': { goal: 150, dir: 'gte' }, 'Weekly Expenses ($)': { goal: 80, dir: 'lte' } } },
  // a different campus, the same department / ministry / number — must NOT show
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', hidden: [], custom: [], cadence: {}, goals: { 'Salvations': { goal: 3, dir: 'gte' } } }
];
const MINISTRY = { ok: true, campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', entries: {}, prev: {}, daily: {}, pins: [] };
const BOOT = {
  ok: true, staff: ME, profile: { email: 'x@example.com' }, roster: [ME], logs: [], habits: null,
  mentees: [], mentorRequests: [], goals: [], checkins: [], ministry: MINISTRY,
  trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [],
  base: { leader: false, entries: { poipet: {} }, okrs: [], survey: [], roster: [], metricOverrides: GOALS }, rocks: []
};

const b = await chromium.launch({ executablePath: CHROMIUM });
const p = await b.newPage({ viewport: { width: 400, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CONN/.test(m.text())) errs.push('console: ' + m.text()); });
await p.route('**/.netlify/functions/api', r => {
  const q = JSON.parse(r.request().postData() || '{}');
  let o = { ok: true };
  if (q.fn === 'getMyBoot') o = BOOT;
  else if (q.fn === 'teamRoster') o = [ME];
  else if (q.fn === 'staffLogin') o = { ok: true, staff: ME, profile: {} };
  else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
});
await p.addInitScript((u) => { localStorage.setItem('gp-cafe-view', 'numbers'); sessionStorage.setItem('gp-lw-tab', 'board'); localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })); }, ME.username);
await p.goto('http://localhost:4420/teams.html'); await p.waitForSelector('nav.bottom button', { timeout: 15000 });
await p.waitForTimeout(700);
await p.click('nav.bottom [data-tab="week"]');
await p.waitForTimeout(600);
await p.click('nav.bottom [data-tab="ministry"]');
await p.waitForTimeout(700);
// the metric form is folded behind one button; it opens every section
/* the boxes open on their own for a week with nothing in yet; tap only if they are folded */
if (!/Hide the metric form/.test(await p.$eval('#kpiInputBtn', b => b.textContent))) await p.click('#kpiInputBtn');
await p.waitForTimeout(400);
await p.click('#kpiShowAll').catch(() => {});
await p.waitForTimeout(300);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

const rows = await p.evaluate(() => {
  const out = {};
  document.querySelectorAll('#kpiDayCard .row').forEach(r => {
    const name = r.querySelector('.rowName').textContent.trim();
    out[name] = r.querySelector('.rowSub').textContent.trim();
  });
  return out;
});

ok('Cups Sold shows its weekly goal (≥ 150)', /goal ≥ 150/.test(rows['Cups Sold'] || ''), rows['Cups Sold']);
ok('a number with no goal on this campus (Salvations) shows none — the other campus’s goal is not ours',
  rows['Salvations'] !== undefined && !/goal/.test(rows['Salvations']), rows['Salvations']);
ok('nothing says “feeds” an objective any more', !Object.values(rows).some(v => /feeds|objective/i.test(v)));
const wkRows = await p.evaluate(() => [...document.querySelectorAll('#main .row')].filter(r => /Weekly Expenses/.test(r.textContent)).map(r => r.textContent));
ok('a weekly figure says its goal too, the right way round (≤ $80)', wkRows.some(x => /goal ≤ \$?80/.test(x)), wkRows.join(' | ').slice(0, 200));

ok('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

await b.close(); srv.close();

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
