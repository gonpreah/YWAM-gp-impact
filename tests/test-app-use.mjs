/* Admin → App use, the server (Nov 2026, Andrew: "data on our staff team who uses the app consistently"):
   markSeen now keeps each person's days (once a day, the newest 90) beside the last day; adminAppUse is for
   admins only and gives each active staff member on a campus their days in the last 30 and 7 and their last
   day — from the days they opened the app and the days the Habit Tracker saved a tick (by when it was saved,
   on Cambodia's clock); applicants and archived people are left out, and nothing of what anyone did is sent. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('app-use');
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
mem.staff = [
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', isAdmin: true }),
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'p1', name: 'Pich Poipet', username: 'pich', campus: 'poipet' }),
  mk({ id: 'ar', name: 'Old Archived', username: 'old', active: false, archived: { at: '2026-01-01' } }),
  mk({ id: 'ap', name: 'Ann Applicant', username: 'ann@e.com', kind: 'applicant', applicant: { type: 'volunteer' } })
];
const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const ago = n => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

await call('markSeen', ['cora', '1234']);
await call('markSeen', ['cora', '1234']);
ok('opening the app keeps the day, once a day', JSON.stringify(mem.lastSeen.days.c1) === JSON.stringify([today]) && mem.lastSeen.seen.c1 === today && mem.lastSeen.daysFrom === today);
mem.lastSeen.days.c2 = Array.from({ length: 100 }, (_, i) => ago(i + 1)).reverse();
await call('markSeen', ['kanha', '1234']);
ok('… only the newest 90 days are kept', mem.lastSeen.days.c2.length === 90 && mem.lastSeen.days.c2[89] === today);

/* Cora: today, plus three days the Habit Tracker saved (two in the last week); one of them on a day she also opened it */
mem.dailyLogs = [
  { staffId: 'c1', date: ago(2), updated: ago(2) + 'T03:00:00.000Z', workout: true },
  { staffId: 'c1', date: ago(5), updated: ago(5) + 'T20:00:00.000Z', bible: true },   // 20:00 UTC is the next morning in Cambodia → ago(4)
  { staffId: 'c1', date: ago(40), updated: ago(40) + 'T03:00:00.000Z' }
];
let r = await call('adminAppUse', ['cora', '1234', 'siemreap']);
ok('only an admin may see it', r.ok === false && r.err === 'not_authorized');
r = await call('adminAppUse', ['ada', '1234', 'siemreap']);
const by = id => (r.people || []).find(x => x.id === id);
ok('the campus’s active staff — no applicant, no one archived, no one from the other campus', r.ok && r.people.map(x => x.id).sort().join(',') === 'ad,c1,c2', r.people && r.people.map(x => x.id).join(','));
ok('a day the Habit Tracker saved counts on Cambodia’s calendar; older than 30 days stays out', by('c1').d30 === 3 && by('c1').days.join(',') === [ago(4), ago(2), today].join(','), by('c1').days.join(','));
ok('… the last 7 days too, and the last day used', by('c1').d7 === 3 && by('c1').last === today);
ok('Kanha’s 90 kept days: 30 in the last 30, 7 in the last 7', by('c2').d30 === 30 && by('c2').d7 === 7);
ok('someone who never opened it: nothing, no last day', by('ad').d30 === 0 && by('ad').last === '');
ok('only dates leave the server — never what anyone did', !/workout|bible|habits|lonely/.test(JSON.stringify(r)));
r = await call('adminAppUse', ['ada', '1234', 'poipet']);
ok('the other campus on asking', r.ok && r.campus === 'poipet' && r.people.length === 1 && r.people[0].id === 'p1');
r = await call('adminAppUse', ['ada', '1234', 'nowhere']);
ok('an unknown campus is the admin’s own', r.ok && r.campus === 'siemreap');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
