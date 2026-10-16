/* YWAM GP (Oct 2026): Campus Leadership titles (International / National Campus
   Director, Director of <department>), YWAM GP roles, and the advisory board —
   kept apart from staff, seen and contactable by every staff member, with its own
   board-only login that opens nothing staff. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('ywam-gp');
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
fs.copyFileSync(REPO + '/netlify/functions/api.js', TMP + '/api.js');
fs.copyFileSync(REPO + '/netlify/functions/team-seed.js', TMP + '/team-seed.js');
fs.copyFileSync(REPO + '/netlify/functions/portal-forms-default.js', TMP + '/portal-forms-default.js'); // and the portal's shipped forms // api.js imports it
fs.copyFileSync(REPO + '/netlify/functions/legal-docs-default.js', TMP + '/legal-docs-default.js');  // the legal forms teams sign
fs.copyFileSync(REPO + '/netlify/functions/legal-pdf.js', TMP + '/legal-pdf.js');  // and the signed-PDF builder
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/library-audio-lib.js');  // the Library audio index
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');


const mk = (o) => Object.assign({ active: true, campus: 'siemreap', role: '', staffType: 'campus' }, o);
const STAFF = [
  mk({ id: 'st_admin', name: 'Uriah', username: 'uriah', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, email: 'u@e.com' }),
  mk({ id: 'st_nat', name: 'Sokha', username: 'sokha', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st_cs', name: 'Dara', username: 'dara', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st_pp', name: 'Vanna', username: 'vanna', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'st_cafe', name: 'Kanha', username: 'kanha', dept: 'Community Service', ministry: 'Cafe', leads: ['Community Service|Cafe'] })
];
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
for (const k of Object.keys(mem)) delete mem[k];
mem.staff = STAFF.map((s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) }));

/* ---------- Campus Leadership titles ---------- */
let r = await call('adminUpdateStaff', ['uriah', '1234', 'st_admin', { cdKind: 'international', gpRole: 'director' }]);
ok('an admin marks a Campus Director international and puts them on the YWAM GP team as its Director', r.body.ok && r.body.staff.cdKind === 'international' && r.body.staff.gpRole === 'director');
r = await call('adminUpdateStaff', ['uriah', '1234', 'st_cs', { gpRole: 'Chief Wizard' }]);
ok('… only the team\'s places: Director, or a lead for Campuses, Leaders, Music, Media, Education', r.body.ok && r.body.staff.gpRole === '');
await call('adminUpdateStaff', ['uriah', '1234', 'st_pp', { gpRole: 'media' }]);
await call('adminUpdateStaff', ['uriah', '1234', 'st_nat', { cdKind: 'national' }]);
r = await call('adminUpdateStaff', ['uriah', '1234', 'st_cs', { cdKind: 'bogus' }]);
ok('… only international or national', r.body.ok && r.body.staff.cdKind === '');
r = await call('adminUpdateStaff', ['sokha', '1234', 'st_nat', { cdKind: 'international' }]);
ok('… and only an admin', r.body.ok === false && mem.staff.find((x) => x.id === 'st_nat').cdKind === 'national');
r = await call('getYwamGp', ['kanha', '1234']);
const sr = r.body.campuses.find((c) => c.id === 'siemreap'), pp = r.body.campuses.find((c) => c.id === 'poipet');
ok('every staff member gets the titles: International / National Campus Director, Director of <department>',
  r.body.ok && r.body.titles.st_admin === 'International Campus Director' && r.body.titles.st_nat === 'National Campus Director' &&
  r.body.titles.st_cs === 'Director of Community Service' && r.body.titles.st_pp === 'Director of Youth Education' && !r.body.titles.st_cafe, JSON.stringify(r.body.titles));
ok('each campus\'s leadership team, the international director first', sr.clt.map((p) => p.id).join() === 'st_admin,st_nat,st_cs' && pp.clt.map((p) => p.id).join() === 'st_pp');
ok('… with who leads each ministry, and the YWAM GP roles', JSON.stringify(sr.leaders['Community Service|Cafe']) === '["Kanha"]' && r.body.gp.map((p) => p.gpRole).join() === 'director,media' && r.body.gpRoles.join() === 'director,campuses,leaders,music,media,education');
ok('the roster gains nothing new', (await call('teamRoster', ['kanha', '1234'])).body.every((p) => !('cdKind' in p) && !('gpRole' in p)));

