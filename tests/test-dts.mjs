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

console.log('\n=== part 2: what God did, from lectures and outreach ===');
mem.candidates = mem.candidates.filter(c => c.school !== 'dts' || ['c_kh', 'c_in', 'c_ar', 'c_ar2'].includes(c.id));
const Y1 = dayAdd(-1);
r = await call('dtsSaveLecture', ['dee', '1234', { date: Y1, topic: 'Evangelism', speaker: 'Someone', fruit: { gospel: 12, salvations: 2, healings: -3, baptisms: 'x' } }]);
ok('a lecture keeps its fruit (only real, positive numbers)', r.body.ok && JSON.stringify(r.body.lectures.find(l => l.topic === 'Evangelism').fruit) === '{"gospel":12,"salvations":2}', JSON.stringify(r.body.lectures.find(l => l.topic === 'Evangelism') && r.body.lectures.find(l => l.topic === 'Evangelism').fruit));
ok('People Heard the Gospel and Salvations count it', sum('People Heard the Gospel') === 12 && sum('Salvations') === 2, [sum('People Heard the Gospel'), sum('Salvations')].join());
r = await call('dtsSaveOutreach', ['dee', '1234', { place: '', reports: [] }]);
ok('an outreach needs a place', r.body.ok === false && r.body.err === 'bad_outreach');
r = await call('dtsSaveOutreach', ['dee', '1234', { place: 'Mondulkiri', from: dayAdd(-10), to: dayAdd(20), leaders: 'Lee', size: 9, reports: [{ date: Y1, fruit: { gospel: 30, baptisms: 4 } }, { date: dayAdd(5), fruit: { gospel: 99 } }, { date: Y1, fruit: {} }] }]);
ok('an outreach and its reports (an empty one dropped)', r.body.ok && r.body.outreaches[0].reports.length === 2);
const outId = r.body.id;
ok('a report counts on its day; one dated ahead waits', sum('People Heard the Gospel') === 42 && sum('Baptisms') === 4, sum('People Heard the Gospel'));
r = await call('dtsDeleteOutreach', ['dee', '1234', outId]);
ok('deleting it takes its numbers back out', r.body.ok && sum('People Heard the Gospel') === 12 && sum('Baptisms') === 0);
r = await call('dtsSaveOutreach', ['cal', '1234', { place: 'X' }]);
ok('only the school’s team writes outreach', r.body.ok === false);
const reminded = (await call('getMyBoot', ['dee', '1234'])).body;
ok('GPDTS gets no “numbers due” reminder (it counts itself)', !(reminded.numbers && (reminded.numbers.duty || []).some(x => x.ministry === 'GPDTS')));

console.log('\n=== past years ===');
const THIS = (await call('dtsBoard', ['dee', '1234'])).body.year;
r = await call('dtsSavePast', ['dee', '1234', THIS, { 'Students Applied': 5 }, '']);
ok('this year is not a past year', r.body.ok === false && r.body.err === 'bad_year');
r = await call('dtsSavePast', ['dee', '1234', THIS - 1, { 'Students Applied': '14', 'Salvations': 7, 'Healings': '', 'Made Up': 3, 'Baptisms': -2 }, 'Outreach to Thailand']);
ok('a past year keeps only real numbers for known metrics', r.body.ok && JSON.stringify(r.body.past[String(THIS - 1)].values) === '{"Students Applied":14,"Salvations":7}', JSON.stringify(r.body.past));
ok('it is never written into the weekly rows', !(mem.entries || []).some(x => Number(x.year) === THIS - 1));
ok('the board carries it', (await call('dtsBoard', ['dee', '1234'])).body.past[String(THIS - 1)].notes === 'Outreach to Thailand');
r = await call('dtsSavePast', ['dee', '1234', THIS - 1, null]);
ok('and it can be deleted', r.body.ok && !r.body.past[String(THIS - 1)]);

