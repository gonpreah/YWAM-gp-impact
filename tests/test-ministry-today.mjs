/* My Ministry → Today, on the server — against the real api.js.

   Nov 2026 (Uriah): every ministry's page opens on Today — tap counters, the team streak, the win of the day.
   What this holds:
     1. the win of the day: who may write one (canLogFor_ — the ministry's people, its leader, its director, an admin;
        nobody else, no other campus, no applicant), cleaned to one line of 200, a cap a person a day, 60 days kept,
        who may take one off; and who is ever sent them (only someone who can open that ministry);
     2. a tap counter's save is the DAY's own value: sending it twice changes nothing, the week is the sum of its days;
     3. the days a ministry was active (`active`) — a weekly row keeps the days it was written on, so a tool's daily
        use counts — dates only;
     4. a page open writes nothing.
   Every name is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('ministry-today');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={}; let writes=[];
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ writes.push(k); mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;
export const __io={ reset(){ writes=[]; }, get writes(){ return writes; } };
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
fs.copyFileSync(REPO + '/netlify/functions/api.js', TMP + '/api.js');
fs.writeFileSync(TMP + '/team-seed.js', 'export default [];');
for (const f of ['portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem, io = blobs.__io;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const st = (o) => Object.assign({ role: '', active: true, campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', pinSalt: o.id, pinHash: mkHash('1234', o.id), surveyToken: 't_' + o.id }, o);
mem.staff = [
  st({ id: 'dara', name: 'Dara Sok', username: 'dara' }),
  st({ id: 'kim', name: 'Kim Coach', username: 'kim', ministry: 'GP Media', leads: ['Youth Education|Sports'] }),
  st({ id: 'oli', name: 'Oli Overseer', username: 'oli', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  st({ id: 'ada', name: 'Ada Min', username: 'ada', dept: 'Skills Training', ministry: 'Technical', isAdmin: true }),
  st({ id: 'vee', name: 'Vee Film', username: 'vee', ministry: 'GP Media' }),
  st({ id: 'pat', name: 'Pat Poipet', username: 'pat', campus: 'poipet' }),
  st({ id: 'app', name: 'App Licant', username: 'app', kind: 'applicant', dept: '', ministry: '', applicant: { type: 'staff' } })
];
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
async function call(fn, args) {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return JSON.parse(await r.text());
}
const SP = ['Youth Education', 'Sports'];
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const winsOf = (k) => ((mem['mwins:siemreap'] || {})[k || 'Youth Education|Sports'] || []);

console.log('=== 1. the win of the day ===');
{
  let r = await call('saveMinistryWin', ['dara', '1234', ...SP, '  Two   new girls\njoined the\tleague  ']);
  ok('someone in the ministry shares one', r.ok && r.wins.length === 1, r);
  ok('… cleaned to one line', r.wins[0].text === 'Two new girls joined the league', r.wins[0]);
  ok('… with a first name, the day and "mine" — and no id of whoever wrote it', r.wins[0].name === 'Dara' && r.wins[0].date === today && r.wins[0].mine === true && !('by' in r.wins[0]) && !JSON.stringify(r.wins).includes('"dara"'), r.wins[0]);
  ok('its leader (in another ministry), its director and an admin can too',
    (await call('saveMinistryWin', ['kim', '1234', ...SP, 'From the leader'])).ok && (await call('saveMinistryWin', ['oli', '1234', ...SP, 'From the director'])).ok && (await call('saveMinistryWin', ['ada', '1234', ...SP, 'From an admin'])).ok);
  r = await call('saveMinistryWin', ['vee', '1234', ...SP, 'Not mine to write']);
  ok('someone outside the ministry cannot', !r.ok && r.err === 'not_authorized', r);
  r = await call('saveMinistryWin', ['pat', '1234', ...SP, 'Another campus']);
  ok('the same ministry on the other campus writes its own campus’s, never this one', r.ok && winsOf().length === 4 && ((mem['mwins:poipet'] || {})['Youth Education|Sports'] || []).length === 1, r);
  ok('an applicant is refused', !(await call('saveMinistryWin', ['app', '1234', ...SP, 'x'])).ok);
  ok('a wrong PIN is refused', !(await call('saveMinistryWin', ['dara', '0000', ...SP, 'x'])).ok);
  ok('nothing to say is not a win', (await call('saveMinistryWin', ['dara', '1234', ...SP, '   \n '])).err === 'empty' && (await call('saveMinistryWin', ['dara', '1234', ...SP, { a: 1 }])).err === 'empty');
  r = await call('saveMinistryWin', ['dara', '1234', ...SP, 'x'.repeat(500)]);
  ok('a long one is cut at 200', r.ok && r.wins[0].text.length === 200, r.wins && r.wins[0].text.length);
  for (let i = 0; i < 12; i++) r = await call('saveMinistryWin', ['dara', '1234', ...SP, 'Win ' + i]);
  ok('ten a person a day, then no more', !r.ok && r.err === 'too_many' && winsOf().filter((w) => w.by === 'dara').length === 10, [r, winsOf().length]);

  /* who is sent them: only someone who can open the ministry */
  const mine = await call('getMyMinistry', ['dara', '1234']);
  ok('the ministry’s own payload carries them, newest first', mine.ok && mine.wins.length === winsOf().length && mine.wins[0].at >= mine.wins[1].at);
  ok('… another ministry’s payload does not', ((await call('getMyMinistry', ['vee', '1234'])).wins || []).length === 0);
  ok('… and getMinistryFor refuses someone who cannot log for it', (await call('getMinistryFor', ['vee', '1234', ...SP])).err === 'not_authorized');
  ok('an admin opening it is sent them, with none marked as theirs but their own', (await call('getMinistryFor', ['ada', '1234', ...SP])).wins.filter((w) => w.mine).length === 1);
  const pub = JSON.stringify(await call('getData', [''])) + JSON.stringify(await call('teamRoster', []));
  ok('nothing public carries a win', !pub.includes('new girls'));
  const boot = await call('getMyBoot', ['vee', '1234']);
  ok('someone else’s boot carries none of this ministry’s', boot.ok && !JSON.stringify(boot).includes('new girls'));

  /* taking one off */
  const id = winsOf().find((w) => w.text === 'From the director').id, n = winsOf().length;
  ok('not by someone outside', !(await call('deleteMinistryWin', ['vee', '1234', ...SP, id])).ok && winsOf().length === n);
  ok('not somebody else’s, by an ordinary member', (await call('deleteMinistryWin', ['dara', '1234', ...SP, id])).err === 'not_authorized' && winsOf().length === n);
  ok('the ministry’s leader can', (await call('deleteMinistryWin', ['kim', '1234', ...SP, id])).ok && winsOf().length === n - 1);
  const own = winsOf().find((w) => w.by === 'dara').id;
  ok('whoever wrote it can', (await call('deleteMinistryWin', ['dara', '1234', ...SP, own])).ok && !winsOf().some((w) => w.id === own));
  ok('one that is not there says so', (await call('deleteMinistryWin', ['dara', '1234', ...SP, 'nope'])).err === 'not_found');

  /* sixty days */
  mem['mwins:siemreap']['Youth Education|Sports'].push({ id: 'old1', text: 'Long ago', by: 'kim', name: 'Kim', date: addDays(today, -61), at: addDays(today, -61) + 'T03:00:00.000Z' },
    { id: 'old2', text: 'Just inside', by: 'kim', name: 'Kim', date: addDays(today, -59), at: addDays(today, -59) + 'T03:00:00.000Z' });
  mem['mwins:siemreap']['Youth Education|GP Media'] = [{ id: 'old3', text: 'Media, long ago', by: 'vee', name: 'Vee', date: addDays(today, -90), at: addDays(today, -90) + 'T03:00:00.000Z' }];
  const seen = (await call('getMyMinistry', ['dara', '1234'])).wins.map((w) => w.id);
  ok('a win older than 60 days is not sent', !seen.includes('old1') && seen.includes('old2'), seen);
  await call('saveMinistryWin', ['kim', '1234', ...SP, 'A new one']);
  ok('… and the next save drops it from the store, for every ministry on the campus', !winsOf().some((w) => w.id === 'old1') && winsOf().some((w) => w.id === 'old2') && !('Youth Education|GP Media' in mem['mwins:siemreap']), Object.keys(mem['mwins:siemreap']));
}

