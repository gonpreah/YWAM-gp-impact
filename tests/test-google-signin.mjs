/* Signing in with Google, the server's part (Nov 2026, Andrew: "a few people having trouble logging into the app
   with the Google account"). Against the real api.js with Google's tokeninfo stood in: a Gmail written another way
   on the profile (capitals, dots, a +tag) still finds it — the exact spelling first; the email-in-the-username-box
   sign-in reads it the same way; and portalAuthConfig says whether Google's page-and-back way is on. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('google-signin');
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
process.env.GP_GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
delete process.env.GP_GOOGLE_REDIRECT;
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_andrew', name: 'Andrew L', username: 'andrew', email: 'Andrew.Lee+ywam@Gmail.com', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_exact', name: 'Exact Person', username: 'exact', email: 'jo.smith@gmail.com', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_dotless', name: 'Other Jo', username: 'otherjo', email: 'josmith@gmail.com', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_work', name: 'Work Mail', username: 'work', email: 'Sam.Work@ywam.org', dept: 'Community Service', ministry: 'Cafe' }),
];
/* Google's tokeninfo, stood in: the token names the account */
const ACCOUNTS = { 'tok-andrew': { email: 'andrewlee@gmail.com', sub: 'g-andrew' }, 'tok-jo': { email: 'jo.smith@gmail.com', sub: 'g-jo' },
  'tok-sam': { email: 'sam.work@ywam.org', sub: 'g-sam' }, 'tok-samdots': { email: 's.a.m.work@ywam.org', sub: 'g-sam2' } };
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.indexOf('tokeninfo') > -1) {
    const tok = decodeURIComponent(u.split('access_token=')[1] || '');
    const a = ACCOUNTS[tok];
    if (!a) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ aud: 'cid.apps.googleusercontent.com', email: a.email, email_verified: 'true', expires_in: '3500', sub: a.sub }) };
  }
  if (u.indexOf('userinfo') > -1) return { ok: true, json: async () => ({ name: 'Someone' }) };
  return { ok: false, json: async () => ({}) };
};
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

let r = (await call('staffLoginGoogle', ['tok-andrew'])).body;
ok('a Gmail written another way on the profile (capitals, dots, a +tag) still finds it', r && r.ok && r.user === 'andrew', JSON.stringify(r));
ok('… and the Google account is then linked to that profile for next time', mem.staff.find(s => s.id === 'st_andrew').google.sub === 'g-andrew');
r = (await call('staffLoginGoogle', ['tok-jo'])).body;
ok('the exact spelling wins over one that only matches without its dots', r && r.ok && r.user === 'exact', JSON.stringify(r && r.user));
r = (await call('staffLoginGoogle', ['tok-sam'])).body;
ok('a work email matches whatever its capitals', r && r.ok && r.user === 'work');
r = (await call('staffLoginGoogle', ['tok-samdots'])).body;
ok('… but dots only don’t count for Gmail — s.a.m.work@ywam.org is someone else', r && r.ok === false && r.err === 'new' && r.email === 's.a.m.work@ywam.org');
r = (await call('staffLogin', ['ANDREW.LEE@GMAIL.COM', '1234'])).body;
ok('an email typed in the username box is read the same way', r && r.ok && r.user === 'andrew', JSON.stringify(r && (r.user || r.err)));
r = (await call('staffLoginGoogle', ['tok-unknown'])).body;
ok('a token Google doesn’t confirm is refused', r && r.ok === false && r.err === 'google');
r = (await call('portalAuthConfig', [])).body;
ok('Google’s page-and-back way is off until the site turns it on', r.ok && r.google === 'cid.apps.googleusercontent.com' && r.redirect === false);
process.env.GP_GOOGLE_REDIRECT = 'on';
r = (await call('portalAuthConfig', [])).body;
ok('… GP_GOOGLE_REDIRECT=on turns it on', r.redirect === true);
r = (await call('getMyBoot', ['andrew', '1234'])).body;
ok('the boot says so too', r && r.ok && r.googleRedirect === true && r.googleId === 'cid.apps.googleusercontent.com');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
