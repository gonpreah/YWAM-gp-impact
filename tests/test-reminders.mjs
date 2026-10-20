/* Reminders (Oct 2026): web push from the server with no library — an admin makes
   the app's keys once, a phone subscribes (only to a real push service), the message
   is encrypted to that phone (RFC 8291) and signed (VAPID, RFC 8292), and the hourly
   job sends each person one notification at their hour with only what applies. This
   decrypts what the server sends exactly as a phone would. Real api.js, fake store,
   fetch stood in for the push services. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('reminders');
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
for (const f of fs.readdirSync(REPO + '/netlify/functions')) {
  if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
}
process.env.GP_LEADER_CODE = 'leadercode';
delete process.env.GP_VAPID_PUBLIC; delete process.env.GP_VAPID_PRIVATE;
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = (o) => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: '', staffType: 'campus' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com', mentorId: 'st1', mentorStatus: 'approved' }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com' }),
  mk({ id: 'st4', name: 'New Leader', username: 'newl', email: 'n@e.com', dept: 'Campus Leadership', ministry: 'Community Service', active: false })
];
const call = async (fn, args) => {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return (await r.json().catch(() => null)) || {};
};
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
/* a phone: its own key pair and secret */
function phone(host) {
  const e = crypto.createECDH('prime256v1'); e.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh: e, auth, sub: { endpoint: 'https://' + (host || 'fcm.googleapis.com') + '/fcm/send/' + crypto.randomBytes(6).toString('hex'), keys: { p256dh: b64u(e.getPublicKey()), auth: b64u(auth) } } };
}
/* decrypt as the phone would (RFC 8291) */
function decrypt(ph, body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = ph.ecdh.computeSecret(asPub);
  const hk = (s, i, info, n) => Buffer.from(crypto.hkdfSync('sha256', i, s, info, n));
  const ikm = hk(ph.auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ph.ecdh.getPublicKey(), asPub]), 32);
  const cek = hk(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), nonce = hk(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  if (pt[pt.length - 1] !== 2) throw new Error('no last-record delimiter');
  return JSON.parse(pt.subarray(0, pt.length - 1).toString('utf8'));
}
let sent = [], answer = 201;
globalThis.fetch = async (url, opts) => { sent.push({ url, opts }); return { status: answer, ok: answer < 300 }; };

/* ---------- 1. off until an admin turns it on ---------- */
let r = await call('getMyBoot', ['kanha', '1234']);
ok('with no keys there are no reminders: the boot says so', r.ok && r.push === null);
const k = phone();
r = await call('savePushSub', ['kanha', '1234', k.sub, 'en']);
ok('… and a phone cannot subscribe', r.ok === false && r.err === 'not_set_up');
r = await call('adminSetUpPush', ['kanha', '1234']);
ok('only an admin can turn them on', r.ok === false && !mem.pushKeys);
r = await call('adminSetUpPush', ['uriah', '1234']);
ok('an admin turns them on: a key pair, kept on the server', r.ok && mem.pushKeys && unb64u(mem.pushKeys.pub).length === 65 && unb64u(mem.pushKeys.priv).length === 32 && /^mailto:u@e\.com$/.test(mem.pushKeys.subject));
const pub1 = mem.pushKeys.pub;
await call('adminSetUpPush', ['uriah', '1234']);
ok('… once — turning on again keeps the same keys', mem.pushKeys.pub === pub1);
r = await call('getMyBoot', ['kanha', '1234']);
ok('the boot carries the public key, never the private one', r.push && r.push.key === pub1 && !JSON.stringify(r).includes(mem.pushKeys.priv) && r.push.prefs.hour === 19);

/* ---------- 2. subscribing ---------- */
r = await call('savePushSub', ['kanha', '1234', Object.assign({}, k.sub, { endpoint: 'https://evil.example.com/x' }), 'en']);
ok('a subscription can only point at a real push service', r.ok === false && r.err === 'bad_endpoint');
r = await call('savePushSub', ['kanha', '1234', Object.assign({}, k.sub, { endpoint: 'http://fcm.googleapis.com/x' }), 'en']);
ok('… over https', r.ok === false);
r = await call('savePushSub', ['kanha', '1234', { endpoint: k.sub.endpoint, keys: { p256dh: 'abc', auth: 'x' } }, 'en']);
ok('… with real keys', r.ok === false && r.err === 'bad_keys');
r = await call('savePushSub', ['kanha', '1234', k.sub, 'en']);
ok('Kanha\'s phone subscribes', r.ok && mem.pushSubs.length === 1 && mem.pushSubs[0].staffId === 'st2');
const u = phone('web.push.apple.com');
await call('savePushSub', ['uriah', '1234', u.sub, 'km']);
const d = phone('updates.push.services.mozilla.com');
await call('savePushSub', ['dara', '1234', d.sub, 'en']);
ok('iPhone (Apple) and Firefox push services are allowed too', mem.pushSubs.length === 3);
ok('the roster says nothing about reminders', !JSON.stringify(await call('teamRoster', ['dara', '1234'])).includes('push'));

