/* Students in the GP app (Oct 2026): profiles made from SR Hospitality's student
   bookings, the invite link and joining with Google, and the student mode's one
   door (studentCall) — what it lets through, that a student's goals, habits and
   tests land in their own 'stu:' blob and never in staff data, that the staff
   handlers still refuse them, and that the only staff they see are Leadership
   Development. Against the real api.js. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('students');
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
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'hosp', name: 'Hana Host', username: 'hana', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'plain', name: 'Pat Plain', username: 'pat' }),
  mk({ id: 'ld1', name: 'Lina Leader', username: 'lina', dept: 'Leadership Development', ministry: 'GPDTS' }),
  mk({ id: 'ld2', name: 'Leo Leader', username: 'leo', dept: 'Leadership Development', ministry: 'DBS', campus: 'poipet' })
];
const day = n => new Date(Date.now() + 7 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);
mem['hosp:siemreap'] = { buildings: [], rooms: [], bookings: [
  { id: 'k1', category: 'student', name: 'DTS Oct', from: day(-20), to: day(60), count: 2, people: [{ name: 'Sokha Student', sex: 'm' }, { name: 'Mary Student', sex: 'f' }], bedIds: [] },
  { id: 'k2', category: 'student', name: 'Gone Student', from: day(-40), to: day(-1), count: 1, bedIds: [] },
  { id: 'k3', category: 'guest', name: 'A Guest', from: day(-1), to: day(2), count: 1, bedIds: [] }
] };
mem.candidates = [];
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };

console.log('=== the students staying with us ===');
let r = await call('studentsList', ['pat', '1234']);
ok('ordinary staff cannot see or make student profiles', r.ok === false && r.err === 'not_authorized');
r = await call('studentsList', ['hana', '1234']);
ok('Hospitality sees the students booked tonight, by name — not one who left, not a guest', r.ok && r.staying.map(x => x.name).join() === 'Sokha Student,Mary Student' && r.staying.every(x => !x.profile), JSON.stringify(r.staying));
r = await call('studentMakeProfile', ['pat', '1234', 'Sokha Student', 'dts']);
ok('… and only they can make one', r.ok === false);
r = await call('studentMakeProfile', ['hana', '1234', 'Sokha Student', 'dts']);
const sokha = r.ok && r.staying.find(x => x.name === 'Sokha Student').profile;
ok('making a profile: a student, arrived, from SR Hospitality, with an invite link', sokha && !sokha.linked && /^[a-f0-9]{36}$/.test(sokha.invite) && mem.candidates[0].type === 'student' && mem.candidates[0].stage === 'arrived' && mem.candidates[0].source === 'hospitality', JSON.stringify(sokha));
ok('… once — the same name again is refused', (await call('studentMakeProfile', ['hana', '1234', 'sokha  student', 'dts'])).err === 'exists');

console.log('=== joining with Google from the invite ===');
r = await call('portalJoinInfo', ['abc']);
ok('a bad invite is refused', r.ok === false);
r = await call('portalJoinInfo', [sokha.invite]);
ok('the invite says who it is for', r.ok && r.name === 'Sokha Student' && r.campus === 'siemreap');
process.env.GP_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
const soon = Math.floor(Date.now() / 1000) + 600;
globalThis.fetch = async () => ({ ok: true, json: async () => ({ aud: 'test-client.apps.googleusercontent.com', iss: 'https://accounts.google.com', email: 'sokha@example.org', email_verified: 'true', exp: soon, name: 'Sokha G', sub: '77' }) });
r = await call('portalJoin', [sokha.invite, 'h.p.s']);
const tok = r.token;
ok('joining makes the account, linked to the profile, signed in with a device token', r.ok && r.user === 'sokha@example.org' && /^[a-f0-9]{40,}$/.test(tok) && r.application && r.application.id === mem.candidates[0].id && mem.candidates[0].staffId && !mem.candidates[0].portal.invite, JSON.stringify(r).slice(0, 200));
ok('… the name is the profile\'s, the account an applicant', mem.staff.find(s => s.email === 'sokha@example.org').name === 'Sokha Student' && mem.staff.find(s => s.email === 'sokha@example.org').kind === 'applicant');
ok('the invite can\'t be used twice', (await call('portalJoinInfo', [sokha.invite])).ok === false);
r = await call('studentsList', ['hana', '1234']);
ok('staff see the student has joined, with their email', r.staying.find(x => x.name === 'Sokha Student').profile.linked === true && r.staying.find(x => x.name === 'Sokha Student').profile.email === 'sokha@example.org');

console.log('=== the student mode\'s one door ===');
const U = ['sokha@example.org', tok];
r = await call('getMyBoot', U);
ok('the staff boot refuses a student', r.ok === false);
r = await call('studentCall', [...U, 'getMyBoot', []]);
ok('the student boot: a student, their own empty data, and only Leadership Development staff as names', r.ok && r.student && r.staff.role === 'Student' && r.roster.map(x => x.id).sort().join() === 'ld1,ld2' && r.goals.length === 0 && r.schedules && r.schedules.ok, JSON.stringify(r.roster));
ok('… no staff fields in the roster beyond a name and face', Object.keys(r.roster[0]).sort().join() === 'campus,dept,id,ministry,name,photo,role');
r = await call('studentCall', [...U, 'getHospitality', []]);
ok('anything else through the door is refused', r.ok === false && r.err === 'student');
r = await call('studentCall', ['pat', '1234', 'getMyBoot', []]);
ok('a staff member can\'t use the student door', r.ok === false);
const WK = 10;
r = await call('studentCall', [...U, 'saveGoals', [WK, [{ text: 'Memorise Psalm 23', pct: 20 }]]]);
ok('a student\'s weekly goal saves — in their own blob, not in staff goals', r.ok && r.goals[0].items[0].text === 'Memorise Psalm 23' && (mem.goals || []).length === 0 && mem['stu:' + mem.candidates[0].staffId].goals.length === 1, JSON.stringify(mem.goals));
r = await call('saveGoals', [...U, WK, [{ text: 'Sneak' }]]);
ok('the staff saveGoals still refuses them', r.ok === false && !(mem.goals || []).length);
r = await call('studentCall', [...U, 'saveDaily', [day(0), { habits: { bible: true }, bible: true }]]);
ok('a habit tick saves to their own blob, not the staff daily logs', r.ok && r.logs.length === 1 && !(mem.dailyLogs || []).length);
r = await call('studentCall', [...U, 'saveMyPersonality', [{ type: 'INFP', source: 'self' }]]);
ok('a personality saves to their own blob', r.ok && r.personality.type === 'INFP' && !mem.staff.some(s => s.personality));
r = await call('studentCall', [...U, 'libSaveReads', [{ 'atomic-habits': '2026-10-01' }]]);
ok('a book read saves to their own blob', r.ok && r.libRead['atomic-habits'] && !mem.staff.some(s => s.libRead));

console.log('=== mentorship: Leadership Development only ===');
r = await call('studentCall', [...U, 'studentSetMentor', ['plain']]);
ok('a mentor outside Leadership Development is refused', r.ok === false && r.err === 'not_a_mentor');
r = await call('studentCall', [...U, 'studentSetMentor', ['ld1']]);
ok('choosing Lina: pending', r.ok && r.mentorStatus === 'pending');
r = await call('getMyBoot', ['lina', '1234']);
ok('Lina\'s boot shows the student asking', r.ok && r.stuMentor && r.stuMentor.requests.map(x => x.name).join() === 'Sokha Student', JSON.stringify(r.stuMentor));
ok('… and nobody else\'s boot does', (await call('getMyBoot', ['pat', '1234'])).stuMentor === null);
r = await call('respondStudentMentor', ['pat', '1234', mem.candidates[0].staffId, true]);
ok('only the chosen mentor can answer', r.ok === false);
r = await call('respondStudentMentor', ['lina', '1234', mem.candidates[0].staffId, true]);
ok('Lina accepts: the student is hers', r.ok && r.students.map(x => x.name).join() === 'Sokha Student' && r.requests.length === 0);
r = await call('studentCall', [...U, 'getMyBoot', []]);
ok('… and the student sees Lina as their mentor', r.staff.mentorId === 'ld1' && r.staff.mentorStatus === 'approved');
ok('staff data was never touched: no staff record changed for the student\'s doings', !mem.staff.some(s => s.mentorId) && !(mem.goals || []).length && !(mem.dailyLogs || []).length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
