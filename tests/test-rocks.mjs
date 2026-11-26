/* Rocks and the Scorecard's goals — against the real api.js.

   Nov 2026 (Uriah): "I'm going to move OKRs to rocks. And we're going to move the KPI and numbers
   things to scorecard … as the OKRs are too complicated."
   A rock is a quarter's priority — a title, whose it is, on track / off track / done, a note — kept in
   one store ('rocks') for every team on both campuses; the leadership meeting's rocks are the ones
   with dept Campus Leadership and no ministry. What this holds:
     1. who may write what (the campus and department come from the staff record, never the payload);
        who reads (every staff member; the public figures carry none; the board title and status);
     2. the one-time move: this quarter's objectives and the meeting's own rocks come across once,
        nothing is lost or made twice (two phones at once included), and a page open writes nothing;
     3. the leadership meeting still reads and writes its rocks;
     4. the Scorecard's weekly goals: who sets them, cleaned, range-checked, kept through other edits;
     5. the server's copy of how a metric adds up (modeOf_) matches taxonomy.js.
   Every name is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('rocks');
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
const st = (o) => ({ role: '', active: true, campus: 'siemreap', ...o });
mem.staff = [
  st({ id: 'st_d', name: 'Dee Director', username: 'dee', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  st({ id: 'st_o', name: 'Oli Overseer', username: 'oli', dept: 'Campus Leadership', ministry: 'Community Service' }),
  st({ id: 'st_c', name: 'Cafe Cam', username: 'cam', dept: 'Community Service', ministry: 'Cafe' }),
  st({ id: 'st_t', name: 'Tia Teams', username: 'tia', dept: 'Community Service', ministry: 'Outreach Teams' }),
  st({ id: 'st_k', name: 'Kim Kids', username: 'kim', dept: 'Youth Education', ministry: 'Kids Club', ministries: ['Community Service|Cafe'] }),
  st({ id: 'st_l', name: 'Lee Leader', username: 'lee', dept: 'Skills Training', ministry: 'Culinary', leads: ['Youth Education|Kids Club'] }),
  st({ id: 'st_s', name: 'Sam Skills', username: 'sam', dept: 'Skills Training', ministry: 'Finances' }),
  st({ id: 'st_a', name: 'Ada Admin', username: 'ada', dept: 'Skills Training', ministry: 'Finances', isAdmin: true }),
  st({ id: 'st_p', name: 'Pat Poipet', username: 'pat', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe' }),
  st({ id: 'st_pd', name: 'Pol Poipet', username: 'pol', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  st({ id: 'st_x', name: 'Appy Applicant', username: 'appy', kind: 'applicant', applicant: { type: 'staff' } }),
  st({ id: 'st_z', name: 'Zed Gone', username: 'zed', dept: 'Community Service', ministry: 'Cafe', active: false }),
].map(s => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) }));
mem.board = [{ id: 'b1', name: 'Bo Board', role: 'Advisor', username: 'bo', active: true, pinSalt: 'b1', pinHash: mkHash('1234', 'b1') }];
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json().catch(() => null);
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
const P = (u) => [u, '1234'];
const rocksOf = async (u) => (await call('getMyBoot', P(u))).rocks;

/* ---------- 2 (first, on the untouched store): the one-time move ---------- */
console.log('=== what was there before comes across once ===');
const okr = (id, campus, dept, quarter, objective, krs, updated) => krs.map(k => Object.assign({ campus, quarter, dept, id, objective, kr: '', metricKey: '', target: 0, manualPct: 0, group: '', kind: '', current: 0, updated }, k));
mem.okrs = [].concat(
  okr('o_cafe', 'siemreap', 'Community Service', 4, 'Make the cafe a place people meet Jesus', [
    { kr: 'Serve 200 cups', metricKey: 'Community Service|Cafe|Cups Sold', target: 200 },
    { kr: 'Train two baristas', kind: 'count', target: 2, current: 1 },
    { kr: 'A prayer corner', manualPct: 40 }], '2026-10-20T03:00:00.000Z'),
  okr('o_done', 'siemreap', 'Community Service', 4, 'Host three teams well', [{ kr: 'Three teams', kind: 'count', target: 3, current: 3 }, { kr: 'Thank-you notes sent', manualPct: 100 }], '2026-11-02T03:00:00.000Z'),
  okr('o_lead', 'siemreap', 'Campus Leadership', 4, 'Every staff member walks with a mentor', [{ kr: 'Two 1-on-1s a month', manualPct: 65 }], '2026-10-05T03:00:00.000Z'),
  okr('o_next', 'siemreap', 'Youth Education', 1, 'Open a second Kids Club', [{ kr: 'Find a room', manualPct: 10 }], '2026-11-10T03:00:00.000Z'),
  okr('o_old1', 'siemreap', 'Youth Education', 1, 'A Q1 objective from the start of the year', [{ kr: 'Something', manualPct: 90 }], '2026-02-10T03:00:00.000Z'),
  okr('o_old3', 'siemreap', 'Community Service', 3, 'A Q3 objective', [{ kr: 'Something else', manualPct: 70 }], '2026-08-10T03:00:00.000Z'),
  okr('o_poi', 'poipet', 'Community Service', 4, 'Poipet’s cafe opens on Saturdays', [{ kr: 'Eight Saturdays', manualPct: 50 }], '2026-10-11T03:00:00.000Z'),
  okr('o_mix', 'siemreap', 'Skills Training', 4, 'Two ministries’ numbers', [
    { kr: 'Meals', metricKey: 'Skills Training|Culinary|Meals Served', target: 100 }, { kr: 'Guests', metricKey: 'Skills Training|Hospitality|Guests Hosted', target: 10 }], '2026-10-11T03:00:00.000Z'));
