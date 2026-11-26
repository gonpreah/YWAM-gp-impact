/* The Advisory Board: its invite link, what it may read, and its own room — against the real api.js.

   Nov 2026 (Uriah): "an easy link to send our board people to sign up with their roles and be able to view all of the
   base app activity, finances, and everything — full access, not admin control … we'll try to run our board by the EOS
   system too." What must hold:
     1. the invite link: only a hash is kept, one use, an end date, can be turned off; Google or a username + PIN;
        a staff member is never given a second identity — the seat goes on their profile;
     2. the read matrix: a board member (their own sign-in, or the staff member their seat is linked to) reads the
        Overview, each campus's leadership team, its finances and its quarterly report — for BOTH campuses; nobody
        else does;
     3. EVERY handler the server has is called with a board member's own sign-in: none writes anything outside the
        board's own room, and none answers ok unless it is on the list below;
     4. the board room's blobs and a campus's never meet, either way;
     5. no answer a board sign-in can get carries a health answer or token, a 1-on-1's words, a prayer request,
        support partners, an HR file, PIN / token / Google-id material, a child's name, a 360's words, a leave reason.
   Every name is made up. */
import { REPO, PUBLIC, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('board-room');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={}, wrote=[];
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ wrote.push(k); mem[k]=JSON.parse(JSON.stringify(v)); },
  set: async (k,v)=>{ wrote.push(k); mem[k]=v; },
  delete: async (k)=>{ wrote.push(k); delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem, __wrote=wrote;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
process.env.GP_GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem, wrote = blobs.__wrote;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s, pin) => ({ active: true, campus: 'siemreap', role: '', ...s, pinSalt: s.id, pinHash: mkHash(pin || '1234', s.id) });
const NOW = new Date().toISOString(), TODAY = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

/* what must never reach the board, planted where each lives */
const MARK = ['SECRETHEALTHTOKEN', 'SECRETOONOTE', 'SECRETOOPREP', 'SECRETPRAYER', 'SECRETPARTNER', 'SECRETCONTRACT', 'SECRETGSUB', 'SECRETCHILD', 'SECRETGUARDIAN',
  'SECRET360', 'SECRETLEAVEREASON', 'SECRETFASTKIND', 'SECRETWEEKBOARD'];
