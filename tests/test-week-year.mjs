/* The last days of December can be next year's week 1.

   The app's week 1 is the Monday–Sunday week that holds 1 January. 1 January 2027
   is a Friday, so Monday 28 – Thursday 31 December 2026 are week 1 of 2027 — and
   they used to count as "week 53" of 2026, clamp onto week 52 and land on top of
   the real week 52 (21–27 December). Every row carries a year now, so the fix is
   to give those days the year their week belongs to: weekYearOf on the pages,
   weekYear_ / yearForWeek_ on the server.

   Three layers:
   1. The rule itself, run straight out of teams.html, index.html and api.js, at
      the dates that matter and across several time zones (one with daylight
      saving), and the three copies against each other for thirteen years.
   2. The pages' helpers with the clock pinned to 30 December 2026: this week is
      week 1 of 2027, and week 1 is 28 Dec 2026 – 3 Jan 2027, not the January
      just gone.
   3. The real handlers with the server's clock pinned: on 30 December a week 1
      check-in, goal and KPI land in 2027 beside January 2026's week 1 rather
      than on top of it; on 2 January a week 52 lands in 2026.

   The one case still clamped — when next year's 1 January is a Monday (2023 into
   2024), the last seven days of December are a 53rd week that is nobody's week 1 —
   is checked too, so a change to it is a decision rather than an accident. */
import { REPO, tmpDir } from './env.mjs';
import { weekOf, weekYearOf as clockWeekYearOf } from './clock.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

/* A Date whose "now" is the given moment and keeps moving from there — the
   server-side twin of pinClock in clock.mjs. */
const RealDate = Date;
function shiftedDate(isoMoment) {
  const offset = new RealDate(isoMoment).getTime() - RealDate.now();
  function Shifted(...a) {
    if (!new.target) return new RealDate(RealDate.now() + offset).toString();
    return a.length ? new RealDate(...a) : new RealDate(RealDate.now() + offset);
  }
  Shifted.prototype = RealDate.prototype;
  Object.setPrototypeOf(Shifted, RealDate);
  Shifted.now = () => RealDate.now() + offset;
  Shifted.parse = RealDate.parse; Shifted.UTC = RealDate.UTC;
  return Shifted;
}

/* Lift named functions out of a source file, brace-matched, so the test runs the
   code that ships rather than a copy of it. */
function lift(src, names) {
  return names.map(function (n) {
    const at = src.search(new RegExp('function ' + n.replace(/\$/g, '\\$') + '\\('));
    if (at < 0) throw new Error('not found: ' + n);
    let i = src.indexOf('{', at), depth = 0;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(at, i + 1);
  }).join('\n');
}
const TEAMS = fs.readFileSync(REPO + '/public/teams.html', 'utf8');
const INDEX = fs.readFileSync(REPO + '/public/index.html', 'utf8');
const API = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const MONTHS = TEAMS.match(/var MONTH_ABBR=\[[^\]]*\];/)[0];
const CLIENT_SRC = MONTHS + '\n' + lift(TEAMS, ['dayNoOf_', 'mondayOfW1No_', 'weekYearOf', 'isoWeekOf', 'thisWeek', 'thisWeekYear',
  'weekYearToday_', 'monthAnchorWeek_', 'quarterAnchorWeek_', 'mondayOfWeek_', 'weekRange_', 'weekRangeShort_', 'isoDateOf_', 'weekBounds_']);
const INDEX_SRC = lift(INDEX, ['weekYearOf', 'currentWeekYear', 'mondayOfW1', 'weekRange', 'currentWeek']);
const SERVER_SRC = 'const YEAR_MIN = 2020, YEAR_MAX = 2100;\n' + lift(API, ['finiteNum_', 'dayNo_', 'mondayOfWeek1No_', 'weekYear_', 'isoWeek_',
  'thisWeekYear_', 'yearForWeek_', 'baseToday_', 'addDays_']);