console.log('=== 2. a tap counter saves the day’s own value ===');
{
  const day = (metric, date) => (mem.kpiDaily || []).filter((r) => r.ministry === 'Sports' && r.metric === metric && r.date === date);
  const week = (metric) => (mem.entries || []).filter((r) => r.ministry === 'Sports' && r.metric === metric);
  const up = [{ metric: 'Games Played', mode: 'sum', value: 3 }];
  let r = await call('saveMyKpiDay', ['dara', '1234', today, up]);
  ok('3 for today', r.ok && r.daily['Games Played'][today] === 3 && day('Games Played', today).length === 1);
  r = await call('saveMyKpiDay', ['dara', '1234', today, up]);
  r = await call('saveMyKpiDay', ['dara', '1234', today, up]);
  ok('sent again and again: still one row of 3, the week 3', day('Games Played', today).length === 1 && day('Games Played', today)[0].value === 3 && week('Games Played').length === 1 && week('Games Played')[0].value === 3, [day('Games Played', today), week('Games Played')]);
  r = await call('saveKpiDayFor', ['ada', '1234', ...SP, today, [{ metric: 'Games Played', mode: 'sum', value: 5 }]]);
  ok('the last value wins (an admin on the same ministry, by the other path)', r.ok && day('Games Played', today)[0].value === 5 && week('Games Played')[0].value === 5);
  ok('… and that path is closed to someone who cannot log for it', (await call('saveKpiDayFor', ['vee', '1234', ...SP, today, up])).err === 'not_authorized' && day('Games Played', today)[0].value === 5);
  /* a week typed as one total, then kept on its Monday by the page before today's taps */
  await call('saveMinistryFor', ['kim', '1234', ...SP, r.entries && Object.keys(r.entries['Games Played'])[0], [{ metric: 'Games Won', value: 5 }]]);
  const wkNo = Number(Object.keys(r.entries['Games Played'])[0]);
  const d0 = new Date(today + 'T00:00:00Z'); const monday = addDays(today, -((d0.getUTCDay() + 6) % 7));
  if (monday !== today) {
    await call('saveMyKpiDay', ['dara', '1234', monday, [{ metric: 'Games Won', mode: 'sum', value: 5 }]]);
    await call('saveMyKpiDay', ['dara', '1234', today, [{ metric: 'Games Won', mode: 'sum', value: 2 }]]);
    ok('a typed week total put on its Monday plus today’s taps: the week is their sum', week('Games Won').find((x) => Number(x.week) === wkNo).value === 7, week('Games Won'));
  } else ok('(Monday: the typed total folds into today — covered on the page)', true);
  r = await call('saveMyKpiDay', ['dara', '1234', today, [{ metric: 'Games Played', mode: 'sum', value: null }]]);
  ok('clearing the day takes its row and the week’s away', day('Games Played', today).length === 0 && week('Games Played').length === 0);
}