mem.entries = [40, 41, 42].map((w, i) => ({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: w, year: 2026, value: [30, 40, 50][i], updated: '2026-10-25T03:00:00.000Z' }))
  .concat([{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 30, year: 2026, value: 999 }]);   // Q3: not this quarter's
mem['leadMeet:siemreap'] = { rocks: [
  { id: 'rk_old1', title: 'Open the new dorm', owner: 'st_o', year: 2026, q: 4, okrId: 'o_lead', status: 'off', note: 'Waiting on the roof', by: 'st_d', created: '2026-11-25T02:00:00.000Z', updated: '2026-11-25T03:00:00.000Z', updatedBy: 'st_o' },
  { id: 'rk_old2', title: 'One staff retreat', owner: '', year: 2027, q: 1, status: 'on', note: '', by: 'st_d' }], score: [], headlines: [], past: [] };
const okrsBefore = JSON.stringify(mem.okrs), meetBefore = JSON.stringify(mem['leadMeet:siemreap']);

io.reset();
let boot = await call('getMyBoot', P('cam'));
ok('a page open carries the rocks and writes no blob', Array.isArray(boot.rocks) && io.writes.length === 0, io.writes.join(','));
const byId = (list, id) => list.filter(r => r.id === id)[0];
let R = boot.rocks;
const cafe = byId(R, 'rk_o_o_cafe');
ok('this quarter’s objective is a rock in the same campus and department, for 2026 Q4', cafe && cafe.campus === 'siemreap' && cafe.dept === 'Community Service' && cafe.year === 2026 && cafe.q === 4 && cafe.title === 'Make the cafe a place people meet Jesus' && cafe.fromOkr === 'o_cafe', cafe);
ok('… its key results are the note, each with its progress (120 of 200 cups = 60%; 1 of 2; 40%)', cafe && cafe.note === '• Serve 200 cups — 60%\n• Train two baristas — 50%\n• A prayer corner — 40%', cafe && cafe.note);
ok('… on track while under 100%, and clearly the Cafe’s (its only linked number is the Cafe’s)', cafe && cafe.status === 'on' && cafe.ministry === 'Cafe');
ok('an objective at 100% is a rock that is done', byId(R, 'rk_o_o_done') && byId(R, 'rk_o_o_done').status === 'done' && byId(R, 'rk_o_o_done').ministry === '');
ok('numbers from two ministries: the department’s rock, no ministry', byId(R, 'rk_o_o_mix') && byId(R, 'rk_o_o_mix').ministry === '');
ok('leadership’s objective is a leadership rock', byId(R, 'rk_o_o_lead') && byId(R, 'rk_o_o_lead').dept === 'Campus Leadership' && byId(R, 'rk_o_o_lead').ministry === '');
ok('one written ahead for Q1 is next quarter’s rock (2027 Q1)', byId(R, 'rk_o_o_next') && byId(R, 'rk_o_o_next').year === 2027 && byId(R, 'rk_o_o_next').q === 1);
ok('earlier quarters’ objectives are not made into rocks', !byId(R, 'rk_o_o_old1') && !byId(R, 'rk_o_o_old3'));
ok('the other campus’s come across too', byId(R, 'rk_o_o_poi') && byId(R, 'rk_o_o_poi').campus === 'poipet');
const lr = byId(R, 'rk_old1');
ok('the meeting’s own rocks come across with their ids, owner, status and note', lr && lr.dept === 'Campus Leadership' && lr.ministry === '' && lr.campus === 'siemreap' && lr.owner === 'st_o' && lr.status === 'off' && lr.note === 'Waiting on the roof' && lr.by === 'st_d' && byId(R, 'rk_old2') && byId(R, 'rk_old2').q === 1);
ok('six objectives and two meeting rocks: eight rocks, none twice', R.length === 8 && new Set(R.map(r => r.id)).size === R.length, R.map(r => r.id).join(','));
ok('reading again gives the same, still with nothing written', JSON.stringify(await rocksOf('cam')) === JSON.stringify(R) && !('rocks' in mem));