console.log('\n=== part 2: graduate → staff application → the GP app ===');
// an applicant account for Arno (graduated, potential staff from above)
mem.staff.push({ id: 'ap_arno', username: 'arno@example.org', name: 'Arno Here', email: 'arno@example.org', kind: 'applicant', active: true, campus: 'siemreap', applicant: { type: 'student', school: 'dts', candidateId: 'c_ar' }, tokens: [] });
const arnoTok = (function () { const salt = 'tok1'; const tok = 'ab'.repeat(24); mem.staff[mem.staff.length - 1].tokens.push({ hash: mkHash(tok, salt), salt, created: NOW }); return tok; })();
mem.candidates = mem.candidates.map(c => c.id === 'c_ar' ? { ...c, staffId: 'ap_arno', email: 'arno@example.org', portal: { createdAt: NOW } } : c);
r = await call('dtsMark', ['dee', '1234', ['c_ar'], { graduated: TODAY, potentialStaff: true }]);
r = await call('dtsToStaff', ['dee', '1234', ['c_ar2']]);
ok('someone not marked potential staff does not move', r.body.ok && r.body.moved === 0);
r = await call('dtsToStaff', ['dee', '1234', ['c_ar']]);
const staffApp = mem.candidates.find(c => c.fromDts === 'c_ar');
ok('a graduate marked potential staff gets a staff application', r.body.moved === 1 && staffApp && staffApp.type === 'staff' && staffApp.stage === 'new' && staffApp.staffId === 'ap_arno');
ok('the board shows where they are in it', r.body.school.find(x => x.id === 'c_ar').staffCand.id === staffApp.id);
const arno = mem.staff.find(x => x.id === 'ap_arno');
ok('their portal login now opens the staff application; the DTS one is history', arno.applicant.type === 'staff' && arno.applicant.candidateId === staffApp.id && arno.applicant.history[0].candidateId === 'c_ar');
let pb = (await call('portalBoot', ['arno@example.org', arnoTok])).body;
ok('the portal shows them the staff application', pb.ok && pb.application.id === staffApp.id && pb.application.formKey === 'staff', JSON.stringify(pb).slice(0, 120));
r = await call('dtsToStaff', ['dee', '1234', ['c_ar']]);
ok('moving twice makes nothing twice', r.body.moved === 0 && mem.candidates.filter(c => c.fromDts === 'c_ar').length === 1);
r = await call('portalGpAdd', ['admin', '1234', staffApp.id, {}]);
ok('Add to the GP app waits until the application is accepted', r.body.ok === false && r.body.err === 'not_accepted');
mem.candidates = mem.candidates.map(c => c.id === staffApp.id ? { ...c, stage: 'accepted' } : c);
r = await call('portalGpAdd', ['dee', '1234', staffApp.id, {}]);
ok('DTS staff (who see only DTS) cannot add a staff applicant', r.body.ok === false && r.body.err === 'not_authorized');
r = await call('portalGpAdd', ['pat', '1234', staffApp.id, { dept: 'Campus Leadership', ministry: 'Campus Director' }]);
ok('only an admin may add someone to Campus Leadership', r.body.ok === false && r.body.err === 'clt_admin');
r = await call('portalGpAdd', ['pat', '1234', staffApp.id, { dept: 'Leadership Development', ministry: 'GPDTS', staffType: 'campus' }]);
const arno2 = mem.staff.find(x => x.id === 'ap_arno');
ok('Add to the GP app: their portal account becomes a staff account, where the inviter put them', r.body.ok && arno2.kind === 'staff' && !arno2.applicant && arno2.dept === 'Leadership Development' && arno2.ministry === 'GPDTS' && arno2.staffType === 'campus' && arno2.active === true && arno2.fromCand === staffApp.id, JSON.stringify(r.body).slice(0, 120));
ok('the application is marked done', mem.candidates.find(c => c.id === staffApp.id).hired.staffId === 'ap_arno' && mem.candidates.find(c => c.id === staffApp.id).stage === 'arrived');
ok('the same sign-in opens the GP app — no username or PIN', (await call('getMyBoot', ['arno@example.org', arnoTok])).body.ok === true);
pb = (await call('portalBoot', ['arno@example.org', arnoTok])).body;
ok('on GPDTS now, the portal opens for them as staff — DTS applicants only', pb.ok && pb.role === 'portal-staff' && JSON.stringify(pb.scope) === '["student:dts"]');
mem.staff = mem.staff.map(x => x.id === 'ap_arno' ? { ...x, dept: 'Skills Training', ministry: 'Cafe' } : x);
pb = (await call('portalBoot', ['arno@example.org', arnoTok])).body;
ok('anywhere else, the portal sends them to the GP app', pb.ok === false && pb.err === 'staff_now');
r = await call('portalGpAdd', ['pat', '1234', staffApp.id, {}]);
ok('and it can’t happen twice', r.body.ok === false && r.body.err === 'hired');
const noAcct = mem.candidates.find(c => c.id === 'c_staff');
mem.candidates = mem.candidates.map(c => c.id === 'c_staff' ? { ...c, stage: 'accepted' } : c);
r = await call('portalGpAdd', ['pat', '1234', noAcct.id, {}]);
ok('someone with no portal account needs one first', r.body.ok === false && r.body.err === 'no_account');

