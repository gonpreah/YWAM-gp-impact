/* Getting back in (Nov 2026, Uriah: "I can't see the full email … I don't want people getting logged out and stuck").
   Against the real api.js: an admin's one-time sign-in link (adminSignInLink → staffUseSignInLink) signs that person
   in once, with a device token that keeps working; it is single-use, runs out, is replaced by a new one, is never
   sent back as a hash, and nobody but an admin can make one. A PIN reset on a password account now works (the
   password used to win). An admin can put an email on a profile. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('signin-link');
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
const withPin = (s) => ({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
const pw = crypto.pbkdf2Sync('old password', 'saltsalt', 30000, 32, 'sha256').toString('hex');
mem.staff = [
  withPin({ id: 'st_admin', name: 'Ada Admin', username: 'ada', isAdmin: true }),
  withPin({ id: 'st_friend', name: 'Fran Friend', username: 'fran', email: 'a.very.long.email.address.for.fran@example-ministry.org' }),
  withPin({ id: 'st_other', name: 'Otto Other', username: 'otto' }),
  withPin({ id: 'st_pw', name: 'Pat Password', username: 'pat', secretSalt: 'saltsalt', secretHash: pw }),
  withPin({ id: 'st_wait', name: 'Wendy Waiting', username: 'wendy', active: false }),
  withPin({ id: 'st_gone', name: 'Gus Gone', username: 'gus', active: false, archived: { at: '2026-01-01', reason: 'left' } }),
  withPin({ id: 'ap_amy', name: 'Amy Applicant', username: 'amy@example.org', kind: 'applicant', applicant: { type: 'student' } }),
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
const ADMIN = ['ada', '1234'];
const fran = () => mem.staff.find(s => s.id === 'st_friend');

// 1. who can make one
let r = await call('adminSignInLink', ['otto', '1234', 'st_friend']);
ok('a non-admin cannot make a sign-in link', r.body && r.body.ok === false && !r.body.token);
r = await call('adminSignInLink', ['ada', '9999', 'st_friend']);
ok('a wrong admin PIN cannot either', r.body && r.body.ok === false && !r.body.token);
r = await call('adminSignInLink', ADMIN.concat(['ap_amy']));
ok('not for an applicant account', r.body && r.body.err === 'not_staff');
r = await call('adminSignInLink', ADMIN.concat(['st_gone']));
ok('not for an archived account', r.body && r.body.err === 'archived');
r = await call('adminSignInLink', ADMIN.concat(['nobody']));
ok('an unknown id is not_found', r.body && r.body.err === 'not_found');

// 2. making one
r = await call('adminSignInLink', ADMIN.concat(['st_friend']));
const tok1 = r.body && r.body.token;
ok('an admin gets a 48-hex token and when it runs out', /^[a-f0-9]{48}$/.test(tok1 || '') && Date.parse(r.body.exp) > Date.now() + 70 * 3600e3, r.body && r.body.exp);
ok('only a hash is kept on the record', fran().signInLink && fran().signInLink.hash && JSON.stringify(fran()).indexOf(tok1) === -1);
let list = await call('adminListStaff', ADMIN);
const fr = list.body.staff.find(s => s.id === 'st_friend');
ok('Admin sees the full email and that a link waits — never the hash', fr.email === 'a.very.long.email.address.for.fran@example-ministry.org' && fr.signInLink && fr.signInLink.exp && !fr.signInLink.hash && !fr.signInLink.salt);

// 3. a new one turns the old off
r = await call('adminSignInLink', ADMIN.concat(['st_friend']));
const tok2 = r.body.token;
r = await call('staffUseSignInLink', [tok1]);
ok('the older link no longer works', r.body && r.body.ok === false && r.body.err === 'link');

// 4. using it
mem.loginThrottle = { fran: { attempts: 5, firstAt: Date.now(), lockedUntil: Date.now() + 600000 } };
r = await call('staffUseSignInLink', [tok2]);
ok('the link signs them in, with a device token', r.body && r.body.ok === true && r.body.user === 'fran' && /^[a-f0-9]{48}$/.test(r.body.token || '') && r.body.staff && r.body.staff.id === 'st_friend');
const dev = r.body.token;
ok('…and lifts the lockout', !mem.loginThrottle.fran);
ok('…and is spent', !fran().signInLink);
r = await call('staffUseSignInLink', [tok2]);
ok('a second use is refused', r.body && r.body.ok === false);
r = await call('getMyBoot', ['fran', dev]);
ok('the device token keeps them signed in', r.body && r.body.ok !== false && r.body.staff && r.body.staff.id === 'st_friend');
r = await call('staffLogin', ['fran', '1234']);
ok('their old PIN still works too (nothing else changed)', r.body && r.body.ok === true);

// 5. runs out; not for someone waiting on approval; junk refused
r = await call('adminSignInLink', ADMIN.concat(['st_other']));
const tok3 = r.body.token;
mem.staff.find(s => s.id === 'st_other').signInLink.exp = new Date(Date.now() - 1000).toISOString();
r = await call('staffUseSignInLink', [tok3]);
ok('a link past its time is refused as expired, and dropped', r.body && r.body.err === 'expired' && !mem.staff.find(s => s.id === 'st_other').signInLink);
r = await call('adminSignInLink', ADMIN.concat(['st_wait']));
r = await call('staffUseSignInLink', [r.body.token]);
ok('someone waiting on approval is told so, not signed in', r.body && r.body.ok === false && r.body.err === 'pending' && !r.body.token);
for (const junk of ['', 'abc', 'x'.repeat(48), null, { a: 1 }, tok1.toUpperCase()]) {
  r = await call('staffUseSignInLink', [junk]);
  if (!(r.status === 200 && r.body && r.body.ok === false && !r.body.token)) { ok('junk refused: ' + JSON.stringify(junk), false); }
}
ok('junk links are refused', true);

// 6. a PIN reset on a password account works now
r = await call('staffLogin', ['pat', 'old password']);
ok('(the password account signs in with its password)', r.body && r.body.ok === true);
r = await call('adminResetPin', ADMIN.concat(['st_pw', '4321']));
ok('an admin resets their PIN', r.body && r.body.ok === true);
r = await call('staffLogin', ['pat', '4321']);
ok('the new PIN works on what was a password account', r.body && r.body.ok === true);
r = await call('staffLogin', ['pat', 'old password']);
ok('the forgotten password is gone', r.body && r.body.ok === false);

// 7. an admin puts an email on a profile
r = await call('adminUpdateStaff', ADMIN.concat(['st_other', { email: 'Otto.Other@Gmail.com' }]));
ok('an admin can set someone\'s email', r.body && r.body.ok === true && mem.staff.find(s => s.id === 'st_other').email === 'otto.other@gmail.com', mem.staff.find(s => s.id === 'st_other').email);
r = await call('adminUpdateStaff', ADMIN.concat(['st_other', { email: 'a.very.long.email.address.for.fran@example-ministry.org' }]));
ok('…not one another profile has', r.body && r.body.err === 'email_taken');
r = await call('adminUpdateStaff', ADMIN.concat(['st_other', { email: 'not an email' }]));
ok('…and not a broken one', r.body && r.body.err === 'bad_email');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
