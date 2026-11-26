/* The quarterly report, ministry by ministry (Nov 2026, Uriah), against the real api.js: who may open what (the
   whole campus, only your own ministries, the board's sign-in, never an applicant), the one call's payload,
   each tool's highlights from seeded tool data, that NOTHING private is in any answer (a student's name, a
   guardian, a payment, a health row or token, staff debt, a prayer need's words, who fasts and how), who may
   write a ministry's story and its caps, the quarter and year edges, and the bell's field on the boot.
   One fixed scenario: the clock is pinned to 18 Nov 2026 (week 47, Q4 = 28 Sep – 27 Dec 2026). Every name and
   story here is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

/* the clock, shifted (not frozen) — before api.js is loaded, so baseToday_ and every stamp read it */
const Real = Date; let OFFSET = 0;
function setNow(iso) { OFFSET = Real.parse(iso) - Real.now(); }
function Shifted(...a) { if (!new.target) return new Real(Real.now() + OFFSET).toString(); return a.length ? new Real(...a) : new Real(Real.now() + OFFSET); }
Shifted.prototype = Real.prototype; Object.setPrototypeOf(Shifted, Real);
Shifted.now = () => Real.now() + OFFSET; Shifted.parse = Real.parse; Shifted.UTC = Real.UTC;
globalThis.Date = Shifted;
setNow('2026-11-18T03:00:00Z');   // 10:00 in Cambodia

