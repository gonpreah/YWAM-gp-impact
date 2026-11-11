/* GPDTS (Nov 2026, Andrew): the school's numbers count themselves from its pipeline, and the
   portal shows each school's staff only their own school's applicants. Against the real api.js:
   the board (who may open it, the counts, follow-ups due, the class that is here), marking
   graduated and potential staff, lectures, the weekly rows the sync writes (tagged, never over a
   typed number, cleared when the pipeline empties), a lead joined by the account made with the
   same email, the first logged contact moving a lead on, and who sees what on the portal —
   from their ministry, or as an admin set it. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('dts');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
fs.copyFileSync(REPO + '/netlify/functions/api.js', TMP + '/api.js');
fs.copyFileSync(REPO + '/netlify/functions/team-seed.js', TMP + '/team-seed.js');
fs.copyFileSync(REPO + '/netlify/functions/portal-forms-default.js', TMP + '/portal-forms-default.js');
fs.copyFileSync(REPO + '/netlify/functions/legal-docs-default.js', TMP + '/legal-docs-default.js');
fs.copyFileSync(REPO + '/netlify/functions/legal-pdf.js', TMP + '/legal-pdf.js');
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/library-audio-lib.js');
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_admin', name: 'Admin Person', username: 'admin', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  withPin({ id: 'st_dts', name: 'Dee Teesse', username: 'dee', dept: 'Leadership Development', ministry: 'GPDTS' }),
  withPin({ id: 'st_dtslead', name: 'Lee Dee', username: 'lee', dept: 'Skills Training', ministry: 'Cafe', leads: ['Leadership Development|GPDTS'] }),
  withPin({ id: 'st_dbs', name: 'Bea Dibs', username: 'bea', dept: 'Leadership Development', ministry: 'DBS' }),
  withPin({ id: 'st_ld', name: 'Lou Director', username: 'lou', dept: 'Campus Leadership', ministry: 'Leadership Development' }),
  withPin({ id: 'st_cafe', name: 'Cal Fay', username: 'cal', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_ot', name: 'Otto Teams', username: 'otto', dept: 'Community Service', ministry: 'Outreach Teams', portalStaff: true }),
  withPin({ id: 'st_ps', name: 'Pat Staff', username: 'pat', dept: 'Skills Training', ministry: 'Hospitality', portalStaff: true }),
  withPin({ id: 'st_pp', name: 'Poi Pet', username: 'poi', campus: 'poipet', dept: 'Leadership Development', ministry: 'DTS' }),
];
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const NOW = new Date().toISOString();
const pnpDay = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = pnpDay(Date.now());
const dayAdd = (n) => pnpDay(Date.now() + n * 86400000);
const cand = (o) => ({ campus: 'siemreap', type: 'student', school: 'dts', stage: 'new', log: [], archived: null, created: NOW, updated: NOW, portal: null, ...o });
const stageLog = (...st) => st.map(s => ({ at: NOW, by: 'x', kind: 'stage', text: s }));
mem.candidates = [
  cand({ id: 'c_kh', name: 'Sokha Khmer', country: 'Cambodia', stage: 'applied', portal: { submittedAt: NOW }, log: stageLog('applied'), nextStep: 'Call her pastor', nextDate: dayAdd(-1) }),
  cand({ id: 'c_in', name: 'Ingrid Intl', country: 'Sweden', stage: 'accepted', portal: { submittedAt: NOW }, log: stageLog('applied', 'accepted') }),
  cand({ id: 'c_ar', name: 'Arno Here', country: 'Germany', stage: 'arrived', log: stageLog('arrived') }),
  cand({ id: 'c_ar2', name: 'Bopha Here', country: 'Cambodia', stage: 'arrived', log: stageLog('arrived') }),
  cand({ id: 'c_dbs', name: 'Dibs Student', country: 'Cambodia', school: 'dbs', stage: 'applied', portal: { submittedAt: NOW } }),
  cand({ id: 'c_team', name: 'A Team', type: 'team', school: '', country: 'USA', stage: 'applied' }),
  cand({ id: 'c_staff', name: 'Staff Hopeful', type: 'staff', school: '', country: 'Cambodia', stage: 'applied' }),
];
const rowsOf = (m) => (mem.entries || []).filter(r => r.campus === 'siemreap' && r.dept === 'Leadership Development' && r.ministry === 'GPDTS' && r.metric === m);
const sum = (m) => rowsOf(m).reduce((a, r) => a + Number(r.value), 0);
const latest = (m) => { const l = rowsOf(m).sort((a, b) => a.week - b.week); return l.length ? Number(l[l.length - 1].value) : 0; };

console.log('=== who may open the board ===');
let r = await call('dtsBoard', ['cal', '1234']);
ok('someone on another ministry cannot', r.body.ok === false && r.body.err === 'not_authorized', JSON.stringify(r.body));
r = await call('dtsBoard', ['poi', '1234']);
ok('Poipet has no GPDTS page yet', r.body.ok === false && r.body.err === 'no_dts');
for (const u of ['dee', 'lee', 'lou', 'admin']) {
  r = await call('dtsBoard', [u, '1234']);
  ok(u + ' (GPDTS staff, its leader, the LD director, an admin) can', r.body.ok === true && r.body.ministry === 'GPDTS', r.body.err);
}

console.log('\n=== the counts and the numbers they make ===');
r = await call('dtsBoard', ['dee', '1234']);
const B = r.body;
ok('only DTS records on this campus are counted', ['lead', 'contacted', 'applied', 'accepted', 'arrived', 'graduated'].reduce((a, k) => a + B.counts[k].khmer + B.counts[k].international, 0) === 4);
ok('applied 1 Khmer, accepted 1 international, here 1 + 1', B.counts.applied.khmer === 1 && B.counts.accepted.international === 1 && B.counts.arrived.khmer === 1 && B.counts.arrived.international === 1, JSON.stringify(B.counts));
ok('a follow-up a day late is due', B.due.length === 1 && B.due[0].id === 'c_kh' && B.due[0].nextStep === 'Call her pastor');
ok('the class lists the two who are here', B.school.map(x => x.id).sort().join() === 'c_ar,c_ar2');
ok('Students Applied counts everyone who applied (or got past it) this year', sum('Students Applied') === 4, sum('Students Applied'));
ok('Students Accepted counts the accepted and the arrived', sum('Students Accepted') === 3, sum('Students Accepted'));
ok('Students Enrolled is a level: who is here', latest('Students Enrolled') === 2, latest('Students Enrolled'));
ok('every row is tagged as the pipeline’s', (mem.entries || []).every(x => x.by === 'tool:dts'));
ok('the board carries the ministry’s numbers for the dashboard', B.data && B.data.entries && B.data.entries['Students Applied'], JSON.stringify(B.data).slice(0, 300));

console.log('\n=== a typed number is never overwritten; an emptied pipeline clears its own rows ===');
const ap = rowsOf('Students Applied')[0];
ap.by = 'st_dts'; ap.value = 9;
await call('dtsBoard', ['dee', '1234']);
ok('a hand-typed week stays', rowsOf('Students Applied')[0].value === 9);
ap.by = 'tool:dts';
const keep = mem.candidates;
mem.candidates = keep.filter(c => c.school !== 'dts');
await call('dtsBoard', ['dee', '1234']);
ok('with nobody in the pipeline the pipeline’s rows go', rowsOf('Students Applied').length === 0 && rowsOf('Students Accepted').length === 0);
mem.candidates = keep;
await call('dtsBoard', ['dee', '1234']);

console.log('\n=== This school: graduated, potential staff ===');
r = await call('dtsMark', ['dee', '1234', ['c_ar', 'c_ar2', 'c_kh'], { graduated: dayAdd(1) }]);
ok('a graduation day can’t be in the future', r.body.ok === false && r.body.err === 'future');
r = await call('dtsMark', ['dee', '1234', ['c_ar', 'c_ar2', 'c_kh'], { graduated: TODAY }]);
ok('mark all graduated at once — only those who came', r.body.ok === true && r.body.changed === 2, r.body.changed);
ok('they count as graduated this year, no longer here', r.body.counts.graduated.khmer + r.body.counts.graduated.international === 2 && r.body.counts.arrived.khmer === 0);
ok('Students Graduated 2, Students Enrolled back to 0', sum('Students Graduated') === 2 && latest('Students Enrolled') === 0, [sum('Students Graduated'), latest('Students Enrolled')].join());
ok('the record keeps it, with a note in its log', mem.candidates.find(c => c.id === 'c_ar').dts.graduated === TODAY && mem.candidates.find(c => c.id === 'c_ar').log.some(l => /Graduated/.test(l.text)));
r = await call('dtsMark', ['dee', '1234', ['c_ar'], { potentialStaff: true }]);
ok('potential staff', r.body.ok === true && r.body.school.find(x => x.id === 'c_ar').potentialStaff === TODAY && latest('Potential Staff') === 1);
r = await call('dtsMark', ['dee', '1234', ['c_ar2'], { graduated: '' }]);
ok('and undo a graduation', r.body.ok === true && !r.body.school.find(x => x.id === 'c_ar2').graduated && sum('Students Graduated') === 1);
r = await call('dtsMark', ['cal', '1234', ['c_ar'], { graduated: TODAY }]);
ok('nobody else marks them', r.body.ok === false);

console.log('\n=== Lectures ===');
r = await call('dtsSaveLecture', ['dee', '1234', { date: '', topic: 'x' }]);
ok('a lecture needs a day', r.body.ok === false && r.body.err === 'bad_lecture');
r = await call('dtsSaveLecture', ['dee', '1234', { date: dayAdd(14), end: dayAdd(18), topic: 'The Father heart of God', speaker: 'A Speaker', from: 'YWAM Somewhere', confirmed: true }]);
ok('added', r.body.ok === true && r.body.lectures.length === 1 && r.body.lectures[0].confirmed === true);
const lid = r.body.id;
r = await call('dtsSaveLecture', ['dee', '1234', { date: dayAdd(7), speaker: 'Another' }]);
ok('sorted by day', r.body.lectures[0].speaker === 'Another');
r = await call('dtsSaveLecture', ['dee', '1234', { id: lid, date: dayAdd(14), topic: 'Changed', speaker: 'A Speaker' }]);
ok('edited in place', r.body.lectures.length === 2 && r.body.lectures.find(l => l.id === lid).topic === 'Changed');
r = await call('dtsDeleteLecture', ['dee', '1234', lid]);
ok('deleted', r.body.ok === true && r.body.lectures.length === 1);
r = await call('dtsSaveLecture', ['cal', '1234', { date: dayAdd(3), topic: 'No' }]);
ok('only the school’s team writes them', r.body.ok === false);

console.log('\n=== contacts: Add a contact, log a contact, Contacted counts the first time ===');
r = await call('hrSaveCandidate', ['dee', '1234', { name: 'Lena Lead', type: 'student', school: 'dts', campus: 'siemreap', country: 'Norway', email: 'Lena@Example.org', source: 'A church', nextStep: 'Message after Sunday', nextDate: dayAdd(2) }]);
ok('the DTS team adds a contact (no account)', r.body.ok === true && r.body.candidate.stage === 'new' && !r.body.candidate.portal, JSON.stringify(r.body).slice(0, 120));
const lena = r.body.candidate;
r = await call('hrSaveCandidate', ['dee', '1234', { name: 'Team X', type: 'team', campus: 'siemreap' }]);
ok('but not a team — outside what they see', r.body.ok === false && r.body.err === 'not_authorized');
r = await call('hrSaveCandidate', ['bea', '1234', { name: 'Nope', type: 'student', school: 'dts', campus: 'siemreap' }]);
ok('nor DBS staff a DTS contact', r.body.ok === false && r.body.err === 'not_authorized');
r = await call('hrCandidateCall', ['dee', '1234', lena.id, { date: TODAY, method: 'message', with: 'Lena', text: 'Interested, asking about fees' }]);
ok('a logged contact keeps how', r.body.ok === true && r.body.candidate.calls[0].method === 'message');
ok('and the first one moves a contact from New to Contacted (logged)', r.body.candidate.stage === 'contacted' && r.body.candidate.log.some(l => l.kind === 'stage' && l.text === 'contacted'));
ok('Intl Students Contacted counts her', sum('Intl Students Contacted') === 1, sum('Intl Students Contacted'));
r = await call('hrCandidateCall', ['dee', '1234', lena.id, { date: TODAY, method: 'nonsense', text: 'Again' }]);
ok('an unknown way of reaching is kept blank, and a second contact counts nobody twice', r.body.candidate.calls[1].method === '' && sum('Intl Students Contacted') === 1);

console.log('\n=== the lead makes an account with the same email: it joins the record ===');
r = await call('portalRegister', [{ username: 'lena.l', pin: '2468', name: 'Lena Lead', email: 'lena@example.org', phone: '+47 400 00 000', messenger: 'whatsapp', type: 'student', school: 'dts', country: 'Norway', campus: 'siemreap' }]);
ok('sign-up works', r.body && r.body.ok === true, JSON.stringify(r.body).slice(0, 160));
const joined = mem.candidates.filter(c => c.name === 'Lena Lead');
ok('one record, the same id, now with the account', joined.length === 1 && joined[0].id === lena.id && joined[0].staffId && joined[0].portal);
ok('what the team logged stays', joined[0].calls.length === 2 && joined[0].source === 'A church' && joined[0].nextStep === 'Message after Sunday');
ok('the log says so', joined[0].log.some(l => /joined to this record/.test(l.text)));

console.log('\n=== who sees what on the portal ===');
const seen = async (u) => { const b = (await call('portalBoot', [u, '1234'])).body; return b && b.ok ? b.applicants.map(a => a.id) : null; };
let ids = await seen('dee');
ok('GPDTS staff get the portal without a tick, and only DTS applicants', ids && ids.every(id => mem.candidates.find(c => c.id === id).school === 'dts') && ids.includes('c_kh') && !ids.includes('c_dbs'), ids && ids.join());
ids = await seen('bea');
ok('DBS staff only DBS applicants', ids && ids.join() === 'c_dbs', ids && ids.join());
ids = await seen('lou');
ok('the Leadership Development director every school, no teams or staff', ids && ids.includes('c_dbs') && ids.includes('c_kh') && !ids.includes('c_team') && !ids.includes('c_staff'));
ids = await seen('otto');
ok('Outreach Teams staff only teams', ids && ids.join() === 'c_team', ids && ids.join());
ids = await seen('pat');
ok('someone ticked with no school ministry sees everything', ids && ids.includes('c_team') && ids.includes('c_staff') && ids.includes('c_kh'));
ok('someone on a ministry with nothing to do with applications gets no portal', (await seen('cal')) === null);
r = await call('adminUpdateStaff', ['admin', '1234', 'st_cafe', { portalScope: ['staff', 'volunteer', 'nonsense'] }]);
ok('an admin can say exactly what someone sees — and that is a grant', r.body.ok === true && JSON.stringify(r.body.staff.portalScope) === '["staff","volunteer"]' && r.body.staff.portal === true);
ids = await seen('cal');
ok('then they see just that', ids && ids.join() === 'c_staff', ids && ids.join());
r = await call('adminUpdateStaff', ['admin', '1234', 'st_dts', { portalScope: 'all' }]);
ids = await seen('dee');
ok('“Everything” widens a school’s staff member', r.body.staff.portalSees === null && ids.includes('c_team'));
r = await call('adminUpdateStaff', ['admin', '1234', 'st_dts', { portalScope: null }]);
ids = await seen('dee');
ok('“From their ministry” puts it back', !mem.staff.find(s => s.id === 'st_dts').portalScope && !ids.includes('c_team') && JSON.stringify(r.body.staff.portalSees) === '["student:dts"]');
r = await call('adminUpdateStaff', ['dee', '1234', 'st_dts', { portalScope: 'all' }]);
ok('only an admin can change it', r.body.ok === false);
r = await call('portalAccessList', ['admin', '1234']);
ok('Who has access says what each person sees', r.body.ok && r.body.staff.find(s => s.id === 'st_dbs').sees.join() === 'student:dbs');

console.log('\n=== the hourly sync ===');
const out = await api.runDtsSync();
ok('runs for Siem Reap', out && 'siemreap' in out);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