console.log('=== the first write stores it — once, even from two phones at once ===');
const g = (await call('getLeadMeeting', P('dee')));
const [a1, a2] = await Promise.all([
  call('saveRock', P('cam').concat([{ ministry: 'Cafe', title: 'New menu board', year: g.year, q: g.q }])),
  call('saveRock', P('kim').concat([{ title: 'Kids Club songbook', year: g.year, q: g.q }]))]);
ok('both saves landed', a1.ok && a2.ok, [a1, a2]);
R = await rocksOf('cam');
ok('the store is seeded once: every moved rock is there once, plus the two new ones', mem.rocks && mem.rocks.seeded && R.length === 10 && new Set(R.map(r => r.id)).size === 10, R.map(r => r.id).join(','));
ok('nothing of the old stores was touched', JSON.stringify(mem.okrs) === okrsBefore && JSON.stringify(mem['leadMeet:siemreap']) === meetBefore);
const del = await call('deleteRock', P('cam').concat(['rk_o_o_done']));
R = await rocksOf('cam');
ok('a moved rock that is deleted stays deleted — it is not brought in again', del.ok && !byId(R, 'rk_o_o_done') && R.length === 9);
const data = await call('getData', ['']);
ok('the objectives are still stored and still sent, for the “Earlier objectives” list', data.okrs.length === 8 && data.okrs.some(o => o.id === 'o_old3'));
ok('the public figures carry no rocks at all', data.rocks === undefined && !/New menu board|Open the new dorm/.test(JSON.stringify(data)));

