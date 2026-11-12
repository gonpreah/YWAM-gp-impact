/* GPDTS → Database (Nov 2026, Andrew), against the real api.js: schools (a year and a name) and
   everything filed under one — events, responsibilities, resources, outreach teams — plus the school
   policy; the lectures' new fields (translator, MC, who is finding the speaker; a topic with no dates
   yet); the students drawn from the portal, put in the school that starts after they applied, with
   their details and 1-on-1 kept apart from their portal answers; an outreach team's weeks counting in
   GPDTS's numbers; and who may do any of it. Every person is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('dts-db');
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
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) {
  fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
}
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_dts', name: 'Dee Teesse', username: 'dee', dept: 'Leadership Development', ministry: 'GPDTS' }),
  withPin({ id: 'st_two', name: 'Tia Two', username: 'tia', dept: 'Leadership Development', ministry: 'GPDTS' }),
  withPin({ id: 'st_cafe', name: 'Cal Fay', username: 'cal', dept: 'Community Service', ministry: 'Cafe' }),
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
const Y = Number(TODAY.slice(0, 4));
const cand = (o) => ({ campus: 'siemreap', type: 'student', school: 'dts', stage: 'applied', log: [{ at: NOW, by: 'x', kind: 'stage', text: 'applied' }], archived: null, created: NOW, updated: NOW, ...o });
mem.candidates = [
  cand({ id: 'c_a', name: 'Ana Applied', country: 'Cambodia', phone: '012 000 001', portal: { submittedAt: NOW, form: { answers: { gender: 'Female', phone: '012 000 001', guardianName: 'Mum A', guardianPhone: '012 000 002', pastorPhone: '012 000 003', email: 'ana@example.org', health: 'private', testimony: 'private story' } } } }),
  cand({ id: 'c_b', name: 'Bo Accepted', country: 'Cambodia', stage: 'accepted', portal: { submittedAt: NOW, form: { answers: { gender: 'Male' } } } }),
  cand({ id: 'c_lead', name: 'Lee Lead', stage: 'new', log: [], portal: null }),
  cand({ id: 'c_dbs', name: 'Dibs Other', school: 'dbs', portal: { submittedAt: NOW } }),
];
const rowsOf = (m) => (mem.entries || []).filter(r => r.campus === 'siemreap' && r.ministry === 'GPDTS' && r.metric === m);
const sum = (m) => rowsOf(m).reduce((a, r) => a + Number(r.value), 0);

console.log('=== who may ===');
{
  let r = await call('dtsDbSave', ['cal', '1234', 'school', { year: Y + 1, name: 'January DTS' }]);
  ok('someone outside GPDTS cannot', r.body && r.body.ok === false && r.body.err === 'not_authorized');
  r = await call('dtsDbSave', ['poi', '1234', 'school', { year: Y + 1, name: 'January DTS' }]);
  ok('a campus with no GPDTS tool cannot', r.body && r.body.err === 'no_dts');
  r = await call('dtsDbSave', ['dee', '1234', 'nope', {}]);
  ok('an unknown kind is refused', r.body && r.body.err === 'bad_kind');
}

console.log('=== a school ===');
let SID = '';
{
  let r = await call('dtsDbSave', ['dee', '1234', 'school', { year: Y + 1, name: '' }]);
  ok('a school needs a name', r.body && r.body.err === 'bad_school');
  r = await call('dtsDbSave', ['dee', '1234', 'school', { year: Y + 1, name: 'January DTS', from: (Y + 1) + '-01-12', to: (Y + 1) + '-06-20' }]);
  ok('a school is saved with its year, name and dates', r.body && r.body.ok && r.body.db.schools.length === 1 && r.body.db.schools[0].year === Y + 1 && r.body.db.schools[0].from === (Y + 1) + '-01-12', JSON.stringify(r.body));
  SID = r.body.id;
  ok('the school policy is there from the start, the default one', /1\. Come to class every day and on time/.test(r.body.db.policy) && /Live as brothers and sisters in Jesus Christ/.test(r.body.db.policy) && r.body.db.policyIsDefault === true);
  r = await call('dtsDbSave', ['dee', '1234', 'school', { year: Y, name: 'September DTS', from: dayAdd(-300), to: dayAdd(-100) }]);
  ok('schools are kept in the order they start', r.body.db.schools[0].name === 'September DTS' && r.body.db.schools[1].id === SID);
}

console.log('=== students from the portal ===');
{
  const r = await call('dtsBoard', ['dee', '1234']);
  const st = r.body.students || [];
  ok('the students are the DTS applications — not a lead, not another school', st.length === 2 && st.some(x => x.id === 'c_a') && st.some(x => x.id === 'c_b'), JSON.stringify(st.map(x => x.id)));
  const a = st.find(x => x.id === 'c_a');
  ok('someone who applied now is in the next school to start', a.schoolId === SID && a.placed === false);
  ok('their details come from the portal: sex, phone, parent, pastor, email', a.portal.sex === 'Female' && a.portal.phone === '012 000 001' && a.portal.guardianPhone === '012 000 002' && a.portal.pastorPhone === '012 000 003' && a.portal.email === 'ana@example.org');
  ok('and nothing private — no health, no story', JSON.stringify(a).indexOf('private') === -1);
  ok('the board carries the Database', r.body.db && Array.isArray(r.body.db.schools) && r.body.db.schools.length === 2);
}
{
  let r = await call('dtsStudentSave', ['dee', '1234', 'c_a', { oneOnOne: 'st_two', profile: { phone: '099 111 222', notes: 'Loves music', health: 'nope' } }]);
  ok('their 1-on-1 and details are saved', r.body && r.body.ok && r.body.student.oneOnOne === 'st_two' && r.body.student.profile.phone === '099 111 222' && r.body.student.profile.notes === 'Loves music' && !('health' in r.body.student.profile), JSON.stringify(r.body));
  const c = mem.candidates.find(x => x.id === 'c_a');
  ok('on their DTS record — their portal answers are untouched', c.dts.oneOnOne === 'st_two' && c.portal.form.answers.phone === '012 000 001' && /GPDTS: /.test(c.log[c.log.length - 1].text));
  r = await call('dtsStudentSave', ['dee', '1234', 'c_a', { oneOnOne: 'st_cafe_nobody' }]);
  ok('a 1-on-1 must be staff on the campus', r.body && r.body.err === 'bad_staff');
  r = await call('dtsStudentSave', ['dee', '1234', 'c_a', { schoolId: 'nope' }]);
  ok('a school must exist', r.body && r.body.err === 'bad_school');
  r = await call('dtsStudentSave', ['dee', '1234', 'c_dbs', { oneOnOne: 'st_two' }]);
  ok('only DTS records', r.body && r.body.err === 'not_found');
}

console.log('=== everything under the school ===');
{
  let r = await call('dtsDbSave', ['dee', '1234', 'event', { schoolId: SID, title: 'Students arrive', date: (Y + 1) + '-01-12' }]);
  ok('an event', r.body.ok && r.body.db.events.length === 1 && r.body.db.events[0].title === 'Students arrive');
  r = await call('dtsDbSave', ['dee', '1234', 'event', { schoolId: 'nope', title: 'X', date: TODAY }]);
  ok('an event must be in a school that exists', r.body.err === 'bad_event');
  r = await call('dtsDbSave', ['dee', '1234', 'resp', { schoolId: SID, when: 'before', title: 'Book the rooms', notes: 'For the speakers', staff: ['st_two', 'st_pp', 'nobody'] }]);
  ok('a responsibility before school, given to campus staff only', r.body.ok && r.body.db.resp[0].when === 'before' && JSON.stringify(r.body.db.resp[0].staff) === '["st_two"]', JSON.stringify(r.body.db.resp));
  r = await call('dtsDbSave', ['dee', '1234', 'resource', { schoolId: SID, title: 'Schedule', url: 'javascript:alert(1)' }]);
  ok('a resource link must be http(s)', r.body.err === 'bad_resource');
  r = await call('dtsDbSave', ['dee', '1234', 'resource', { schoolId: SID, title: 'Schedule', url: 'https://example.org/s' }]);
  ok('a resource', r.body.ok && r.body.db.resources[0].url === 'https://example.org/s');
  r = await call('dtsDbSave', ['dee', '1234', 'policy', { text: '1. Be kind\n* Always' }]);
  ok('the policy can be changed', r.body.ok && r.body.db.policy === '1. Be kind\n* Always' && !r.body.db.policyIsDefault);
  r = await call('dtsDbSave', ['dee', '1234', 'policy', { reset: true }]);
  ok('and put back to the default', r.body.ok && r.body.db.policyIsDefault === true);
  r = await call('dtsDbDelete', ['dee', '1234', 'school', SID]);
  ok('a school with things in it is not deleted', r.body.err === 'in_use');
}

console.log('=== the speaker schedule ===');
{
  let r = await call('dtsSaveLecture', ['dee', '1234', { schoolId: SID, topic: 'Father heart of God', finder: 'st_two' }]);
  ok('a topic with no dates and no speaker yet, and who is finding one', r.body.ok && r.body.lectures[0].topic === 'Father heart of God' && r.body.lectures[0].date === '' && r.body.lectures[0].finder === 'st_two', JSON.stringify(r.body));
  r = await call('dtsSaveLecture', ['dee', '1234', { topic: 'No school, no date' }]);
  ok('outside a school a lecture still needs its day', r.body.err === 'bad_lecture');
  r = await call('dtsSaveLecture', ['dee', '1234', { schoolId: 'nope', topic: 'Lost' }]);
  ok('the school must exist', r.body.err === 'bad_school');
  r = await call('dtsSaveLecture', ['dee', '1234', { schoolId: SID, date: (Y + 1) + '-01-19', end: (Y + 1) + '-01-23', topic: 'Worship', speaker: 'A Speaker', translator: 'Tia Two', mc: 'Dee Teesse' }]);
  ok('a dated lecture has its translator and MC, and sorts before the undated one', r.body.ok && r.body.lectures[0].topic === 'Worship' && r.body.lectures[0].translator === 'Tia Two' && r.body.lectures[0].mc === 'Dee Teesse' && r.body.lectures[1].date === '');
}

console.log('=== an outreach team, week by week ===');
{
  const start = dayAdd(-14);
  let r = await call('dtsDbSave', ['dee', '1234', 'team', { schoolId: SID, name: 'Team North',
    short: { place: 'Kampot', from: start, to: dayAdd(-1), leaders: ['st_dts', 'st_pp'], students: ['c_a', 'c_lead_x', 'c_b'], weeks: [{ male: 10, female: 12, salvations: 2, healings: 1, gospel: 30 }, { salvations: 1, gospel: 5 }, { gospel: 99 }] },
    long: { place: 'Mondulkiri', weeks: [] } }]);
  const tm = r.body.db && r.body.db.teams[0];
  ok('a team with a short and a long outreach', r.body.ok && tm.short.place === 'Kampot' && tm.long.place === 'Mondulkiri', JSON.stringify(r.body.err));
  ok('leaders are campus staff, students are DTS records', JSON.stringify(tm.short.leaders) === '["st_dts"]' && JSON.stringify(tm.short.students) === '["c_a","c_b"]');
  ok('the short outreach has as many weeks as its dates (2); the long one 8 with no dates yet', tm.short.weeks.length === 2 && tm.long.weeks.length === 8);
  ok('each week keeps males, females, salvations, healings and heard the gospel', tm.short.weeks[0].male === 10 && tm.short.weeks[0].female === 12 && tm.short.weeks[1].gospel === 5);
  ok('the weeks count in GPDTS’s numbers (a third week past the dates is not kept)', sum('Salvations') === 3 && sum('Healings') === 1 && sum('People Heard the Gospel') === 35, JSON.stringify([sum('Salvations'), sum('People Heard the Gospel')]));
  ok('… as the tool’s own rows', rowsOf('Salvations').every(x => x.by === 'tool:dts'));
  r = await call('dtsDbDelete', ['dee', '1234', 'team', tm.id]);
  ok('deleting the team takes its numbers away', r.body.ok && sum('Salvations') === 0 && sum('People Heard the Gospel') === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
