/* Quarterly snapshots of the org structure.

   Against the real api.js: only an admin saves; the snapshot is built on
   the server from the active staff of that campus (names included, so it
   still renders after someone leaves); saving the same quarter again
   replaces it; reading a quarter nobody saved answers with the latest
   earlier snapshot marked 'copied', or nothing; campuses are separate. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('structure');
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
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/library-audio-lib.js');  // the Library audio index (api.js imports it)
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_admin', name: 'Uriah', username: 'uriah', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true }),
  withPin({ id: 'st_lead', name: 'Sreilea', username: 'sreilea', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, leads: ['Community Service|Cafe'], role: 'Cafe manager', photo: 'data:image/png;base64,xxxx' }),
  withPin({ id: 'st_dara', name: 'Dara', username: 'dara', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_pend', name: 'Pending', username: 'pend', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Community Service', active: false }),
  withPin({ id: 'st_gone', name: 'Gone', username: 'gone', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: false, archived: { at: '2026-01-01', reason: 'left' } }),
  withPin({ id: 'st_pp', name: 'Bopha', username: 'bopha', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_appl', name: 'Anna Applicant', username: 'anna.a', campus: 'siemreap', dept: '', ministry: '', active: true, kind: 'applicant', applicant: { type: 'student', school: 'dts' } }),
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

console.log('=== nothing saved yet ===');
let r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 3]);
ok('anyone signed in may read; with nothing saved the answer is none', r.body.ok === true && r.body.doc === null && r.body.source === 'none' && r.body.year === 2026 && r.body.quarter === 3, JSON.stringify(r.body));
r = await call('saveStructure', ['dara', '1234', 'siemreap', 2026, 3]);
ok('an ordinary member cannot save a snapshot', r.body.ok === false && !mem.structure);
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 9]);
ok('a quarter outside 1–4 is refused', r.body.ok === false && r.body.err === 'bad_quarter');

console.log('\n=== the admin saves a snapshot ===');
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 3]);
ok('the admin saves Q3 2026', r.body.ok === true && r.body.source === 'saved' && r.body.doc.quarter === 3);
const snap = r.body.doc;
ok('it is built on the server from the campus’s ACTIVE people — not the pending sign-up, not the archived one, not the other campus', snap.people.length === 3 && snap.people.every(p => ['st_admin', 'st_lead', 'st_dara'].includes(p.id)), snap.people.map(p => p.id).join(','));
const lead = snap.people.find(p => p.id === 'st_lead');
ok('each person carries what the chart draws: name, department, ministry, role, leads', lead.name === 'Sreilea' && lead.dept === 'Community Service' && lead.ministry === 'Cafe' && lead.role === 'Cafe manager' && lead.leads[0] === 'Community Service|Cafe', JSON.stringify(lead));
ok('but not their photo (a snapshot is small)', lead.photo === '' && !JSON.stringify(snap).includes('base64'));
ok('and who saved it, when', snap.savedBy === 'st_admin' && /^\d{4}-/.test(snap.savedAt));
ok('one row in the store', mem.structure.length === 1);

console.log('\n=== reading back, copying forward, replacing ===');
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 3]);
ok('the saved quarter reads back as saved', r.body.source === 'saved' && r.body.doc.people.length === 3);
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 4]);
ok('the next quarter, unsaved, shows Q3’s snapshot marked copied', r.body.source === 'copied' && r.body.doc.quarter === 3 && r.body.quarter === 4);
r = await call('getStructure', ['dara', '1234', 'siemreap', 2027, 1]);
ok('a new year copies forward from the last quarter of the old one', r.body.source === 'copied' && r.body.doc.year === 2026 && r.body.doc.quarter === 3);
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 2]);
ok('an earlier quarter never copies from a later one', r.body.source === 'none' && r.body.doc === null);
r = await call('getStructure', ['bopha', '1234', 'poipet', 2026, 4]);
ok('the other campus has its own snapshots and copies nothing from Siem Reap', r.body.source === 'none');
// someone leaves, someone moves; a new snapshot for Q4 records it, Q3 keeps the old picture
mem.staff = mem.staff.map(s => s.id === 'st_dara' ? { ...s, active: false, archived: { at: '2026-10-01', reason: 'left' } } : s.id === 'st_lead' ? { ...s, dept: 'Youth Education', ministry: 'GP Media', leads: [] } : s);
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 4]);
ok('Q4 saved after the changes has two people, one moved', r.body.ok === true && r.body.doc.people.length === 2 && r.body.doc.people.find(p => p.id === 'st_lead').ministry === 'GP Media');
r = await call('getStructure', ['uriah', '1234', 'siemreap', 2026, 3]);
ok('Q3 still shows the picture as it was — Dara there, Sreilea in the Cafe', r.body.doc.people.length === 3 && r.body.doc.people.find(p => p.id === 'st_lead').ministry === 'Cafe');
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 4]);
ok('saving the same quarter again replaces it rather than adding a row', r.body.ok === true && mem.structure.length === 2);

console.log('\n=== portal applicants are never on the chart ===');
mem.staff = mem.staff.map(x => x.id === 'st_dara' ? { ...x, active: true, archived: null } : x);   // an earlier block archived her
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 3]);
ok('a snapshot leaves applicant accounts out', r.body.ok === true && !r.body.doc.people.some(p => p.id === 'st_appl'));
mem.structure.find(x => x.year === 2026 && x.quarter === 3).people.push({ id: 'st_appl', name: 'Anna Applicant', dept: '', ministry: '', role: '', leads: [] });
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 3]);
ok('and one saved before that rule reads back without them', r.body.ok === true && !r.body.doc.people.some(p => p.id === 'st_appl'));

console.log('\n=== staff who are students for one quarter ===');
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 4]);
ok('a quarter with no plan answers an empty students list and no arrangement', r.body.ok === true && JSON.stringify(r.body.plan.students) === '{}' && JSON.stringify(r.body.plan.place) === '{}' && r.body.plan.inherited === false);
r = await call('saveStructurePlan', ['dara', '1234', 'siemreap', 2026, 4, { st_dara: 'bcs' }]);
ok('only an admin sets it', r.body.ok === false && !mem.structurePlans);
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2026, 4, { st_dara: 'BCS', st_lead: 'dts', st_pp: 'bcs', st_appl: 'dts', st_gone: 'bcs', st_admin: 'cooking' }]);
ok('the admin marks Dara in the BCS and Sreilea in the DTS for Q4; other campuses, applicants, archived people and unknown schools are dropped', r.body.ok === true && JSON.stringify(r.body.plan.students) === JSON.stringify({ st_dara: 'bcs', st_lead: 'dts' }), JSON.stringify(r.body.plan));
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 4]);
ok('anyone reads it back with the quarter', r.body.plan.students.st_dara === 'bcs');
r = await call('getStructure', ['dara', '1234', 'siemreap', 2026, 3]);
ok('it is for that quarter only', JSON.stringify(r.body.plan.students) === '{}');
ok('and nobody’s profile changed', mem.staff.find(x => x.id === 'st_dara').ministry === 'Cafe' && !mem.staff.find(x => x.id === 'st_dara').student);
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2026, 4]);
ok('saving Q4 carries who is a student in the snapshot', r.body.doc.people.find(p => p.id === 'st_dara').student === 'bcs' && r.body.doc.people.find(p => p.id === 'st_lead').student === 'dts' && !r.body.doc.people.find(p => p.id === 'st_admin').student);
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2026, 4, { st_dara: 'bcs' }]);
ok('changing the plan updates a snapshot already saved for that quarter', r.body.ok === true && r.body.doc.people.find(p => p.id === 'st_lead').student === undefined && mem.structure.find(x => x.year === 2026 && x.quarter === 4).people.find(p => p.id === 'st_dara').student === 'bcs');

console.log('\n=== the chart’s own arrangement, separate from profiles ===');
r = await call('saveStructurePlan', ['dara', '1234', 'siemreap', 2027, 1, undefined, { st_dara: { dept: 'Youth Education', ministry: 'GP Media' } }]);
ok('only an admin arranges the chart', r.body.ok === false);
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2027, 1, undefined, { st_dara: { dept: 'Youth Education', ministry: 'GP Media' }, st_pp: { dept: 'Youth Education', ministry: 'YDC' }, st_appl: { dept: 'Youth Education', ministry: 'YDC' }, st_lead: { ministry: 'no department' } }]);
ok('the admin moves Dara to GP Media for Q1 2027; other campuses, applicants and a place without a department are dropped', r.body.ok === true && JSON.stringify(r.body.plan.place) === JSON.stringify({ st_dara: { dept: 'Youth Education', ministry: 'GP Media' } }), JSON.stringify(r.body.plan.place));
ok('her profile is untouched', mem.staff.find(x => x.id === 'st_dara').dept === 'Community Service' && mem.staff.find(x => x.id === 'st_dara').ministry === 'Cafe');
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2027, 1, { st_lead: 'sms' }]);
ok('saving students alone keeps the arrangement', r.body.plan.place.st_dara.ministry === 'GP Media' && r.body.plan.students.st_lead === 'sms');
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2027, 1, undefined, { st_dara: { dept: 'Youth Education', ministry: 'GP Media' }, st_admin: { dept: 'Campus Leadership', ministry: 'Campus Director' } }]);
ok('and saving the arrangement alone keeps the students', r.body.plan.students.st_lead === 'sms' && r.body.plan.place.st_admin.ministry === 'Campus Director');
r = await call('getStructure', ['sreilea', '1234', 'siemreap', 2027, 2]);
ok('the next quarter starts from that arrangement (not its students)', r.body.plan.inherited === true && r.body.plan.from.quarter === 1 && r.body.plan.place.st_dara.ministry === 'GP Media' && JSON.stringify(r.body.plan.students) === '{}');
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2027, 1]);
const q1p = r.body.doc.people.find(p => p.id === 'st_dara');
ok('a snapshot saved for that quarter follows the arrangement', q1p.dept === 'Youth Education' && q1p.ministry === 'GP Media');
r = await call('saveStructurePlan', ['uriah', '1234', 'siemreap', 2027, 1, undefined, {}]);
ok('clearing the arrangement puts people back where their profile says, in the saved snapshot too', JSON.stringify(r.body.plan.place) === '{}' && r.body.doc.people.find(p => p.id === 'st_dara').ministry === 'Cafe');

console.log('=== the structure whiteboard (Nov 2026): Campus Leadership edits, leaders and typed-in names per quarter ===');
mem.staff.push(withPin({ id: 'st_clt', name: 'Kosal', username: 'kosal', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Youth Education', active: true }));
r = await call('saveStructurePlan', ['kosal', '1234', 'poipet', 2027, 2, undefined, { st_pp: { dept: 'Youth Education', ministry: 'YDC' } }]);
ok('Campus Leadership may not arrange the other campus', r.body.ok === false && r.body.err === 'not_authorized', JSON.stringify(r.body));
r = await call('saveStructurePlan', ['dara', '1234', 'siemreap', 2027, 2, undefined, {}, {}, []]);
ok('nor may an ordinary staff member arrange their own', r.body.ok === false && r.body.err === 'not_authorized');
const profBefore = JSON.stringify(mem.staff.map(x => [x.id, x.dept, x.ministry, x.leads]));
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 2, { st_dara: 'dts' },
  { st_dara: { dept: 'Community Service', ministry: 'Cafe' }, st_lead: { dept: '_off', ministry: '' }, x_newperson1: { dept: 'Youth Education', ministry: 'GP Media' }, x_bad: { dept: 'Youth Education', ministry: 'YDC' } },
  { 'Youth Education|GP Media': ['x_newperson1', 'st_pp', 'st_gone', 'x_newperson1'], 'Community Service|Cafe': ['st_dara'], 'nonsense': ['st_dara'] },
  [{ id: 'x_newperson1', name: '  Sophea (coming in January)  ' }, { id: 'bad id', name: 'Nope' }, { id: 'x_noname1', name: '' }]]);
const pl = r.body.plan || {};
ok('Campus Leadership arranges its own campus: the quarter is saved', r.body.ok === true, JSON.stringify(r.body).slice(0, 200));
ok('a name typed in for someone not in the app is kept, cleaned; bad ids and empty names are not', JSON.stringify(pl.extra) === JSON.stringify([{ id: 'x_newperson1', name: 'Sophea (coming in January)' }]), JSON.stringify(pl.extra));
ok('… and sits in the arrangement like anyone; a place for an unknown id is dropped', pl.place.x_newperson1 && pl.place.x_newperson1.ministry === 'GP Media' && !pl.place.x_bad);
ok('“not on the chart this quarter” is kept as its own place', pl.place.st_lead && pl.place.st_lead.dept === '_off');
ok('who leads what this quarter: only people here, once each; keys that aren’t a ministry are dropped', JSON.stringify(pl.leads) === JSON.stringify({ 'Youth Education|GP Media': ['x_newperson1'], 'Community Service|Cafe': ['st_dara'] }), JSON.stringify(pl.leads));
ok('nobody’s profile moved', JSON.stringify(mem.staff.map(x => [x.id, x.dept, x.ministry, x.leads])) === profBefore);
r = await call('getStructure', ['dara', '1234', 'siemreap', 2027, 3]);
ok('the next quarter starts from it — leaders and typed-in names too (students do not carry over)', r.body.plan.inherited === true && r.body.plan.leads['Youth Education|GP Media'][0] === 'x_newperson1' && r.body.plan.extra.length === 1 && JSON.stringify(r.body.plan.students) === '{}', JSON.stringify(r.body.plan).slice(0, 220));
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 2, undefined, undefined]);
ok('saving without leaders or names keeps the quarter’s own', r.body.ok && r.body.plan.extra.length === 1 && r.body.plan.leads['Community Service|Cafe'][0] === 'st_dara');
r = await call('saveStructure', ['uriah', '1234', 'siemreap', 2027, 2]);
const ppl = (r.body.doc && r.body.doc.people) || [];
ok('a snapshot of the quarter carries the typed-in name and the quarter’s leaders', ppl.some(p => p.id === 'x_newperson1' && p.extra && p.ministry === 'GP Media' && p.leads[0] === 'Youth Education|GP Media') && JSON.stringify(ppl.find(p => p.id === 'st_lead').leads) === '[]' && ppl.find(p => p.id === 'st_lead').dept === '_off', JSON.stringify(ppl.map(p => [p.id, p.dept, p.ministry, p.leads])));
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 2, undefined, {}, null, []]);
ok('back to the profiles: leaders null, no names, no places', r.body.ok && r.body.plan.leads === null && r.body.plan.extra.length === 0 && JSON.stringify(r.body.plan.place) === '{}');

console.log('=== which schools run in the quarter (Nov 2026, Andrew: "in Q1, we only have the GPDTS school running") ===');
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 1, undefined, undefined, undefined, undefined, ['GPDTS', 'Nope', 'GPDTS', 'Cafe']]);
ok('the schools running are kept: only real schools, once each', r.body.ok && JSON.stringify(r.body.plan.schools) === '["GPDTS"]', JSON.stringify(r.body.plan && r.body.plan.schools));
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 1, undefined, { st_dara: { dept: 'Leadership Development', ministry: 'GPDTS' } }]);
ok('saving without them keeps the quarter’s', r.body.ok && JSON.stringify(r.body.plan.schools) === '["GPDTS"]');
r = await call('getStructure', ['dara', '1234', 'siemreap', 2027, 2]);
ok('a quarter with its own plan from before has no school list: every school', r.body.plan.schools === null, JSON.stringify(r.body.plan.schools));
r = await call('saveStructurePlan', ['kosal', '1234', 'siemreap', 2027, 1, undefined, undefined, undefined, undefined, null]);
ok('null puts every school back', r.body.ok && r.body.plan.schools === null);
r = await call('saveStructurePlan', ['dara', '1234', 'siemreap', 2027, 1, undefined, undefined, undefined, undefined, ['GPDTS']]);
ok('only Campus Leadership and admins can set them', r.body.ok === false && r.body.err === 'not_authorized');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
