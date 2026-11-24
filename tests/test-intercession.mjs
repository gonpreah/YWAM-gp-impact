/* Intercession (Nov 2026, Uriah): the Wednesday plans, prayer needs, the fast and its joins, against the real
   api.js — who may write and read, what is cleaned, that nobody learns who fasts (counts only), and the weekly
   rows the tool writes (tagged tool:intercession, never over a typed number, cleared when nothing is held). */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('icp');
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
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js'])
  fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_ic', name: 'Ina Prayer', username: 'ina', dept: 'Youth Education', ministry: 'Intercession' }),
  withPin({ id: 'st_old', name: 'Olly Moved', username: 'olly', dept: 'Community Service', ministry: 'Intercession' }),   // the old department: still the ministry
  withPin({ id: 'st_yed', name: 'Yan Director', username: 'yan', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  withPin({ id: 'st_cafe', name: 'Cal Fay', username: 'cal', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_cafe2', name: 'Cora Bean', username: 'cora', dept: 'Community Service', ministry: 'Cafe' }),
  withPin({ id: 'st_admin', name: 'Admin Person', username: 'admin', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  withPin({ id: 'st_pp', name: 'Poi Pet', username: 'poi', campus: 'poipet', dept: 'Youth Education', ministry: 'Intercession' }),
  withPin({ id: 'st_app', name: 'App Licant', username: 'appl', kind: 'applicant', applicant: { type: 'student' } }),
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
const pnp = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = pnp(Date.now());
const addD = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();
let LASTWED = TODAY; while (dow(LASTWED) !== 3) LASTWED = addD(LASTWED, -1);   // today, if it is a Wednesday
const WED2 = addD(LASTWED, -14), NEXTWED = addD(LASTWED, 7);
/* the app's own week rule (week 1 holds 1 January), as api.js counts */
function weekYear(iso) { const n = Date.parse(iso + 'T00:00:00Z') / 864e5; const y = new Date(iso + 'T00:00:00Z').getUTCFullYear(); return n >= mon1(y + 1) ? y + 1 : y; }
function mon1(y) { const j = Date.UTC(y, 0, 1); return Math.round(j / 864e5) - ((new Date(j).getUTCDay() + 6) % 7); }
function week(iso) { const n = Date.parse(iso + 'T00:00:00Z') / 864e5; return Math.max(1, Math.min(52, Math.floor((n - mon1(weekYear(iso))) / 7) + 1)); }
const row = (metric, iso) => (mem.entries || []).find(r => r.campus === 'siemreap' && r.dept === 'Youth Education' && r.ministry === 'Intercession' &&
  r.metric === metric && Number(r.week) === week(iso) && Number(r.year) === weekYear(iso));

console.log('=== who may read and write ===');
let r = await call('getIntercession', ['cal', '1234']);
ok('anyone on staff reads it', r.body.ok === true && r.body.canEdit === false, JSON.stringify(r.body).slice(0, 80));
ok('the next Wednesday is a Wednesday, today or later', dow(r.body.nextWed) === 3 && r.body.nextWed >= TODAY && r.body.nextWed <= addD(TODAY, 6));
r = await call('getIntercession', ['ina', '1234']);
ok('the ministry edits', r.body.ok && r.body.canEdit === true && !!r.body.dash);
r = await call('getIntercession', ['olly', '1234']);
ok('someone still on the old department (Community Service) is the ministry too', r.body.ok && r.body.canEdit === true);
r = await call('getIntercession', ['yan', '1234']);
ok('the Youth Education director edits', r.body.canEdit === true);
r = await call('getIntercession', ['admin', '1234']);
ok('an admin edits', r.body.canEdit === true);
r = await call('getIntercession', ['appl', '1234']);
ok('an applicant gets nothing', r.body.ok === false);
r = await call('getIntercession', ['cal', '9999']);
ok('a wrong PIN gets nothing', r.body.ok === false);
r = await call('intercessionSaveWed', ['cal', '1234', NEXTWED, { focus: 'x' }]);
ok('someone outside the ministry cannot plan a Wednesday', r.body.err === 'not_authorized');
r = await call('intercessionSaveWed', ['ina', '1234', addD(NEXTWED, 1), { focus: 'x' }]);
ok('only a Wednesday', r.body.err === 'not_wednesday');

console.log('=== a Wednesday, cleaned ===');
r = await call('intercessionSaveWed', ['ina', '1234', NEXTWED, { leaderId: 'st_pp', leaderName: 'Guest Pastor', focus: 'F'.repeat(400), scripture: 'Isaiah 62:6-7',
  mins: ['Community Service|Cafe', 'Community Service|Cafe', 'junk', 'Youth Education|Sports'], items: ['Rain', ''], notes: 'private notes', held: true, came: 30, hours: 2 }]);
let w = r.body.weds.find(x => x.date === NEXTWED);
ok('saved', r.body.ok && !!w);
ok('a leader from another campus is not taken; the typed name is', w.leaderId === '' && w.leaderName === 'Guest Pastor');
ok('the focus is cut to 200', w.focus.length === 200);
ok('ministries: well formed, once each', JSON.stringify(w.mins) === JSON.stringify(['Community Service|Cafe', 'Youth Education|Sports']));
ok('empty items dropped', JSON.stringify(w.items) === '["Rain"]');
ok('a Wednesday still to come cannot be held', w.held === null && w.came === null && w.hours === null);
r = await call('getIntercession', ['cal', '1234']);
w = r.body.weds.find(x => x.date === NEXTWED);
ok('everyone sees the plan, not the notes or attendance', w && w.focus && w.notes === undefined && w.came === undefined);
r = await call('intercessionSaveWed', ['ina', '1234', NEXTWED, { leaderId: 'st_cafe', focus: 'The nation' }]);
w = r.body.weds.find(x => x.date === NEXTWED);
ok('a leader on the campus by id, with their name', w.leaderId === 'st_cafe' && w.leaderName === 'Cal Fay');

console.log('=== held: the numbers count themselves ===');
r = await call('intercessionSaveWed', ['ina', '1234', LASTWED, { focus: 'Families', held: true, came: 12.4, hours: 1.6,
  mins: ['Community Service|Cafe', 'Youth Education|Sports'], testimonies: [{ text: 'A job for Sokha' }, { text: 'Rain came' }, { text: '' }] }]);
w = r.body.weds.find(x => x.date === LASTWED);
ok('held, with how many and how long (to a quarter hour)', w.held === true && w.came === 12 && w.hours === 1.5, JSON.stringify(w));
ok('testimonies kept, empty ones dropped, each with an id', w.testimonies.length === 2 && w.testimonies.every(x => x.id));
ok('Prayer Meetings Held = 1, tagged', row('Prayer Meetings Held', LASTWED) && row('Prayer Meetings Held', LASTWED).value === 1 && row('Prayer Meetings Held', LASTWED).by === 'tool:intercession');
ok('Prayer Hours Covered = 1.5', row('Prayer Hours Covered', LASTWED)?.value === 1.5);
ok('Ministries Covered in Prayer = 2', row('Ministries Covered in Prayer', LASTWED)?.value === 2);
ok('Answered-Prayer Testimonies = 2', row('Answered-Prayer Testimonies', LASTWED)?.value === 2);
ok('the director’s score is never written by the tool', !row('Director Weekly Score (1-10)', LASTWED));

console.log('=== a typed number stays ===');
mem.entries.push({ campus: 'siemreap', dept: 'Youth Education', ministry: 'Intercession', metric: 'Prayer Hours Covered', week: week(WED2), year: weekYear(WED2), value: 9, by: 'st_ic', updated: new Date().toISOString() });
r = await call('intercessionSaveWed', ['ina', '1234', WED2, { held: true, hours: 2, came: 5 }]);
ok('the typed hours are kept', row('Prayer Hours Covered', WED2).value === 9 && row('Prayer Hours Covered', WED2).by === 'st_ic');
ok('the rest of that week counts', row('Prayer Meetings Held', WED2)?.value === 1);
r = await call('intercessionSaveWed', ['ina', '1234', WED2, { held: false }]);
ok('not held: the tool’s rows go', !row('Prayer Meetings Held', WED2));
ok('… the typed one stays', row('Prayer Hours Covered', WED2)?.value === 9);

console.log('=== prayer needs ===');
r = await call('intercessionNeedSend', ['cal', '1234', { text: 'Pray for our new barista', ministry: 'Community Service|Cafe', wed: LASTWED, private: false }]);
ok('anyone sends one', r.body.ok === true);
const pub = r.body.needs.find(n => n.text === 'Pray for our new barista');
ok('a Wednesday gone by becomes the next one', pub && pub.wed >= TODAY && dow(pub.wed) === 3, pub && pub.wed);
r = await call('intercessionNeedSend', ['cal', '1234', { text: 'Something private', private: true }]);
r = await call('intercessionNeedSend', ['cal', '1234', { text: '   ' }]);
ok('an empty need is refused', r.body.err === 'empty');
r = await call('getIntercession', ['cora', '1234']);
ok('another staff member sees the shared need, not who sent it', r.body.needs.some(n => n.text === 'Pray for our new barista' && n.byName === undefined));
ok('… and never the private one', !r.body.needs.some(n => n.text === 'Something private'));
r = await call('getIntercession', ['ina', '1234']);
ok('the ministry sees both, with who sent them', r.body.needs.filter(n => n.byName === 'Cal Fay').length === 2);
const priv = r.body.needs.find(n => n.text === 'Something private');
r = await call('intercessionNeedMark', ['cora', '1234', priv.id, 'prayed']);
ok('outside the ministry: cannot mark', r.body.err === 'not_authorized');
r = await call('intercessionNeedDelete', ['cora', '1234', priv.id]);
ok('… nor delete someone else’s', r.body.err === 'not_authorized');
r = await call('intercessionNeedDelete', ['cal', '1234', priv.id]);
ok('the sender deletes their own', r.body.ok && !r.body.needs.some(n => n.id === priv.id));
/* a need for last Wednesday, prayed for: its ministry counts */
mem['icp:siemreap'].needs.push({ id: 'in_x', text: 'For the school', ministry: 'Youth Education|YDC', wed: LASTWED, private: false, byId: 'st_cafe', byName: 'Cal Fay', status: 'open', answer: '', at: new Date().toISOString() });
r = await call('intercessionNeedMark', ['ina', '1234', 'in_x', 'answered', 'They found a teacher']);
ok('marked answered, with how', r.body.ok && r.body.needs.find(n => n.id === 'in_x').answer === 'They found a teacher');
ok('a ministry prayed for that Wednesday counts', row('Ministries Covered in Prayer', LASTWED)?.value === 3);
r = await call('intercessionNeedMark', ['ina', '1234', 'in_x', 'nonsense']);
ok('a made-up status is refused', r.body.err === 'bad_status');
for (let i = 0; i < 12; i++) r = await call('intercessionNeedSend', ['cora', '1234', { text: 'need ' + i }]);
ok('ten a day each', r.body.err === 'too_many');

console.log('=== the fast ===');
const START = addD(TODAY, -2);
r = await call('fastSave', ['cal', '1234', { title: 'Fast', start: START, days: 21 }]);
ok('outside the ministry: cannot plan a fast', r.body.err === 'not_authorized');
r = await call('fastSave', ['ina', '1234', { title: '', start: START, days: 21 }]);
ok('a title is needed', r.body.err === 'no_title');
r = await call('fastSave', ['ina', '1234', { title: 'Fast', start: START, days: 5 }]);
ok('7 to 40 days', r.body.err === 'bad_days');
r = await call('fastSave', ['ina', '1234', { title: 'Fast', start: '2020-01-01', days: 21 }]);
ok('a start long gone is refused', r.body.err === 'bad_date');
r = await call('fastSave', ['ina', '1234', { title: 'January fast', start: START, days: 21, theme: 'Seek first',
  plan: [{ focus: 'Seeking God first', ref: 'Matthew 6:33' }, { focus: 'Repentance', ref: 'Psalm 51:10' }, { focus: 'Our base' }],
  gatherings: [{ day: 1, time: '06:00', place: 'Chapel', held: true, hours: 1 }, { day: 30, time: '06:00' }, { day: 5, time: '25:00', held: true, hours: 2 }] }]);
const F = r.body.fasts && r.body.fasts[0];
ok('saved', r.body.ok && F && F.title === 'January fast' && F.days === 21 && r.body.current === F.id);
ok('a plan for every day', F.plan.length === 21 && F.plan[0].focus === 'Seeking God first' && F.plan[20].focus === '');
ok('a gathering past the last day is dropped; a bad time is blanked', F.gatherings.length === 2 && F.gatherings[1].time === '');
ok('a gathering still to come cannot be held', F.gatherings.find(g => g.day === 5).held === null);
ok('running, on day 3', F.state === 'running' && F.day === 3);
const day1 = addD(START, 0);
ok('a gathering held counts as a prayer meeting in its week', row('Prayer Meetings Held', day1)?.value >= 1, JSON.stringify(row('Prayer Meetings Held', day1)));

console.log('=== joining is private ===');
r = await call('fastJoin', ['cal', '1234', F.id, 'mystery']);
ok('a made-up kind of fast is refused', r.body.err === 'bad_kind');
r = await call('fastJoin', ['cal', '1234', F.id, 'partial']);
let mine = r.body.fasts.find(f => f.id === F.id).mine;
ok('joined, the kind chosen', mine && mine.kind === 'partial' && mine.ticks.length === 0);
ok('a joiner sees no counts', r.body.fasts[0].counts === undefined);
r = await call('fastTick', ['cal', '1234', F.id, 1, true]);
r = await call('fastTick', ['cal', '1234', F.id, 3, true]);
mine = r.body.fasts[0].mine;
ok('days ticked', JSON.stringify(mine.ticks) === '[1,3]');
r = await call('fastTick', ['cal', '1234', F.id, 10, true]);
ok('a day still to come cannot be ticked', r.body.err === 'bad_day');
r = await call('fastTick', ['cora', '1234', F.id, 1, true]);
ok('ticking needs joining first', r.body.err === 'not_joined');
await call('fastJoin', ['cora', '1234', F.id, 'media']);
r = await call('getIntercession', ['ina', '1234']);
const fm = r.body.fasts.find(f => f.id === F.id);
ok('the ministry sees counts: joined, today, days ticked', fm.counts.joined === 2 && fm.counts.today === 1 && fm.counts.ticks === 2, JSON.stringify(fm.counts));
const s = JSON.stringify(r.body.fasts);
ok('… and never who, or what they chose', s.indexOf('st_cafe') === -1 && s.indexOf('Cal Fay') === -1 && s.indexOf('partial') === -1 && s.indexOf('media') === -1);
ok('the ministry’s own part is null (they didn’t join)', fm.mine === null);
r = await call('getMyBoot', ['cal', '1234']);
ok('the boot carries the fast, with my own part', !!(r.body.fast && r.body.fast.id === F.id && r.body.fast.mine && r.body.fast.mine.kind === 'partial'), JSON.stringify(r.body.fast));
ok('the boot’s focus is today’s (day 3)', r.body.fast && r.body.fast.focus === 'Our base');
r = await call('getMyBoot', ['poi', '1234']);
ok('another campus has no fast', r.body.ok && r.body.fast === null);
r = await call('getIntercession', ['poi', '1234']);
ok('another campus sees none of this campus', r.body.ok && r.body.weds.length === 0 && r.body.needs.length === 0 && r.body.fasts.length === 0);
r = await call('fastJoin', ['cal', '1234', F.id, '']);
ok('leaving takes it off', r.body.fasts[0].mine === null && !(mem['fastJoin:siemreap'][F.id] || {}).st_cafe);
r = await call('fastDelete', ['cal', '1234', F.id]);
ok('outside the ministry: cannot delete the fast', r.body.err === 'not_authorized');
r = await call('fastDelete', ['ina', '1234', F.id]);
ok('the ministry deletes it, joins and all', r.body.ok && r.body.fasts.length === 0 && !mem['fastJoin:siemreap'][F.id]);

console.log('=== the lists agree ===');
const tax = fs.readFileSync(REPO + '/public/taxonomy.js', 'utf8'), src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const autoList = JSON.parse(tax.match(/var ICP_AUTO_METRICS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
const serverList = [...src.match(/const ICP_METRICS = \{([^}]+)\}/)[1].matchAll(/:\s*'([^']+)'/g)].map(m => m[1]);
ok('taxonomy’s ICP_AUTO_METRICS = api.js’s ICP_METRICS', JSON.stringify(autoList.slice().sort()) === JSON.stringify(serverList.slice().sort()), serverList.join(', '));
ok('every one is an Intercession metric in the taxonomy', autoList.every(m => tax.indexOf("'" + m + "'") > -1));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
