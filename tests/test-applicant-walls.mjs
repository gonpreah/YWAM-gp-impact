/* The wall between applicants and staff (Nov 2026, Andrew: "make sure that those who applied through the
   portal cannot access any of what the staff and admin can access in the portal as well as the impact
   app"). Every handler the server has — read straight out of api.js's HANDLERS — is called with an
   applicant's own sign-in, a few ways round. Two things must hold for all of them:
     1. none answers ok unless it is one the applicant is meant to use (their own application, the
        portal's applicant pages, the public ones);
     2. no answer carries anything of anyone else — markers planted in another applicant's record, in
        staff contact details, call notes, support and health — whatever it says.
   A handler added later is covered without touching this file; if it lets an applicant in, add it to
   APPLICANT_OK only after reading why. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('applicant-walls');
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
const withPin = (s, pin) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash(pin || '1234', s.id) });
const NOW = new Date().toISOString();
const MARK = ['SECRETSTAFFPHONE', 'secret.staff@example.org', 'SECRETCALLNOTE', 'Zorro Otherapplicant', 'SECRETSUPPORT', 'SECRETNOTE', 'SECRETDEBTNAME'];
mem.staff = [
  withPin({ id: 'st_admin', name: 'Admin Person', username: 'admin', email: 'admin@example.org', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, phone: 'SECRETSTAFFPHONE', staffType: 'campus' }),
  withPin({ id: 'st_dts', name: 'Dee Teesse', username: 'dee', email: 'secret.staff@example.org', dept: 'Leadership Development', ministry: 'GPDTS', phone: 'SECRETSTAFFPHONE', staffType: 'campus',
    support: { goal: 500, partners: [{ id: 'p1', name: 'SECRETSUPPORT', amount: 50, freq: 'month', status: 'giving' }] }, surveyToken: 'tok-dee' }),
  withPin({ id: 'ap_me', name: 'Amy Applicant', username: 'amy.app', email: 'amy@example.org', kind: 'applicant', applicant: { type: 'student', school: 'dts', candidateId: 'c_me' } }, '2468'),
  withPin({ id: 'ap_other', name: 'Zorro Otherapplicant', username: 'zorro', email: 'zorro@example.org', kind: 'applicant', applicant: { type: 'student', school: 'dts', candidateId: 'c_other' } }, '9999'),
];
const cand = (o) => ({ campus: 'siemreap', type: 'student', school: 'dts', stage: 'applied', log: [], archived: null, created: NOW, updated: NOW, country: 'Sweden', ...o });
mem.candidates = [
  cand({ id: 'c_me', name: 'Amy Applicant', staffId: 'ap_me', email: 'amy@example.org', portal: { submittedAt: NOW, form: { answers: {} } } }),
  cand({ id: 'c_other', name: 'Zorro Otherapplicant', staffId: 'ap_other', email: 'zorro@example.org', notes: 'SECRETNOTE', calls: [{ id: 'cl1', date: NOW.slice(0, 10), text: 'SECRETCALLNOTE', by: 'st_dts', at: NOW }], portal: { submittedAt: NOW, form: { answers: {} } } }),
];
mem.survey = [{ token: 'tok-dee', week: 1, year: 2026, lonely: 9, campus: 'siemreap' }];
mem['finance:siemreap'] = { debt: { rows: [{ name: 'SECRETDEBTNAME', total: 100 }] } };

/* the applicant's own pages, and the public ones (no sign-in at all) */
const APPLICANT_OK = new Set([
  // their own application, account and portal pages
  'portalBoot', 'portalSaveDraft', 'portalSubmit', 'portalUpdateAnswers', 'portalUpdateContact', 'portalSetPassword',
  'portalMeetTeam', 'portalStaffPhoto', 'portalResources', 'portalStrengths', 'portalSaveStrength', 'portalDeleteStrength',
  'portalReferenceLink', 'portalUploadDoc', 'portalGetDoc', 'portalDeleteDoc', 'portalSaveTeamMembers', 'portalTeamPhotos',
  'portalSaveTeamPhoto', 'portalDeleteTeamPhoto', 'portalSaveTeamNumbers', 'portalVisaDocGet', 'portalVisaInfo',
  'portalSignOpen', 'portalSignSubmit', 'portalSignStatus', 'portalSignedPdf', 'portalMySchedules',
  // a student's own GP app, through its one door
  'studentCall',
  // public: no sign-in is read
  'getData', 'teamRoster', 'portalAuthConfig', 'portalRegister', 'portalLoginGoogle', 'portalReferenceForm', 'portalReferenceSubmit',
  'portalJoinInfo', 'portalJoin', 'stayRequest', 'libAudioIndex', 'contractLinkOpen', 'contractLinkSign', 'boardLogin', 'staffInviteInfo',
]);
const src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const hb = src.slice(src.indexOf('const HANDLERS = {'));
const names = [...hb.slice(0, hb.indexOf('\n};')).matchAll(/^\s+([A-Za-z0-9_]+):\s*function/gm)].map(m => m[1]);

async function call(fn, args) {
  try {
    const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (e) { return { status: 0, body: null }; }
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

const ME = ['amy.app', '2468'];
const tries = [[], ['x'], ['c_other'], ['st_dts'], ['siemreap'], [{}], ['c_other', {}], ['st_dts', { isAdmin: true }]];
const opened = [], leaked = [];
const snapshot = JSON.stringify(mem.staff.map(s => [s.id, s.kind, s.isAdmin, s.active]));
for (const fn of names) {
  if (fn === 'portalSetPassword') continue;   // their own password, which they may change (and the junk tried here would)
  for (const extra of tries) {
    const r = await call(fn, ME.concat(extra));
    const text = JSON.stringify(r.body || '');
    const hit = MARK.filter(m => text.indexOf(m) > -1);
    if (hit.length) leaked.push(fn + ' [' + hit.join(',') + ']');
    if (r.body && r.body.ok === true && !APPLICANT_OK.has(fn)) opened.push(fn);
    if (process.env.WALL_DEBUG && !((await call('portalBoot', ME)).body || {}).ok) { console.log('broke after', fn, JSON.stringify(extra)); process.exit(2); }
  }
}
ok('every handler (' + names.length + ') was tried with an applicant’s sign-in', names.length > 250, String(names.length));
ok('no staff or admin handler answers an applicant', opened.length === 0, [...new Set(opened)].join(', '));
ok('no answer to an applicant carries anyone else’s details, notes, calls, support or debt', leaked.length === 0, [...new Set(leaked)].join(', '));
ok('nothing an applicant sent made them staff or admin', JSON.stringify(mem.staff.map(s => [s.id, s.kind, s.isAdmin, s.active])) === snapshot);
ok('their own application is still theirs to read', (await call('portalBoot', ME)).body.application.id === 'c_me');
ok('the GP app turns them away at the door', (await call('staffLogin', ME)).body.err === 'applicant' && (await call('getMyBoot', ME)).body.ok === false);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