mem.staff = [
  withPin({ id: 'st_admin', name: 'Ada Admin', username: 'ada', email: 'ada@example.org', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, surveyToken: 'SECRETHEALTHTOKEN-ada', staffType: 'campus', country: 'Cambodia',
    google: { sub: 'SECRETGSUB-ada' }, contracts: [{ id: 'k1', signed: '2025-01', years: 2, notes: 'SECRETCONTRACT', files: [{ id: 'f1', name: 'SECRETCONTRACT.pdf' }] }] }),
  withPin({ id: 'st_cal', name: 'Cal Poipet', username: 'cal', email: 'cal@example.org', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', surveyToken: 'SECRETHEALTHTOKEN-cal', staffType: 'campus', country: 'Cambodia' }),
  withPin({ id: 'st_sam', name: 'Sam Seated', username: 'sam', email: 'sam.seated@gmail.com', dept: 'Community Service', ministry: 'Cafe', leads: ['Community Service|Cafe'], surveyToken: 'SECRETHEALTHTOKEN-sam', staffType: 'campus', country: 'USA',
    support: { goal: 900, partners: [{ id: 'p1', name: 'SECRETPARTNER', amount: 50, freq: 'month', status: 'giving' }] } }),
  withPin({ id: 'st_ned', name: 'Ned Ordinary', username: 'ned', email: 'ned@example.org', dept: 'Community Service', ministry: 'Cafe', surveyToken: 'SECRETHEALTHTOKEN-ned', staffType: 'yap', country: 'Cambodia', mentorId: 'st_sam', mentorStatus: 'approved' }),
  withPin({ id: 'st_new', name: 'Nia Newstaff', username: 'nia', email: 'nia.staff@gmail.com', campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', staffType: 'campus', country: 'Cambodia' }),
  withPin({ id: 'ap_x', name: 'Appy Applicant', username: 'appy', email: 'appy@example.org', kind: 'applicant', applicant: { type: 'staff' } }),
];
mem.board = [
  { id: 'bd_bea', name: 'Bea Board', role: 'President', email: 'bea@example.org', phone: '', bio: 'Chairs the board.', photo: '', staffId: '', order: 0, active: true, safeguarding: true, username: 'bea', pinSalt: 'bd_bea', pinHash: mkHash('4321', 'bd_bea') },
  { id: 'bd_sam', name: '', role: 'Secretary', email: '', phone: '', bio: '', photo: '', staffId: 'st_sam', order: 0, active: true, safeguarding: false },
  { id: 'bd_gone', name: 'Gil Gone', role: 'Advisor', email: 'gil@example.org', staffId: '', active: false, username: 'gil', pinSalt: 'bd_gone', pinHash: mkHash('4321', 'bd_gone') },
];
const wk = (await call0('getBoardOverview', ['ada', '1234'])).week, YEAR = (await call0('getBoardOverview', ['ada', '1234'])).year;
mem.survey = [1, 2, 3, 4].map(i => ({ device: 'SECRETHEALTHTOKEN-' + ['ada', 'sam', 'ned', 'cal'][i - 1], campus: i === 4 ? 'poipet' : 'siemreap', week: wk, year: YEAR, lonely: 3, clarity: 8, porn: 0, oneOnOne: 1, exercise: 1, quietTime: 1, debt: 0 }));
mem.entries = [
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Customers Served', week: wk, year: YEAR, value: 140, by: 'st_ned', updated: NOW },
  { campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', metric: 'Youth Enrolled', week: wk, year: YEAR, value: 61, by: 'st_new', updated: NOW },
  { campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Community Service', metric: 'Staff Debt ($)', week: wk, year: YEAR, value: 320, by: 'st_admin', updated: NOW },
];
mem.metricOverrides = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', goals: { 'Customers Served': { goal: 100, dir: 'gte' } } }];
mem.oneOnOnes = [{ id: 'oo1', fromId: 'st_ned', toId: 'st_sam', menteeId: 'st_ned', status: 'held', heldOn: TODAY, notes: 'SECRETOONOTE', prep: { helpWith: 'SECRETOOPREP' }, followUps: [{ text: 'SECRETOONOTE follow', done: false }], created: NOW }];
mem.prayers = [{ id: 'pr1', staffId: 'st_ned', campus: 'siemreap', scope: 'mentor', text: 'SECRETPRAYER one', at: NOW }, { id: 'pr2', staffId: 'st_ned', campus: 'siemreap', scope: 'campus', text: 'SECRETPRAYER two', at: NOW }];
mem.trips = [{ id: 't1', staffId: 'st_ned', type: 'pto', from: TODAY, to: TODAY, status: 'approved', reason: 'SECRETLEAVEREASON', notes: 'SECRETLEAVEREASON' }];
mem.p360 = [{ id: 'r1', staffId: 'st_ned', title: 'SECRET360', status: 'closed', reviewers: ['st_sam'], answers: [{ ratings: {}, texts: { keep: 'SECRET360 words' } }], self: { texts: { keep: 'SECRET360 self' } } }];
mem['school:poipet'] = { students: [{ id: 's1', name: 'SECRETCHILD Dara', guardian: 'SECRETGUARDIAN', photo: '', active: true }], classes: [], locations: [], payments: [{ id: 'p', studentId: 's1', note: 'SECRETCHILD paid' }] };
mem['fastJoin:siemreap'] = { f1: { st_ned: { kind: 'SECRETFASTKIND', ticks: [1] } } };
mem.dailyLogs = [{ staffId: 'st_ned', date: TODAY, notes: 'SECRETWEEKBOARD', habits: { bible: true } }];
mem['fin2:siemreap'] = { rev: 3, at: NOW, by: 'st_admin', byName: 'Ada Admin', state: { bal: [{ asOf: TODAY, rec: TODAY, aba: 1000, us: 500, cash: 250.5, at: 1 }], debt: { asOf: TODAY, people: [{ n: 'Debtor Dan', tot: 320, d: 'Community Service' }] } } };
mem['fin2:poipet'] = { rev: 1, at: NOW, by: 'st_cal', byName: 'Cal Poipet', state: { bal: [{ asOf: TODAY, rec: '', aba: 40, us: 0, cash: 2, at: 1 }] } };
mem['leadBoard:siemreap'] = { cols: [{ id: 'agenda', title: 'Agenda', done: false }, { id: 'done', title: 'Done', done: true }], areas: [], standing: [], cards: [{ id: 'lc1', title: 'Campus card SR', type: 'agenda', col: 'agenda', owner: 'st_admin', tasks: [] }], notes: [], tues: [] };
mem['leadMeet:siemreap'] = { score: [], rocks: [], headlines: [], past: [{ id: 'mt1', date: TODAY, endedAt: NOW, avg: 8.5, todo: { done: 9, total: 10, pct: 90 }, solved: [{ title: 'x', decision: 'y' }], ratings: [], present: [], mins: {}, total: 88 }], run: null, minutes: {} };
mem.rocks = { seeded: TODAY, rocks: [
  { id: 'rk1', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', owner: 'st_ned', year: YEAR, q: Math.min(4, Math.floor((wk - 1) / 13) + 1), title: 'Cafe rock', status: 'on', note: '' },
  { id: 'rk2', campus: 'poipet', dept: 'Campus Leadership', ministry: '', owner: 'st_cal', year: YEAR, q: Math.min(4, Math.floor((wk - 1) / 13) + 1), title: 'Poipet leadership rock', status: 'off', note: '' }] };

/* Google's tokeninfo, stood in */
const ACCOUNTS = { 'tok-gina': { email: 'gina.guest@gmail.com', sub: 'g-gina', name: 'Gina Google' }, 'tok-nia': { email: 'nia.staff@gmail.com', sub: 'g-nia', name: 'Nia N' }, 'tok-bea': { email: 'bea@example.org', sub: 'g-bea', name: 'Bea B' } };
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.indexOf('tokeninfo') > -1) {
    const a = ACCOUNTS[decodeURIComponent(u.split('access_token=')[1] || '')];
    if (!a) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ aud: 'cid.apps.googleusercontent.com', email: a.email, email_verified: 'true', expires_in: '3500', sub: a.sub }) };
  }
  if (u.indexOf('userinfo') > -1) { const tk = String(((opts || {}).headers || {}).Authorization || '').replace('Bearer ', ''); return { ok: true, json: async () => ({ name: (ACCOUNTS[tk] || {}).name || 'Someone' }) }; }
  return { ok: false, json: async () => ({}) };
};
async function call0(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json().catch(() => null);
}
const seen = [];   // every answer a board sign-in got
async function call(fn, args) { const r = await call0(fn, args); return r; }
async function asBoard(fn, args) { mem.loginThrottle = {}; const r = await call0(fn, args); seen.push([fn, JSON.stringify(r || '')]); return r; }
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined && extra !== '' ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined && extra !== '' ? '  → ' + extra : '')); }
}
const BEA = ['bea', '4321'], SAM = ['sam', '1234'], NED = ['ned', '1234'], ADA = ['ada', '1234'], CAL = ['cal', '1234'], APP = ['appy', '1234'];