function client(nowIso) { const c = vm.createContext({ Date: nowIso ? shiftedDate(nowIso) : RealDate, Math }); vm.runInContext(CLIENT_SRC, c); return c; }
function index(nowIso) { const c = vm.createContext({ Date: nowIso ? shiftedDate(nowIso) : RealDate, Math }); vm.runInContext(INDEX_SRC, c); return c; }
function server(nowIso) { const c = vm.createContext({ Date: nowIso ? shiftedDate(nowIso) : RealDate, Math, String, Number, isFinite, isNaN }); vm.runInContext(SERVER_SRC, c); return c; }

/* ---------- 1. the rule, at the dates that matter ---------- */
const CASES = [
  ['2026-12-27', 52, 2026, 'the Sunday of the real week 52'],
  ['2026-12-28', 1, 2027, 'Monday: next year\'s week 1 starts'],
  ['2026-12-31', 1, 2027, 'New Year\'s Eve'],
  ['2027-01-01', 1, 2027, 'New Year\'s Day'],
  ['2027-01-03', 1, 2027, 'the Sunday that ends week 1'],
  ['2027-01-04', 2, 2027, 'week 2'],
  ['2025-12-29', 1, 2026, 'last year\'s turn: 29 Dec 2025 is week 1 of 2026'],
  ['2026-01-01', 1, 2026, 'and 1 Jan 2026 is in it too'],
  ['2026-10-16', 42, 2026, 'an ordinary day'],
];
for (let d = 25; d <= 31; d++) CASES.push(['2023-12-' + d, 52, 2023, 'the rare 53rd week (next 1 Jan a Monday) still clamps to 52']);
CASES.push(['2024-01-01', 1, 2024, 'and 1 Jan 2024, a Monday, starts its own week 1']);

const ZONES = ['UTC', 'Asia/Phnom_Penh', 'America/New_York', 'Pacific/Auckland'];
for (const tz of ZONES) {
  process.env.TZ = tz;
  const C = client(), I = index(), S = server();
  let bad = [];
  for (const [iso, wk, yr, why] of CASES) {
    for (const at of ['T00:00:00', 'T12:00:00', 'T23:59:00']) {
      const d = new Date(iso + at);
      const got = [C.isoWeekOf(d), C.weekYearOf(d), I.weekYearOf(d), S.isoWeek_(iso), S.weekYear_(iso)];
      if (got[0] !== wk || got[1] !== yr || got[2] !== yr || got[3] !== wk || got[4] !== yr) bad.push(iso + at + ' (' + why + '): ' + got.join('/'));
    }
  }
  ok(tz + ': every case is the right week and week year on both pages and the server', !bad.length, bad.slice(0, 3).join(' | '));
  for (const [iso, wk, yr, why] of CASES.slice(0, 9)) {
    if (tz !== 'Asia/Phnom_Penh') break;
    const d = new Date(iso + 'T12:00:00');
    ok(iso + ' → W' + wk + '/' + yr + ' (' + why + ')', C.isoWeekOf(d) === wk && C.weekYearOf(d) === yr,
      'W' + C.isoWeekOf(d) + '/' + C.weekYearOf(d));
  }
  const mon = C.mondayOfWeek_(1, 2027);
  ok(tz + ': mondayOfWeek_(1, 2027) is Monday 28 December 2026', C.isoDateOf_(mon) === '2026-12-28', C.isoDateOf_(mon));
  ok(tz + ': index.html\'s mondayOfW1(2027) agrees', C.isoDateOf_(I.mondayOfW1(2027)) === '2026-12-28', String(I.mondayOfW1(2027)));
  ok(tz + ': weekBounds_(52, 2026) is 21–27 December', JSON.stringify(C.weekBounds_(52, 2026)) === '{"from":"2026-12-21","to":"2026-12-27"}',
    JSON.stringify(C.weekBounds_(52, 2026)));

  /* All three copies (and the tests' own clock.mjs) agree on every day of 2020–2032. */
  let diffs = 0, first = '';
  for (let t = Date.UTC(2020, 0, 1); t <= Date.UTC(2032, 11, 31); t += 86400000) {
    const iso = new RealDate(t).toISOString().slice(0, 10), d = new Date(iso + 'T09:00:00');
    const a = C.isoWeekOf(d) + '/' + C.weekYearOf(d), b = S.isoWeek_(iso) + '/' + S.weekYear_(iso),
      c = weekOf(d) + '/' + clockWeekYearOf(d), e = I.weekYearOf(d);
    if (a !== b || a !== c || C.weekYearOf(d) !== e) { diffs++; if (!first) first = iso + ' ' + a + ' ' + b + ' ' + c + ' ' + e; }
  }
  ok(tz + ': teams.html, index.html, api.js and clock.mjs agree on every day 2020–2032', diffs === 0, first);
}

