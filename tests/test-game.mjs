/* The week's board, the server (Nov 2026, Uriah: "gamify the app … see how active people are"): points for a week
   and a day streak worked out from what is already stored. What others get of a person is points, a streak and
   which days they were active — never what they did; the weekly health check-in gives nothing; everyone active on the campus is on it; applicants and archived people are never on it. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('game');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } }

/* Cambodia's today, its Monday, and helpers */
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const day = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = new Date(today + 'T00:00:00Z').getUTCDay(), monday = day(today, -((dow + 6) % 7));
const nowIso = new Date().toISOString();
const board = await call('getMyBoot', ['zz', '0000']);   // warm
mem.staff = [
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora', libRead: { 'atomic-habits': today } }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'c3', name: 'Quiet Cafe', username: 'quiet' }),
  mk({ id: 'h1', name: 'Hana Fourth', username: 'hana', gameHide: true }),   // an old flag: no longer honoured
  mk({ id: 'p1', name: 'Pich Poipet', username: 'pich', campus: 'poipet' }),
  mk({ id: 'ar', name: 'Old Archived', username: 'old', active: false, archived: { at: '2026-01-01' } }),
  mk({ id: 'ap', name: 'Ann Applicant', username: 'ann@e.com', kind: 'applicant', applicant: { type: 'volunteer' } })
];
/* Cora: opened today and the two days before (a 3-day streak), three habits today, a task done, a book, numbers */
mem.lastSeen = { started: '2026-01-01', seen: { c1: today, h1: today, ap: today, ar: today }, days: { c1: [day(today, -2), day(today, -1), today], c2: [today], h1: [today], p1: [today] } };
mem.dailyLogs = [
  { staffId: 'c1', date: today, habits: { bible: true, prayer: true, exercise: true, lang: false }, updated: nowIso },
  { staffId: 'c2', date: today, habits: { bible: true, prayer: true, exercise: true, a: true, b: true, c: true, d: true }, updated: nowIso },
  { staffId: 'h1', date: today, habits: { bible: true }, updated: nowIso }
];
mem.gpTasks = { lists: [], tasks: [{ id: 't1', title: 'x', by: 'c1', created: nowIso, done: true, doneBy: 'c1', doneAt: nowIso }] };
mem.entries = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups', week: 1, value: 3, by: 'c1', updated: nowIso },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups', week: 1, value: 3, by: 'tool:cafe', updated: nowIso }];
mem.survey = [{ token: 'tok-c3', campus: 'siemreap', week: 1, updated: nowIso }];   // a check-in: must give nobody anything

console.log('1. points, streak, order');
let g = await call('getGame', ['cora', '1234', 'siemreap']);
ok('answers', g.ok && g.from === monday && g.today === today, g);
const row = id => g.people.filter(p => p.id === id)[0];
const P = g.pts;
ok('Cora: open + habits + task + numbers + book', row('c1') && row('c1').pts === P.open * (Math.min(3, ((dow + 6) % 7) + 1)) + 3 * P.habit + P.task + P.numbers + P.book, row('c1'));
ok('Cora has a 3-day streak', row('c1').streak === 3, row('c1'));
ok('Kanha: habits capped a day', row('c2').pts === P.open + P.habitDayCap, row('c2'));
ok('Cora is first, Kanha second', row('c1').rank === 1 && row('c2').rank === 2 && g.people[0].id === 'c1');
ok('the quiet one is listed with nothing', row('c3') && row('c3').pts === 0 && row('c3').streak === 0);
ok('a week string of 7', /^[01-]{7}$/.test(row('c1').week) && row('c1').week.charAt((dow + 6) % 7) === '1');
ok('my own parts add up', g.me && Object.values(g.me.parts).reduce((a, b) => a + b, 0) === g.me.pts && g.me.rank === 1, g.me);

console.log('2. who is on it');
ok('other campus, archived and applicants are not', !row('p1') && !row('ar') && !row('ap'));
ok('an old step-off flag is not honoured: everyone is listed', !!row('h1') && row('h1').pts === P.open + P.habit, row('h1'));
ok('active counts', g.of === 4 && g.active === 3 && g.activeToday === 3, [g.of, g.active, g.activeToday]);
ok('a row is only id, points, streak, week, rank', g.people.every(p => Object.keys(p).sort().join() === 'id,pts,rank,streak,week'), g.people[0]);
ok('nothing of what anyone did leaves', !/bible|prayer|atomic|Cups|tok-c3/.test(JSON.stringify(g)));
ok('the ministry board needs two people', g.ministries.length === 1 && g.ministries[0].ministry === 'Cafe' && g.ministries[0].n === 4 && g.ministries[0].active === 3, g.ministries);

console.log('3. no way off');
ok('there is no handler to step off', (await call('gameSetHide', ['kanha', '1234', true])).ok !== true && !mem.staff.find(s => s.id === 'c2').gameHide);

console.log('4. doors');
ok('a bad PIN gets nothing', (await call('getGame', ['cora', '9999', 'siemreap'])).ok === false);
ok('an applicant gets nothing', (await call('getGame', ['ann@e.com', '1234', 'siemreap'])).ok === false);
const pp = await call('getGame', ['cora', '1234', 'poipet']);
ok('another campus can be read', pp.ok && pp.campus === 'poipet' && pp.people.length === 1 && pp.me === null, pp);
const boot = await call('getMyBoot', ['cora', '1234']);
ok('the boot carries it', boot.ok && boot.game && boot.game.ok && boot.game.me.pts === row('c1').pts, boot.game && boot.game.me);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
