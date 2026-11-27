/* The school tool (YDC, Nov 2026, Uriah), against the real api.js: who may open it (the ministry's own
   people, its department's director, admins — never someone outside it, an applicant or another
   campus), what setting up needs, every record cleaned and capped, the roll replaced rather than added
   to (so a phone sending the same roll twice changes nothing), photos in their own blobs, nothing of it
   on the roster or getData, and YDC's numbers counting themselves without touching a typed one.
   Every name here is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('school');
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
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_lead', name: 'Lina Leader', username: 'lina', dept: 'Youth Education', ministry: 'YDC', leads: ['Youth Education|YDC'] }),
  withPin({ id: 'st_teach', name: 'Tom Teacher', username: 'tom', dept: 'Youth Education', ministry: 'YDC' }),
  withPin({ id: 'st_other', name: 'Mia Other', username: 'mia', dept: 'Community Service', ministry: 'Cafe', ministries: ['Youth Education|YDC'] }),
  withPin({ id: 'st_cafe', name: 'Cal Fay', username: 'cal', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_dir', name: 'Dan Director', username: 'dan', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  withPin({ id: 'st_adm', name: 'Ada Admin', username: 'ada', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  withPin({ id: 'st_pp', name: 'Pip Poipet', username: 'pip', campus: 'poipet', dept: 'Youth Education', ministry: 'YDC' }),
  withPin({ id: 'ap_x', name: 'App Licant', username: 'app', kind: 'applicant', applicant: { type: 'student', school: 'dts', candidateId: 'c1' } }),
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
const pnpDay = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = pnpDay(Date.now());
const dayAdd = (n) => pnpDay(Date.now() + n * 86400000);
const SC = { dept: 'Youth Education', ministry: 'YDC' };
const KEY = 'siemreap:Youth Education|YDC';
const B64 = 'A'.repeat(400);
const rows = (m) => (mem.entries || []).filter(r => r.campus === 'siemreap' && r.ministry === 'YDC' && r.metric === m);

console.log('=== who may open it ===');
{
  let r = await call('schoolBoard', ['tom', '1234', SC]);
  ok('a YDC member opens it', r.body && r.body.ok === true && r.body.canSetup === false);
  r = await call('schoolBoard', ['lina', '1234', SC]);
  ok('its leader can set it up', r.body && r.body.ok && r.body.canSetup === true);
  r = await call('schoolBoard', ['dan', '1234', SC]);
  ok('the department director can set it up', r.body && r.body.ok && r.body.canSetup === true);
  r = await call('schoolBoard', ['mia', '1234', SC]);
  ok('someone with YDC as another ministry opens it', r.body && r.body.ok === true);
  r = await call('schoolBoard', ['cal', '1234', SC]);
  ok('someone outside YDC cannot', r.body && r.body.ok === false && r.body.err === 'not_authorized');
  r = await call('schoolBoard', ['app', '1234', SC]);
  ok('an applicant cannot', r.body && r.body.ok === false && !r.body.data);
  r = await call('schoolBoard', ['tom', '9999', SC]);
  ok('a wrong PIN cannot', r.body && r.body.ok === false && !r.body.data);
  r = await call('schoolBoard', ['tom', '1234', { dept: 'Community Service', ministry: 'Cafe' }]);
  ok('a ministry with no school tool is refused', r.body && r.body.err === 'no_school');
  r = await call('schoolBoard', ['tom', '1234', { ...SC, campus: 'poipet' }]);
  ok('staff cannot open another campus', r.body && r.body.err === 'not_authorized');
  r = await call('schoolBoard', ['ada', '1234', { ...SC, campus: 'siemreap' }]);
  ok('an admin can open another campus', r.body && r.body.ok && r.body.campus === 'siemreap' && r.body.canSetup);
  r = await call('schoolBoard', ['pip', '1234', SC]);
  ok("Poipet's YDC is its own school", r.body && r.body.ok && r.body.campus === 'poipet');
}

console.log('=== setting up ===');
let locId, clsId, cls2;
{
  let r = await call('schoolSave', ['tom', '1234', SC, 'location', { name: 'Village hall' }]);
  ok('a member cannot add a location', r.body && r.body.err === 'not_setup');
  r = await call('schoolSave', ['lina', '1234', SC, 'location', { name: '' }]);
  ok('a location needs a name', r.body && r.body.err === 'name_needed');
  r = await call('schoolSave', ['lina', '1234', SC, 'location', { name: '  Village hall  ', notes: 'x'.repeat(900) }]);
  locId = r.body && r.body.saved;
  ok('the leader adds a location, trimmed and capped', r.body && r.body.ok && r.body.data.locations[0].name === 'Village hall' && r.body.data.locations[0].notes.length === 300);
  r = await call('schoolSave', ['lina', '1234', SC, 'class', { name: 'Level 1', locationId: 'nope' }]);
  ok('a class needs a real location', r.body && r.body.err === 'bad_location');
  r = await call('schoolSave', ['lina', '1234', SC, 'class', { name: 'Level 1', locationId: locId, teacherId: 'st_teach', days: [1, 3, 3, 9, 'x'], time: '16:00' }]);
  clsId = r.body && r.body.saved;
  const c = r.body.data.classes[0];
  ok('a class keeps a teacher on the campus, real days once each, the time', c && c.teacherId === 'st_teach' && JSON.stringify(c.days) === '[1,3]' && c.time === '16:00');
  r = await call('schoolSave', ['lina', '1234', SC, 'class', { name: 'Level 2', locationId: locId, teacherId: 'st_pp', teacherName: 'Guest Teacher', time: '25:00' }]);
  cls2 = r.body.saved;
  const c2 = r.body.data.classes.find(x => x.id === cls2);
  ok('a teacher from another campus is not kept; a typed name is', c2.teacherId === '' && c2.teacherName === 'Guest Teacher' && c2.time === '');
  r = await call('schoolSave', ['lina', '1234', SC, 'settings', { passMark: 60, fee: { amount: 5, per: 'month' }, terms: [{ name: 'Term 1', from: '2026-01-05', to: '2026-03-31' }, { name: 'Bad', from: '2026-05-01', to: '2026-04-01' }] }]);
  ok('settings: pass mark, fee, terms (a backwards one dropped)', r.body.ok && r.body.data.settings.passMark === 60 && r.body.data.settings.fee.amount === 5 && r.body.data.settings.terms.length === 1);
  r = await call('schoolSave', ['tom', '1234', SC, 'settings', { passMark: 10 }]);
  ok('a member cannot change the settings', r.body.err === 'not_setup');
  r = await call('schoolSave', ['lina', '1234', SC, 'nope', {}]);
  ok('an unknown kind is refused', r.body.err === 'bad_kind');
}

console.log('=== students ===');
let s1, s2, s3;
{
  let r = await call('schoolSave', ['tom', '1234', SC, 'student', { kh: '', en: '' }]);
  ok('a student needs a name', r.body.err === 'name_needed');
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { kh: 'សុខា', en: 'Sokha Test', sex: 'f', dob: '2012-02-30', classId: clsId, start: dayAdd(-60), guardian: 'Mum Test', guardianPhone: '012 345 678', notes: 'n'.repeat(5000), fee: { mode: 'discount', amount: 2 }, hasPhoto: true }]);
  s1 = r.body.saved;
  const st = r.body.data.students.find(x => x.id === s1);
  ok('a member adds a student, cleaned', st && st.sex === 'f' && st.dob === '' && st.notes.length === 1000 && st.fee.mode === 'discount' && st.fee.amount === 2 && st.hasPhoto === false);
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { en: 'Bopha Test', sex: 'x', classId: clsId, start: dayAdd(-60), fee: { mode: 'free', amount: 9 } }]);
  s2 = r.body.saved;
  ok('a sponsored student owes nothing (amount 0)', r.body.data.students.find(x => x.id === s2).fee.amount === 0);
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { en: 'Dara Test', classId: clsId, start: dayAdd(-60) }]);
  s3 = r.body.saved;
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { en: 'X', classId: 'nope' }]);
  ok('a student needs a real class', r.body.err === 'bad_class');
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { id: 'ghost', en: 'X' }]);
  ok('editing a student that is not there is refused', r.body.err === 'not_found');
}

console.log('=== photos ===');
{
  let r = await call('schoolPhoto', ['tom', '1234', SC, 'student', s1, 'not base64!', B64]);
  ok('a bad file is refused', r.body.err === 'bad_file');
  r = await call('schoolPhoto', ['tom', '1234', SC, 'student', s1, 'A'.repeat(500 * 1024), B64]);
  ok('a photo too large is refused', r.body.err === 'too_large');
  r = await call('schoolPhoto', ['tom', '1234', SC, 'student', s1, B64, B64]);
  ok('a student photo is kept in its own blob, the thumb in the thumbs blob', r.body.ok && mem['schphoto:' + KEY + ':' + s1] && mem['schthumbs:' + KEY][s1] === B64 && r.body.thumbs[s1] === B64);
  ok('the student list itself holds no picture', !JSON.stringify(mem['school:' + KEY]).includes(B64) && r.body.data.students.find(x => x.id === s1).hasPhoto === true);
  r = await call('schoolPhotoGet', ['tom', '1234', SC, s1]);
  ok('the full photo opens', r.body.ok && r.body.data === B64);
  r = await call('schoolPhotoGet', ['cal', '1234', SC, s1]);
  ok('not for someone outside YDC', r.body.ok === false && !r.body.data);
  r = await call('schoolPhotoGet', ['pip', '1234', SC, s1]);
  ok("not from the other campus's YDC", r.body.ok === false && !r.body.data);
}

console.log('=== the roll ===');
{
  let r = await call('schoolRoll', ['tom', '1234', SC, clsId, dayAdd(1), { [s1]: 'p' }]);
  ok('tomorrow is refused', r.body.err === 'bad_date');
  r = await call('schoolRoll', ['tom', '1234', SC, clsId, dayAdd(-15), { [s1]: 'p' }]);
  ok('more than a fortnight ago is refused', r.body.err === 'bad_date');
  r = await call('schoolRoll', ['tom', '1234', SC, 'nope', TODAY, { [s1]: 'p' }]);
  ok('a real class is needed', r.body.err === 'bad_class');
  r = await call('schoolRoll', ['tom', '1234', SC, clsId, TODAY, { [s1]: 'p', [s2]: 'a', [s3]: 'l', ghost: 'p', [s1 + 'x']: 'p' }]);
  ok('the roll is saved, unknown students and marks dropped', r.body.ok && r.body.rolls.length === 1 && Object.keys(r.body.rolls[0].marks).length === 3);
  const before = JSON.stringify(mem['schoolRoll:' + KEY].rolls);
  r = await call('schoolRoll', ['tom', '1234', SC, clsId, TODAY, { [s1]: 'p', [s2]: 'a', [s3]: 'l' }]);
  const after = mem['schoolRoll:' + KEY].rolls;
  ok('sending the same roll again replaces it (one roll for that class and day)', r.body.ok && Object.keys(after).length === 1 && JSON.stringify(Object.values(after)[0].marks) === JSON.stringify(Object.values(JSON.parse(before))[0].marks));
  await call('schoolRoll', ['tom', '1234', SC, clsId, dayAdd(-1), { [s1]: 'p', [s2]: 'p' }]);
  ok('Days with Classes counts the days with a roll', rows('Days with Classes').reduce((a, x) => a + x.value, 0) >= 1 && rows('Days with Classes').every(x => x.by === 'tool:school'));
  ok('… and each row carries the days the roll was taken, so taking the roll counts toward the team streak (Today)', rows('Days with Classes').every(x => Array.isArray(x.days) && x.days.length === x.value && x.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d))), rows('Days with Classes'));
}

console.log('=== tests ===');
let tId;
{
  let r = await call('schoolSave', ['tom', '1234', SC, 'test', { classId: clsId, subject: 'Maths', date: TODAY, outOf: 0 }]);
  ok('a test needs a total', r.body.err === 'bad_out_of');
  r = await call('schoolSave', ['tom', '1234', SC, 'test', { classId: clsId, subject: 'Maths', date: TODAY, outOf: 20, scores: { [s1]: 15, [s2]: 8, [s3]: '', ghost: 10, [s1 + 'y']: 3 } }]);
  tId = r.body.saved;
  const t = r.body.data.tests.find(x => x.id === tId);
  ok('scores kept for real students, blank is absent', t && Object.keys(t.scores).length === 2 && t.scores[s1] === 15);
  r = await call('schoolSave', ['tom', '1234', SC, 'test', { id: tId, classId: clsId, subject: 'Maths', date: TODAY, outOf: 20, scores: { [s1]: 25 } }]);
  ok('a score over the total is dropped', !('s1' in r.body.data.tests.find(x => x.id === tId).scores) && Object.keys(r.body.data.tests.find(x => x.id === tId).scores).length === 0);
  r = await call('schoolSave', ['tom', '1234', SC, 'test', { id: tId, classId: clsId, subject: 'Maths', date: TODAY, outOf: 20, scores: { [s1]: 15, [s2]: 8, [s3]: 12 } }]);
  ok('Tests Held counts it', rows('Tests Held').length === 1 && rows('Tests Held')[0].value === 1);
  ok('Passing Rate: 2 of 3 at 60% (the pass mark)', rows('Passing Rate (%)')[0] && rows('Passing Rate (%)')[0].value === 67);
  r = await call('schoolPhoto', ['tom', '1234', SC, 'paper', tId, B64]);
  const pid = r.body.photoId;
  ok('a photo of the marked papers is kept on its own', r.body.ok && r.body.data.tests.find(x => x.id === tId).papers[0] === pid && mem['schphoto:' + KEY + ':' + pid]);
  r = await call('schoolPhotoGet', ['tom', '1234', SC, pid]);
  ok('and opens', r.body.ok && r.body.data === B64);
}

console.log('=== payments and events ===');
{
  const ym = TODAY.slice(0, 7);
  let r = await call('schoolSave', ['tom', '1234', SC, 'payment', { studentId: s1, amount: -2, date: TODAY, period: ym }]);
  ok('a negative amount is refused', r.body.err === 'bad_amount');
  r = await call('schoolSave', ['tom', '1234', SC, 'payment', { studentId: s1, amount: 2, date: TODAY, period: 'whenever' }]);
  ok('a period must be a month or a term', r.body.err === 'bad_period');
  r = await call('schoolSave', ['tom', '1234', SC, 'payment', { studentId: s1, amount: 2.005, date: TODAY, period: ym, method: 'aba', note: 'first' }]);
  ok('a payment is kept', r.body.ok && r.body.data.payments.length === 1 && r.body.data.payments[0].method === 'aba');
  r = await call('schoolDelete', ['tom', '1234', SC, 'student', s1]);
  ok('a student with payments cannot be deleted (mark them left)', r.body.err === 'in_use');
  r = await call('schoolSave', ['tom', '1234', SC, 'event', { title: 'Christmas party', date: TODAY, kind: 'party' }]);
  await call('schoolSave', ['tom', '1234', SC, 'event', { title: 'Football match', date: TODAY, kind: 'competition' }]);
  ok('Parties Thrown and Competitions Held count the events', rows('Parties Thrown')[0].value === 1 && rows('Competitions Held')[0].value === 1);
}

console.log('=== faith, levels, typed numbers ===');
{
  let r = await call('schoolSave', ['tom', '1234', SC, 'student', { id: s2, en: 'Bopha Test', classId: clsId, start: dayAdd(-60), fee: { mode: 'free' }, faith: { disc: dayAdd(-10), church: dayAdd(-3), salv: TODAY, bapt: 'not a date' } }]);
  ok('faith ticks keep real dates', r.body.data.students.find(x => x.id === s2).faith.bapt === '');
  ok('Salvations counts the salvation in its week', rows('Salvations').reduce((a, x) => a + x.value, 0) === 1);
  const thisWk = Math.max(...rows('Youth Enrolled').map(x => x.week));
  ok('Youth Enrolled is the number of active students this week', rows('Youth Enrolled').find(x => x.week === thisWk).value === 3);
  ok('Students in Discipleship is a level', rows('Students in Discipleship').find(x => x.week === thisWk).value === 1);
  // a typed number for Tests Held this week stays
  const typed = rows('Tests Held')[0];
  typed.by = 'st_teach'; typed.value = 9;
  await call('schoolSave', ['tom', '1234', SC, 'test', { classId: clsId, subject: 'Khmer', date: TODAY, outOf: 10, scores: { [s3]: 1 } }]);
  ok('a number someone typed is never overwritten', rows('Tests Held')[0].value === 9 && rows('Tests Held')[0].by === 'st_teach');
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { id: s3, en: 'Dara Test', classId: clsId, start: dayAdd(-60), status: 'left', leftOn: TODAY }]);
  ok('a student who left today is not enrolled this week', rows('Youth Enrolled').find(x => x.week === thisWk).value === 2);
  // deleting the roll's events takes the tool's own rows away
  await call('schoolRoll', ['tom', '1234', SC, clsId, TODAY, {}]);
  await call('schoolRoll', ['tom', '1234', SC, clsId, dayAdd(-1), {}]);
  ok('an emptied roll takes Days with Classes away', rows('Days with Classes').length === 0);
}

console.log('=== deleting ===');
{
  let r = await call('schoolDelete', ['lina', '1234', SC, 'location', locId]);
  ok('a location with classes cannot be deleted', r.body.err === 'in_use');
  r = await call('schoolDelete', ['lina', '1234', SC, 'class', cls2]);
  ok('an empty class can be deleted', r.body.ok && !r.body.data.classes.some(x => x.id === cls2));
  r = await call('schoolDelete', ['tom', '1234', SC, 'class', clsId]);
  ok('a member cannot delete a class', r.body.err === 'not_setup');
  const papers = mem['school:' + KEY].tests.find(x => x.id === tId).papers;
  r = await call('schoolDelete', ['tom', '1234', SC, 'test', tId]);
  ok('deleting a test takes its paper photos with it', r.body.ok && !mem['schphoto:' + KEY + ':' + papers[0]]);
  r = await call('schoolSave', ['tom', '1234', SC, 'student', { en: 'Temp Test', classId: clsId }]);
  const tmp = r.body.saved;
  await call('schoolPhoto', ['tom', '1234', SC, 'student', tmp, B64, B64]);
  r = await call('schoolDelete', ['tom', '1234', SC, 'student', tmp]);
  ok("deleting a student takes their photo and thumb", r.body.ok && !mem['schphoto:' + KEY + ':' + tmp] && !(tmp in mem['schthumbs:' + KEY]));
}

console.log('=== nothing leaks ===');
{
  let r = await call('teamRoster', ['tom', '1234']);
  ok('not on the roster', !JSON.stringify(r.body).includes('Sokha Test') && !JSON.stringify(r.body).includes('012 345 678'));
  r = await call('getData', ['']);
  ok('not in getData', !JSON.stringify(r.body).includes('Sokha Test') && !JSON.stringify(r.body).includes('Mum Test'));
  r = await call('getMyBoot', ['cal', '1234']);
  ok("not in someone else's boot", !JSON.stringify(r.body).includes('Sokha Test') && !JSON.stringify(r.body).includes(B64));
  r = await call('getMyBoot', ['tom', '1234']);
  ok('not even in the teacher’s own boot (one load when the page opens)', !JSON.stringify(r.body).includes('Mum Test'));
  r = await call('demoCall', ['schoolBoard', []]);
  ok('not in the preview', !(r.body && r.body.ok === true && r.body.data));
}

console.log('=== the community schools: their own school each, on their own campus, counting only once switched on ===');
{
  mem.staff.push(
    withPin({ id: 'cs_lead', name: 'Pola Lead', username: 'pola', dept: 'Community Service', ministry: 'Ponlork School', leads: ['Community Service|Ponlork School'] }),
    withPin({ id: 'cs_teach', name: 'Pen Teach', username: 'pen', dept: 'Community Service', ministry: 'Ponlork School' }),
    withPin({ id: 'cs_ltn', name: 'Lot Teach', username: 'lot', dept: 'Community Service', ministry: 'LTN' }),
    withPin({ id: 'cs_gpe', name: 'Gia Teach', username: 'gia', campus: 'poipet', dept: 'Community Service', ministry: 'GP Education', leads: ['Community Service|GP Education'] }));
  const PK = { dept: 'Community Service', ministry: 'Ponlork School' }, LT = { dept: 'Community Service', ministry: 'LTN' }, GE = { dept: 'Community Service', ministry: 'GP Education' };
  const PKEY = 'siemreap:Community Service|Ponlork School';
  const prow = (m, min) => (mem.entries || []).filter(r => r.ministry === (min || 'Ponlork School') && r.metric === m);
  /* who may open it — the same matrix as YDC */
  let r = await call('schoolBoard', ['pen', '1234', PK]);
  ok('a Ponlork member opens Ponlork’s school — an opt-in one', r.body && r.body.ok && r.body.canSetup === false && r.body.optIn === true && r.body.data.settings.count === false);
  ok('… with only the four metrics that truly match', JSON.stringify(r.body.metrics) === JSON.stringify(['Students Enrolled', 'Students in Discipleship', 'Salvations', 'Baptisms']));
  r = await call('schoolBoard', ['pola', '1234', PK]);
  ok('its leader can set it up', r.body && r.body.ok && r.body.canSetup === true);
  for (const [who, why] of [['lot', 'a teacher at another community school'], ['tom', 'a YDC teacher'], ['cal', 'someone at the Cafe']]) {
    r = await call('schoolBoard', [who, '1234', PK]);
    ok(why + ' cannot open Ponlork’s', r.body && r.body.ok === false && r.body.err === 'not_authorized' && !r.body.data);
  }
  r = await call('schoolBoard', ['app', '1234', PK]);
  ok('an applicant cannot', r.body && r.body.ok === false && !r.body.data);
  r = await call('schoolBoard', ['pen', '9999', PK]);
  ok('a wrong PIN cannot', r.body && r.body.ok === false && !r.body.data);
  r = await call('schoolBoard', ['ada', '1234', { ...PK, campus: 'poipet' }]);
  ok('Poipet has no Ponlork School — not even for an admin', r.body && r.body.err === 'no_school');
  r = await call('schoolBoard', ['ada', '1234', { ...GE, campus: 'siemreap' }]);
  ok('… and Siem Reap no GP Education', r.body && r.body.err === 'no_school');
  r = await call('schoolBoard', ['gia', '1234', GE]);
  ok('GP Education is Poipet’s', r.body && r.body.ok && r.body.campus === 'poipet' && r.body.optIn === true);
  r = await call('schoolBoard', ['pip', '1234', SC]);
  ok('YDC is still on both campuses, and counts as before', r.body && r.body.ok && r.body.optIn === false);

  /* a typed number from before, then the school set up and students put in */
  const wkNow = Math.max(...rows('Youth Enrolled').map(x => x.week)), yr = rows('Youth Enrolled')[0].year;
  mem.entries.push({ campus: 'siemreap', dept: 'Community Service', ministry: 'Ponlork School', metric: 'Students Enrolled', week: wkNow, year: yr, value: 120, updated: new Date().toISOString(), by: 'cs_lead' });
  r = await call('schoolSave', ['pen', '1234', PK, 'location', { name: 'Made-up village' }]);
  ok('a member cannot set up', r.body.err === 'not_setup');
  r = await call('schoolSave', ['pola', '1234', PK, 'location', { name: 'Made-up village' }]);
  const loc = r.body.saved;
  r = await call('schoolSave', ['pola', '1234', PK, 'class', { name: 'Grade 1', locationId: loc, days: [1, 3] }]);
  const cls = r.body.saved;
  r = await call('schoolSave', ['pen', '1234', PK, 'student', { en: 'Rith Madeup', classId: cls, start: dayAdd(-30), guardian: 'Aunt Madeup', guardianPhone: '011 000 111', faith: { disc: dayAdd(-5), salv: TODAY } }]);
  ok('a student goes into Ponlork’s own store', r.body.ok && mem['school:' + PKEY].students.length === 1 && !mem['school:siemreap:Community Service|LTN']);
  await call('schoolRoll', ['pen', '1234', PK, cls, TODAY, { [r.body.saved]: 'p' }]);
  ok('until it is switched on the tool writes NOTHING: the typed 120 stands alone', prow('Students Enrolled').length === 1 && prow('Students Enrolled')[0].value === 120 && prow('Students Enrolled')[0].by === 'cs_lead' && !mem.entries.some(e => e.ministry === 'Ponlork School' && e.by === 'tool:school'));
  r = await call('schoolBoard', ['lot', '1234', LT]);
  ok('LTN’s school is its own — none of Ponlork’s students, classes or rolls', r.body && r.body.ok && r.body.data.students.length === 0 && r.body.data.classes.length === 0 && r.body.rolls.length === 0 && !JSON.stringify(r.body).includes('Rith Madeup'));
  r = await call('schoolBoard', ['tom', '1234', SC]);
  ok('… and YDC sees none of them either', !JSON.stringify(r.body).includes('Rith Madeup') && !JSON.stringify(r.body).includes('Aunt Madeup'));

  /* switching the count on: its leader's */
  r = await call('schoolSave', ['pen', '1234', PK, 'settings', { count: true }]);
  ok('a member cannot switch the count on', r.body.err === 'not_setup' && !mem['school:' + PKEY].settings.count);
  r = await call('schoolSave', ['pola', '1234', PK, 'settings', { count: true }]);
  ok('its leader can', r.body.ok && r.body.data.settings.count === true);
  ok('the week with a typed number keeps it', prow('Students Enrolled').find(x => x.week === wkNow).value === 120 && prow('Students Enrolled').find(x => x.week === wkNow).by === 'cs_lead');
  ok('the weeks with none count from the tool (the student started a month ago)', prow('Students Enrolled').some(x => x.week !== wkNow && x.by === 'tool:school' && x.value === 1));
  ok('Students in Discipleship and Salvations count from their dates', prow('Students in Discipleship').some(x => x.by === 'tool:school' && x.value === 1) && prow('Salvations').reduce((a, x) => a + x.value, 0) === 1);
  ok('nothing the school has no metric for is written (no Days with Classes, Youth Enrolled, Tests Held…)', !['Days with Classes', 'Youth Enrolled', 'Tests Held', 'Passing Rate (%)', 'Parties Thrown', 'Competitions Held', 'Students Brought to Local Church'].some(m => prow(m).length));
  ok('… and nothing for another school', !mem.entries.some(e => (e.ministry === 'LTN' || e.ministry === 'Sry Noi' || e.ministry === 'GP Education')));
  const typedRow = mem.entries.find(e => e.ministry === 'Ponlork School' && e.metric === 'Students Enrolled' && e.week === wkNow);
  mem.entries.splice(mem.entries.indexOf(typedRow), 1);
  r = await call('schoolSave', ['pola', '1234', PK, 'settings', { count: false }]);
  ok('switched off again, the tool takes back everything it wrote', r.body.ok && r.body.data.settings.count === false && !mem.entries.some(e => e.ministry === 'Ponlork School'));
  mem.entries.push(typedRow);

  /* nothing leaks */
  r = await call('teamRoster', ['pen', '1234']);
  ok('not on the roster', !JSON.stringify(r.body).includes('Rith Madeup') && !JSON.stringify(r.body).includes('011 000 111'));
  r = await call('getData', ['']);
  ok('not in getData', !JSON.stringify(r.body).includes('Rith Madeup') && !JSON.stringify(r.body).includes('Aunt Madeup'));
  r = await call('getMyBoot', ['lot', '1234']);
  ok("not in another school's boot", !JSON.stringify(r.body).includes('Rith Madeup'));
  r = await call('getMyBoot', ['pen', '1234']);
  ok('not even in the teacher’s own boot', !JSON.stringify(r.body).includes('Aunt Madeup'));
  ok('a community school still gets its numbers-due reminders (it is not exempt, YDC is)', (() => { const src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8'); return /isSchoolMinistry_\(dept, ministry\) && !schoolConf_\(dept, ministry\)\.optIn/.test(src); })());
  r = await call('getMyMinistry', ['pen', '1234']);
  ok('its Scorecard payload is the ministry’s own, typed number and all', r.body && r.body.ok && r.body.ministry === 'Ponlork School' && r.body.entries['Students Enrolled'][String(wkNow)] === 120);
}

console.log('=== the two lists agree ===');
{
  const tax = fs.readFileSync(REPO + '/public/taxonomy.js', 'utf8');
  const src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
  const grab = (s) => { const m = s.match(/SCHOOL_TOOL = (\{[\s\S]*?\n\});/); return m ? m[1] : ''; };
  const norm = (s) => { try { return JSON.stringify(Function('return ' + s)()); } catch (e) { return 'x' + s; } };
  ok("SCHOOL_TOOL in taxonomy.js matches api.js's", grab(tax) && norm(grab(tax)) === norm(grab(src)));
  ok('each community school maps only metrics its own list has, on the campus that has it', (() => {
    const box = {}; Function('box', tax + '\n;box.T = SCHOOL_TOOL; box.get = getBaselineDepartments; box.auto = autoMetricsFor;')(box);
    return Object.keys(box.T).filter(k => box.T[k].optIn).every(k => { const [d, m] = k.split('|');
      return box.T[k].campuses.every(c => { const list = (box.get(c)[d] || {})[m]; return !!list && Object.values(box.T[k].metrics).every(x => list.includes(x)) && box.auto(c, d, m).length === 0; }) &&
        ['poipet', 'siemreap'].filter(c => !box.T[k].campuses.includes(c)).every(c => !(box.get(c)[d] || {})[m]); }) && Object.keys(box.T).filter(k => box.T[k].optIn).length === 4;
  })());
  ok('every YDC metric in the taxonomy counts itself', /'YDC': \['Days with Classes','Youth Enrolled','Tests Held','Passing Rate \(%\)',\s*'Parties Thrown','Competitions Held','Salvations','Baptisms',\s*'Students in Discipleship','Students Brought to Local Church'\]/.test(tax));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
