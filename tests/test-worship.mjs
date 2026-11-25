/* The Worship rota (Youth Education › Worship), against the real api.js.

   Who makes it (the ministry's people and admins; nobody else, never an applicant); a fresh week comes from
   the settings (four services, the default roles); a saved week is cleaned (people from the campus by id,
   typed names, one person in a single role, links http(s) only, setlists only from the library); a draft is
   the team's alone until published; after a service its numbers go into `entries` as tool:worship rows —
   never over a typed row; our own songs count in the week each step was reached; musicians in training is
   a level from the team list; copying last week; settings; who is away; My Home's line in the boot; the
   tool's metric list matches taxonomy.js. Every name here is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('worship');
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
fs.writeFileSync(TMP + '/team-seed.js', 'export default [];');
fs.copyFileSync(REPO + '/netlify/functions/portal-forms-default.js', TMP + '/portal-forms-default.js');
fs.copyFileSync(REPO + '/netlify/functions/legal-docs-default.js', TMP + '/legal-docs-default.js');
fs.copyFileSync(REPO + '/netlify/functions/legal-pdf.js', TMP + '/legal-pdf.js');
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/library-audio-lib.js');
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');

const st = (o) => ({ role: '', active: true, campus: 'siemreap', staffType: 'campus', ...o });
const PEOPLE = [
  st({ id: 'st_w', name: 'Wren Worship', username: 'wren', dept: 'Youth Education', ministry: 'Worship' }),
  st({ id: 'st_k', name: 'Kai Keys', username: 'kai', dept: 'Community Service', ministry: 'Cafe', ministries: ['Youth Education|Worship'] }),
  st({ id: 'st_r', name: 'Rae Reader', username: 'rae', dept: 'Skills Training', ministry: 'Culinary' }),
  st({ id: 'st_a', name: 'Ada Admin', username: 'ada', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  st({ id: 'st_p', name: 'Poi Person', username: 'poi', campus: 'poipet', dept: 'Youth Education', ministry: 'Worship' }),
  st({ id: 'st_app', name: 'App Licant', username: 'appl', dept: '', ministry: '', kind: 'applicant', applicant: { type: 'staff', school: '', candidateId: 'c1' } }),
];
mem.staff = PEOPLE.map(s => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) }));

async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json().catch(() => null);
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
// Mondays, the way the rota keys weeks (Cambodia time)
const monday = (n) => { const d = new Date(Date.now() + 7 * 3600000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7 * n); return d.toISOString().slice(0, 10); };
const addD = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const M0 = monday(0), M1 = monday(1), MP = monday(-1);
const W = ['wren', '1234'], K = ['kai', '1234'], R = ['rae', '1234'];
const rows = (metric) => (mem.entries || []).filter(r => r.dept === 'Youth Education' && r.ministry === 'Worship' && r.metric === metric);

console.log('=== who makes it ===');
let r = await call('worshipBoard', [...W, M0]);
ok('the worship team opens this week to edit, a fresh week from the settings', r.ok && r.canEdit && r.isNew && r.rec.services.length === 4 && r.week === M0, JSON.stringify(r).slice(0, 160));
ok('the four services: Monday morning and night, Wednesday morning intercession, Thursday night', r.rec.services.map(s => s.day).join() === '1,1,3,4' && /intercession/i.test(r.rec.services[2].name));
ok('the default roles lead with the worship leader', r.roles[0].id === 'lead' && r.roles.some(x => x.id === 'vocals' && x.many) && r.roles.some(x => x.id === 'drums'));
ok('a member through "other ministries" may edit too', (await call('worshipBoard', [...K, M0])).canEdit === true);
ok('an admin may edit', (await call('worshipBoard', ['ada', '1234', M0])).canEdit === true);
r = await call('worshipBoard', [...R, M0]);
ok('anyone else on the campus reads only — and a week not made is nothing', r.ok && r.canEdit === false && r.rec === null && !r.team && !r.songs && !r.away);
ok('saving needs the ministry', (await call('worshipSaveWeek', [...R, M0, { services: [] }, 'save'])).err === 'not_authorized');
ok('an applicant gets nothing', (await call('worshipBoard', ['appl', '1234', M0])).ok === false);
ok('a wrong PIN gets nothing', (await call('worshipBoard', ['wren', '0000', M0])).ok === false);
ok('more than eight weeks ahead is refused', (await call('worshipSaveWeek', [...W, monday(9), { services: [] }, 'save'])).err === 'bad_week');
ok('any day of a week means its Monday', (await call('worshipBoard', [...W, addD(M0, 3)])).week === M0);

console.log('=== songs ===');
r = await call('worshipSaveSong', [...W, { title: '  Example Song  ', key: 'G', link: 'javascript:alert(1)', lang: 'km', notes: 'slow intro' }, M0]);
ok('a song is kept, a link that isn’t http(s) dropped', r.ok && r.songs.length === 1 && r.songs[0].title === 'Example Song' && r.songs[0].link === '' && r.songs[0].lang === 'km');
const SG = r.songs[0].id;
r = await call('worshipSaveSong', [...W, { id: SG, title: 'Example Song', key: 'A', link: 'https://example.org/chords' }, M0]);
ok('an edit keeps its id; an https link stays', r.songs.length === 1 && r.songs[0].key === 'A' && r.songs[0].link === 'https://example.org/chords');
ok('a song needs a title', (await call('worshipSaveSong', [...W, { title: '' }, M0])).err === 'no_title');

console.log('=== a week ===');
const base = (await call('worshipBoard', [...W, M1])).rec;
const svc = JSON.parse(JSON.stringify(base.services));
svc[0].slots = { lead: [{ id: 'st_w' }, { id: 'st_k' }], vocals: [{ id: 'st_k' }, { name: '  Guest   Singer ' }, { name: 'Guest Singer' }], keys: [{ id: 'st_p', name: 'Poi Person' }], drums: [{ id: 'st_app' }] };
svc[0].setlist = [{ songId: SG, note: 'key of A' }, { songId: 'nope' }, { songId: SG }];
svc[0].notes = 'Practice at 6:45';
svc[1].off = true;
r = await call('worshipSaveWeek', [...W, M1, { services: svc }, 'save']);
const s0 = r.rec.services[0];
ok('a single role takes one person', s0.slots.lead.length === 1 && s0.slots.lead[0].id === 'st_w');
ok('several people sing; a typed guest is kept once, tidied', s0.slots.vocals.length === 2 && s0.slots.vocals[1].name === 'Guest Singer' && !s0.slots.vocals[1].id);
ok('someone from the other campus is kept only as a name, an applicant not by id', s0.slots.keys[0].name === 'Poi Person' && !s0.slots.keys[0].id && !(s0.slots.drums || []).some(p => p.id));
ok('the setlist takes only songs in the library, once each, with the song’s title', s0.setlist.length === 1 && s0.setlist[0].title === 'Example Song' && s0.setlist[0].note === 'key of A');
ok('a service can be off this week; filled counts the others', r.rec.services[1].off === true && r.rec.filled === 1 && r.rec.total === 3, r.rec.filled + '/' + r.rec.total);
ok('still a draft: the team sees it, the campus does not', r.rec.published === false && (await call('worshipBoard', [...R, M1])).rec === null);
r = await call('worshipSaveWeek', [...W, M1, { services: r.rec.services }, 'publish']);
let rd = await call('worshipBoard', [...R, M1]);
ok('published: everyone on the campus reads it, setlist titles included', r.rec.published && rd.rec && rd.rec.services[0].slots.lead[0].name === 'Wren Worship' && rd.rec.services[0].setlist[0].title === 'Example Song');
ok('the other campus never sees it', (await call('worshipBoard', ['poi', '1234', M1])).rec === null || (await call('worshipBoard', ['poi', '1234', M1])).rec.services[0].slots.lead === undefined);
const boot = await call('getMyBoot', [...W]);
ok('My Home: the boot says what I am on in the next week', boot.worship && boot.worship.mine.some(x => x.week === M1 && x.roles.includes('Worship leader')), JSON.stringify(boot.worship));
const bootK = await call('getMyBoot', [...K]);
ok('…and Kai is on vocals', bootK.worship.mine.some(x => x.roles.includes('Vocals')));
r = await call('worshipSaveWeek', [...W, M1, { services: r.rec.services }, 'save']);
ok('saving again keeps it published', r.rec.published === true);
await call('worshipSaveWeek', [...W, M1, { services: r.rec.services }, 'unpublish']);
ok('taken down: gone for the campus', (await call('worshipBoard', [...R, M1])).rec === null);
ok('…and from My Home', !(await call('getMyBoot', [...W])).worship.mine.length);

console.log('=== after a service: the numbers ===');
ok('a service still to come can’t be held', (await call('worshipHeld', [...W, monday(2), 'monam', { held: true, count: 10 }])).err === 'not_yet');
r = await call('worshipHeld', [...W, MP, 'monam', { held: true, count: 40, practice: 2.5 }]);
ok('a held service is kept on the week', r.ok && r.rec.services[0].held === true && r.rec.services[0].count === 40);
await call('worshipHeld', [...W, MP, 'monpm', { held: false, count: 99, practice: '' }]);
let nh = rows('Worship Nights Hosted'), at = rows('Attendance at Gatherings'), hp = rows('Hours Spent Practicing');
ok('Worship Nights Hosted counts the services held (not the one that didn’t happen)', nh.length === 1 && nh[0].value === 1 && nh[0].by === 'tool:worship', JSON.stringify(nh));
ok('attendance sums who came (a service that didn’t happen keeps no count)', at.length === 1 && at[0].value === 40);
ok('practice hours sum', hp.length === 1 && hp[0].value === 2.5);
ok('bad numbers are refused', (await call('worshipHeld', [...W, MP, 'wedam', { held: true, count: 'lots' }])).err === 'bad_number');
// a typed attendance for the week stays
mem.entries = mem.entries.map(x => x.metric === 'Attendance at Gatherings' ? { ...x, value: 55, by: 'st_k' } : x);
await call('worshipHeld', [...W, MP, 'wedam', { held: true, count: 12 }]);
at = rows('Attendance at Gatherings'); nh = rows('Worship Nights Hosted');
ok('a number someone typed is never overwritten', at.length === 1 && at[0].value === 55 && at[0].by === 'st_k', JSON.stringify(at));
ok('…while the tool’s own rows still follow', nh[0].value === 2);
await call('worshipHeld', [...W, MP, 'monam', { held: null }]);
await call('worshipHeld', [...W, MP, 'monpm', { held: null }]);
await call('worshipHeld', [...W, MP, 'wedam', { held: null }]);
ok('clearing every answer takes the tool’s rows away, the typed one stays', rows('Worship Nights Hosted').length === 0 && rows('Attendance at Gatherings').length === 1 && rows('Hours Spent Practicing').length === 0);
ok('Salvations is never written by the tool', rows('Salvations').length === 0);

console.log('=== our own songs, the team ===');
const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
await call('worshipSaveSong', [...W, { title: 'Our Song', own: { written: today, recorded: '', uploaded: addD(today, 30) } }, M0]);
ok('a song of ours written this week counts as written', rows('Songs Written').some(x => x.value === 1));
ok('a date in the future (beyond tomorrow) is dropped', !rows('Songs Uploaded to Social Media').length);
const ours = (await call('worshipBoard', [...W, M0])).songs.find(s => s.title === 'Our Song');
await call('worshipSaveSong', [...W, { id: ours.id, remove: true }, M0]);
ok('removing it clears the count', !rows('Songs Written').length);
r = await call('worshipSaveTeam', [...W, { staffId: 'st_k', roles: ['keys', 'vocals', 'kazoo'], training: true }, M0]);
ok('a team member: staff by id, only real roles', r.ok && r.team.length === 1 && r.team[0].name === 'Kai Keys' && r.team[0].roles.join() === 'keys,vocals');
await call('worshipSaveTeam', [...W, { name: 'Typed Drummer', roles: ['drums'], training: false }, M0]);
ok('Musicians in Training is the team’s level this week', rows('Musicians in Training').some(x => x.value === 1));
ok('the same person twice is refused', (await call('worshipSaveTeam', [...W, { staffId: 'st_k' }, M0])).err === 'already');
ok('the team list is the ministry’s to change', (await call('worshipSaveTeam', [...R, { name: 'X' }, M0])).err === 'not_authorized');

console.log('=== copy, settings, away, dashboard ===');
r = await call('worshipCopyWeek', [...W, monday(2)]);
ok('a week copied from the latest before it: the same people, no setlist, nothing held', r.ok && r.rec.services[0].slots.lead[0].id === 'st_w' && !r.rec.services[0].setlist.length && r.rec.published === false, JSON.stringify(r).slice(0, 120));
await call('worshipSaveWeek', [...W, monday(3), { services: r.rec.services }, 'publish']);
ok('a published week isn’t copied over', (await call('worshipCopyWeek', [...W, monday(3)])).err === 'published');
r = await call('worshipSaveSettings', [...W, { roles: [{ name: 'Vocals', many: true }], services: [{ name: 'Friday prayer worship', day: 5, time: '18:30', place: 'The hall' }, { name: '' }] }, M0]);
ok('settings: the worship leader is always a role; an empty service is dropped', r.ok && r.settings.roles[0].id === 'lead' && r.settings.services.length === 1 && r.settings.services[0].time === '18:30');
ok('a week not made yet starts from the new settings', (await call('worshipBoard', [...W, monday(5)])).rec.services[0].name === 'Friday prayer worship');
ok('a week already made keeps its own', (await call('worshipBoard', [...W, M1])).rec.services.length === 4);
ok('no services at all is refused', (await call('worshipSaveSettings', [...W, { services: [] }, M0])).err === 'no_services');
mem.trips = [{ id: 'tr1', staffId: 'st_k', from: M1, to: addD(M1, 1), status: 'approved' }, { id: 'tr2', staffId: 'st_w', from: M1, to: M1, status: 'declined' }];
r = await call('worshipBoard', [...W, M1]);
ok('who is on approved leave that week', r.away.st_k && r.away.st_k.includes(M1) && !r.away.st_w);
ok('the dashboard is there for the team', r.dash && typeof r.dash.held === 'number' && Array.isArray(r.dash.served));

console.log('=== the tool’s metrics match taxonomy.js ===');
const tax = fs.readFileSync(REPO + '/public/taxonomy.js', 'utf8');
const src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const a = JSON.parse(/var WORSHIP_AUTO_METRICS = (\[[^\]]*\])/.exec(tax)[1].replace(/'/g, '"'));
const b = JSON.parse(/const WORSHIP_AUTO = (\[[^\]]*\])/.exec(src)[1].replace(/'/g, '"'));
ok('WORSHIP_AUTO (api.js) and WORSHIP_AUTO_METRICS (taxonomy.js) are the same list', a.join('|') === b.join('|'));
const sb = {}; new Function('g', tax + '\ng.f=autoMetricsFor;g.d=getBaselineDepartments;')(sb);
ok('autoMetricsFor: Worship on both campuses, every metric is Worship’s own, Salvations not among them',
  sb.f('poipet', 'Youth Education', 'Worship').length === 7 && sb.f('siemreap', 'Youth Education', 'Worship').length === 7 &&
  a.every(m => sb.d('poipet')['Youth Education'].Worship.includes(m)) && !a.includes('Salvations'));
ok('GPDTS keeps its own list', sb.f('siemreap', 'Leadership Development', 'GPDTS').includes('Students Applied'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