/* ---------- 1: who may write what ---------- */
console.log('=== who may write ===');
const Q = { year: g.year, q: g.q }, NQ = g.q === 4 ? { year: g.year + 1, q: 1 } : { year: g.year, q: g.q + 1 };
let r = await call('saveRock', P('cam').concat([{ title: '  Fix the grinder  ', ...Q, owner: 'st_c', note: ' Parts ordered ', status: 'weird' }]));
const k1 = r.saved; let rk = byId(r.rocks, k1);
ok('with no place named a rock is the caller’s own campus and department’s, cleaned', r.ok && rk.campus === 'siemreap' && rk.dept === 'Community Service' && rk.ministry === '' && rk.title === 'Fix the grinder' && rk.note === 'Parts ordered' && rk.status === 'on' && rk.owner === 'st_c' && rk.by === 'st_c', rk);
r = await call('saveRock', P('cam').concat([{ campus: 'siemreap', dept: 'Youth Education', ministry: 'Kids Club', title: 'Not mine', ...Q }]));
ok('a payload naming another department is refused', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('cam').concat([{ campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', title: 'Not my campus', ...Q }]));
ok('… and another campus, even the same department', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('cam').concat([{ dept: 'Campus Leadership', title: 'Not leadership', ...Q }]));
ok('… and leadership’s rocks', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('cam').concat([{ ministry: 'Outreach Teams', title: 'Another ministry of my department', ...Q }]));
ok('staff write any rock of their own department (as its objectives were)', r.ok && byId(r.rocks, r.saved).ministry === 'Outreach Teams');
r = await call('saveRock', P('kim').concat([{ dept: 'Community Service', ministry: 'Cafe', title: 'Kim’s other ministry', ...Q }]));
const kKim = r.saved;
ok('someone with the ministry among their other ministries writes that ministry’s', r.ok && byId(r.rocks, kKim).dept === 'Community Service' && byId(r.rocks, kKim).ministry === 'Cafe');
r = await call('saveRock', P('kim').concat([{ dept: 'Community Service', ministry: '', title: 'The department’s', ...Q }]));
ok('… but not that department’s own rocks', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('lee').concat([{ dept: 'Youth Education', ministry: 'Kids Club', title: 'A leader’s rock', ...Q }]));
ok('a ministry’s leader writes its rocks from another department', r.ok && byId(r.rocks, r.saved).ministry === 'Kids Club');
r = await call('saveRock', P('oli').concat([{ dept: 'Community Service', ministry: 'Cafe', title: 'The director’s rock for the Cafe', ...Q }]));
ok('the department’s director writes its ministries’ rocks', r.ok);
r = await call('saveRock', P('oli').concat([{ dept: 'Youth Education', ministry: 'Kids Club', title: 'Another department', ...Q }]));
ok('… and not another department’s', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('oli').concat([{ dept: 'Campus Leadership', title: 'A leadership rock', ...Q, owner: 'st_d' }]));
const kLead = r.saved;
ok('Campus Leadership writes their campus’s leadership rocks', r.ok && byId(r.rocks, kLead).dept === 'Campus Leadership' && byId(r.rocks, kLead).owner === 'st_d');
r = await call('saveRock', P('pol').concat([{ campus: 'siemreap', dept: 'Campus Leadership', title: 'Other campus', ...Q }]));
ok('… not the other campus’s', r.ok === false && r.err === 'not_authorized');
r = await call('saveRock', P('ada').concat([{ campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', title: 'An admin anywhere', ...Q }]));
ok('an admin writes any rock on either campus', r.ok && byId(r.rocks, r.saved).campus === 'poipet');
ok('an applicant, an inactive account, a wrong PIN and nobody are refused', (await call('saveRock', P('appy').concat([{ title: 'x' }]))).ok === false && (await call('saveRock', P('zed').concat([{ title: 'x' }]))).ok === false
  && (await call('saveRock', ['cam', '9999', { title: 'x' }])).ok === false && (await call('saveRock', ['', '', { title: 'x' }])).ok === false && (await call('deleteRock', P('appy').concat([k1]))).ok === false);

console.log('=== an existing rock stays where it is ===');
r = await call('saveRock', P('sam').concat([{ id: k1, title: 'Hijacked', ...Q }]));
ok('an id cannot be used to change another department’s rock', r.ok === false && r.err === 'not_authorized' && byId(await rocksOf('cam'), k1).title === 'Fix the grinder');
ok('… nor to delete it', (await call('deleteRock', P('sam').concat([k1]))).err === 'not_authorized' && !!byId(await rocksOf('cam'), k1));
r = await call('saveRock', P('tia').concat([{ id: k1, campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', title: 'Fix the grinder', owner: 'st_t', status: 'off', note: 'Still waiting', ...Q }]));
rk = byId(r.rocks, k1);
ok('a teammate changes its status, owner and note; its place and who made it stay', r.ok && rk.status === 'off' && rk.owner === 'st_t' && rk.note === 'Still waiting' && rk.campus === 'siemreap' && rk.dept === 'Community Service' && rk.ministry === '' && rk.by === 'st_c' && rk.updatedBy === 'st_t', rk);
r = await call('saveRock', P('cam').concat([{ id: k1, title: 'Fix the grinder', owner: 'st_p', ...Q }]));
ok('an owner must be active staff on that campus, or it is the team’s', r.ok && byId(r.rocks, k1).owner === '');
r = await call('saveRock', P('cam').concat([{ id: k1, title: 'Fix the grinder', ...NQ }]));
ok('it can be moved on to next quarter', r.ok && byId(r.rocks, k1).year === NQ.year && byId(r.rocks, k1).q === NQ.q);
ok('a rock needs a title; an unknown id is not found', (await call('saveRock', P('cam').concat([{ title: '  ' }]))).err === 'bad_title' && (await call('saveRock', P('cam').concat([{ id: 'nope', title: 'x' }]))).err === 'not_found' && (await call('deleteRock', P('cam').concat(['nope']))).err === 'not_found');
r = await call('saveRock', P('cam').concat([{ title: 'Long ago', year: 2001, q: 3 }]));
ok('a new rock for any other quarter is this quarter’s', r.ok && byId(r.rocks, r.saved).year === g.year && byId(r.rocks, r.saved).q === g.q);
mem.rocks.rocks.push({ id: 'rk_hist', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', owner: '', year: 2025, q: 2, title: 'History', status: 'done', note: '', by: 'st_c' });
ok('an earlier quarter’s rock is history: nobody changes or deletes it, an admin included',
  (await call('saveRock', P('cam').concat([{ id: 'rk_hist', title: 'Rewritten', ...Q }]))).err === 'past' && (await call('deleteRock', P('ada').concat(['rk_hist']))).err === 'past' && byId(await rocksOf('cam'), 'rk_hist').title === 'History');
for (let i = 0; i < 12; i++) r = await call('saveRock', P('lee').concat([{ title: 'Culinary rock ' + i, ...Q, owner: 'st_l' }]));
ok('ten a person a team a quarter at most', r.err === 'too_many' && (await rocksOf('lee')).filter(x => x.dept === 'Skills Training' && x.owner === 'st_l').length === 10);
r = await call('saveRock', P('cam').concat([{ title: 'x'.repeat(300), note: 'y'.repeat(3000), ...Q }]));
ok('a title is cut at 120 and a note at 1200', r.ok && byId(r.rocks, r.saved).title.length === 120 && byId(r.rocks, r.saved).note.length === 1200);

console.log('=== who reads ===');
const forCam = await rocksOf('cam'), forPat = await rocksOf('pat');
ok('every staff member reads every rock on both campuses', forCam.length === forPat.length && forCam.some(x => x.campus === 'poipet') && forPat.some(x => x.dept === 'Campus Leadership' && x.campus === 'siemreap'));
ok('an applicant’s sign-in gets none', (await call('getMyBoot', P('appy'))).rocks === undefined);
const org = await call('getYwamGp', P('bo'));
ok('a board member gets title and status for the quarter report — no notes, no owners', org.ok && org.rocks.length === forCam.length && Object.keys(org.rocks[0]).sort().join() === 'campus,dept,id,ministry,q,status,title,year');
ok('staff do not get a second copy with the YWAM GP page', (await call('getYwamGp', P('cam'))).rocks === undefined);
ok('nothing of it is on the public roster', !/Fix the grinder|New menu board/.test(JSON.stringify(await call('teamRoster', []))));

/* ---------- 3: the leadership meeting ---------- */
console.log('=== the leadership meeting reads and writes the same rocks ===');
let m = await call('getLeadMeeting', P('dee'));
ok('the meeting shows this campus’s leadership rocks — the moved ones, the old meeting’s and the new', m.ok && m.rocks.every(x => x.dept === 'Campus Leadership' && x.campus === 'siemreap' && !x.ministry) && ['rk_old1', 'rk_old2', 'rk_o_o_lead', kLead].every(id => byId(m.rocks, id)), m.rocks.map(x => x.id));
m = await call('saveLeadRock', P('dee').concat([{ id: 'rk_old1', title: 'Open the new dorm', owner: 'st_o', year: g.year, q: g.q, status: 'done', note: 'Roof is on' }]));
ok('a meeting save changes the one rock everyone sees', m.ok && byId(m.rocks, 'rk_old1').status === 'done' && byId(await rocksOf('cam'), 'rk_old1').status === 'done' && byId(await rocksOf('cam'), 'rk_old1').okrId === 'o_lead');
m = await call('saveLeadRock', P('oli').concat([{ title: 'From the meeting', year: g.year, q: g.q }]));
const kM = m.saved;
ok('a meeting rock is leadership’s, whatever the payload says', m.ok && byId(await rocksOf('cam'), kM).dept === 'Campus Leadership' && byId(await rocksOf('cam'), kM).campus === 'siemreap');
ok('the meeting cannot reach a ministry’s rock by its id', (await call('saveLeadRock', P('dee').concat([{ id: k1, title: 'Taken' }]))).err === 'not_found' && (await call('deleteLeadRock', P('dee').concat([k1]))).err === 'not_found' && byId(await rocksOf('cam'), k1).title === 'Fix the grinder');
m = await call('deleteLeadRock', P('dee').concat([kM]));
ok('… and removes its own', m.ok && !byId(m.rocks, kM) && !byId(await rocksOf('cam'), kM));
ok('Poipet’s meeting has only Poipet’s', (await call('getLeadMeeting', P('pol'))).rocks.every(x => x.campus === 'poipet'));
ok('someone outside leadership still cannot use the meeting’s door', (await call('saveLeadRock', P('cam').concat([{ title: 'x' }]))).err === 'not_authorized');

/* ---------- 4: the Scorecard's goals ---------- */
console.log('=== the Scorecard’s weekly goals ===');
const T = ['siemreap', 'Community Service', 'Cafe'];
ok('a ministry’s ordinary staff cannot set goals', (await call('saveMetricGoals', P('cam').concat(T, [{ 'Cups Sold': { goal: 150 } }]))).err === 'not_authorized');
mem.staff.find(s => s.id === 'st_c').leads = ['Community Service|Cafe'];
r = await call('saveMetricGoals', P('cam').concat(T, [{ 'Cups Sold': { goal: '150', dir: 'sideways' }, 'Weekly Expenses ($)': { goal: 80, dir: 'lte' }, 'Customer Rating (1-10)': { goal: 11 }, 'Repeat Customers (%)': { goal: 60 },
  'Nothing': { goal: '' }, 'Words': { goal: 'many' }, 'Base Finances ($)': { goal: 5 } }]));
const row = () => mem.metricOverrides.find(x => x.campus === 'siemreap' && x.dept === 'Community Service' && x.ministry === 'Cafe');
ok('its leader sets them: a number and a direction each, cleaned', r.ok && JSON.stringify(row().goals) === JSON.stringify({ 'Cups Sold': { goal: 150, dir: 'gte' }, 'Weekly Expenses ($)': { goal: 80, dir: 'lte' }, 'Repeat Customers (%)': { goal: 60, dir: 'gte' } }), row().goals);
ok('a goal outside a score’s edges, and one that is not a number, are named and left out', r.rejected.sort().join() === 'Customer Rating (1-10),Words');
ok('they ride the figures every page already loads', (await call('getData', [''])).metricOverrides.some(x => x.ministry === 'Cafe' && x.goals['Cups Sold'].goal === 150));
r = await call('saveMetricOverrides', P('cam').concat(T, [['Days Open'], ['Loyalty Cards']]));
ok('hiding or adding a number keeps the goals', r.ok && row().goals['Cups Sold'].goal === 150 && row().custom[0] === 'Loyalty Cards');
await call('saveMetricGoals', P('cam').concat(T, [{ 'Cups Sold': { goal: 150 }, 'Loyalty Cards': { goal: 20 } }]));
r = await call('renameCustomMetric', P('cam').concat(T, ['Loyalty Cards', 'Loyalty Cards Given']));
ok('renaming a number takes its goal with it; a goal left out is gone', r.ok && row().goals['Loyalty Cards Given'].goal === 20 && !row().goals['Loyalty Cards'] && !row().goals['Weekly Expenses ($)']);
ok('Campus Leadership and admins set any ministry’s; another campus’s leader cannot', (await call('saveMetricGoals', P('oli').concat(T, [{ 'Cups Sold': { goal: 160 } }]))).ok && (await call('saveMetricGoals', P('ada').concat(['poipet', 'Community Service', 'Cafe', {}]))).ok
  && (await call('saveMetricGoals', P('pol').concat(T, [{}]))).err === 'not_authorized' && (await call('saveMetricGoals', P('appy').concat(T, [{}]))).ok === false);
const many = {}; for (let i = 0; i < 70; i++) many['Number ' + i] = { goal: i + 1 };
r = await call('saveMetricGoals', P('ada').concat(T, [many]));
ok('sixty goals a ministry at most', r.ok && Object.keys(row().goals).length === 60 && r.rejected.length === 10);

/* ---------- 5: the mirrored rule ---------- */
console.log('=== how a metric adds up: the server’s copy matches taxonomy.js ===');
const tax = fs.readFileSync(REPO + '/public/taxonomy.js', 'utf8'), src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const listOf = (text, name) => { const m = text.match(new RegExp(name + '\\s*=\\s*\\[([\\s\\S]*?)\\];')); return m ? [...m[1].replace(/\/\/[^\n]*/g, '').matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]) : null; };
const A = listOf(tax, 'var LATEST_SET'), B = listOf(src, 'const LATEST_SET_');
ok('LATEST_SET_ in api.js is taxonomy.js’s LATEST_SET', A && B && A.length > 20 && JSON.stringify(A) === JSON.stringify(B), [A && A.length, B && B.length]);
const body = (text, name) => { const i = text.indexOf('function ' + name + '('); return text.slice(i, text.indexOf('\n}', i)); };
ok('modeOf_ reads a name the way modeOf does', /\(1-10\)/.test(body(src, 'modeOf_')) && /\(%\)/.test(body(src, 'modeOf_')) && /'Pages'/.test(body(src, 'modeOf_')) && /'Followers'/.test(body(src, 'modeOf_'))
  && /'Pages'/.test(body(tax, 'modeOf')) && /'Followers'/.test(body(tax, 'modeOf')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