/* ==================== 1. the invite link ==================== */
ok('only an admin makes an invite', (await call('adminMakeBoardInvite', NED.concat([{ role: 'Treasurer', days: 7 }]))).ok === false && (await call('adminMakeBoardInvite', BEA.concat([{ role: 'Treasurer', days: 7 }]))).ok === false);
const inv1 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Treasurer', days: 7, note: 'for Tess' }]));
ok('an admin makes one: a 48-hex token, shown once', inv1.ok && /^[a-f0-9]{48}$/.test(inv1.token) && inv1.invite.role === 'Treasurer' && inv1.invite.state === 'ok');
ok('… and only its hash is kept', JSON.stringify(mem.boardInvites).indexOf(inv1.token) === -1 && !!mem.boardInvites[0].hash && mem.boardInvites[0].uses === 1);
ok('… the days are one of 3 / 7 / 14 / 30', (() => { const d = (Date.parse(inv1.invite.exp) - Date.now()) / 864e5; return d > 6.9 && d < 7.1; })());
const info = await call('boardInviteInfo', [inv1.token]);
ok('the page is told the role and who invited them — nothing else', info.ok && info.role === 'Treasurer' && info.byName === 'Ada Admin' && Object.keys(info).sort().join() === 'byName,google,ok,role');
ok('a wrong token says so', (await call('boardInviteInfo', ['f'.repeat(48)])).err === 'bad' && (await call('boardInviteInfo', ['nope'])).err === 'bad');
ok('a typed email that belongs to a staff profile is turned away — no seat lands on someone who never asked', (await call('boardJoin', [inv1.token, { name: 'Imp', email: 'ada@example.org', username: 'imp', pin: '1111' }])).err === 'staff_email' && mem.board.length === 3);
ok('usernames stay one namespace with staff', (await call('boardJoin', [inv1.token, { name: 'Tess Treasurer', email: 'tess@example.org', username: 'ned', pin: '1111' }])).err === 'username_taken');
ok('… and with the board', (await call('boardJoin', [inv1.token, { name: 'Tess Treasurer', email: 'tess@example.org', username: 'bea', pin: '1111' }])).err === 'username_taken');
ok('a name, an email, a username and a 4-digit PIN are needed', (await call('boardJoin', [inv1.token, { name: '', email: 'tess@example.org', username: 'tess', pin: '1111' }])).err === 'name_required' &&
  (await call('boardJoin', [inv1.token, { name: 'Tess', email: '', username: 'tess', pin: '1111' }])).err === 'email_required' && (await call('boardJoin', [inv1.token, { name: 'Tess', email: 'tess@example.org', username: 'tess', pin: '12' }])).err === 'bad_pin');
ok('none of those tries used the link up', (await call('boardInviteInfo', [inv1.token])).ok === true);
const j1 = await call('boardJoin', [inv1.token, { name: 'Tess Treasurer', email: 'tess@example.org', phone: '012 345', bio: 'An accountant.', username: 'tess', pin: '1111' }]);
ok('a username + PIN sign-up: on the board at once, with the invite’s role', j1.ok && j1.member.role === 'Treasurer' && j1.member.name === 'Tess Treasurer' && j1.user === 'tess' && !j1.token);
ok('… and signs in', (await call('boardLogin', ['tess', '1111'])).ok === true && (await call('getBoardOverview', ['tess', '1111'])).ok === true);
ok('the link is single use', (await call('boardJoin', [inv1.token, { name: 'Second', email: 'second@example.org', username: 'second', pin: '2222' }])).err === 'invite_used' && (await call('boardInviteInfo', [inv1.token])).err === 'used');
const listed = await call('adminListBoard', ADA);
ok('Admin lists the link with who used it', listed.invites[0].state === 'used' && listed.invites[0].used[0].name === 'Tess Treasurer' && listed.invites[0].note === 'for Tess' && JSON.stringify(listed).indexOf(inv1.token) === -1);
ok('… and the admin’s list never carries a PIN hash, a token or a Google id', !/pinHash|pinSalt|tokens|"sub"|hash/.test(JSON.stringify(listed)));