const TMP = tmpDir('qreport');
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
const withPin = (s) => ({ active: true, campus: 'siemreap', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_secret_' + s.id, ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
const YDC = 'Youth Education|YDC', CAFE = 'Community Service|Cafe', ICP = 'Youth Education|Intercession';
mem.staff = [
  withPin({ id: 'st_lea', name: 'Lea Director', username: 'lea', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  withPin({ id: 'st_yed', name: 'Yan Youthdir', username: 'yan', dept: 'Campus Leadership', ministry: 'Youth Education', country: 'Norway' }),
  withPin({ id: 'st_admin', name: 'Ada Admin', username: 'ada', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', isAdmin: true }),
  withPin({ id: 'st_yara', name: 'Yara Teacher', username: 'yara', dept: 'Youth Education', ministry: 'YDC', leads: [YDC], ministries: [ICP] }),
  withPin({ id: 'st_cal', name: 'Cal Barista', username: 'cal', dept: 'Community Service', ministry: 'Cafe', country: '' }),
  withPin({ id: 'st_dara', name: 'Dara Coach', username: 'dara', dept: 'Youth Education', ministry: 'Sports', leads: ['Youth Education|Sports'] }),
  withPin({ id: 'st_none', name: 'Nomi Nowhere', username: 'nomi', dept: '', ministry: '' }),
  withPin({ id: 'st_poi', name: 'Poi Director', username: 'poi', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  withPin({ id: 'st_gone', name: 'Gone Away', username: 'gone', dept: 'Community Service', ministry: 'Cafe', active: false }),
  withPin({ id: 'st_app', name: 'App Licant', username: 'appl', kind: 'applicant', applicant: { type: 'student' } }),
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: mkHash('4321', 'bd1'), active: true }];
const E = (dept, ministry, metric, week, value, year, campus) => ({ campus: campus || 'siemreap', dept, ministry, metric, week, value, year: year || 2026, updated: '2026-10-10T00:00:00Z' });
mem.entries = [
  E('Community Service', 'Cafe', 'Cups Sold', 41, 100), E('Community Service', 'Cafe', 'Cups Sold', 45, 50), E('Community Service', 'Cafe', 'Cups Sold', 30, 80),
  E('Community Service', 'Cafe', 'Cups Sold', 50, 7, 2025), E('Community Service', 'Cafe', 'Cups Sold', 5, 9, 2026, 'poipet'),
  E('Community Service', 'Cafe', 'Weekly Profit ($)', 41, 20), E('Community Service', 'Cafe', 'Days Open', 41, 5),
  E('Youth Education', 'YDC', 'Youth Enrolled', 41, 3), E('Youth Education', 'Sports', 'Salvations', 42, 4),
  E('Campus Leadership', 'Youth Education', 'Staff Debt ($)', 41, 987654), E('Campus Leadership', 'Campus Director', 'Base Finances ($)', 41, 876543),
];
const S3 = (wk, extra) => ({ campus: 'siemreap', week: wk, year: 2026, device: 'tok_secret_row' + wk, lonely: 2, clarity: 8, porn: 0, oneOnOne: 1, exercise: 1, quietTime: 1, debt: 0, ...extra });
mem.survey = [S3(41), S3(42), S3(43, { lonely: 9, debt: 1 }), { ...S3(41), campus: 'poipet' }, { ...S3(42), campus: 'poipet' }, S3(30)];
mem['school:siemreap:' + YDC] = {
  settings: { passMark: 50, fee: { amount: 5, per: 'month' } },
  locations: [{ id: 'l1', name: 'Riverside village' }, { id: 'l2', name: 'Market hall' }],
  classes: [{ id: 'c1', locationId: 'l1', name: 'Level 1' }, { id: 'c2', locationId: 'l2', name: 'Level 2' }],
  students: [
    { id: 's1', en: 'Sokny Testchild', kh: 'សុខនី', classId: 'c1', start: '2026-09-01', status: 'active', guardian: 'Guardian Secretname', guardianPhone: '012999888', village: 'Hiddenvillage', faith: { salv: '2026-10-11', bapt: '2026-11-01' } },
    { id: 's2', en: 'Pisey Testchild', kh: '', classId: 'c1', start: '2026-09-01', status: 'active', faith: { salv: '2026-07-01' } },
    { id: 's3', en: 'Rith Testchild', kh: '', classId: 'c2', start: '2026-10-01', status: 'active', faith: {} },
    { id: 's4', en: 'Left Testchild', kh: '', classId: 'c2', start: '2026-01-10', status: 'left', leftOn: '2026-10-05', faith: {} },
  ],
  tests: [{ id: 't1', classId: 'c1', subject: 'English', date: '2026-10-20', outOf: 20, scores: { s1: 18, s2: 6 } }, { id: 't0', classId: 'c1', subject: 'English', date: '2026-08-20', outOf: 20, scores: { s1: 2 } }],
  payments: [{ id: 'p1', studentId: 's1', amount: 37.25, date: '2026-10-02', note: 'PAYNOTE cash' }], events: [],
};
mem['schoolRoll:siemreap:' + YDC] = { rolls: {
  'c1|2026-10-06': { classId: 'c1', date: '2026-10-06', marks: { s1: 'p', s2: 'a' } },
  'c1|2026-10-07': { classId: 'c1', date: '2026-10-07', marks: { s1: 'l', s2: 'p' } },
  'c1|2026-09-01': { classId: 'c1', date: '2026-09-01', marks: { s1: 'a', s2: 'a' } } } };
mem.teamTrips = [
  { id: 'tt1', campus: 'siemreap', name: 'Team Fjord', country: 'Norway', from: '2026-10-10', to: '2026-10-20', size: 12, status: 'active', metrics: {}, reached: {} },
  { id: 'tt2', campus: 'siemreap', name: 'Team Lake', country: 'Canada', from: '2026-11-01', to: '2026-11-09', size: 5, status: 'active', metrics: {}, reached: {} },
  { id: 'tt3', campus: 'siemreap', name: 'Team Cancelled', country: 'Chile', from: '2026-10-01', to: '2026-10-08', size: 9, status: 'cancelled', metrics: {}, reached: {} },
  { id: 'tt4', campus: 'siemreap', name: 'Team Coming', country: 'Kenya', from: '2026-12-01', to: '2026-12-10', size: 4, status: 'active', metrics: {}, reached: {} },
  { id: 'tt5', campus: 'siemreap', name: 'Team Summer', country: 'Japan', from: '2026-08-01', to: '2026-08-10', size: 8, status: 'active', metrics: {}, reached: {} },
];
mem['dtsDb:siemreap'] = { schools: [], events: [], resp: [], resources: [], teams: [
  { id: 'dt1', name: 'Team East', schoolId: '', short: { place: 'Kampot', from: '2026-10-05', to: '2026-10-18', leaders: [], students: [], weeks: [{ male: 10, female: 5, salvations: 2, gospel: 30 }, { male: 4, female: 6, healings: 1, gospel: 12 }], stops: [] },
    long: { place: 'Kep', from: '2026-12-07', to: '2027-01-31', leaders: [], students: [], weeks: [{ male: 99, salvations: 99 }], stops: [] } }] };
mem['icp:siemreap'] = { weds: {
  '2026-10-07': { date: '2026-10-07', held: true, hours: 1.5, came: 10, mins: [CAFE, YDC], testimonies: [{ id: 'a', text: 'TESTIMONYTEXT rain came' }] },
  '2026-10-14': { date: '2026-10-14', held: true, hours: 2, came: 14, mins: [CAFE], testimonies: [] },
  '2026-10-21': { date: '2026-10-21', held: false, mins: [], testimonies: [] },
  '2026-09-09': { date: '2026-09-09', held: true, hours: 5, came: 50, mins: ['Youth Education|Sports'], testimonies: [] } },
  needs: [{ id: 'n1', text: 'PRAYERNEEDTEXT for my family', ministry: CAFE, wed: '2026-10-07', status: 'prayed', byId: 'st_cal', byName: 'Cal Barista', at: '2026-10-05T00:00:00Z' }] };
mem['fast:siemreap'] = { fasts: [{ id: 'f1', title: 'October fast', start: '2026-10-10', days: 7, theme: '', plan: [], gatherings: [{ id: 'g1', day: 1, held: true, hours: 2 }] },
  { id: 'f0', title: 'January fast', start: '2026-01-05', days: 21, plan: [], gatherings: [] }] };
mem['fastJoin:siemreap'] = { f1: { st_cal: { kind: 'daniel', ticks: [1, 2] }, st_yara: { kind: 'fullfastkind', ticks: [] } } };
mem['worship:siemreap'] = { team: [{ id: 'm1', name: 'Mika Keys', training: true }, { id: 'm2', name: 'Noa Drums', training: false }],
  songs: [{ id: 'sg1', title: 'New song', own: { written: '2026-10-12' } }, { id: 'sg2', title: 'Old song', own: { written: '2026-05-01' } }] };
mem['worshipWeeks:siemreap'] = { weeks: { '2026-10-05': { published: true, services: [
  { id: 'a', name: 'Monday', day: 1, held: true, count: 40, slots: {} }, { id: 'b', name: 'Thursday', day: 4, held: true, count: 20, slots: {} },
  { id: 'c', name: 'Wednesday', day: 3, off: true, held: true, count: 500, slots: {} }, { id: 'd', name: 'Mon night', day: 1, held: false, slots: {} }] } } };
mem['hosp:siemreap'] = { buildings: [], rooms: [], bookings: [
  { id: 'b1', category: 'team', name: 'Team Fjord', from: '2026-10-10', to: '2026-10-20', count: 12, bedIds: [] },
  { id: 'b2', category: 'guest', name: 'Guest Privatename', from: '2026-09-25', to: '2026-10-01', count: 2, bedIds: [] },
  { id: 'b3', category: 'staff', name: 'Staff Privatename', from: '2026-01-01', permanent: true, count: 1, bedIds: [] }] };

async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const seen = [];   // every answer, for the privacy sweep at the end
const get = async (u, campus, year, q, pin) => { const r = await call('getQuarterReport', [u, pin || '1234', campus, year, q]); seen.push(JSON.stringify(r.body)); return r.body; };

console.log('=== who may open what ===');
let d = await get('lea', 'siemreap', 2026, 4);
ok('Campus Leadership opens its whole campus', d.ok && d.full === true && d.board === false, JSON.stringify(d).slice(0, 90));
ok('the quarter is the app’s 13-week block: Q4 2026 = 28 Sep – 27 Dec, weeks 40–52', d.from === '2026-09-28' && d.to === '2026-12-27' && d.weeks.join() === '40,52' && d.done === false, d.from + ' ' + d.to);
const LEA = d;
ok('… but not the other campus', (await get('lea', 'poipet', 2026, 4)).err === 'not_authorized');
d = await get('ada', 'siemreap', 2026, 4);
ok('an admin opens any campus', d.ok && d.full === true && d.can.write === 'all' && d.can.letter === true);
d = await get('mary', 'siemreap', 2026, 4, '4321');
ok('the board’s own sign-in opens the whole campus, read only', d.ok && d.full === true && d.board === true && d.can.write.length === 0 && d.can.letter === false, JSON.stringify(d.can));
ok('… either campus', (await get('mary', 'poipet', 2026, 4, '4321')).ok === true);
ok('… and a wrong PIN is refused', (await get('mary', 'siemreap', 2026, 4, '0000')).ok === false);
d = await get('yara', 'siemreap', 2026, 4);
const YARA = d;
ok('a ministry’s leader gets only her own ministries', d.ok && d.full === false && Object.keys(d.people).sort().join() === [ICP, YDC].sort().join(), Object.keys(d.people).join());
ok('… no other ministry’s numbers', Object.keys(d.entries).every(k => k.indexOf(YDC + '|') === 0 || k.indexOf(ICP + '|') === 0) && Object.keys(d.entries).length > 0, Object.keys(d.entries).join(' ; '));
ok('… no cover: no staff mix, health, departments or letter', d.mix === undefined && d.health === undefined && d.depts === undefined && d.letter === null);
ok('… only her own tools', Object.keys(d.tools).sort().join() === [ICP, YDC].sort().join(), Object.keys(d.tools).join());
ok('… and she may write for both', d.can.write.sort().join() === [ICP, YDC].sort().join() && d.can.letter === false);
ok('… not on the other campus', (await get('yara', 'poipet', 2026, 4)).err === 'not_authorized');
d = await get('cal', 'siemreap', 2026, 4);
ok('someone in a ministry gets that ministry’s page', d.ok && !d.full && Object.keys(d.people).join() === CAFE && d.people[CAFE].n === 1, JSON.stringify(d.people));
ok('someone in no ministry is refused', (await get('nomi', 'siemreap', 2026, 4)).err === 'not_authorized');
ok('an applicant is refused', (await get('appl', 'siemreap', 2026, 4)).ok === false);
ok('an account switched off is refused', (await get('gone', 'siemreap', 2026, 4)).ok === false);
ok('nobody at all is refused', (await get('', 'siemreap', 2026, 4, '')).ok === false);
ok('a campus that isn’t one is refused', (await get('lea', 'atlantis', 2026, 4)).err === 'bad_campus');

console.log('=== the one call: rows for rollup.js, people, the mix, health ===');
d = LEA;
ok('the weekly rows of that week year for the campus', d.entries[CAFE + '|Cups Sold']['41'] === 100 && d.entries[CAFE + '|Cups Sold']['45'] === 50 && d.entries[CAFE + '|Cups Sold']['30'] === 80, JSON.stringify(d.entries[CAFE + '|Cups Sold']));
ok('… never another year’s or another campus’s', d.entries[CAFE + '|Cups Sold']['50'] === undefined && d.entries[CAFE + '|Cups Sold']['5'] === undefined && d.prev === null);
ok('… the Teams Database’s rows are laid in (Teams Hosted in the week each left)', d.entries['Community Service|Outreach Teams|Teams Hosted'] && Object.values(d.entries['Community Service|Outreach Teams|Teams Hosted']).reduce((a, b) => a + b, 0) >= 3);
ok('staff debt and the leadership-only money metrics are never sent', !Object.keys(d.entries).some(k => /Staff Debt|Base Finances|Cash Reserve/.test(k)), Object.keys(d.entries).filter(k => /\$/.test(k)).join());
ok('who leads a ministry by name, everyone else a count', d.people[YDC].leaders.join() === 'Yara Teacher' && d.people[YDC].n === 1 && d.people[CAFE].n === 1 && d.people[CAFE].leaders.length === 0 && d.people[ICP].n === 1, JSON.stringify(d.people[YDC]));
ok('a department: its director and how many', d.depts['Youth Education'].directors.join() === 'Yan Youthdir' && d.depts['Youth Education'].n === 2 && d.depts['Community Service'].n === 1, JSON.stringify(d.depts));
ok('the staff as kind and country only — for Khmer / international', d.mix.length === 6 && d.mix.every(m => Object.keys(m).sort().join() === 'campus,country,staffType') && d.mix.filter(m => m.country === 'Norway').length === 1, d.mix.length);
ok('the Staff Health Score: a count and an average, from three check-ins', d.health.now.n === 3 && typeof d.health.now.score === 'number' && d.health.now.score > 0 && d.health.now.score <= 10 && d.health.minN === 3, JSON.stringify(d.health));
ok('… and nothing under three (last quarter had one)', d.health.prev.n === 1 && d.health.prev.score === null);
d = await get('mary', 'poipet', 2026, 4, '4321');
ok('… Poipet’s two check-ins give no score', d.health.now.n === 2 && d.health.now.score === null);

console.log('=== each tool’s highlights, counts only ===');
let T = LEA.tools[YDC];
ok('YDC: students enrolled now, by location', T.kind === 'school' && T.students === 3 && JSON.stringify(T.byLocation) === JSON.stringify([{ name: 'Riverside village', n: 2 }, { name: 'Market hall', n: 1 }]), JSON.stringify(T));
ok('YDC: attendance from the quarter’s rolls (here or late, of everyone marked)', T.attendance === 75 && T.classDays === 2, T.attendance + '% over ' + T.classDays);
ok('YDC: tests given and the pass rate, this quarter’s only', T.tests === 1 && T.passRate === 50);
ok('YDC: salvation and baptism ticks dated in the quarter', T.salvations === 1 && T.baptisms === 1);
T = LEA.tools['Community Service|Outreach Teams'];
ok('Outreach Teams: the teams that left in the quarter, by today', T.kind === 'teams' && T.teams === 2 && T.people === 17 && T.countries.join() === 'Canada,Norway', JSON.stringify(T).slice(0, 160));
ok('… named (a team is an organisation), never a cancelled one or one still to come', T.list.map(x => x.name).join() === 'Team Fjord,Team Lake');
T = LEA.tools['Leadership Development|GPDTS'];
ok('GPDTS: the outreach weeks that began in the quarter', T.kind === 'dts' && T.outreachTeams === 1 && T.places.join() === 'Kampot' && T.reached === 25 && T.salvations === 2 && T.healings === 1 && T.gospel === 42, JSON.stringify(T));
T = LEA.tools[ICP];
ok('Intercession: Wednesdays held, hours (with the fast’s gathering), ministries, testimonies', T.kind === 'icp' && T.wedsHeld === 2 && T.gatheringsHeld === 1 && T.hours === 5.5 && T.ministries === 2 && T.testimonies === 1 && T.avgCame === 12, JSON.stringify(T));
ok('… the fast that touched the quarter: how many joined, nothing else', JSON.stringify(T.fasts) === JSON.stringify([{ title: 'October fast', days: 7, joined: 2 }]), JSON.stringify(T.fasts));
T = LEA.tools['Youth Education|Worship'];
ok('Worship: services held, average attendance, in training, songs written', T.kind === 'worship' && T.held === 2 && T.avg === 30 && T.training === 1 && T.songsWritten === 1, JSON.stringify(T));
T = LEA.tools['Skills Training|Hospitality'];
ok('Hospitality: guest nights (visitors only, inside the quarter), teams housed', T.kind === 'hosp' && T.guestNights === 126 && T.teams === 1 && T.guests === 2, JSON.stringify(T));
ok('a ministry with no tool data has no highlights', LEA.tools[CAFE] === undefined && LEA.tools['Youth Education|Sports'] === undefined);

console.log('=== the story: who may write, the caps ===');
const save = (u, campus, key, rec, y, q) => call('saveQuarterStory', [u, '1234', campus, y || 2026, q || 4, key, rec]).then(r => r.body);
let r = await save('yara', 'siemreap', YDC, { highlights: 'Forty new readers.', story: 'A girl we will call Bopha read aloud for the first time.', challenges: 'CHALLENGETEXT we need a second teacher.', needs: 'Pray for the new class.', extra: 'x' });
ok('the ministry’s leader writes its story', r.ok && r.key === YDC && r.story.highlights === 'Forty new readers.' && r.story.byName === 'Yara Teacher' && r.story.extra === undefined, JSON.stringify(r).slice(0, 120));
ok('… kept in qreport:<campus> under the quarter', mem['qreport:siemreap']['2026-Q4'].ministries[YDC].by === 'st_yara');
ok('someone in the ministry writes', (await save('cal', 'siemreap', CAFE, { highlights: 'Busy mornings.' })).ok === true);
ok('… not for another ministry', (await save('cal', 'siemreap', YDC, { highlights: 'x' })).err === 'not_authorized');
ok('the department’s director writes for its ministries', (await save('yan', 'siemreap', 'Youth Education|Sports', { story: 'A new team.' })).ok === true);
ok('Campus Leadership writes for any ministry on its campus', (await save('lea', 'siemreap', CAFE, { highlights: 'Busy mornings.', needs: 'A grinder.' })).ok === true);
ok('… not on the other campus', (await save('lea', 'poipet', CAFE, { highlights: 'x' })).err === 'not_authorized');
ok('an admin writes anywhere', (await save('ada', 'siemreap', ICP, { highlights: 'Steady.' })).ok === true);
ok('an applicant cannot', (await save('appl', 'siemreap', YDC, { highlights: 'x' })).ok === false);
ok('the board cannot', (await call('saveQuarterStory', ['mary', '4321', 'siemreap', 2026, 4, YDC, { highlights: 'x' }])).body.ok === false);
ok('a key that isn’t a ministry is refused', (await save('lea', 'siemreap', 'nonsense', { highlights: 'x' })).err === 'bad_ministry' && (await save('lea', 'siemreap', 'Campus Leadership|Campus Director', { highlights: 'x' })).err === 'bad_ministry');
r = await save('yara', 'siemreap', YDC, { highlights: 'h'.repeat(5000), story: 'ok\r\nline' });
ok('each part is cut at 1200', r.story.highlights.length === 1200 && r.story.story === 'ok\nline' && r.story.challenges === '');
r = await save('yara', 'siemreap', YDC, { highlights: 'Forty new readers.', story: 'A girl we will call Bopha read aloud for the first time.', challenges: 'CHALLENGETEXT we need a second teacher.', needs: 'Pray for the new class.' });
ok('saved again, whole', r.ok && r.story.challenges.indexOf('CHALLENGETEXT') === 0);
r = await save('lea', 'siemreap', '@letter', { letter: 'Dear friends, thank you.' });
ok('leadership writes the letter', r.ok && r.letter.text === 'Dear friends, thank you.' && r.letter.byName === 'Lea Director');
ok('… nobody else', (await save('yara', 'siemreap', '@letter', { letter: 'x' })).err === 'not_authorized');
ok('… cut at 3000', (await save('lea', 'siemreap', '@letter', { letter: 'L'.repeat(9000) })).letter.text.length === 3000);
await save('lea', 'siemreap', '@letter', { letter: 'Dear friends, thank you.' });
r = await save('dara', 'siemreap', 'Youth Education|Sports', {});
ok('an empty story takes it away', r.ok && r.story === null && mem['qreport:siemreap']['2026-Q4'].ministries['Youth Education|Sports'] === undefined);
d = await get('lea', 'siemreap', 2026, 4);
ok('the report carries the stories and the letter', d.stories[YDC].story.indexOf('Bopha') > -1 && d.stories[CAFE].needs === 'A grinder.' && d.letter.text === 'Dear friends, thank you.' && d.stories[YDC].by === undefined, Object.keys(d.stories).join());
d = await get('cal', 'siemreap', 2026, 4);
ok('someone in the Cafe gets the Cafe’s story only, and no letter', Object.keys(d.stories).join() === CAFE && d.letter === null);
d = await get('mary', 'siemreap', 2026, 4, '4321');
ok('the board reads them', !!d.stories[YDC] && !!d.letter);

console.log('=== quarter and year edges ===');
ok('a quarter that hasn’t begun is refused', (await get('lea', 'siemreap', 2027, 1)).err === 'bad_quarter' && (await save('lea', 'siemreap', CAFE, { highlights: 'x' }, 2027, 1)).err === 'bad_quarter');
ok('junk is refused', (await get('lea', 'siemreap', 2026, 5)).err === 'bad_quarter' && (await get('lea', 'siemreap', 'x', 1)).err === 'bad_quarter' && (await get('lea', 'siemreap', 2019, 1)).err === 'bad_quarter');
d = await get('lea', 'siemreap', 2026, 3);
ok('Q3 2026 = 29 Jun – 27 Sep, done; its own tool figures', d.from === '2026-06-29' && d.to === '2026-09-27' && d.done === true && d.tools['Community Service|Outreach Teams'].list.some(x => x.name === 'Team Summer') && !d.tools['Community Service|Outreach Teams'].list.some(x => x.name === 'Team Fjord') && d.tools[ICP].wedsHeld === 1 && d.tools[YDC].tests === 1, d.from + ' ' + d.to);
ok('… and Q3 has no story yet', Object.keys(d.stories).length === 0 && d.letter === null);
d = await get('lea', 'siemreap', 2026, 1);
ok('Q1 2026 = 29 Dec 2025 – 29 Mar 2026, with last year’s rows for “last quarter”', d.from === '2025-12-29' && d.to === '2026-03-29' && d.prev && d.prev[CAFE + '|Cups Sold']['50'] === 7, d.from + ' ' + d.to);
ok('… the January fast is Q1’s', d.tools[ICP] && d.tools[ICP].fasts.map(f => f.title).join() === 'January fast');
d = await get('lea', 'siemreap', 2025, 4);
ok('last year’s Q4 = 29 Sep – 28 Dec 2025, last year’s rows only', d.from === '2025-09-29' && d.to === '2025-12-28' && d.entries[CAFE + '|Cups Sold']['50'] === 7 && d.entries[CAFE + '|Cups Sold']['41'] === undefined, d.from + ' ' + d.to);

console.log('=== the bell: a leader with nothing written, around the quarter’s end ===');
const boot = async (u) => (await call('getMyBoot', [u, '1234'])).body;
ok('mid-quarter the boot says nothing', (await boot('dara')).qstory === null);
setNow('2026-12-22T03:00:00Z');   // week 52: the quarter's last two weeks
let b = await boot('dara');
ok('in the last two weeks: the ministries I lead with no story', b.ok && b.qstory && b.qstory.year === 2026 && b.qstory.q === 4 && b.qstory.keys.join() === 'Youth Education|Sports' && b.qstory.since === '2026-12-14', JSON.stringify(b.qstory));
ok('… not one whose story is written', (await boot('yara')).qstory === null);
ok('… and nobody who leads nothing', (await boot('cal')).qstory === null);
setNow('2027-01-05T03:00:00Z');   // week 2 of 2027: still asking for Q4 2026
b = await boot('dara');
ok('in the first two weeks of the next quarter it still asks for the one just ended', b.qstory && b.qstory.year === 2026 && b.qstory.q === 4, JSON.stringify(b.qstory));
ok('… and that quarter can still be written and read', (await save('dara', 'siemreap', 'Youth Education|Sports', { story: 'Late, but written.' }, 2026, 4)).ok === true && (await boot('dara')).qstory === null);
d = await get('lea', 'siemreap', 2027, 1);
ok('Q1 2027 has begun: 28 Dec 2026 on, with 2026’s rows for last quarter', d.ok && d.from === '2026-12-28' && d.prev[CAFE + '|Cups Sold']['45'] === 50);
setNow('2027-01-20T03:00:00Z');
await save('dara', 'siemreap', 'Youth Education|Sports', {}, 2026, 4);
ok('after that the bell is quiet again', (await boot('dara')).qstory === null);
setNow('2026-11-18T03:00:00Z');

console.log('=== nothing private in ANY answer ===');
const all = seen.join('\n');
const never = { 'a student’s name': /Testchild|សុខនី/, 'a guardian or their phone': /Secretname|012999888|Hiddenvillage/, 'a payment': /PAYNOTE|37\.25/, 'a health token': /tok_secret/,
  'a health answer': /"lonely"|"porn"|"quietTime"|"debt"/, 'staff debt': /Staff Debt|987654/, 'leadership-only money': /Base Finances|876543/, 'a prayer need’s words': /PRAYERNEEDTEXT/,
  'a testimony’s words': /TESTIMONYTEXT/, 'how anyone fasts': /daniel|fullfastkind|"ticks"/, 'a guest’s name': /Privatename/, 'a PIN hash': /pinHash|pinSalt/, 'a musician’s name': /Mika Keys|Noa Drums/ };
ok('there were answers to check', seen.length > 25 && all.length > 5000, seen.length + ' answers, ' + all.length + ' chars');
for (const k of Object.keys(never)) ok('no answer carries ' + k, !never[k].test(all), (all.match(never[k]) || [''])[0]);
ok('Challenges reach only those who may read the whole text (it is in the payload; the page leaves it out for donors and government)', /CHALLENGETEXT/.test(all));
ok('a leader’s answer names nobody but leaders', !/Cal Barista|Dara Coach|Nomi Nowhere|Gone Away/.test(JSON.stringify(YARA)) && !/Cal Barista|Nomi Nowhere|Gone Away/.test(JSON.stringify(LEA)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
