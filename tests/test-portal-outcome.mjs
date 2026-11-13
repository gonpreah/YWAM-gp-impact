/* The portal's staff side, Nov 2026 (Andrew): an application marked Cancelled or Rejected from the stage list goes
   to the archive with that word (its stage untouched, a line in its log, reopened like any closed one), and a
   portal admin can put an application's name right — the person's, their applicant account's, and a team's
   team name. Against the real api.js. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('portal-outcome');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_padm', name: 'Pam Admin', username: 'pam', dept: 'Skills Training', ministry: 'Hospitality', portalAdmin: true }),
  withPin({ id: 'st_dts', name: 'Dee Teesse', username: 'dee', dept: 'Leadership Development', ministry: 'GPDTS' }),
  withPin({ id: 'ap_amy', name: 'Amy Aplicant', username: 'amy@example.org', email: 'amy@example.org', kind: 'applicant', applicant: { type: 'student', school: 'dts', candidateId: 'c_amy' } }),
];
const NOW = new Date().toISOString();
const cand = (o) => ({ campus: 'siemreap', type: 'student', school: 'dts', stage: 'applied', log: [], archived: null, created: NOW, updated: NOW, country: 'Sweden', portal: { submittedAt: NOW, form: { answers: {} } }, ...o });
mem.candidates = [
  cand({ id: 'c_amy', name: 'Amy Aplicant', staffId: 'ap_amy', email: 'amy@example.org' }),
  cand({ id: 'c_bo', name: 'Bo Ross', stage: 'interview' }),
  cand({ id: 'c_team', name: 'Lee Leader', type: 'team', school: '', stage: 'applied', portal: { submittedAt: NOW, form: { answers: { teamName: 'YWAM Sompl' } } } }),
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
const C = (id) => mem.candidates.find(c => c.id === id);

/* ---- Cancelled / Rejected ---- */
let r = (await call('hrArchiveCandidate', ['dee', '1234', 'c_bo', { outcome: 'rejected', reason: '' }])).body;
ok('Rejected: the application goes to the archive, saying so', r.ok && C('c_bo').archived && C('c_bo').archived.outcome === 'rejected' && C('c_bo').archived.reason === 'Rejected', JSON.stringify(C('c_bo').archived));
ok('… its stage stays where it was', C('c_bo').stage === 'interview');
ok('… and its log says it', C('c_bo').log.some(l => /Rejected — moved to the archive/.test(l.text)));
r = (await call('hrArchiveCandidate', ['dee', '1234', 'c_amy', { outcome: 'cancelled' }])).body;
ok('Cancelled likewise', r.ok && C('c_amy').archived.outcome === 'cancelled' && C('c_amy').archived.reason === 'Cancelled');
const boot = (await call('portalBoot', ['amy@example.org', '1234'])).body;
ok('the applicant sees their application closed', boot && boot.ok && boot.application && boot.application.status === 'closed', JSON.stringify(boot && boot.application && boot.application.status));
r = (await call('hrArchiveCandidate', ['dee', '1234', 'c_amy', null])).body;
ok('reopening brings it back, the outcome gone', r.ok && C('c_amy').archived === null);
r = (await call('hrArchiveCandidate', ['dee', '1234', 'c_amy', { outcome: 'banished', reason: 'moved away' }])).body;
ok('anything but cancelled or rejected is a plain close, with its reason', r.ok && !C('c_amy').archived.outcome && C('c_amy').archived.reason === 'moved away');
await call('hrArchiveCandidate', ['dee', '1234', 'c_amy', null]);

/* ---- the name ---- */
r = (await call('portalRenameCand', ['dee', '1234', 'c_amy', { name: 'Amy Applicant' }])).body;
ok('only a portal admin changes a name', r.ok === false && r.err === 'not_authorized' && C('c_amy').name === 'Amy Aplicant');
r = (await call('portalRenameCand', ['pam', '1234', 'c_amy', { name: '  Amy   Applicant ' }])).body;
ok('a portal admin puts the name right, tidied', r.ok && C('c_amy').name === 'Amy Applicant' && r.candidate.name === 'Amy Applicant');
ok('… and their applicant account follows', mem.staff.find(s => s.id === 'ap_amy').name === 'Amy Applicant');
ok('… with a line in the log', C('c_amy').log.some(l => l.text === 'Name changed from “Amy Aplicant” to “Amy Applicant”'));
ok('a name can’t be blank', (await call('portalRenameCand', ['pam', '1234', 'c_amy', { name: '   ' }])).body.err === 'no_name');
r = (await call('portalRenameCand', ['pam', '1234', 'c_team', { name: 'Lee Leader', teamName: 'YWAM Sample' }])).body;
ok('a team: its team name (the application’s answer) is changed, the leader’s left as it was', r.ok && C('c_team').portal.form.answers.teamName === 'YWAM Sample' && C('c_team').name === 'Lee Leader' && C('c_team').log.some(l => /Team name changed/.test(l.text)));
ok('the team in the Teams Database follows', (mem.teamTrips || []).some(t => t.candidateId === 'c_team' && t.name === 'YWAM Sample'), JSON.stringify((mem.teamTrips || []).map(t => [t.candidateId, t.name])));
const r2 = (await call('portalRenameCand', ['pam', '1234', 'c_team', { name: 'Lee Leader', teamName: 'YWAM Sample' }])).body;
ok('the same name again writes nothing', r2.ok && r2.same === true);
ok('an applicant can’t rename anything', (await call('portalRenameCand', ['amy@example.org', '1234', 'c_amy', { name: 'Me' }])).body.ok === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