const inv2 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Advisor', days: 3 }]));
mem.boardInvites.find(r => r.id === inv2.invite.id).exp = new Date(Date.now() - 1000).toISOString();
ok('an ended link says so and lets nobody in', (await call('boardInviteInfo', [inv2.token])).err === 'expired' && (await call('boardJoin', [inv2.token, { name: 'Late', email: 'late@example.org', username: 'late', pin: '1111' }])).err === 'invite_expired');
const inv3 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Advisor', days: 30 }]));
ok('only an admin turns a link off', (await call('adminBoardInviteOff', NED.concat([inv3.invite.id]))).ok === false);
const off = await call('adminBoardInviteOff', ADA.concat([inv3.invite.id]));
ok('a link turned off stops at once', off.ok && off.invites.find(x => x.id === inv3.invite.id).state === 'off' && (await call('boardJoin', [inv3.token, { name: 'Off', email: 'off@example.org', username: 'offy', pin: '1111' }])).err === 'invite_off');

/* Google */
const inv4 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Advisor', days: 14 }]));
ok('a Google token Google doesn’t know is refused', (await call('boardJoin', [inv4.token, { googleToken: 'tok-nobody' }])).err === 'google');
const j4 = await call('boardJoin', [inv4.token, { googleToken: 'tok-gina', bio: 'From the church.' }]);
ok('Continue with Google: a member with Google’s name and email, a username made from the email, and a device token', j4.ok && j4.member.name === 'Gina Google' && j4.member.email === 'gina.guest@gmail.com' && /^[a-f0-9]{48}$/.test(j4.token) && j4.user === 'gina.guest');
ok('… the device token is the sign-in', (await call('getBoardOverview', [j4.user, j4.token])).ok === true && (await call('boardLogin', [j4.user, j4.token])).ok === true);
const gl = await call('staffLoginGoogle', ['tok-gina']);
ok('… and next time Continue with Google finds them: not staff (ok stays false), a board session beside it', gl.ok === false && gl.err === 'board' && gl.member.name === 'Gina Google' && (await call('getBoardOverview', [gl.user, gl.token])).ok === true);
const glb = await call('staffLoginGoogle', ['tok-bea']);
ok('a member an admin made by hand signs in with Google by the email on their seat', glb.err === 'board' && glb.user === 'bea' && (await call('getYwamGp', ['bea', glb.token])).ok === true);
const inv5 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Advisor', days: 7 }]));
ok('the same Google account can’t take a second seat', (await call('boardJoin', [inv5.token, { googleToken: 'tok-gina' }])).err === 'already_member' && (await call('boardInviteInfo', [inv5.token])).ok === true);
const before = mem.board.length;
const j5 = await call('boardJoin', [inv5.token, { googleToken: 'tok-nia', bio: 'Teaches at YDC.' }]);
const seatNia = mem.board.find(b => b.staffId === 'st_new');
ok('a Google account that is a STAFF profile: no second identity — the seat is linked to the profile', j5.ok && j5.linked === true && j5.name === 'Nia Newstaff' && !j5.member && !j5.token && mem.board.length === before + 1 && seatNia && seatNia.role === 'Advisor' && !seatNia.username && !seatNia.pinHash);
ok('… and they read the board’s pages with their staff sign-in', (await call('getBoardOverview', ['nia', '1234'])).ok === true);
const inv6 = await call('adminMakeBoardInvite', ADA.concat([{ role: 'Vice President', days: 7 }]));
ok('signed in as staff: a wrong PIN takes no seat', (await call('boardJoin', [inv6.token, { staff: { user: 'ned', pin: '0000' } }])).err === 'auth');
mem.loginThrottle = {};
const j6 = await call('boardJoin', [inv6.token, { staff: { user: 'ned', pin: '1234' } }]);
ok('signed in as staff: the seat goes on that profile, with a typed role', j6.ok && j6.linked && j6.role === 'Vice President' && mem.board.filter(b => b.staffId === 'st_ned').length === 1);
ok('an applicant’s sign-in takes no seat', (await call('boardJoin', [(await call('adminMakeBoardInvite', ADA.concat([{ role: 'Advisor', days: 7 }]))).token, { staff: { user: 'appy', pin: '1234' } }])).err === 'auth');
mem.loginThrottle = {};
mem.board = mem.board.filter(b => b.staffId !== 'st_ned');   // Ned is ordinary staff again for the rest
ok('a staff sign-up can’t take a board member’s username', (await call('staffRegister', [{ username: 'tess', pin: '1234', name: 'X', email: 'x@example.org' }])).err === 'taken');