/* ---------- 2. the pages' helpers on 30 December 2026 ---------- */
process.env.TZ = 'Asia/Phnom_Penh';
{
  const C = client('2026-12-30T10:00:00+07:00'), I = index('2026-12-30T10:00:00+07:00');
  ok('teams.html on 30 Dec 2026: this week is week 1 of 2027', C.thisWeek() === 1 && C.thisWeekYear() === 2027, C.thisWeek() + '/' + C.thisWeekYear());
  ok('and week 1 is 28 Dec 2026 – 3 Jan 2027, not last January',
    C.isoDateOf_(C.mondayOfWeek_(1)) === '2026-12-28' && C.weekBounds_(1).to === '2027-01-03', JSON.stringify(C.weekBounds_(1)));
  const r = C.weekRange_(1);
  ok('the Weekly Goals header reads "Dec 28 – Jan 3", 2027', r.short === 'Dec 28 – Jan 3' && r.year === 2027, JSON.stringify(r));
  ok('the month and quarter anchors are week 1 too (January / Q1 of the week year)',
    C.monthAnchorWeek_() === 1 && C.quarterAnchorWeek_() === 1, C.monthAnchorWeek_() + ',' + C.quarterAnchorWeek_());
  ok('index.html on 30 Dec 2026: currentWeek 1 of 2027', I.currentWeek() === 1 && I.currentWeekYear() === 2027, I.currentWeek() + '/' + I.currentWeekYear());
  const C2 = client('2026-12-27T10:00:00+07:00');
  ok('on 27 Dec 2026 it is still week 52 of 2026, 21–27 Dec', C2.thisWeek() === 52 && C2.thisWeekYear() === 2026 && C2.weekBounds_(52).from === '2026-12-21',
    C2.thisWeek() + '/' + C2.thisWeekYear());
  const C3 = client('2026-10-16T10:00:00+07:00');
  ok('an ordinary day is untouched: 16 Oct 2026 is week 42, month anchor week 40',
    C3.thisWeek() === 42 && C3.thisWeekYear() === 2026 && C3.monthAnchorWeek_() === 40 && C3.quarterAnchorWeek_() === 40,
    C3.thisWeek() + ' ' + C3.monthAnchorWeek_());
}

/* ---------- yearForWeek_: which year a bare week number from the page means ---------- */
{
  const at = function (moment, wk) { return server(moment).yearForWeek_(wk); };
  ok('2 Jan 2027: week 52 is 2026\'s (backfilling the week just gone)', at('2027-01-02T12:00:00+07:00', 52) === 2026);
  ok('2 Jan 2027: week 51 is 2026\'s', at('2027-01-02T12:00:00+07:00', 51) === 2026);
  ok('2 Jan 2027: week 1 and 2 are 2027\'s', at('2027-01-02T12:00:00+07:00', 1) === 2027 && at('2027-01-02T12:00:00+07:00', 2) === 2027);
  ok('30 Dec 2026: week 1 is 2027\'s, week 52 is 2026\'s', at('2026-12-30T12:00:00+07:00', 1) === 2027 && at('2026-12-30T12:00:00+07:00', 52) === 2026);
  ok('Sunday 27 Dec 2026: a week 1 is 2027\'s (a phone a little ahead)', at('2026-12-27T12:00:00+07:00', 1) === 2027);
  ok('20 Dec 2026: a week 1 is still 2026\'s (correcting January)', at('2026-12-20T12:00:00+07:00', 1) === 2026);
  ok('16 Oct 2026: every week is 2026\'s', [1, 2, 42, 51, 52].every(function (w) { return at('2026-10-16T12:00:00+07:00', w) === 2026; }));
  /* The base's own calendar, not UTC: 17:30 UTC on 27 Dec is 00:30 on Monday 28 Dec in Cambodia. */
  ok('thisWeekYear_ turns at Cambodia\'s midnight, not the server\'s',
    server('2026-12-27T17:30:00Z').thisWeekYear_() === 2027 && server('2026-12-27T16:30:00Z').thisWeekYear_() === 2026);
}