/* ---------- 3. the test message: encrypted to the phone, signed ---------- */
sent = [];
r = await call('sendTestPush', ['kanha', '1234']);
ok('Send me a test reaches the phone', r.ok && sent.length === 1 && sent[0].url === k.sub.endpoint);
const msg = decrypt(k, sent[0].opts.body);
ok('… decrypts on the phone (aes128gcm) to the message', msg.title === 'My YWAM GP' && /Reminders are on/.test(msg.body) && sent[0].opts.headers['Content-Encoding'] === 'aes128gcm');
const auth = sent[0].opts.headers.Authorization, m = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
const [jh, jb, js] = m[1].split('.');
const P = unb64u(m[2]);
const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(P.subarray(1, 33)), y: b64u(P.subarray(33)) }, format: 'jwk' });
const claims = JSON.parse(unb64u(jb).toString());
ok('… signed with the app\'s key (VAPID ES256) for that push service', crypto.verify('sha256', Buffer.from(jh + '.' + jb), { key: pubKey, dsaEncoding: 'ieee-p1363' }, unb64u(js)) && m[2] === pub1 && claims.aud === 'https://fcm.googleapis.com' && claims.exp > Date.now() / 1000);

/* ---------- 4. the hourly run ---------- */
await call('savePushPrefs', ['dara', '1234', { hour: 7 }]);
mem.dailyLogs = [{ staffId: 'st3', date: '2026-10-19' }];
const MON_19 = new Date('2026-10-19T12:00:00Z');   // Monday 19 Oct 2026, 19:00 in Phnom Penh
sent = [];
r = await api.runReminders(MON_19);
const byUrl = Object.fromEntries(sent.map((x) => [x.url, x]));
ok('at 19:00 everyone whose hour it is gets one notification — Dara chose 07:00', r.ok && sent.length === 2 && !byUrl[d.sub.endpoint], JSON.stringify(r));
const kan = decrypt(k, byUrl[k.sub.endpoint].opts.body);
ok('Kanha: today\'s check-in isn\'t in', /check-in for today/.test(kan.body) && kan.body.split('\n').length === 1);
const uri = decrypt(u, byUrl[u.sub.endpoint].opts.body);
ok('Uriah (in Khmer): check-in, a 1-on-1 with Kanha behind, and a sign-up waiting', /ការរាយការណ៍/.test(uri.body) && /Kanha/.test(uri.body) && /0/.test(uri.body) && /1 កំពុងរង់ចាំ/.test(uri.body), uri.body.replace(/\n/g, ' / '));
sent = [];
r = await api.runReminders(MON_19);
ok('the same hour never sends twice', sent.length === 0 && r.skipped === 'already_ran');
sent = [];
r = await api.runReminders(new Date('2026-10-20T00:00:00Z'));   // Tuesday 07:00
ok('Dara at 07:00 the next morning: a new day, and her check-in isn\'t in yet', sent.length === 1 && sent[0].url === d.sub.endpoint && /check-in/.test(decrypt(d, sent[0].opts.body).body));
mem.dailyLogs.push({ staffId: 'st2', date: '2026-10-20' });
await call('savePushPrefs', ['kanha', '1234', { hour: 8, daily: true }]);
sent = [];
await api.runReminders(new Date('2026-10-20T01:00:00Z'));   // 08:00, Kanha logged
ok('nothing to say, nothing sent', sent.length === 0);
await call('savePushPrefs', ['uriah', '1234', { hour: 9, daily: false, oneonone: true, admin: false }]);
sent = [];
await api.runReminders(new Date('2026-10-20T02:00:00Z'));   // Tuesday 09:00: 1-on-1s only on Mondays, admin off, daily off
ok('each kind can be switched off, and 1-on-1 reminders wait for Monday', sent.length === 0);