/* ==================== 2. the read matrix ==================== */
for (const [who, creds] of [['a board member’s own sign-in', BEA], ['a staff member whose seat is linked', SAM]]) {
  const O = await asBoard('getBoardOverview', creds);
  ok(who + ': the Overview — both campuses in one call', O.ok && O.campuses.siemreap && O.campuses.poipet && O.week === wk);
  ok('… staff counted, never listed with anything but a name', O.campuses.siemreap.staff === 3 && O.campuses.poipet.staff === 2 && O.names.st_ned === 'Ned Ordinary' && typeof O.names.st_ned === 'string');
  ok('… who is away is a count', O.campuses.siemreap.away === 1 && JSON.stringify(O.campuses).indexOf('Ned') === -1);
  ok('… numbers in: the ministries with typed numbers this week', O.campuses.siemreap.logged[wk].indexOf('Community Service|Cafe') > -1 && O.campuses.poipet.logged[wk].indexOf('Youth Education|YDC') > -1);
  ok('… the balance the office entered, and whether it was reconciled', O.campuses.siemreap.fin.total === 1750.5 && O.campuses.siemreap.fin.reconciled === TODAY && O.campuses.poipet.fin.total === 42 && O.campuses.poipet.fin.reconciled === '');
  ok('… leadership’s last meeting: its rating and its to-dos', O.campuses.siemreap.meet.last.avg === 8.5 && O.campuses.siemreap.meet.last.todoPct === 90 && O.campuses.siemreap.meet.issues === 1 && O.campuses.poipet.meet.last === null);
  ok('… 1-on-1s as a count, staff debt as each department’s total', O.campuses.siemreap.oneOnOnes === 1 && O.campuses.siemreap.debt['Community Service'].value === 320);
  ok('… every campus rock, and none of the board’s own', O.rocks.length === 2 && O.rocks.every(r => r.campus !== 'board'));
  ok('… the board’s members by their board-room id', O.members.some(m => m.id === 'bd_bea' && m.name === 'Bea Board') && O.members.some(m => m.id === 'st_sam' && m.name === 'Sam Seated' && m.staff) && !O.members.some(m => m.name === 'Gil Gone'));
  for (const c of ['siemreap', 'poipet']) {
    const L = await asBoard('getBoardLeadership', creds.concat([c]));
    ok(who + ': ' + c + '’s leadership team, to read', L.ok && L.readOnly === true && L.campus === c && Array.isArray(L.board.cards) && Array.isArray(L.past));
    const F = await asBoard('fin2Get', creds.concat([c]));
    ok(who + ': ' + c + '’s finances — read only, no staff list', F.ok && F.campus === c && F.canEdit === false && F.staff.length === 0 && !!F.state);
    const Q = await asBoard('getQuarterReport', creds.concat([c, YEAR, Math.min(4, Math.floor((wk - 1) / 13) + 1)]));
    ok(who + ': ' + c + '’s quarterly report, in full', Q.ok && Q.full === true && Q.campus === c);
  }
  ok(who + ': the YWAM GP page', (await asBoard('getYwamGp', creds)).ok === true);
}
ok('the leadership answer carries the campus’s own card', (await asBoard('getBoardLeadership', BEA.concat(['siemreap']))).board.cards[0].title === 'Campus card SR');
ok('a campus that isn’t one is refused', (await asBoard('getBoardLeadership', BEA.concat(['board']))).err === 'bad_campus' && (await asBoard('getBoardLeadership', BEA.concat(['mars']))).err === 'bad_campus');
ok('the linked member’s own campus finances stay the staff page for the office — theirs is read only', (await call('fin2Get', SAM.concat(['']))).canEdit === false);
ok('an admin reads the Overview too (they read everything anyway)', (await call('getBoardOverview', ADA)).ok === true && (await call('getBoardOverview', ADA)).me.member === false);
for (const [who, creds] of [['ordinary staff', NED], ['Campus Leadership', CAL], ['an applicant', APP], ['a member taken off the board', ['gil', '4321']], ['nobody', ['', '']]]) {
  mem.loginThrottle = {};
  const a = await call('getBoardOverview', creds), b = await call('getBoardLeadership', creds.concat(['siemreap'])), c = await call('boardRoom', creds.concat(['getLeadMeeting', []]));
  ok(who + ' gets none of the board’s pages', a.ok === false && b.ok === false && c.ok === false && !a.campuses && !b.board && !c.score);
}
mem.loginThrottle = {};
ok('Campus Leadership still has no other campus’s finances', (await call('fin2Get', CAL.concat(['siemreap']))).campus === 'poipet');
ok('ordinary staff still have no finances', (await call('fin2Get', NED.concat(['siemreap']))).err === 'not_authorized');
ok('a board member can never save finances', (await asBoard('fin2Save', BEA.concat(['siemreap', { bal: [] }, 3]))).ok === false && mem['fin2:siemreap'].rev === 3);
ok('… nor the linked member, on either campus', (await call('fin2Save', SAM.concat(['poipet', { bal: [] }, 1]))).ok === false && (await call('fin2Save', SAM.concat(['siemreap', { bal: [] }, 3]))).ok === false && mem['fin2:poipet'].rev === 1);
ok('the linked member writes no story for a ministry that isn’t theirs', (await call('getQuarterReport', SAM.concat(['poipet', YEAR, 4]))).can.write.length === 0 && (await call('getQuarterReport', BEA.concat(['poipet', YEAR, 4]))).can.write.length === 0);

