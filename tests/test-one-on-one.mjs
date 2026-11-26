/* 1-on-1 requests: either side of an approved mentor/mentee pair can ask the
   other for a 1-on-1. The only rules that matter are that the pair must
   actually be an approved mentor/mentee relationship, and that only the
   recipient of a request — not the requester — can accept or decline it. */
/* Paths and the browser binary come from tests/env.mjs so this runs from a clone
   rather than from one machine's scratch directory. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('one-on-one');
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
fs.copyFileSync(REPO + '/netlify/functions/library-audio-lib.js', TMP + '/library-audio-lib.js');  // the Library audio index
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');

const MENTOR = {
  id: 'st_mentor', name: 'Andrew', username: 'andrew', campus: 'siemreap', dept: 'Campus Leadership',
  ministry: 'Campus Director', role: 'Oversight', active: true,
};
const MENTEE = {
  id: 'st_mentee', name: 'Sokha', username: 'sokha', campus: 'siemreap', dept: 'Community Service',
  ministry: 'Outreach Teams', role: 'Coordinator', active: true,
  mentorId: 'st_mentor', mentorStatus: 'approved',
};
const STRANGER = {
  id: 'st_stranger', name: 'Mealea', username: 'mealea', campus: 'siemreap', dept: 'Youth Education',
  ministry: 'YDC', role: 'Teacher', active: true,
};

async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
function seed(rows) {
  for (const k of Object.keys(mem)) delete mem[k];
  mem.staff = [MENTOR, MENTEE, STRANGER].map(function (s) {
    return { ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) };
  });
  mem.oneOnOnes = rows || [];
}

/* ---------- 1. either side of an approved pair can request ---------- */
seed();
let r = await call('requestOneOnOne', ['andrew', '1234', 'st_mentee', '']);
ok('mentor can request a 1-on-1 with their mentee',
  r.body && r.body.ok === true && r.body.oneOnOnes.length === 1 && r.body.oneOnOnes[0].status === 'pending',
  JSON.stringify(r.body));

seed();
r = await call('requestOneOnOne', ['sokha', '1234', 'st_mentor', '']);
ok('mentee can request a 1-on-1 with their mentor',
  r.body && r.body.ok === true && r.body.oneOnOnes.length === 1, JSON.stringify(r.body));

/* ---------- 2. a non mentor/mentee pair is refused ---------- */
seed();
r = await call('requestOneOnOne', ['andrew', '1234', 'st_stranger', '']);
ok('a request between people with no mentor relationship is refused',
  r.body && r.body.ok === false && r.body.err === 'not_mentor_pair', JSON.stringify(r.body));
ok('and nothing was written', (mem.oneOnOnes || []).length === 0);

