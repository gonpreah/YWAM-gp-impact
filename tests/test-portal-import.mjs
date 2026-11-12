/* Importing applications from a spreadsheet (Nov 2026), against the real api.js:
   portalImportApplications. Who may import (portal staff for that school, portal
   admins, HR — not plain staff, not someone scoped to teams, never an applicant);
   each row becomes a DTS application at "applied", dated by its form timestamp,
   with its answers cleaned against the form and its leftovers kept as notes;
   the same sheet twice adds nothing twice; someone already applying with that
   email or phone is skipped and named; and a person who later signs up with
   the same email takes over the application they already sent. Every person
   here is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('portal-import');
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
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_padmin', name: 'Sina Sok', username: 'sina', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, portalAdmin: true }),
  withPin({ id: 'st_pstaff', name: 'Dara Pen', username: 'dara', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, portalStaff: true }),
  withPin({ id: 'st_plain', name: 'Bopha Kim', username: 'bopha', campus: 'siemreap', dept: 'Youth Education', ministry: 'YDC', active: true }),
  withPin({ id: 'st_teams', name: 'Rithy Team', username: 'rithy', campus: 'siemreap', dept: 'Community Service', ministry: 'Outreach Teams', active: true, portalStaff: true }),
  withPin({ id: 'st_hr', name: 'Mealea Sok', username: 'mealea', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true, hr: true }),
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
const OPTS = { campus: 'siemreap', school: 'dts', country: 'Cambodia', file: 'DTS sheet.csv' };
const ROWS = [
  { name: 'Sokha Example', email: 'sokha@example.org', phone: '012 345 678', submittedAt: '2026-07-01T05:00:00.000Z',
    answers: { firstName: 'Sokha', lastName: 'Example', gender: 'Male', whyDts: 'To know God more.', notAQuestion: 'dropped' },
    extra: [{ label: 'Parent or guardian — how they are related', value: 'Mother' }, { label: '', value: 'no label' }] },
  { name: 'Chenda Sample', email: '', phone: '098 765 432', submittedAt: '2026-08-02T03:00:00.000Z', answers: { firstName: 'Chenda', lastName: 'Sample', funds: 'No' } },
  { name: '', phone: '011 111 111', answers: {} },
];

console.log('=== who may import ===');
{
  let r = await call('portalImportApplications', ['bopha', '1234', OPTS, ROWS]);
  ok('plain staff are refused', r.body && r.body.ok === false && r.body.err === 'not_authorized', JSON.stringify(r.body));
  r = await call('portalImportApplications', ['rithy', '1234', OPTS, ROWS]);
  ok('someone scoped to team applications cannot import DTS applications', r.body && r.body.err === 'not_authorized', JSON.stringify(r.body));
  r = await call('portalImportApplications', ['sina', '9999', OPTS, ROWS]);
  ok('a wrong PIN is refused', r.body && r.body.ok === false && !r.body.added);
  r = await call('portalImportApplications', ['sina', '1234', { ...OPTS, school: 'xyz' }, ROWS]);
  ok('an unknown school is refused', r.body && r.body.err === 'school_required');
  r = await call('portalImportApplications', ['sina', '1234', { ...OPTS, campus: 'poipet', school: 'sms' }, ROWS]);
  ok('a school the campus does not run is refused', r.body && r.body.err === 'school_not_at_campus');
  r = await call('portalImportApplications', ['sina', '1234', OPTS, []]);
  ok('no rows is refused', r.body && r.body.err === 'empty');
  r = await call('portalImportApplications', ['sina', '1234', OPTS, new Array(301).fill(ROWS[0])]);
  ok('more than 300 rows at once is refused', r.body && r.body.err === 'too_many_rows');
  ok('nothing was written by any of those', !(mem.candidates || []).length);
}

console.log('=== a portal admin imports a sheet ===');
let ids = [];
{
  const r = await call('portalImportApplications', ['sina', '1234', OPTS, ROWS]);
  ok('two applications are added and the row with no name is skipped', r.body && r.body.ok && r.body.added.length === 2 && r.body.skipped.length === 1 && r.body.skipped[0].why === 'no_name' && r.body.skipped[0].row === 3, JSON.stringify(r.body));
  ids = r.body.added.map(x => x.id);
  const c = mem.candidates.find(x => x.id === ids[0]);
  ok('it is a DTS student application on that campus, at applied', c.type === 'student' && c.school === 'dts' && c.subtype === 'DTS' && c.campus === 'siemreap' && c.stage === 'applied');
  ok('dated by the form timestamp — sent in, with the answers on the form', c.portal.submittedAt === '2026-07-01T05:00:00.000Z' && c.portal.form.submittedAt === c.portal.submittedAt && c.portal.form.formKey === 'dts' && c.portal.form.audience === 'khmer');
  ok('answers are cleaned against the DTS form (a key that is no question is dropped)', c.portal.form.answers.whyDts === 'To know God more.' && c.portal.form.answers.gender === 'Male' && !('notAQuestion' in c.portal.form.answers));
  ok('what has no question is kept as a note; a note with no label is not', c.portal.form.extra.length === 1 && c.portal.form.extra[0].value === 'Mother');
  ok('no portal account, contact details on the record, where it came from is marked', c.staffId === '' && c.email === 'sokha@example.org' && c.phone === '012 345 678' && c.country === 'Cambodia' && c.portal.imported && c.portal.imported.by === 'st_padmin' && c.portal.imported.file === 'DTS sheet.csv');
  ok('the log says applied (on the day they sent it) and that it was imported', c.log[0].kind === 'stage' && c.log[0].text === 'applied' && c.log[0].at === '2026-07-01T05:00:00.000Z' && /Imported from DTS sheet\.csv/.test(c.log[1].text));
  const boot = await call('portalBoot', ['dara', '1234']);
  const seen = (boot.body.applicants || []).find(x => x.id === ids[0]);
  ok('portal staff see it in Applications, with no account, as "pending" review', seen && seen.hasAccount === false && seen.status !== 'draft' && seen.portal.imported, JSON.stringify(seen && { status: seen.status, hasAccount: seen.hasAccount }));
}

console.log('=== the same sheet again, and someone already applying ===');
{
  let r = await call('portalImportApplications', ['sina', '1234', OPTS, ROWS.slice(0, 2)]);
  ok('importing the same rows again adds nothing', r.body.ok && r.body.added.length === 0 && r.body.skipped.every(s => s.why === 'imported'), JSON.stringify(r.body));
  r = await call('portalImportApplications', ['dara', '1234', OPTS, [{ name: 'Someone Else', phone: '+855 98 765 432', submittedAt: '2026-09-01T00:00:00Z', answers: {} }, { name: 'Sokha E.', email: 'SOKHA@example.org', answers: {} }]]);
  ok('a row with the same phone (any spacing or +855) or email as an application already there is skipped and named', r.body.ok && r.body.added.length === 0 && r.body.skipped.length === 2 && r.body.skipped.every(s => s.why === 'exists') && r.body.skipped[0].with === 'Chenda Sample' && r.body.skipped[1].with === 'Sokha Example', JSON.stringify(r.body));
  r = await call('portalImportApplications', ['mealea', '1234', OPTS, [{ name: 'New Person', phone: '077 000 000', answers: {} }]]);
  ok('HR may import too; a row with no timestamp is dated today', r.body.ok && r.body.added.length === 1 && Date.now() - Date.parse(mem.candidates.find(x => x.id === r.body.added[0].id).portal.submittedAt) < 60000, JSON.stringify(r.body));
  ok('there are three imported records in all', mem.candidates.filter(x => x.portal && x.portal.imported).length === 3);
}

console.log('=== signing up later with the same email takes over the application ===');
{
  const r = await call('portalRegister', [{ username: 'sokha.e', pin: '2468', name: 'Sokha Example', email: 'sokha@example.org', phone: '012 345 678', messenger: 'telegram', type: 'student', school: 'dts', country: 'Cambodia', campus: 'siemreap' }]);
  ok('sign-up works', r.body && r.body.ok, JSON.stringify(r.body && r.body.err));
  const c = mem.candidates.find(x => x.id === ids[0]);
  const acct = mem.staff.find(x => x.username === 'sokha.e');
  ok('the account points at the imported record — no second application', acct.applicant.candidateId === ids[0] && c.staffId === acct.id && mem.candidates.filter(x => x.email === 'sokha@example.org').length === 1);
  ok('the application stays sent in, at applied, with its answers and notes', c.stage === 'applied' && c.portal.submittedAt === '2026-07-01T05:00:00.000Z' && c.portal.form.answers.whyDts === 'To know God more.' && c.portal.form.extra.length === 1);
  ok('the log says they made an account, and does not go back to new', /joined to this record/.test(c.log[c.log.length - 1].text) && !c.log.some(l => l.kind === 'stage' && l.text === 'new'));
  const boot = await call('portalBoot', ['sokha.e', '2468']);
  ok('their dashboard shows the application as sent, not a blank form', boot.body.ok && boot.body.application && boot.body.application.submittedAt === '2026-07-01T05:00:00.000Z' && boot.body.application.status !== 'draft', JSON.stringify(boot.body.application && boot.body.application.status));
  const r2 = await call('portalImportApplications', ['sokha.e', '2468', OPTS, ROWS]);
  ok('an applicant cannot import', r2.body && r2.body.ok === false && !r2.body.added);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