/* ---------- the advisory board ---------- */
r = await call('adminSaveBoardMember', ['uriah', '1234', { name: 'Mary Board', role: 'President', email: 'MARY@board.org', phone: '+855 12 345 678', bio: 'Pastor in Phnom Penh.', username: 'mary', newPin: '4321', safeguarding: true }]);
const mary = r.body.board && r.body.board.find((b) => b.name === 'Mary Board');
ok('an admin adds a board member with their own login', r.body.ok && mary && mary.role === 'President' && mary.email === 'mary@board.org' && mary.hasLogin && mary.username === 'mary');
r = await call('adminSaveBoardMember', ['uriah', '1234', { staffId: 'st_admin', role: 'Advisor' }]);
ok('a staff member can sit on the board, linked — their name from their profile, no second login', r.body.ok && r.body.board.some((b) => b.staffId === 'st_admin' && b.name === 'Uriah' && !b.hasLogin));
await call('adminSaveBoardMember', ['uriah', '1234', { name: 'Tom Treasurer', role: 'Treasurer', email: 't@board.org' }]);
r = await call('adminSaveBoardMember', ['uriah', '1234', { name: 'Clash', username: 'kanha', newPin: '1111' }]);
ok('a board username can\'t be a staff one', r.body.ok === false && r.body.err === 'username_taken');
r = await call('staffRegister', [{ username: 'mary', pin: '1234', name: 'X', email: 'x@e.com', campus: 'siemreap', dept: 'Community Service' }]);
ok('… nor a new staff sign-up a board one', r.body.ok === false && r.body.err === 'taken');
r = await call('adminSaveBoardMember', ['kanha', '1234', { name: 'Sneaky' }]);
ok('only an admin manages the board', r.body.ok === false && mem.board.length === 3);
r = await call('getYwamGp', ['kanha', '1234']);
ok('every staff member sees the board, President first, with how to reach them',
  r.body.board.length === 3 && r.body.board[0].role === 'President' && r.body.board[0].email === 'mary@board.org' && r.body.board[0].phone && r.body.board.map((b) => b.role).join() === 'President,Treasurer,Advisor', r.body.board.map((b) => b.role).join());
ok('… and never their login details', r.body.board.every((b) => !('username' in b) && !('pinHash' in b)));
ok('… and which of them are the safeguarding contacts', r.body.board.filter((b) => b.safeguarding).map((b) => b.name).join() === 'Mary Board');

/* ---------- a board member's own view ---------- */
r = await call('boardLogin', ['mary', '4321']);
ok('a board member logs in with their own username and PIN', r.body.ok && r.body.member.name === 'Mary Board');
r = await call('boardLogin', ['mary', '0000']);
ok('… a wrong PIN is refused', r.body.ok === false);
r = await call('getYwamGp', ['mary', '4321']);
ok('… and sees both campuses, their leadership and the board', r.body.ok && r.body.viewer === 'board' && r.body.me.name === 'Mary Board' && r.body.campuses.length === 2 && r.body.board.length === 3);
for (let i = 0; i < 7; i++) await call('getYwamGp', ['mary', '4321']);
ok('… many requests never lock a board member out', (await call('getYwamGp', ['mary', '4321'])).body.ok === true);
const staffFns = [['getMyBoot', ['mary', '4321']], ['getMyLogs', ['mary', '4321']], ['getDeptPulse', ['mary', '4321', 'Community Service']], ['adminListStaff', ['mary', '4321']]];
let closed = true;
for (const [fn, args] of staffFns) { const x = await call(fn, args); if (x.body && (x.body.ok === true || Array.isArray(x.body) && x.body.length)) { closed = false; console.log('open:', fn, JSON.stringify(x.body).slice(0, 160)); } }
ok('a board login opens nothing for staff — no boot, logs, pulse or admin', closed);
ok('… and the roster answers it exactly as it answers someone signed out',
  JSON.stringify((await call('teamRoster', ['mary', '4321'])).body) === JSON.stringify((await call('teamRoster', [])).body));
r = await call('teamRoster', ['kanha', '1234']);
ok('the board is not staff: not in the roster or any headcount', r.body.length === STAFF.length && !r.body.some((p) => /Board|Treasurer/.test(p.name)));
r = await call('getYwamGp', ['', '']);
ok('nobody signed out sees the board', r.body.ok === false);

/* ---------- removing ---------- */
r = await call('adminDeleteBoardMember', ['uriah', '1234', mary.id]);
ok('an admin removes a board member', r.body.ok && r.body.board.length === 2);
r = await call('getYwamGp', ['mary', '4321']);
ok('… whose login then stops working', r.body.ok === false);

/* ---------- Campus Leadership picks its own title (Profile & settings) ---------- */
r = await call('updateProfile', ['vanna', '1234', { dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national' }]);
let g = await call('getYwamGp', ['kanha', '1234']);
ok('a Campus Leadership member makes themselves the National Campus Director', r.body.ok && g.body.titles.st_pp === 'National Campus Director');
r = await call('updateProfile', ['vanna', '1234', { dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'emperor' }]);
g = await call('getYwamGp', ['kanha', '1234']);
ok('… only International or National', r.body.ok && g.body.titles.st_pp === 'Campus Director');
r = await call('updateProfile', ['vanna', '1234', { dept: 'Campus Leadership', ministry: 'Youth Education', cdKind: '' }]);
g = await call('getYwamGp', ['kanha', '1234']);
ok('… or Director of a department', r.body.ok && g.body.titles.st_pp === 'Director of Youth Education');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