/* ---------- 5. a phone that's gone ---------- */
await call('savePushPrefs', ['kanha', '1234', { hour: 10 }]);
mem.dailyLogs = [];
answer = 410; sent = [];
r = await api.runReminders(new Date('2026-10-20T03:00:00Z'));
ok('a subscription the push service has dropped (410) is removed', r.dropped === 1 && !mem.pushSubs.some((x) => x.endpoint === k.sub.endpoint));
answer = 201;
r = await call('deletePushSub', ['dara', '1234', d.sub.endpoint]);
ok('Turn off removes this phone', r.ok && !mem.pushSubs.some((x) => x.endpoint === d.sub.endpoint));
r = await call('adminPushStatus', ['uriah', '1234']);
ok('Admin → Reminders: on, how many people and phones, the last run', r.ok && r.ready && r.people === 1 && r.phones === 1 && r.last.slot);

/* ---------- 6. right away: what the bell says, on the phone (Oct 2026) ---------- */
answer = 201;
const k2 = phone(), u2 = phone();
await call('savePushSub', ['kanha', '1234', k2.sub, 'en']); await call('savePushSub', ['uriah', '1234', u2.sub, 'en']);
const to = (ph) => sent.filter((x) => x.url === ph.sub.endpoint).map((x) => decrypt(ph, x.opts.body).body);
const ahead = (n) => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
sent = [];
r = await call('requestOneOnOne', ['kanha', '1234', 'st1', 'Can we talk?']);
ok('Kanha asks her mentor for a 1-on-1: his phone hears of it at once', r.ok && to(u2).length === 1 && /Kanha Lim asked you for a 1-on-1/.test(to(u2)[0]), JSON.stringify(to(u2)));
const oid = r.oneOnOnes.find((o) => o.status === 'pending').id;
r = await call('respondToOneOnOne', ['uriah', '1234', oid, true, '2020-01-01T10:00']);
ok('a time in the past is refused', r.ok === false && r.err === 'bad_when');
r = await call('respondToOneOnOne', ['kanha', '1234', oid, true, ahead(2) + 'T15:00']);
ok('only the one asked can answer', r.ok === false);
sent = [];
r = await call('respondToOneOnOne', ['uriah', '1234', oid, true, ahead(2) + 'T15:00']);
const ro = r.ok && r.oneOnOnes.find((o) => o.id === oid);
ok('Uriah sets the day and time: it is on, with the time, set by him', ro && ro.status === 'accepted' && ro.when === ahead(2) + 'T15:00' && ro.whenByMe === true);
ok('… and Kanha\'s phone says so, with the day and time', to(k2).length === 1 && /Uriah Lyford set your 1-on-1 for .+, 3:00 pm\./.test(to(k2)[0]), JSON.stringify(to(k2)));
sent = [];
r = await call('setOneOnOneTime', ['kanha', '1234', oid, ahead(3) + 'T09:30']);
ok('either of the pair can move it; the other hears', r.ok && r.oneOnOnes.find((o) => o.id === oid).when === ahead(3) + 'T09:30' && /Kanha Lim set your 1-on-1 for .+, 9:30 am/.test(to(u2)[0] || ''));
r = await call('setOneOnOneTime', ['dara', '1234', oid, ahead(3) + 'T09:30']);
ok('… nobody else can', r.ok === false);
await call('savePushPrefs', ['kanha', '1234', { hour: 10, alerts: false }]);
sent = [];
await call('setOneOnOneTime', ['uriah', '1234', oid, ahead(4) + 'T08:00']);
ok('“Right away” switched off: nothing to that phone', to(k2).length === 0);
await call('savePushPrefs', ['kanha', '1234', { hour: 10, alerts: true }]);
sent = [];
await call('updateProfile', ['dara', '1234', { mentorId: 'st1' }]);
ok('choosing a mentor: their phone hears of it', /Dara Sok asked you to be their mentor/.test(to(u2)[0] || ''));
sent = [];
r = await call('saveTrip', ['kanha', '1234', { from: ahead(10), to: ahead(11), type: 'personal', reason: 'Visit family' }]);
ok('asking for leave: the mentor\'s phone hears of it', /Kanha Lim asked for leave/.test(to(u2)[0] || ''));
const tid = mem.trips.find((x) => x.staffId === 'st2' && x.status === 'pending').id;
sent = [];
await call('respondToTrip', ['uriah', '1234', tid, true]);
ok('… and the answer reaches hers', /was approved/.test(to(k2)[0] || ''));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