console.log('=== 3. the days a ministry was active ===');
{
  let r = await call('getMyMinistry', ['dara', '1234']);
  ok('today is one of them (a weekly row was written today)', Array.isArray(r.active) && r.active.includes(today), r.active);
  ok('dates only', r.active.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  /* a tool writes its week's row every day it is used: each day is kept on the row, seven at most */
  const row = mem.entries.find((x) => x.ministry === 'Sports' && x.metric === 'Games Won');
  ok('a weekly row keeps the day it was written', Array.isArray(row.days) && row.days.includes(today), row);
  row.days = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => addDays(today, -n));
  row.updated = addDays(today, -8) + 'T03:00:00.000Z';
  await call('saveMinistryFor', ['kim', '1234', ...SP, row.week, [{ metric: 'Games Won', value: 9 }]]);
  const after = mem.entries.find((x) => x.ministry === 'Sports' && x.metric === 'Games Won');
  ok('… the newest seven, today last, none twice', after.days.length === 7 && after.days[6] === today && new Set(after.days).size === 7, after.days);
  mem.entries.push({ campus: 'siemreap', dept: 'Youth Education', ministry: 'Sports', metric: 'Current Coaches', week: 1, year: 2020, value: 4, updated: addDays(today, -200) + 'T03:00:00.000Z', by: 'tool:x', days: [addDays(today, -200), addDays(today, -3)] },
    { campus: 'siemreap', dept: 'Youth Education', ministry: 'GP Media', metric: 'Videos Posted', week: 1, year: 2020, value: 4, updated: addDays(today, -40) + 'T03:00:00.000Z', by: 'vee' });
  r = await call('getMyMinistry', ['dara', '1234']);
  ok('a tool’s row counts; a day more than 100 days back does not; another ministry’s never', r.active.includes(addDays(today, -3)) && !r.active.includes(addDays(today, -200)) && !r.active.includes(addDays(today, -40)), r.active);
  ok('the roll-up the dashboards read is unchanged by it (no days in the public figures)', !JSON.stringify(await call('getData', [''])).includes('"days"'));
}

console.log('=== 4. a page open writes nothing ===');
{
  io.reset();
  const b = await call('getMyBoot', ['dara', '1234']);
  ok('the boot carries the ministry’s wins and active days', b.ok && b.ministry && Array.isArray(b.ministry.wins) && b.ministry.wins.length > 0 && Array.isArray(b.ministry.active));
  await call('getMinistryFor', ['ada', '1234', ...SP]);
  ok('… and neither read wrote a blob', io.writes.filter((k) => k !== 'loginThrottle').length === 0, io.writes);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
