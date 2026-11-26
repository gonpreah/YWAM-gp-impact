/* Admin → Loose ends, the server half: only an admin reads it; markSeen records
   the day someone opened the app — the date only, at most one write a day, never
   from the boot; the facts come back as the page needs them: the last week each
   ministry has numbers for this year (blank values and other years ignored), who
   is set to enter each ministry's numbers, and this quarter's open rocks with
   when each was last updated (until Nov 2026: objectives, marked when a
   ministry's numbers fed them — rocks have no numbers behind them, so that
   mark is gone). */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('loose-ends');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={}; const writes=[];
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ writes.push(k); mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem; export const __writes=writes;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem, writes = blobs.__writes;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
const Y = new Date().getUTCFullYear();
const TODAY = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const Q = Math.floor((Number(TODAY.slice(5, 7)) - 1) / 3) + 1;
mem.staff = [
  withPin({ id: 'st_admin', name: 'Uriah', username: 'uriah', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true }),
  withPin({ id: 'st_dara', name: 'Dara', username: 'dara', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true }),
];
mem.entries = [
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 30, year: Y, value: 5 },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 33, year: Y, value: 6 },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 35, year: Y, value: null },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Ponlork School', metric: 'Hours', week: 50, year: Y - 1, value: 2 },
];
mem.numbersPeople = { 'siemreap|Community Service|Cafe': { main: 'st_dara', backup: '' } };
/* the server's own week and quarter: 13-week quarters of the week year (as the Rocks tab counts them) */
const meetNow = (await call('getLeadMeeting', ['uriah', '1234'])).body, RQ = meetNow.q, RY = meetNow.year;
const rk = (id, title, status, updated, extra) => Object.assign({ id, campus: 'siemreap', dept: 'Community Service', ministry: '', owner: '', year: RY, q: RQ, title, status, note: 'private-ish note', by: 'st_dara', at: '2000-01-01T00:00:00Z', updated }, extra || {});
mem.rocks = { seeded: 'test', rocks: [
  rk('k1', 'Grow the cafe', 'on', RY + '-01-05T00:00:00Z', { ministry: 'Cafe' }),
  rk('k2', 'Pray more', 'off', ''),
  rk('k3', 'Already done', 'done', '2000-01-01T00:00:00Z'),
  rk('k4', 'Another quarter', 'on', '', RQ === 4 ? { year: RY + 1, q: 1 } : { q: RQ + 1 }),
  rk('k5', 'Last year', 'on', '', { year: RY - 1 })
] };
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

console.log('=== who ===');
let r = await call('adminLooseEnds', ['dara', '1234']);
ok('only an admin reads loose ends', r.body.ok === false && r.body.err === 'not_authorized');

console.log('\n=== opening the app ===');
writes.length = 0;
await call('getMyBoot', ['dara', '1234']);
ok('the boot itself writes nothing', writes.length === 0, writes.join());
r = await call('markSeen', ['dara', '1234']);
ok('markSeen records today, and when counting started', r.body.ok && mem.lastSeen.seen.st_dara === TODAY && mem.lastSeen.started === TODAY);
ok('… the date only (and, for Admin → App use, the days themselves — dates too)', Object.keys(mem.lastSeen).sort().join() === 'days,daysFrom,seen,started' && typeof mem.lastSeen.seen.st_dara === 'string' &&
  JSON.stringify(mem.lastSeen.days.st_dara) === JSON.stringify([TODAY]) && mem.lastSeen.daysFrom === TODAY, JSON.stringify(mem.lastSeen));
writes.length = 0;
await call('markSeen', ['dara', '1234']);
ok('a second open the same day writes nothing', writes.length === 0);
mem.lastSeen.started = '2026-01-01';
await call('markSeen', ['uriah', '1234']);
ok('another person adds to it, keeping when counting started', mem.lastSeen.seen.st_uriah === undefined && mem.lastSeen.seen.st_admin === TODAY && mem.lastSeen.started === '2026-01-01');
r = await call('markSeen', ['dara', '9999']);
ok('a wrong PIN records nothing', r.body.ok === false);

console.log('\n=== the facts ===');
r = await call('adminLooseEnds', ['uriah', '1234']);
const L = r.body;
ok('the last week with numbers this year, per ministry — a blank value does not count', L.ok && L.lastWeek['siemreap|Community Service|Cafe'] === 33, JSON.stringify(L.lastWeek));
ok('… and last year’s numbers do not count', !('siemreap|Community Service|Ponlork School' in L.lastWeek));
ok('who is set to enter numbers', L.people['siemreap|Community Service|Cafe'].main === 'st_dara');
ok('when each person last opened the app, and since when that is counted', L.seen.st_dara === TODAY && L.seenSince === '2026-01-01');
const o1 = L.rocks.find((o) => o.title === 'Grow the cafe'), o2 = L.rocks.find((o) => o.title === 'Pray more');
ok('this quarter’s open rocks, each once, with when it was last updated', L.rocks.length === 2 && o1.updated.startsWith(RY + '-01-05') && o1.ministry === 'Cafe' && o2.status === 'off', JSON.stringify(L.rocks));
ok('… a rock that is done, another quarter’s and another year’s are not listed', !L.rocks.some((o) => /Already done|Another quarter|Last year/.test(o.title)));
ok('… one never touched since it was made goes by the day it was made', o2.updated === '2000-01-01T00:00:00Z');
ok('… and the quarter and today', L.quarter === RQ && L.today === TODAY);
ok('nothing private comes along — nor a rock’s note or owner, which the list does not need', !/pinHash|surveyToken|tok_|private-ish/.test(JSON.stringify(L)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