console.log('\n=== staff sign in with Google ===');
{
  let INFO = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: !!INFO, json: async () => INFO });
  process.env.GP_GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
  const soon = String(Math.floor(Date.now() / 1000) + 600);
  const gInfo = (email, sub) => ({ aud: 'cid.apps.googleusercontent.com', iss: 'https://accounts.google.com', email, email_verified: 'true', exp: soon, name: 'G ' + email, sub });
  ok('the boot says Google is on', (await call('getMyBoot', ['dee', '1234'])).body.googleId === 'cid.apps.googleusercontent.com');
  mem.staff = mem.staff.map(x => x.id === 'st_dts' ? { ...x, email: 'dee@example.org' } : x);
  INFO = gInfo('dee@example.org', 'g-dee');
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('a staff email signs in with Google, and gets a device token', r.body.ok && r.body.user === 'dee' && /^[a-f0-9]{48}$/.test(r.body.token), JSON.stringify(r.body).slice(0, 100));
  ok('that token works like the PIN', (await call('getMyBoot', ['dee', r.body.token])).body.ok === true);
  INFO = gInfo('other@gmail.com', 'g-cal');
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('an email with no profile is told to sign up', r.body.ok === false && r.body.err === 'new' && r.body.email === 'other@gmail.com');
  r = await call('staffLinkGoogle', ['cal', '1234', 'a.b.c']);
  ok('signed in with a PIN, they connect a Google account with a different email', r.body.ok && /^[a-f0-9]{48}$/.test(r.body.token));
  ok('the profile keeps its own email; the Google account is tied by its id', mem.staff.find(x => x.id === 'st_cafe').google.sub === 'g-cal');
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('from then on that Google account opens that profile', r.body.ok && r.body.user === 'cal');
  r = await call('staffLinkGoogle', ['bea', '1234', 'a.b.c']);
  ok('the same Google account can’t be tied to a second profile', r.body.ok === false && r.body.err === 'email_taken');
  INFO = gInfo('newbie@gmail.com', 'g-new');
  r = await call('staffRegister', [{ googleToken: 'a.b.c', name: 'New Person', campus: 'siemreap', dept: 'Skills Training', ministry: 'Cafe' }]);
  const newbie = mem.staff.find(x => x.username === 'newbie');
  ok('sign up with Google: no username or PIN to pick — and it waits for an admin', r.body.ok && r.body.pending === true && newbie && !newbie.pinHash && newbie.google.sub === 'g-new' && newbie.active === false, JSON.stringify(r.body).slice(0, 120));
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('until approved, Continue with Google says it is waiting', r.body.ok === false && r.body.err === 'pending');
  r = await call('adminSetActive', ['admin', '1234', newbie.id, true]);
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('once approved, Continue with Google signs them in', r.body.ok && r.body.user === 'newbie');
  r = await call('staffRegister', [{ googleToken: 'a.b.c', name: 'Again', campus: 'siemreap', dept: 'Skills Training', ministry: 'Cafe' }]);
  ok('the same Google email can’t make a second profile', r.body.ok === false && r.body.err === 'email_taken');
  INFO = null;
  r = await call('staffLoginGoogle', ['a.b.c']);
  ok('a token Google doesn’t vouch for is refused', r.body.ok === false && r.body.err === 'google');
  r = await call('staffLogin', ['arno@example.org', arnoTok]);
  ok('an email can go in the username box, and the answer names the username', r.body.ok && r.body.user === 'arno@example.org');
  globalThis.fetch = realFetch; delete process.env.GP_GOOGLE_CLIENT_ID;
}

console.log('\n=== the hourly sync ===');
const out = await api.runDtsSync();
ok('runs for Siem Reap', out && 'siemreap' in out);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