/* ---------- 3. only the recipient can respond, and only once ---------- */
seed([{ id: 'oo1', fromId: 'st_mentor', toId: 'st_mentee', note: '', status: 'pending', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', decidedAt: '' }]);
r = await call('respondToOneOnOne', ['andrew', '1234', 'oo1', true]);
ok('the requester cannot respond to their own request', r.body && r.body.ok === false, JSON.stringify(r.body));

r = await call('respondToOneOnOne', ['sokha', '1234', 'oo1', true]);
ok('the recipient can accept', r.body && r.body.ok === true && r.body.oneOnOnes[0].status === 'accepted', JSON.stringify(r.body));

r = await call('respondToOneOnOne', ['sokha', '1234', 'oo1', false]);
ok('an already-decided request cannot be responded to again',
  r.body && r.body.ok === false, JSON.stringify(r.body));
ok('and the accepted status stuck', (mem.oneOnOnes || [])[0].status === 'accepted');

/* ---------- 4. each side sees the same request with the right "mine" flag ---------- */
seed([{ id: 'oo2', fromId: 'st_mentor', toId: 'st_mentee', note: 'coffee?', status: 'pending', created: '2026-01-02T00:00:00.000Z', updated: '2026-01-02T00:00:00.000Z', decidedAt: '' }]);
r = await call('getMyOneOnOnes', ['andrew', '1234']);
ok('the requester sees mine:true', r.body && r.body.oneOnOnes[0].mine === true && r.body.oneOnOnes[0].otherName === 'Sokha',
  JSON.stringify(r.body));
r = await call('getMyOneOnOnes', ['sokha', '1234']);
ok('the recipient sees mine:false', r.body && r.body.oneOnOnes[0].mine === false && r.body.oneOnOnes[0].otherName === 'Andrew',
  JSON.stringify(r.body));

/* ---------- 5. a wrong PIN writes nothing ---------- */
seed();
r = await call('requestOneOnOne', ['andrew', '9999', 'st_mentee', '']);
ok('a wrong PIN is refused', r.body && r.body.ok === false && (mem.oneOnOnes || []).length === 0);

/* ---------- 6. the mentee's check-in rides with their request ---------- */
const PREP = { areas: { money: 2, language: 4, physical: 3, emotional: 2, relational: 5, spiritual: 4, bogus: 5 },
  values: { faithful: 4, innovative: 3, generous: 5, humble: 4, tenacious: 2 }, helpWith: 'Support raising', workingOn: 'Khmer level 2', other: '' };
seed();
r = await call('requestOneOnOne', ['sokha', '1234', 'st_mentor', '', PREP]);
let row = (mem.oneOnOnes || [])[0] || {};
ok('a mentee\'s request carries their check-in (areas, values, help, goals)',
  r.body.ok && row.prep && row.prep.areas.money === 2 && row.prep.values.tenacious === 2 && row.prep.helpWith === 'Support raising' && row.menteeId === 'st_mentee');
ok('… only the six areas and five values are kept, 1-5', !('bogus' in row.prep.areas) && Object.keys(row.prep.areas).length === 6);
r = await call('getMyOneOnOnes', ['andrew', '1234']);
ok('the mentor sees the check-in, and knows they are the mentor', r.body.oneOnOnes[0].prep && r.body.oneOnOnes[0].prep.areas.relational === 5 && r.body.oneOnOnes[0].iMentor === true && r.body.perMonth === 2);
seed();
r = await call('requestOneOnOne', ['andrew', '1234', 'st_mentee', '', PREP]);
ok('a mentor cannot fill in a check-in for their mentee', r.body.ok && !(mem.oneOnOnes[0].prep));

/* ---------- 7. the mentee adds it later; nobody else can ---------- */
seed([{ id: 'oo3', fromId: 'st_mentor', toId: 'st_mentee', note: '', status: 'accepted', created: '2026-01-03T00:00:00.000Z', updated: '', decidedAt: '2026-01-03T00:00:00.000Z' }]);
r = await call('saveOneOnOnePrep', ['andrew', '1234', 'oo3', PREP]);
ok('the mentor cannot write the mentee\'s check-in', r.body.ok === false && !mem.oneOnOnes[0].prep);
r = await call('saveOneOnOnePrep', ['sokha', '1234', 'oo3', PREP]);
ok('the mentee can add it after accepting', r.body.ok && mem.oneOnOnes[0].prep && mem.oneOnOnes[0].prep.areas.spiritual === 4);
r = await call('saveOneOnOnePrep', ['sokha', '1234', 'oo3', {}]);
ok('an empty check-in is refused', r.body.ok === false && r.body.err === 'empty');

/* ---------- 8. the mentor marks it held, with notes and follow-ups ---------- */
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
r = await call('saveOneOnOneNotes', ['sokha', '1234', 'oo3', 'mine', [], today]);
ok('the mentee cannot write the mentor\'s notes or mark it held', r.body.ok === false && mem.oneOnOnes[0].status === 'accepted');
r = await call('saveOneOnOneNotes', ['andrew', '1234', 'oo3', 'Talked about support letters', ['Send 5 letters', { text: 'Book a Khmer tutor' }, ''], today]);
row = mem.oneOnOnes[0];
ok('the mentor marks it held, with notes and follow-ups', r.body.ok && row.status === 'held' && row.heldOn === today && row.notes === 'Talked about support letters' && row.followUps.length === 2 && row.followUps[1].text === 'Book a Khmer tutor');
r = await call('saveOneOnOnePrep', ['sokha', '1234', 'oo3', PREP]);
ok('once held, the check-in is closed', r.body.ok === false && r.body.err === 'closed');
r = await call('saveOneOnOneNotes', ['andrew', '1234', 'oo3', 'x', [], '2999-01-01']);
ok('a date in the future is refused', r.body.ok === false && r.body.err === 'bad_date');
r = await call('tickOneOnOneFollowUp', ['sokha', '1234', 'oo3', 0, true]);
ok('either of the pair can tick a follow-up done', r.body.ok && mem.oneOnOnes[0].followUps[0].done === true);
r = await call('tickOneOnOneFollowUp', ['mealea', '1234', 'oo3', 1, true]);
ok('… nobody else can', r.body.ok === false && mem.oneOnOnes[0].followUps[1].done === false);

/* ---------- 9. logging one that happened without a request ---------- */
seed();
r = await call('logOneOnOne', ['andrew', '1234', 'st_mentee', 'Coffee after church', ['Pray about the move'], today]);
ok('a mentor can log a 1-on-1 that already happened', r.body.ok && mem.oneOnOnes[0].status === 'held' && mem.oneOnOnes[0].heldOn === today && mem.oneOnOnes[0].menteeId === 'st_mentee');
r = await call('logOneOnOne', ['sokha', '1234', 'st_mentor', 'x', [], today]);
ok('a mentee cannot log one for their mentor', r.body.ok === false && mem.oneOnOnes.length === 1);
r = await call('logOneOnOne', ['andrew', '1234', 'st_stranger', 'x', [], today]);
ok('nor a mentor for someone who isn\'t their mentee', r.body.ok === false && mem.oneOnOnes.length === 1);

/* ---------- 9b. the one asking suggests a day and time; the other takes it with one tap or picks another ---------- */
{
  const day = n => { const d = new Date(Date.now() + 7 * 3600e3 + n * 864e5); return d.toISOString().slice(0, 10); };
  seed();
  r = await call('requestOneOnOne', ['sokha', '1234', 'st_mentor', '', null, day(5) + 'T25:00']);
  ok('a suggested time that is not a time is refused', r.body.ok === false && r.body.err === 'bad_when' && mem.oneOnOnes.length === 0);
  r = await call('requestOneOnOne', ['sokha', '1234', 'st_mentor', '', null, day(5) + 'T15:00']);
  let row = mem.oneOnOnes[0];
  ok('the asker\'s suggested time waits on the request, theirs', row.status === 'pending' && row.when === day(5) + 'T15:00' && row.whenBy === 'st_mentee');
  r = await call('getMyOneOnOnes', ['andrew', '1234']);
  ok('… the one asked sees it, not as theirs', r.body.oneOnOnes[0].when === day(5) + 'T15:00' && r.body.oneOnOnes[0].whenByMe === false);
  ok('… and it is no task yet in anyone\'s GP Tasks', !((mem.gpTasks && mem.gpTasks.tasks) || []).some(t => t.ooId === row.id));
  r = await call('respondToOneOnOne', ['andrew', '1234', row.id, true]);
  row = mem.oneOnOnes[0];
  ok('a yes takes the suggested time; it stays the asker\'s', row.status === 'accepted' && row.when === day(5) + 'T15:00' && row.whenBy === 'st_mentee');
  ok('… and now it is a task for both', (mem.gpTasks.tasks || []).filter(t => t.ooId === row.id && t.due === day(5) && t.time === '15:00').length === 2);
  seed();
  await call('requestOneOnOne', ['andrew', '1234', 'st_mentee', '', null, day(3) + 'T09:00']);
  row = mem.oneOnOnes[0];
  r = await call('respondToOneOnOne', ['sokha', '1234', row.id, true, day(4) + 'T10:30']);
  row = mem.oneOnOnes[0];
  ok('picking another time replaces the suggestion, set by the one asked', row.status === 'accepted' && row.when === day(4) + 'T10:30' && row.whenBy === 'st_mentee' && r.body.oneOnOnes[0].whenByMe === true);
  seed();
  await call('requestOneOnOne', ['andrew', '1234', 'st_mentee', '', null, day(3) + 'T09:00']);
  r = await call('respondToOneOnOne', ['sokha', '1234', mem.oneOnOnes[0].id, false]);
  ok('a no to a suggested time is a no — no tasks', mem.oneOnOnes[0].status === 'declined' && !((mem.gpTasks && mem.gpTasks.tasks) || []).some(t => t.ooId === mem.oneOnOnes[0].id));
  seed();
  await call('requestOneOnOne', ['andrew', '1234', 'st_mentee', '', null, '']);
  ok('no suggestion is still a request with no time', mem.oneOnOnes[0].status === 'pending' && !mem.oneOnOnes[0].when);
}

/* ---------- 10. the words stay with the pair ---------- */
seed([{ id: 'oo4', fromId: 'st_mentee', toId: 'st_mentor', menteeId: 'st_mentee', note: '', status: 'held', heldOn: today,
  created: '2026-01-04T00:00:00.000Z', prep: { areas: { money: 1 }, values: {}, helpWith: 'secret', workingOn: '', other: '' }, notes: 'private', followUps: [] }]);
mem.staff.find((x) => x.id === 'st_mentee').mentorId = 'st_stranger';
r = await call('getMyOneOnOnes', ['andrew', '1234']);
ok('a former mentor keeps the count but no longer sees the check-in or notes', r.body.ok && r.body.oneOnOnes.length === 1 && !('prep' in r.body.oneOnOnes[0]) && !('notes' in r.body.oneOnOnes[0]));
r = await call('getMyOneOnOnes', ['sokha', '1234']);
ok('the mentee still sees their own', r.body.oneOnOnes[0].prep.helpWith === 'secret' && r.body.oneOnOnes[0].notes === 'private');
r = await call('saveOneOnOneNotes', ['andrew', '1234', 'oo4', 'rewrite', [], '']);
ok('… and the former mentor cannot change the notes', r.body.ok === false && mem.oneOnOnes[0].notes === 'private');

/* ---- how my mentees are doing with THEIR 1-on-1s (Nov 2026, Uriah) ---- */
{
  for (const k of Object.keys(mem)) delete mem[k];
  const P = (o) => ({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', active: true, ...o, pinSalt: o.id, pinHash: mkHash('1234', o.id) });
  const A = (id, name, username, mentorId, more) => P({ id, name, username, mentorId, mentorStatus: 'approved', ...(more || {}) });
  mem.staff = [
    P({ id: 'top', name: 'Tola Top', username: 'tola' }),
    A('mid', 'Maly Mid', 'maly', 'top'), A('solo', 'Sina Solo', 'sina', 'top'),
    A('a1', 'Ary One', 'ary', 'mid'), A('a2', 'Bora Two', 'bora', 'mid'), A('a3', 'Chea Three', 'chea', 'mid'),
    P({ id: 'a4', name: 'Dy Pending', username: 'dy', mentorId: 'mid', mentorStatus: 'pending' }),
    A('a5', 'Ek Gone', 'ek', 'mid', { active: false }),
    P({ id: 'out', name: 'Oun Outside', username: 'oun' })
  ];
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), month = today.slice(0, 7);
  const lastMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 15)).toISOString().slice(0, 10);
  const row = (id, from, to, menteeId, status, heldOn) => ({ id, fromId: from, toId: to, menteeId, status, heldOn: heldOn || '', created: today + 'T01:00:00.000Z',
    prep: { helpWith: 'SECRET-PREP' }, notes: 'SECRET-NOTES', followUps: [{ text: 'SECRET-FOLLOW', done: false }] });
  mem.oneOnOnes = [
    row('o1', 'mid', 'a1', 'a1', 'held', month + '-01'), row('o2', 'a1', 'mid', 'a1', 'held', today),   // two with Ary, whoever asked
    row('o3', 'mid', 'a2', 'a2', 'held', today),                                                        // one with Bora
    row('o4', 'mid', 'a3', 'a3', 'held', lastMonth),                                                    // last month: not this month's
    row('o5', 'mid', 'a3', 'a3', 'accepted'),                                                           // not held yet
    row('o6', 'top', 'mid', 'mid', 'held', today),                                                      // Maly's own with her mentor: not "theirs"
    row('o7', 'out', 'a2', 'a2', 'held', today)                                                         // someone else's with Bora
  ];
  let r = await call('getMyMentees', ['tola', '1234']);
  const mid = r.body.mentees.find(m => m.id === 'mid'), solo = r.body.mentees.find(m => m.id === 'solo');
  ok('a mentee who mentors others comes with this month’s count for each of THEIR approved, active mentees', r.body.ok && mid.oo && mid.oo.held === 3 && mid.oo.met === 2 && JSON.stringify(mid.oo.people) === JSON.stringify([{ id: 'a1', name: 'Ary', held: 2 }, { id: 'a2', name: 'Bora', held: 1 }, { id: 'a3', name: 'Chea', held: 0 }]), JSON.stringify(mid.oo));
  ok('first names and counts only — never a check-in, a note or a follow-up', !/SECRET/.test(JSON.stringify(r.body)) && Object.keys(mid.oo.people[0]).sort().join() === 'held,id,name');
  ok('a mentee who mentors nobody has nothing extra', solo && !('oo' in solo));
  r = await call('getMyBoot', ['tola', '1234']);
  ok('it rides on the boot’s mentees — no new call on open', r.body.ok && r.body.mentees.find(m => m.id === 'mid').oo.held === 3 && !/SECRET-(PREP|NOTES|FOLLOW)/.test(JSON.stringify(r.body.mentees)));
  r = await call('getMyMentees', ['oun', '1234']);
  ok('someone who is not their mentor gets none of it', r.body.ok && r.body.mentees.length === 0);
  r = await call('getMyMentees', ['maly', '1234']);
  ok('the mentee’s own list is just her people (none of them mentors anyone)', r.body.ok && r.body.mentees.length === 3 && r.body.mentees.every(m => !m.oo));
  mem.staff.find(x => x.id === 'mid').mentorStatus = 'pending';
  r = await call('getMyMentees', ['tola', '1234']);
  ok('a mentor request not yet accepted gives no counts', r.body.ok && !r.body.mentees.some(m => m.id === 'mid'));
  r = await call('teamRoster', []);
  ok('nothing of it on the public roster', !/"oo"/.test(JSON.stringify(r.body)));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