/* ---------- 3. the real handlers, with the server's clock pinned ---------- */
const TMP = tmpDir('week-year');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js'])
  fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_LEGACY_YEAR = '2024';
process.env.TZ = 'UTC';   // what Netlify runs in
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const ME = { id: 'st_me', name: 'Sokha', username: 'sokha', campus: 'poipet', dept: 'Youth Education',
  ministry: 'YDC', role: 'Coordinator', active: true, surveyToken: 'tok_me' };
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
function seed(extra) {
  for (const k of Object.keys(mem)) delete mem[k];
  mem.staff = [Object.assign({}, ME, { pinSalt: ME.id, pinHash: mkHash('1234', ME.id) })];
  Object.assign(mem, extra || {});
}
async function at(moment, fn) {
  globalThis.Date = shiftedDate(moment);
  try { return await fn(); } finally { globalThis.Date = RealDate; }
}
const CHECKIN = { lonely: 2, clarity: 9, growth: 8 };
const KPI = { campus: 'poipet', dept: 'Youth Education', ministry: 'YDC' };
const JAN_2026 = {
  survey: [{ campus: 'poipet', week: 1, year: 2026, device: 'tok_me', source: 'weekly', lonely: 9, clarity: 1, growth: 1, days: 7 }],
  goals: [{ staffId: 'st_me', week: 1, year: 2026, items: [{ text: 'January 2026', pct: 100 }] }],
  entries: [Object.assign({ metric: 'Salvations', week: 1, year: 2026, value: 7 }, KPI)],
  personalKpi: [{ staffId: 'st_me', metric: 'Shared faith', week: 1, year: 2026, value: 3 }],
};
const years = function (rows, wk) { return (rows || []).filter(function (r) { return Number(r.week) === wk; }).map(function (r) { return r.year; }).sort().join(','); };

await at('2026-12-30T12:00:00+07:00', async function () {
  seed(JSON.parse(JSON.stringify(JAN_2026)));
  let r = await call('saveMyWeek', ['sokha', '1234', 1, CHECKIN]);
  ok('30 Dec 2026: a week 1 check-in is stored as 2027', years(mem.survey, 1) === '2026,2027', years(mem.survey, 1));
  ok('and January 2026\'s week 1 is still there, untouched', mem.survey.some(function (x) { return x.year === 2026 && x.lonely === 9; }));
  ok('and "my weeks" show 2027\'s week 1 only', r.body && r.body.checkins && r.body.checkins.length === 1 && r.body.checkins[0].lonely === 2,
    JSON.stringify((r.body && r.body.checkins || []).map(function (c) { return c.week + '/' + c.lonely; })));

  r = await call('saveGoals', ['sokha', '1234', 1, [{ text: 'first week of 2027', pct: 20 }]]);
  ok('30 Dec 2026: week 1 goals are stored as 2027, beside January 2026\'s', years(mem.goals, 1) === '2026,2027', years(mem.goals, 1));
  ok('and the goals answered are 2027\'s', r.body && r.body.goals && r.body.goals.length === 1 && r.body.goals[0].items[0].text === 'first week of 2027',
    JSON.stringify((r.body && r.body.goals || []).map(function (g) { return g.week + ':' + g.items[0].text; })));

  r = await call('saveMyMinistry', ['sokha', '1234', 1, [{ metric: 'Salvations', value: 2 }]]);
  ok('30 Dec 2026: a week 1 ministry number is stored as 2027', years(mem.entries, 1) === '2026,2027', years(mem.entries, 1));
  ok('and January 2026\'s 7 is not overwritten', mem.entries.some(function (x) { return x.year === 2026 && x.value === 7; }));
  ok('and My Ministry reads 2 for week 1', r.body && r.body.entries && r.body.entries.Salvations && Number(r.body.entries.Salvations['1']) === 2,
    JSON.stringify(r.body && r.body.entries && r.body.entries.Salvations));

  r = await call('saveMyKpiDay', ['sokha', '1234', '2026-12-30', [{ metric: 'Gospel Conversations', value: 4, mode: 'sum' }]]);
  const day = (mem.kpiDaily || [])[0] || {};
  ok('a KPI typed on 30 Dec 2026 is a week 1 / 2027 day', day.week === 1 && day.year === 2027, day.week + '/' + day.year);
  const gc = (mem.entries || []).find(function (x) { return x.metric === 'Gospel Conversations'; }) || {};
  ok('and rolls into week 1 of 2027', gc.week === 1 && gc.year === 2027 && gc.value === 4, gc.week + '/' + gc.year + '=' + gc.value);

  r = await call('saveMyPersonalWeek', ['sokha', '1234', 1, [{ metric: 'Shared faith', value: 5 }]]);
  ok('30 Dec 2026: a personal number for week 1 is stored as 2027', years(mem.personalKpi, 1) === '2026,2027', years(mem.personalKpi, 1));

  r = await call('saveDaily', ['sokha', '1234', '2026-12-30', { bible: true }]);
  const log = (mem.dailyLogs || [])[0] || {};
  ok('a daily log for 30 Dec 2026 is week 1 of 2027', log.week === 1 && log.year === 2027, log.week + '/' + log.year);

  r = await call('getData', ['']);
  ok('the dashboard\'s "this year" on 30 Dec 2026 is 2027', r.body && r.body.year === 2027, String(r.body && r.body.year));
  ok('and its week 1 is 2027\'s, not January\'s', r.body && r.body.survey.length === 1 && r.body.survey[0].clarity === 9,
    JSON.stringify(r.body && r.body.survey));

  r = await call('deleteMyWeek', ['sokha', '1234', 1]);
  ok('deleting week 1 on 30 Dec 2026 removes 2027\'s and leaves January 2026\'s', years(mem.survey, 1) === '2026', years(mem.survey, 1));
});

