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


console.log('\n=== a person in more than one ministry; a quarter made live → profiles (Nov 2026, Uriah) ===');
const NOWD = new Date(), CY = NOWD.getUTCFullYear(), CQ = Math.floor(NOWD.getUTCMonth() / 3) + 1;
const NXT = CQ === 4 ? [CY + 1, 1] : [CY, CQ + 1], PREV = CQ === 1 ? [CY - 1, 4] : [CY, CQ - 1];
mem.staff.push(
  withPin({ id: 'pp_cl', name: 'Vanna Keo', username: 'vanna', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Community Service', active: true }),
  withPin({ id: 'pp_cd', name: 'Chan Dy', username: 'chan', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national', active: true, leads: ['Campus Leadership|Campus Director'] }),
  withPin({ id: 'pp_a', name: 'Rith Sam', username: 'rith', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true, leads: ['Community Service|Cafe'], mentorId: 'pp_b', mentorStatus: 'approved', staffType: 'campus', role: 'Barista', hr: true, country: 'Cambodia', phone: '012 000 000' }),
  withPin({ id: 'pp_b', name: 'Maly Ouk', username: 'maly', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true, ministries: ['Youth Education|YDC'] }),
  withPin({ id: 'pp_c', name: 'Sokun Im', username: 'sokun', campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', active: true }),
  withPin({ id: 'pp_d', name: 'Nita Pen', username: 'nita', campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', active: true, leads: ['Youth Education|YDC'] }),
  withPin({ id: 'pp_e', name: 'Pich Lay', username: 'pich', campus: 'poipet', dept: 'Youth Education', ministry: 'YDC', active: true }),
);
const prof = id => mem.staff.find(x => x.id === id);
const core = () => JSON.stringify(mem.staff.filter(x => x.campus === 'poipet').map(x => [x.id, x.dept, x.ministry, x.ministries || null, x.leads || null, x.cltRequest ? x.cltRequest.ministry : null, x.cdKind || '']));
const PLACE = {
  pp_cl: { dept: 'Campus Leadership', ministry: 'Community Service' }, pp_cd: { dept: 'Campus Leadership', ministry: 'Campus Director' },
  pp_a: { dept: 'Youth Education', ministry: 'YDC' }, pp_b: { dept: 'Community Service', ministry: 'Cafe' },
  pp_c: { dept: 'Campus Leadership', ministry: 'Youth Education' }, pp_d: { dept: '_off', ministry: '' }, pp_e: { dept: '_off', ministry: '' },
  st_pp: { dept: 'Community Service', ministry: 'Cafe' }, x_typed001: { dept: 'Community Service', ministry: 'Cafe' },
};
const LEADS = { 'Youth Education|YDC': ['pp_a'], 'Community Service|Cafe': ['pp_b', 'x_typed001'] };
const ALSO_A = ['Community Service|Cafe', 'Youth Education|Worship', 'Youth Education|GP Media', 'Skills Training|Culinary'];
const ALSO = {
  pp_a: ['Community Service|Cafe', 'Youth Education|YDC', 'Campus Leadership|Youth Education', 'nonsense', 'Community Service|Cafe', 'Youth Education|Worship', 'Youth Education|GP Media', 'Skills Training|Culinary', 'Skills Training|Hospitality'],
  pp_b: [], pp_d: ['Community Service|Cafe'], pp_e: ['Community Service|Cafe'], st_gone: ['Community Service|Cafe'], st_dara: ['Community Service|Cafe'],
};
const before0 = core();
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', CY, CQ, { pp_e: 'dts' }, PLACE, LEADS, [{ id: 'x_typed001', name: 'Coming Soon' }], null, ALSO]);
ok('the quarter’s plan keeps who also serves where: never the main place, never a Campus Leadership row, once each, four at most; nobody off the chart, no student, nobody from elsewhere',
  r.body.ok && JSON.stringify(r.body.plan.also) === JSON.stringify({ pp_a: ['Community Service|Cafe', 'Youth Education|Worship', 'Youth Education|GP Media', 'Skills Training|Culinary'] }), JSON.stringify(r.body.plan && r.body.plan.also));
ok('a plan that is not live writes no profile', core() === before0 && !r.body.plan.live && r.body.applied.length === 0);
ok('… and whoever arranges it hears what making it live would change', r.body.diff && r.body.diff.changes.length === 3, JSON.stringify(r.body.diff && r.body.diff.changes.map(c => c.id)));
r = await call('getStructure', ['maly', '1234', 'poipet', CY, CQ]);
ok('an ordinary staff member reads the plan (with also) but gets no list of changes', r.body.ok && r.body.plan.also.pp_a.length === 4 && r.body.diff === undefined);
r = await call('getStructure', ['vanna', '1234', 'poipet', NXT[0], NXT[1]]);
ok('the next quarter starts from it — the other ministries too — and is not live', r.body.plan.inherited === true && r.body.plan.also.pp_a.length === 4 && r.body.plan.live === null);

r = await call('applyStructure', ['maly', '1234', 'poipet', CY, CQ, { dry: true }]);
ok('an ordinary staff member cannot make a quarter live, nor look', r.body.ok === false && r.body.err === 'not_authorized');
r = await call('applyStructure', ['kosal', '1234', 'poipet', CY, CQ, {}]);
ok('nor Campus Leadership of the other campus', r.body.ok === false && r.body.err === 'not_authorized' && core() === before0);
r = await call('applyStructure', ['vanna', '1234', 'poipet', PREV[0], PREV[1], {}]);
ok('a quarter already over is refused', r.body.ok === false && r.body.err === 'past_quarter');
r = await call('applyStructure', ['vanna', '1234', 'poipet', CY, 7, {}]);
ok('and a quarter that is not one', r.body.ok === false && r.body.err === 'bad_quarter');

r = await call('applyStructure', ['vanna', '1234', 'poipet', CY, CQ, { dry: true }]);
const dry = r.body.changes || [], byC = id => dry.find(c => c.id === id);
ok('a look first lists the changes and writes nothing', r.body.ok && r.body.dry === true && core() === before0 && !mem.structurePlans.find(p => p.campus === 'poipet' && p.year === CY && p.quarter === CQ).live, JSON.stringify(dry));
ok('… the main move, the other ministries and the leading, per person', byC('pp_a') && byC('pp_a').from === 'Community Service|Cafe' && byC('pp_a').to === 'Youth Education|YDC' && byC('pp_a').alsoAdd.length === 4 &&
  JSON.stringify(byC('pp_a').leadAdd) === '["Youth Education|YDC"]' && JSON.stringify(byC('pp_a').leadDrop) === '["Community Service|Cafe"]' &&
  byC('pp_b') && !byC('pp_b').to && JSON.stringify(byC('pp_b').alsoDrop) === '["Youth Education|YDC"]' && JSON.stringify(byC('pp_b').leadAdd) === '["Community Service|Cafe"]', JSON.stringify([byC('pp_a'), byC('pp_b')]));
ok('… a move into Campus Leadership by someone who is not an admin waits for one', byC('pp_c') && byC('pp_c').waits === 'Campus Leadership|Youth Education' && !byC('pp_c').to);
ok('… nobody off the chart, no student, no typed-in name, nobody whose profile already matches', !byC('pp_d') && !byC('pp_e') && !byC('x_typed001') && !byC('pp_cl') && !byC('pp_cd') && !byC('st_pp') && dry.length === 3, dry.map(c => c.id).join(','));

const keep = id => { const x = { ...prof(id) }; ['dept', 'ministry', 'ministries', 'leads', 'updated', 'cltRequest'].forEach(k => delete x[k]); return JSON.stringify(x); };
const keepA = keep('pp_a'), keepC = keep('pp_c'), wholeD = JSON.stringify(prof('pp_d')), wholeE = JSON.stringify(prof('pp_e')), wholeCd = JSON.stringify(prof('pp_cd')), sr = JSON.stringify(mem.staff.filter(x => x.campus === 'siemreap'));
r = await call('applyStructure', ['vanna', '1234', 'poipet', CY, CQ, {}]);
ok('made live: the changes come back', r.body.ok && r.body.changes.length === 3 && r.body.plan.live && r.body.plan.live.by === 'pp_cl', JSON.stringify(r.body).slice(0, 300));
ok('the main place is the profile’s department and ministry', prof('pp_a').dept === 'Youth Education' && prof('pp_a').ministry === 'YDC');
ok('the other ministries are the profile’s `ministries`', JSON.stringify(prof('pp_a').ministries) === JSON.stringify(['Community Service|Cafe', 'Youth Education|Worship', 'Youth Education|GP Media', 'Skills Training|Culinary']) && JSON.stringify(prof('pp_b').ministries) === '[]', JSON.stringify([prof('pp_a').ministries, prof('pp_b').ministries]));
ok('who leads what is the profile’s `leads`', JSON.stringify(prof('pp_a').leads) === '["Youth Education|YDC"]' && JSON.stringify(prof('pp_b').leads) === '["Community Service|Cafe"]');
ok('nothing else on a profile changed — mentor, kind of staff, role, HR, PIN…', keep('pp_a') === keepA, keep('pp_a'));
ok('the one moved into Campus Leadership keeps their department: it is a request for an admin', prof('pp_c').dept === 'Youth Education' && prof('pp_c').ministry === 'YDC' && prof('pp_c').cltRequest && prof('pp_c').cltRequest.ministry === 'Youth Education' && keep('pp_c') === keepC, JSON.stringify(prof('pp_c').cltRequest));
ok('off the chart, a student: their whole profile untouched (a leader key the plan dropped included)', JSON.stringify(prof('pp_d')) === wholeD && JSON.stringify(prof('pp_e')) === wholeE);
ok('someone who stays Campus Director keeps their title and their Campus Leadership key', JSON.stringify(prof('pp_cd')) === wholeCd);
ok('the other campus is untouched', JSON.stringify(mem.staff.filter(x => x.campus === 'siemreap')) === sr);
ok('the plan is marked live', !!mem.structurePlans.find(p => p.campus === 'poipet' && p.year === CY && p.quarter === CQ).live);
ok('what is still to do: nothing new, one waiting for an admin', r.body.diff.changes.length === 0 && r.body.diff.waiting.length === 1 && r.body.diff.waiting[0].id === 'pp_c', JSON.stringify(r.body.diff));
r = await call('applyStructure', ['vanna', '1234', 'poipet', CY, CQ, {}]);
ok('again changes nothing', r.body.ok && r.body.changes.length === 0);
r = await call('adminListStaff', ['uriah', '1234']);
ok('Admin → Approvals sees the move into Campus Leadership', r.body.staff.find(x => x.id === 'pp_c').cltRequest.ministry === 'Youth Education');
r = await call('getMyBoot', ['maly', '1234']);
ok('someone given a ministry here has it on their own card', r.body.ok && JSON.stringify(r.body.staff.leads) === '["Community Service|Cafe"]');

console.log('\n=== live, then edited: a change on the board waits for Apply again (Nov 2026, Andrew) ===');
r = await call('saveStructure', ['uriah', '1234', 'poipet', CY, CQ]);
ok('a snapshot of the quarter carries the other ministries', JSON.stringify(r.body.doc.people.find(p => p.id === 'pp_a').also) === JSON.stringify(prof('pp_a').ministries) && !r.body.doc.people.find(p => p.id === 'pp_b').also);
// Rith edits his own profile; then an unrelated change on the board
r = await call('updateProfile', ['rith', '1234', { dept: 'Community Service', ministry: 'Cafe' }]);
ok('(Rith moves himself back on his own profile)', prof('pp_a').ministry === 'Cafe');
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', CY, CQ, { pp_e: 'dts' }, { ...PLACE, pp_b: { dept: 'Youth Education', ministry: 'YDC' } }, { 'Youth Education|YDC': ['pp_a'], 'Community Service|Cafe': ['x_typed001'] }, [{ id: 'x_typed001', name: 'Coming Soon' }], null, { pp_a: ALSO_A, pp_b: ['Community Service|Cafe'] }]);
const pbBefore = JSON.stringify(prof('pp_b'));
ok('a change on a live board writes no profile', r.body.ok && JSON.stringify(prof('pp_b')) === pbBefore && r.body.applied.length === 0 && r.body.plan.live, JSON.stringify(prof('pp_b')));
ok('… it shows as profiles that differ, to apply with the button', r.body.diff.changes.some(c => c.id === 'pp_b' && c.to === 'Youth Education|YDC') && r.body.diff.changes.some(c => c.id === 'pp_a'), JSON.stringify(r.body.diff.changes.map(c => c.id)));
ok('… the saved snapshot follows the board', mem.structure.find(x => x.campus === 'poipet' && x.year === CY && x.quarter === CQ).people.find(p => p.id === 'pp_b').ministry === 'YDC');
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', CY, CQ, { pp_e: 'dts' }, { ...PLACE, pp_b: { dept: 'Youth Education', ministry: 'YDC' }, st_pp: { dept: 'Youth Education', ministry: 'YDC' } }, { 'Youth Education|YDC': ['pp_a'], 'Community Service|Cafe': ['x_typed001'] }, [{ id: 'x_typed001', name: 'Coming Soon' }], null, { pp_a: ALSO_A, pp_b: ['Community Service|Cafe'] }]);
ok('another change on the board still writes nothing', prof('st_pp').ministry !== 'YDC' && prof('pp_a').ministry === 'Cafe' && r.body.applied.length === 0);
r = await call('applyStructure', ['vanna', '1234', 'poipet', CY, CQ, {}]);
ok('Apply again writes them all at once', r.body.ok && r.body.changes.length >= 3 && prof('pp_a').ministry === 'YDC' && JSON.stringify(prof('pp_a').ministries) === JSON.stringify(ALSO_A) && prof('pp_b').ministry === 'YDC' && JSON.stringify(prof('pp_b').ministries) === '["Community Service|Cafe"]' && prof('st_pp').ministry === 'YDC', JSON.stringify(r.body.changes.map(c => c.id)));
// an admin makes it live: Campus Leadership is written directly
r = await call('applyStructure', ['uriah', '1234', 'poipet', CY, CQ, {}]);
ok('an admin’s apply moves the one waiting straight into Campus Leadership, and the request is gone', r.body.ok && prof('pp_c').dept === 'Campus Leadership' && prof('pp_c').ministry === 'Youth Education' && !prof('pp_c').cltRequest, JSON.stringify(prof('pp_c')));
r = await call('saveStructurePlan', ['uriah', '1234', 'poipet', CY, CQ, undefined, { ...PLACE, pp_b: { dept: 'Youth Education', ministry: 'YDC' }, st_pp: { dept: 'Youth Education', ministry: 'YDC' }, pp_cd: { dept: 'Community Service', ministry: 'Cafe' }, pp_c: { dept: 'Campus Leadership', ministry: 'Campus Director' } }]);
ok('(the save itself writes no profile)', prof('pp_cd').dept === 'Campus Leadership' && r.body.applied.length === 0);
r = await call('applyStructure', ['uriah', '1234', 'poipet', CY, CQ, {}]);
ok('leaving the Campus Director row drops the International / National title; moving within Campus Leadership needs nobody', prof('pp_cd').dept === 'Community Service' && prof('pp_cd').cdKind === '' && JSON.stringify(prof('pp_cd').leads) === '["Campus Leadership|Campus Director"]' && prof('pp_c').ministry === 'Campus Director', JSON.stringify(prof('pp_cd')));

console.log('\n=== a later quarter writes nothing until someone makes it live ===');
const c1 = core();
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', NXT[0], NXT[1], {}, { pp_a: { dept: 'Community Service', ministry: 'Cafe' }, pp_b: { dept: 'Community Service', ministry: 'Cafe' } }, {}, [], null, { pp_a: ['Youth Education|YDC'] }]);
ok('arranging next quarter moves no profile', r.body.ok && core() === c1 && !r.body.plan.live && r.body.applied.length === 0 && r.body.diff.changes.length >= 2);
r = await call('applyStructure', ['vanna', '1234', 'poipet', NXT[0], NXT[1], {}]);
ok('made live early, it does', r.body.ok && prof('pp_a').ministry === 'Cafe' && JSON.stringify(prof('pp_a').ministries) === '["Youth Education|YDC"]' && JSON.stringify(prof('pp_a').leads) === '[]' && r.body.plan.live);
const c2 = core();
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', NXT[0], NXT[1], {}, { pp_a: { dept: 'Youth Education', ministry: 'YDC' }, pp_b: { dept: 'Community Service', ministry: 'Cafe' } }, {}, [], null, {}]);
ok('but a later change to a quarter that has not started waits for Apply again', r.body.ok && core() === c2 && r.body.plan.live && r.body.diff.changes.some(c => c.id === 'pp_a'));
r = await call('saveStructurePlan', ['vanna', '1234', 'poipet', NXT[0], NXT[1], {}, {}, null, [], null, null]);
ok('“start again from everyone’s profile” clears live', r.body.ok && !r.body.plan.live && r.body.plan.also === null && r.body.diff.changes.length === 0);

console.log('\n=== Campus Leadership’s bell: this quarter is arranged and not live ===');
r = await call('getMyBoot', ['vanna', '1234']);
ok('live already: nothing to say', r.body.ok && r.body.structReady === null, JSON.stringify(r.body.structReady));
mem.structurePlans = mem.structurePlans.map(p => (p.campus === 'poipet' && p.year === CY && p.quarter === CQ) ? (({ live, ...rest }) => rest)(p) : p);
r = await call('getMyBoot', ['vanna', '1234']);
ok('arranged and not live: the boot says which quarter', r.body.structReady && r.body.structReady.year === CY && r.body.structReady.q === CQ);
r = await call('getMyBoot', ['maly', '1234']);
ok('never for someone outside Campus Leadership', r.body.ok && !r.body.structReady);

console.log('\n=== Campus Leadership is on the chart once (Nov 2026, Uriah: "the director of one department is in every single ministry") ===');
{
  const CS = 'Community Service', FY = CY + 2;   // a quarter of its own, well ahead
  mem.staff = [
    withPin({ id: 'ad', name: 'Adam Admin', username: 'adam', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true }),
    withPin({ id: 'bo', name: 'Boss Hill', username: 'boss', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, ministries: [CS + '|Cafe'] }),
    withPin({ id: 'di', name: 'Dana Direct', username: 'dana', campus: 'siemreap', dept: 'Campus Leadership', ministry: CS, active: true,
      ministries: [CS + '|Cafe', CS + '|LTN', 'Youth Education|Worship'], leads: [CS + '|Cafe'] }),
    withPin({ id: 're', name: 'Rey Regular', username: 'rey', campus: 'siemreap', dept: CS, ministry: 'Cafe', active: true, ministries: ['Youth Education|Worship'] }),
  ];
  mem.structurePlans = []; mem.structure = [];
  r = await call('saveStructure', ['adam', '1234', 'siemreap', FY, 1]);
  const snap = id => r.body.doc.people.find(p => p.id === id);
  ok('from profiles: a director is not put in a ministry because their profile lists it; anyone else still is', r.body.ok && !snap('di').also && !snap('bo').also && JSON.stringify(snap('re').also) === JSON.stringify(['Youth Education|Worship']), JSON.stringify([snap('di').also, snap('bo').also, snap('re').also]));
  const place = { ad: { dept: 'Campus Leadership', ministry: 'Campus Director' }, bo: { dept: 'Campus Leadership', ministry: 'Campus Director' }, di: { dept: 'Campus Leadership', ministry: CS }, re: { dept: CS, ministry: 'Cafe' } };
  r = await call('saveStructurePlan', ['boss', '1234', 'siemreap', FY, 1, {}, place, { [CS + '|Cafe']: ['di'] }, [], null, { di: [CS + '|LTN', 'Skills Training|Hospitality'], re: ['Youth Education|Worship'] }]);
  ok('the quarter’s own second jobs: a Director’s second job in the department they direct is never on the chart; one in another department is',
    r.body.ok && JSON.stringify(snap('di').also) === JSON.stringify(['Skills Training|Hospitality']), JSON.stringify(snap('di').also));
  ok('“n profiles would change” does not count a director for the ministries on their profile', r.body.diff.changes.length === 1 && r.body.diff.changes[0].id === 'di' && JSON.stringify(r.body.diff.changes[0].alsoAdd) === JSON.stringify(['Skills Training|Hospitality']) && r.body.diff.changes[0].alsoDrop.length === 0, JSON.stringify(r.body.diff.changes));
  r = await call('applyStructure', ['boss', '1234', 'siemreap', FY, 1, {}]);
  const di = () => mem.staff.find(x => x.id === 'di'), bo = () => mem.staff.find(x => x.id === 'bo');
  ok('made live: the board only ever ADDS a ministry page to someone in Campus Leadership — nothing they had is taken away',
    r.body.ok && [CS + '|Cafe', CS + '|LTN', 'Youth Education|Worship', 'Skills Training|Hospitality'].every(k => di().ministries.indexOf(k) > -1) && JSON.stringify(bo().ministries) === JSON.stringify([CS + '|Cafe']) && JSON.stringify(di().leads) === JSON.stringify([CS + '|Cafe']), JSON.stringify([di().ministries, bo().ministries, di().leads]));
  ok('… and afterwards nobody “differs”', r.body.diff.changes.length === 0, JSON.stringify(r.body.diff.changes));
  r = await call('saveStructurePlan', ['boss', '1234', 'siemreap', FY, 1, {}, place, {}, [], null, {}]);
  ok('second jobs and leading taken off the board for everyone: a director loses the leading, never a ministry page; the regular staff member loses the second job', r.body.ok && r.body.diff.changes.map(c => c.id).sort().join() === 'di,re' && r.body.diff.changes.find(c => c.id === 'di').alsoDrop.length === 0 && JSON.stringify(r.body.diff.changes.find(c => c.id === 're').alsoDrop) === JSON.stringify(['Youth Education|Worship']), JSON.stringify(r.body.diff.changes));
  r = await call('getMinistryFor', ['dana', '1234', CS, 'LTN']);
  ok('a Director reaches every ministry of their department whatever the chart says', r.body && r.body.ok !== false && r.body.err !== 'not_authorized', JSON.stringify(r.body).slice(0, 80));
  mem.staff.find(x => x.id === 'di').ministries = [];
  r = await call('getMinistryFor', ['dana', '1234', CS, 'Sry Noi']);
  ok('… even with nothing on their profile (the overseer’s right)', r.body && r.body.err !== 'not_authorized', JSON.stringify(r.body).slice(0, 80));
  /* a Director moved to a ministry is an ordinary member again: the plan's second jobs are theirs exactly */
  r = await call('saveStructurePlan', ['adam', '1234', 'siemreap', FY, 1, {}, Object.assign({}, place, { di: { dept: CS, ministry: 'LTN' } }), {}, [], null, { di: [CS + '|Cafe'] }]);
  ok('moved out of Campus Leadership into a ministry, a second job in that department shows again', r.body.ok && JSON.stringify(snap('di').also) === JSON.stringify([CS + '|Cafe']) && snap('di').ministry === 'LTN', JSON.stringify(snap('di')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