/* ==================== 3. the board's own room ==================== */
const R = (creds, fn, args) => asBoard('boardRoom', creds.concat([fn, args || []]));
ok('only the leadership tools run in the room', (await R(BEA, 'adminListStaff')).err === 'not_allowed' && (await R(BEA, 'saveRock', [{ title: 'x' }])).err === 'not_allowed' && (await R(BEA, 'setMinistryLeader', ['Community Service', 'Cafe', 'st_ned', true])).err === 'not_allowed' && (await R(BEA, 'boardRoom', ['getLeadBoard', []])).err === 'not_allowed');
const srcApi = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8'), srcPage = fs.readFileSync(PUBLIC + '/teams/30-boardroom.js', 'utf8');
const srvFns = srcApi.slice(srcApi.indexOf('const BOARD_ROOM_FNS = ['), srcApi.indexOf('];', srcApi.indexOf('const BOARD_ROOM_FNS = ['))).match(/'([A-Za-z]+)'/g).map(x => x.replace(/'/g, '')).sort();
const pageFns = srcPage.slice(srcPage.indexOf('var BR_FNS={'), srcPage.indexOf('};', srcPage.indexOf('var BR_FNS={'))).match(/([A-Za-z]+):1/g).map(x => x.replace(':1', '')).sort();
ok('the page’s list of the room’s calls is the server’s (' + srvFns.length + ')', srvFns.join() === pageFns.join() && srvFns.length === 21);
const m0 = await R(BEA, 'getLeadMeeting');
ok('the room opens empty: its own meeting and Kanban, the board’s focus areas', m0.ok && m0.campus === 'board' && m0.board.cards.length === 0 && m0.rocks.length === 0 && m0.board.areas.some(a => a.title === 'Governance'));
wrote.length = 0;
const c1 = await R(BEA, 'saveLeadCard', [{ title: 'Board issue one', type: 'agenda', col: 'agenda', owner: 'bd_bea', taskMin: 'Community Service|' }]);
ok('a card on the board’s Kanban', c1.ok && c1.saved.title === 'Board issue one' && c1.saved.taskMin === '' && c1.campus === 'board');
ok('… written to the board’s blob and nothing of a campus or GP Tasks', wrote.filter(k => k !== 'loginThrottle').join() === 'leadBoard:board' && mem['leadBoard:siemreap'].cards.length === 1 && !mem.gpTasks);
wrote.length = 0;
const t1 = await R(SAM, 'leadMeetTodo', [{ text: 'Call the auditor', owner: 'bd_bea', cardId: c1.saved.id }]);
const tk = t1.board.cards[0].tasks[0];
ok('a To-Do for a member who is not staff lives on the board’s Kanban — no GP Tasks row', t1.ok && tk.owner === 'bd_bea' && tk.text === 'Call the auditor' && !mem.gpTasks && wrote.indexOf('gpTasks') === -1);
const t2 = await R(BEA, 'saveLeadTask', [c1.saved.id, { text: 'Read the accounts', owner: 'st_sam' }]);
ok('… and one for a linked member stays there too', t2.ok && !mem.gpTasks);
const rk = await R(BEA, 'saveLeadRock', [{ title: 'A written reserves policy', owner: 'bd_bea' }]);
ok('a rock for the board', rk.ok && rk.rocks.length === 1 && rk.rocks[0].campus === 'board' && rk.rocks[0].owner === 'bd_bea');
ok('… kept apart: the campuses’ rocks store is untouched', mem.rocks.rocks.length === 2 && mem['rocks:board'].rocks.length === 1);
ok('… an owner who isn’t on the board is not taken', (await R(BEA, 'saveLeadRock', [{ title: 'Rock for Ned', owner: 'st_ned' }])).rocks.find(r => r.title === 'Rock for Ned').owner === '');
ok('… status moves, by another member', (await R(SAM, 'saveLeadRock', [Object.assign({}, rk.rocks[0], { status: 'off' })])).rocks.find(r => r.id === rk.rocks[0].id).status === 'off');
const boot = await call('getMyBoot', NED);
ok('no staff boot carries a board rock, card or headline', boot.ok && boot.rocks.length === 2 && JSON.stringify(boot).indexOf('reserves policy') === -1 && JSON.stringify(boot).indexOf('Board issue one') === -1);
const sr = await call('saveRock', NED.concat([{ title: 'Second cafe rock' }]));
ok('… nor a staff rock save’s answer', sr.ok && sr.rocks.every(r => r.campus !== 'board') && mem['rocks:board'].rocks.length === 2);
ok('… nor the board’s report (getYwamGp)', (await asBoard('getYwamGp', BEA)).rocks.every(r => r.campus !== 'board'));
const s1 = await R(BEA, 'saveLeadScore', [{ name: 'Youth enrolled at YDC', owner: 'bd_bea', goal: 50, dir: 'gte', src: 'metric', metric: { campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', metric: 'Youth Enrolled' } }]);
const sc = s1.score && s1.score[0];
ok('the board’s scorecard takes a number from either campus', s1.ok && sc.metric.campus === 'poipet' && sc.vals[YEAR + '-' + wk] === 61);
ok('… and needs to be told which campus', (await R(BEA, 'saveLeadScore', [{ name: 'x', src: 'metric', metric: { dept: 'Youth Education', ministry: 'YDC', metric: 'Youth Enrolled' } }])).err === 'bad_metric');
const s2 = await R(BEA, 'saveLeadScore', [{ name: 'Board members at the meeting', goal: 5, dir: 'gte' }]);
const typed = s2.score.find(x => x.name === 'Board members at the meeting');
ok('… or one it types', (await R(SAM, 'saveLeadScoreValue', [typed.id, YEAR + '-' + wk, '6'])).score.find(x => x.id === typed.id).vals[YEAR + '-' + wk] === 6);
ok('a headline', (await R(BEA, 'saveLeadHeadline', [{ text: 'The audit came back clean', kind: 'good' }])).headlines.length === 1);
const st = await R(BEA, 'leadMeetStart');
ok('a board meeting starts: Bea leads', st.ok && st.run && st.run.leader.id === 'bd_bea' && st.run.present.join() === 'bd_bea');
ok('… a second member joins the one going on', (await R(SAM, 'leadMeetStart')).already === true);
const up = await R(SAM, 'leadMeetUpdate', [{ part: 5, present: ['bd_bea', 'st_sam', 'st_ned'], rating: 9, top: [c1.saved.id] }]);
ok('… who is here is only ever board members; your own rating', up.run.present.join() === 'bd_bea,st_sam' && up.run.ratings.st_sam === 9 && up.run.part === 5);
const sol = await R(BEA, 'leadMeetSolve', [{ cardId: c1.saved.id, issue: 'No reserves policy', decision: 'Draft one by March' }]);
ok('… an issue solved: the decision on the card, the card in the finished column', sol.ok && /Draft one by March/.test(sol.board.cards[0].notes) && sol.board.cards[0].col === 'done');
await R(BEA, 'leadMeetUpdate', [{ ratings: { bd_bea: 8, st_sam: 10 } }]);
const end = await R(BEA, 'leadMeetEnd', [{}]);
const rec = end.past[end.past.length - 1];
ok('… ended: the record names the board’s people', end.ok && end.run === null && rec.leader.name === 'Bea Board' && rec.present.map(p => p.name).join() === 'Bea Board,Sam Seated' && rec.avg === 9 && rec.solved[0].decision === 'Draft one by March' && rec.headlines.length === 1);
ok('the campus’s meeting and Kanban never moved', mem['leadMeet:siemreap'].past.length === 1 && mem['leadBoard:siemreap'].cards.length === 1 && mem['leadBoard:siemreap'].cards[0].title === 'Campus card SR');
const cl = await call('getLeadMeeting', ADA);
ok('Campus Leadership’s own meeting shows nothing of the board’s', cl.ok && cl.campus === 'siemreap' && JSON.stringify(cl).indexOf('Board issue one') === -1 && JSON.stringify(cl).indexOf('audit came back') === -1 && cl.rocks.every(r => r.campus === 'siemreap'));
wrote.length = 0;
const cc = await call('saveLeadCard', ADA.concat([{ title: 'Campus card two', type: 'agenda', col: 'agenda' }]));
ok('… and a campus card is written to the campus, never the board', cc.ok && cc.campus === 'siemreap' && wrote.indexOf('leadBoard:board') === -1 && mem['leadBoard:board'].cards.length === 1);
ok('a leadership handler called straight by a board member is refused (no scope without boardRoom)', (await asBoard('getLeadMeeting', BEA)).ok === false && (await asBoard('saveLeadCard', BEA.concat([{ title: 'sneak' }]))).ok === false);
ok('an admin who isn’t on the board may open the room', (await call('boardRoom', ADA.concat(['getLeadBoard', []]))).ok === true);
ok('the room is not in the preview', (await call('demoCall', ['boardRoom', ['demo', '0000', 'getLeadBoard', []]])).ok !== true);

/* ==================== 4. every handler, with a board member's own sign-in ==================== */
const hb = srcApi.slice(srcApi.indexOf('const HANDLERS = {'));
const names = [...hb.slice(0, hb.indexOf('\n};')).matchAll(/^\s+([A-Za-z0-9_]+):\s*function/gm)].map(m => m[1]);
/* may answer ok to a board sign-in: the board's reads, its room, the 360 a member is asked to answer, and the public ones */
const BOARD_OK = new Set(['getBoardOverview', 'getBoardLeadership', 'fin2Get', 'getQuarterReport', 'getYwamGp', 'boardRoom', 'boardLogin',
  'p360Mine', 'p360Get', 'p360Answer', 'p360Decline',
  'getData', 'teamRoster', 'portalAuthConfig', 'libAudioIndex', 'demoCall', 'boardInviteInfo', 'inviteInfo', 'portalJoinInfo', 'portalReferenceForm']);
/* may write for a board sign-in: only the room */
const BOARD_WRITES = new Set(['boardRoom']);
const ROOM_KEYS = ['leadBoard:board', 'leadMeet:board', 'rocks:board'];
const tries = [[], ['siemreap'], ['poipet', YEAR, 4], ['st_ned'], [{}], ['st_ned', {}], [{ title: 'x', name: 'x', text: 'x' }], ['siemreap', { bal: [] }, 3], ['Community Service', 'Cafe', 'st_ned', true]];
const opened = [], wroteBad = [], snap = () => JSON.stringify(Object.keys(mem).filter(k => k !== 'loginThrottle' && ROOM_KEYS.indexOf(k) === -1).sort().map(k => [k, mem[k]]));
let base = snap();
for (const fn of names) {
  for (const extra of tries) {
    const r = await asBoard(fn, BEA.concat(extra));
    if (r && r.ok === true && !BOARD_OK.has(fn)) opened.push(fn);
    const now = snap();
    if (now !== base) { if (!BOARD_WRITES.has(fn)) wroteBad.push(fn); base = now; }
  }
  for (const rf of ['saveLeadCard', 'saveLeadRock', 'saveRock', 'adminUpdateStaff', 'fin2Save', 'saveQuarterStory']) {   // and through the room, naming anything
    if (fn !== 'boardRoom') break;
    await asBoard('boardRoom', BEA.concat([rf, ['siemreap', { title: 'via room', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe' }]]));
    const now2 = snap(); if (now2 !== base) { wroteBad.push('boardRoom→' + rf); base = now2; }
  }
}
ok('every handler (' + names.length + ') was tried with a board member’s own sign-in', names.length > 250, String(names.length));
ok('none answers ok but the board’s reads, its room and the public ones', opened.length === 0, [...new Set(opened)].join(', '));
ok('none writes anything outside the board’s own room', wroteBad.length === 0, [...new Set(wroteBad)].join(', '));
ok('… and the room’s writes only ever reach its three blobs', mem['leadBoard:siemreap'].cards.every(c => c.title !== 'via room') && mem.rocks.rocks.every(r => r.title !== 'via room'));
ok('the board member is still signed in after all that', (await asBoard('getBoardOverview', BEA)).ok === true);
ok('… and is still not staff, nor an admin', !mem.staff.some(s => s.username === 'bea') && mem.board.find(b => b.id === 'bd_bea').active === true);

/* ==================== 5. the privacy scan ==================== */
await asBoard('getData', ['']); await asBoard('teamRoster', []);
for (const c of ['siemreap', 'poipet']) for (const q of [1, 2, 3, 4]) await asBoard('getQuarterReport', BEA.concat([c, YEAR, q]));
await R(BEA, 'getLeadMeeting'); await R(BEA, 'getLeadBoard');
const leaks = [];
/* the public getData (and the two objective handlers, which answer with it) has always carried each check-in row's
   token with no name — anonymous by construction, open to anyone. What must never appear is a token beside a person:
   so the token is looked for everywhere else, and `surveyToken` (the join) everywhere. */
const PUBLIC_ROWS = ['getData', 'saveObjective', 'deleteObjective'];
seen.forEach(([fn, text]) => { MARK.forEach(m => { if (m === 'SECRETHEALTHTOKEN' && PUBLIC_ROWS.indexOf(fn) > -1) return; if (text.indexOf(m) > -1) leaks.push(fn + ' [' + m + ']'); }); });
ok('across every answer a board sign-in got (' + seen.length + '): no health token, 1-on-1 words, prayer, support partner, HR file, Google id, child, guardian, 360, leave reason, who fasts or what someone did', leaks.length === 0, [...new Set(leaks)].join(', '));
const cred = seen.filter(([fn, text]) => /"pinHash"|"pinSalt"|"secretHash"|"tokens":\[|"surveyToken"|"hash":/.test(text)).map(x => x[0]);
ok('… and no PIN, password or token material', cred.length === 0, [...new Set(cred)].join(', '));
const ovText = JSON.stringify(await asBoard('getBoardOverview', BEA));
ok('the Overview is counts and names only: no email, phone, photo data of staff, no survey row', !/@example\.org|@gmail\.com/.test(ovText.replace(/"members":\[.*?\]/, '')) && ovText.indexOf('lonely') === -1 && ovText.indexOf('device') === -1);
ok('staff debt: the board gets what Campus Leadership gets from the finance tool — which names who owes', JSON.stringify(await asBoard('fin2Get', BEA.concat(['siemreap']))).indexOf('Debtor Dan') > -1 && JSON.stringify(await call('fin2Get', ADA.concat(['siemreap']))).indexOf('Debtor Dan') > -1 && ovText.indexOf('Debtor Dan') === -1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