await at('2027-01-02T12:00:00+07:00', async function () {
  seed();
  await call('saveMyWeek', ['sokha', '1234', 52, CHECKIN]);
  ok('2 Jan 2027: a week 52 check-in is stored as 2026', years(mem.survey, 52) === '2026', years(mem.survey, 52));
  await call('saveGoals', ['sokha', '1234', 52, [{ text: 'last week of 2026', pct: 80 }]]);
  ok('2 Jan 2027: week 52 goals are stored as 2026', years(mem.goals, 52) === '2026', years(mem.goals, 52));
  await call('saveMyMinistry', ['sokha', '1234', 52, [{ metric: 'Salvations', value: 3 }]]);
  ok('2 Jan 2027: a week 52 ministry number is stored as 2026', years(mem.entries, 52) === '2026', years(mem.entries, 52));
  await call('saveMyWeek', ['sokha', '1234', 1, CHECKIN]);
  ok('2 Jan 2027: week 1 is 2027\'s', years(mem.survey, 1) === '2027', years(mem.survey, 1));
});

/* The base's midnight, not the server's: 17:30 UTC on Sunday 27 Dec is already
   Monday in Cambodia, so the phone's week 1 is 2027's. */
await at('2026-12-27T17:30:00Z', async function () {
  seed(JSON.parse(JSON.stringify(JAN_2026)));
  await call('saveMyWeek', ['sokha', '1234', 1, CHECKIN]);
  ok('00:30 Monday 28 Dec in Cambodia (still Sunday in UTC): week 1 is 2027\'s', years(mem.survey, 1) === '2026,2027', years(mem.survey, 1));
});

await at('2026-10-16T12:00:00+07:00', async function () {
  seed();
  await call('saveMyWeek', ['sokha', '1234', 42, CHECKIN]);
  await call('saveGoals', ['sokha', '1234', 1, [{ text: 'January, looked back on', pct: 50 }]]);
  ok('an ordinary day: week 42 and a backfilled week 1 are both 2026\'s', years(mem.survey, 42) === '2026' && years(mem.goals, 1) === '2026',
    years(mem.survey, 42) + ' ' + years(mem.goals, 1));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
