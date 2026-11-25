/* The leadership meeting — against the real api.js.

   A weekly meeting in seven parts for Campus Leadership, built on the leadership board: the
   issues are the board's first column, the to-dos are the board's little tasks (and so GP Tasks),
   and who leads comes from the meeting-day schedule. Its own store, leadMeet:<campus>, holds the
   scorecard, the rocks, the headlines, the meeting going on and the records of past ones. Only
   Campus Leadership on the campus and admins read or change any of it. Every name is made up. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('lead-meeting');
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
const st = (o) => ({ role: '', active: true, campus: 'siemreap', ...o });
mem.staff = [
  st({ id: 'st_d', name: 'Dee Director', username: 'dee', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  st({ id: 'st_o', name: 'Oli Overseer', username: 'oli', dept: 'Campus Leadership', ministry: 'Community Service' }),
  st({ id: 'st_c', name: 'Cafe Cam', username: 'cam', dept: 'Community Service', ministry: 'Cafe' }),
  st({ id: 'st_a', name: 'Ada Admin', username: 'ada', dept: 'Community Service', ministry: 'Cafe', isAdmin: true }),
  st({ id: 'st_p', name: 'Pat Poipet', username: 'pat', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  st({ id: 'st_x', name: 'Appy Applicant', username: 'appy', kind: 'applicant', applicant: { type: 'staff' } }),
].map(s => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) }));
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json().catch(() => null);
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const D = ['dee', '1234'], O = ['oli', '1234'];
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

console.log('=== who may ===');
let r = await call('getLeadMeeting', D);
ok('Campus Leadership opens the meeting: seven parts, 90 minutes, nothing in it yet',
  r.ok && r.parts.length === 7 && Object.values(r.minutes).reduce((a, b) => a + b, 0) === 90 && r.minutes.issues === 60 && !r.run && !r.score.length && !r.rocks.length && !r.past.length);
ok('… with the board it stands on in the same answer, and the meeting day (Tuesday to start)', r.board && r.board.ok && Array.isArray(r.board.cards) && r.board.meetDay === 2);
ok('… and the thirteen weeks of the scorecard, newest first', r.weeks.length === 13 && r.weeks[0].week === r.week && r.weeks[0].key === r.year + '-' + r.week);
ok('an overseer and an admin may', (await call('getLeadMeeting', O)).ok === true && (await call('getLeadMeeting', ['ada', '1234'])).ok === true);
const WRITES = [['saveLeadMeetSettings', [{ day: 3 }]], ['saveLeadScore', [{ name: 'x' }]], ['deleteLeadScore', ['x']], ['saveLeadScoreValue', ['x', 'y', 1]],
  ['saveLeadRock', [{ title: 'x' }]], ['deleteLeadRock', ['x']], ['saveLeadHeadline', [{ text: 'x' }]], ['deleteLeadHeadline', ['x']],
  ['leadMeetStart', []], ['leadMeetUpdate', [{ part: 1 }]], ['leadMeetTodo', [{ text: 'x' }]], ['leadMeetSolve', [{ cardId: 'x', decision: 'y' }]], ['leadMeetEnd', [{}]]];
let shut = true, shutX = true;
for (const w of [['getLeadMeeting', []]].concat(WRITES)) {
  const a = await call(w[0], ['cam', '1234'].concat(w[1])); if (a.ok !== false || a.err !== 'not_authorized') shut = false;
  const b = await call(w[0], ['appy', '1234'].concat(w[1])); if (b.ok !== false) shutX = false;
}
ok('nobody outside Campus Leadership reads or writes any of it', shut);
ok('… nor an applicant', shutX);
ok('… and nothing was written by trying', !mem['leadMeet:siemreap'] && !mem['leadBoard:siemreap']);

console.log('=== the meeting day and the minutes ===');
const nextDow = (dow) => { let d = today; while (new Date(d + 'T12:00:00Z').getUTCDay() !== dow) d = addDays(d, 1); return d; };
const tue = addDays(nextDow(2), 7), wedSameWeek = addDays(tue, 1);
r = await call('saveLeadTuesday', D.concat([{ date: tue, facilitator: { id: 'st_o' }, topics: ['Outreach week'] }]));
ok('the schedule takes the meeting day (Tuesday)', r.ok && r.tues.length === 1 && r.meetDay === 2);
ok('… and no other weekday', (await call('saveLeadTuesday', D.concat([{ date: wedSameWeek, topics: ['x'] }]))).err === 'bad_date');
r = await call('saveLeadMeetSettings', D.concat([{ day: 3, minutes: { issues: 45, checkin: 10, bogus: 9, wrap: 'abc' } }]));
ok('the day and the minutes can be changed; junk is ignored', r.ok && r.board.meetDay === 3 && r.minutes.issues === 45 && r.minutes.checkin === 10 && r.minutes.wrap === 5 && !('bogus' in r.minutes));
ok('… the weeks still to come move to the new weekday, in the same week', r.board.tues.length === 1 && r.board.tues[0].date === wedSameWeek && r.board.tues[0].facilitator.id === 'st_o');
ok('… and the schedule now takes Wednesdays, not Tuesdays', (await call('saveLeadTuesday', D.concat([{ date: addDays(wedSameWeek, 7), topics: ['y'] }]))).ok === true &&
  (await call('saveLeadTuesday', D.concat([{ date: addDays(tue, 7), topics: ['z'] }]))).err === 'bad_date');
ok('a day that isn’t one is refused', (await call('saveLeadMeetSettings', D.concat([{ day: 9 }]))).err === 'bad_day');
ok('the board itself still says which day', (await call('getLeadBoard', D)).meetDay === 3);
ok('Poipet keeps its own day', (await call('getLeadBoard', ['pat', '1234'])).meetDay === 2);
/* today's meeting has a facilitator on the schedule */
const dowToday = new Date(today + 'T12:00:00Z').getUTCDay();
await call('saveLeadMeetSettings', D.concat([{ day: dowToday, minutes: { issues: 60, checkin: 5 } }]));
r = await call('saveLeadTuesday', D.concat([{ date: today, facilitator: { id: 'st_o' }, topics: ['Staff retreat'] }]));
ok('today is a meeting day with Oli down to lead', r.ok && r.tues.some(t => t.date === today && t.facilitator.id === 'st_o'));

console.log('=== the scorecard ===');
r = await call('saveLeadScore', D.concat([{ name: '  Staff 1-on-1s held ', owner: 'st_o', goal: 10, dir: 'gte' }]));
const s1 = r.saved;
ok('a measurable typed by hand', r.ok && r.score.length === 1 && r.score[0].name === 'Staff 1-on-1s held' && r.score[0].owner === 'st_o' && r.score[0].goal === 10 && r.score[0].src === 'manual');
ok('it needs a name', (await call('saveLeadScore', D.concat([{ name: ' ' }]))).err === 'bad_name');
r = await call('saveLeadScore', D.concat([{ name: 'Debt', owner: 'st_c_not', goal: 'abc', dir: 'lte' }]));
ok('cleaned: an owner who isn’t on the campus dropped, a goal that isn’t a number dropped', r.ok && r.score[1].owner === '' && r.score[1].goal === null && r.score[1].dir === 'lte');
const s2 = r.saved;
const g = await call('getLeadMeeting', D), wk0 = g.weeks[0], wk1 = g.weeks[1];
r = await call('saveLeadScoreValue', D.concat([s1, wk1.key, '12']));
ok('a week’s number is typed in', r.ok && r.score[0].vals[wk1.key] === 12 && r.score[0].vals[wk0.key] === null);
ok('… not for a week off the card, nor a value that isn’t a number', (await call('saveLeadScoreValue', D.concat([s1, '1999-3', 4]))).err === 'bad_week' && (await call('saveLeadScoreValue', D.concat([s1, wk1.key, 'lots']))).err === 'bad_value');
r = await call('saveLeadScoreValue', D.concat([s1, wk1.key, '']));
ok('… and taken away again', r.ok && r.score[0].vals[wk1.key] === null);
mem.entries = [
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: wk1.week, year: wk1.year, value: 180 },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: wk0.week, year: wk0.year, value: 95 },
  { campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: wk1.week, year: wk1.year, value: 999 },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: wk1.week, year: wk1.year - 1, value: 777 },
  { campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', metric: 'Base Finances ($)', week: wk1.week, year: wk1.year, value: 5000 },
];
r = await call('saveLeadScore', D.concat([{ name: 'Cups sold', owner: 'st_o', goal: 150, src: 'metric', metric: { dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold' } }]));
const s3 = r.saved, m3 = r.score.find(x => x.id === s3);
ok('a measurable linked to a ministry’s metric fills itself — this campus, this year, week by week', r.ok && m3.src === 'metric' && m3.vals[wk1.key] === 180 && m3.vals[wk0.key] === 95, JSON.stringify(m3.vals));
ok('… and can’t be typed over', (await call('saveLeadScoreValue', D.concat([s3, wk1.key, 5]))).err === 'linked');
ok('a link needs all three parts, and never a leadership-only money metric', (await call('saveLeadScore', D.concat([{ name: 'x', src: 'metric', metric: { dept: 'Community Service', ministry: 'Cafe' } }]))).err === 'bad_metric' &&
  (await call('saveLeadScore', D.concat([{ name: 'x', src: 'metric', metric: { dept: 'Campus Leadership', ministry: 'Campus Director', metric: 'Base Finances ($)' } }]))).err === 'bad_metric');
r = await call('saveLeadScore', D.concat([{ id: s1, name: '1-on-1s held', owner: 'st_d', goal: 8 }]));
ok('editing keeps the id and the numbers already in', r.ok && r.score.length === 3 && r.score[0].id === s1 && r.score[0].name === '1-on-1s held' && r.score[0].owner === 'st_d');
for (let i = 0; i < 12; i++) await call('saveLeadScore', D.concat([{ name: 'M' + i }]));
ok('fifteen at most', (await call('saveLeadScore', D.concat([{ name: 'one too many' }]))).err === 'too_many' && (await call('getLeadMeeting', D)).score.length === 15);
r = await call('deleteLeadScore', D.concat([s2]));
ok('one can be taken off', r.ok && r.score.length === 14 && !r.score.some(x => x.id === s2));

console.log('=== rocks ===');
r = await call('saveLeadRock', D.concat([{ title: ' Open the new dorm ', owner: 'st_o', year: g.year, q: g.q, okrId: 'okr_1', status: 'weird', note: 'Roof first' }]));
const k1 = r.saved, rk = r.rocks[0];
ok('a rock for this quarter, cleaned', r.ok && rk.title === 'Open the new dorm' && rk.owner === 'st_o' && rk.year === g.year && rk.q === g.q && rk.okrId === 'okr_1' && rk.status === 'on' && rk.by === 'st_d', JSON.stringify(rk));
const nq = g.q === 4 ? { year: g.year + 1, q: 1 } : { year: g.year, q: g.q + 1 };
r = await call('saveLeadRock', O.concat([{ title: 'Team: one staff retreat', owner: '', year: nq.year, q: nq.q }]));
ok('next quarter’s can be written ahead; a rock with no owner is the team’s', r.ok && r.rocks[1].owner === '' && r.rocks[1].year === nq.year && r.rocks[1].q === nq.q);
r = await call('saveLeadRock', D.concat([{ title: 'Long ago', year: 2001, q: 3 }]));
ok('any other quarter falls back to this one', r.ok && r.rocks[2].year === g.year && r.rocks[2].q === g.q);
r = await call('saveLeadRock', O.concat([{ id: k1, title: 'Open the new dorm', owner: 'st_o', year: g.year, q: g.q, okrId: 'okr_1', status: 'off', note: 'Waiting on the roof' }]));
ok('its status changes; who made it stays', r.ok && r.rocks[0].status === 'off' && r.rocks[0].by === 'st_d' && r.rocks[0].updatedBy === 'st_o');
ok('a rock needs a title; an unknown one is not found', (await call('saveLeadRock', D.concat([{ title: '' }]))).err === 'bad_title' && (await call('saveLeadRock', D.concat([{ id: 'nope', title: 'x' }]))).err === 'not_found');
r = await call('deleteLeadRock', D.concat([r.rocks[2].id]));
ok('a rock can be removed', r.ok && r.rocks.length === 2);

console.log('=== headlines ===');
r = await call('saveLeadHeadline', O.concat([{ text: '  Three students baptised on Sunday ', kind: 'good' }]));
ok('anyone on the team adds a headline', r.ok && r.headlines.length === 1 && r.headlines[0].text === 'Three students baptised on Sunday' && r.headlines[0].by === 'st_o' && r.headlines[0].kind === 'good');
r = await call('saveLeadHeadline', D.concat([{ text: 'A staff member’s father is in hospital', kind: 'hard' }]));
r = await call('saveLeadHeadline', D.concat([{ text: 'Oops', kind: 'nonsense' }]));
ok('good or hard; anything else is good', r.headlines[1].kind === 'hard' && r.headlines[2].kind === 'good');
r = await call('deleteLeadHeadline', D.concat([r.headlines[2].id]));
ok('one can be taken off; an empty one is refused', r.ok && r.headlines.length === 2 && (await call('saveLeadHeadline', D.concat([{ text: ' ' }]))).err === 'bad_text');

console.log('=== running the meeting ===');
/* the board: two issues waiting, and last week's to-dos */
let b = await call('saveLeadCard', D.concat([{ title: 'Water pump keeps failing', type: 'agenda', col: 'agenda', notes: 'Third time this month' }]));
const iss1 = b.saved.id;
b = await call('saveLeadCard', D.concat([{ title: 'Who covers reception in January', type: 'agenda', col: 'agenda' }]));
const iss2 = b.saved.id;
b = await call('saveLeadCard', D.concat([{ title: 'Retreat', type: 'project', col: 'doing' }]));
const proj = b.saved.id;
const t1 = (await call('saveLeadTask', D.concat([proj, { text: 'Book the venue', owner: 'st_o', due: today }]))).saved.id;
const t2 = (await call('saveLeadTask', D.concat([proj, { text: 'Send the invite', owner: 'st_d', due: addDays(today, -1) }]))).saved.id;
await call('saveLeadTask', D.concat([proj, { text: 'Later thing', owner: 'st_d', due: addDays(today, 20) }]));
await call('saveLeadTask', O.concat([proj, { id: t1, text: 'Book the venue', owner: 'st_o', due: today, done: true }]));
ok('nothing can be moved on before a meeting starts', (await call('leadMeetUpdate', D.concat([{ part: 1 }]))).err === 'no_meeting' && (await call('leadMeetEnd', D.concat([{}]))).err === 'no_meeting');
r = await call('leadMeetStart', D);
ok('Start: part one, today, whoever started it is there — and the day’s facilitator leads', r.ok && r.run.part === 0 && r.run.date === today && r.run.by === 'st_d' && r.run.present.join() === 'st_d' && r.run.leader.id === 'st_o', JSON.stringify(r.run && r.run.leader));
r = await call('leadMeetStart', O);
ok('a second Start joins the one going on', r.ok && r.already === true && r.run.by === 'st_d');
r = await call('getLeadMeeting', O);
ok('another leader’s phone sees the same part', r.run && r.run.part === 0 && r.run.startedAt);
/* pretend five minutes have gone by in the check-in */
mem['leadMeet:siemreap'].run.partAt = new Date(Date.now() - 5 * 60000).toISOString();
r = await call('leadMeetUpdate', O.concat([{ part: 1, present: ['st_d', 'st_o', 'st_c_nobody', 'st_p', 'st_o'] }]));
ok('Next moves everyone on and keeps the time the part took', r.ok && r.run.part === 1 && r.run.spent.checkin >= 299 && r.run.spent.checkin <= 302, JSON.stringify(r.run.spent));
ok('who is here: this campus’s people only, once each', r.run.present.join() === 'st_d,st_o');
ok('a part that isn’t one is refused', (await call('leadMeetUpdate', D.concat([{ part: 7 }]))).err === 'bad_part');
r = await call('leadMeetUpdate', D.concat([{ part: 5, top: [iss2, iss1, iss2, 'a', 'b'] }]));
ok('the top three issues, in the order picked', r.run.part === 5 && r.run.top.join() === [iss2, iss1, 'a'].join());
r = await call('leadMeetUpdate', D.concat([{ top: [iss1, iss2], issue: iss1, identify: 'Nobody owns maintenance' }]));
ok('the issue being worked on, and the real issue in a sentence', r.run.issue === iss1 && r.run.identify === 'Nobody owns maintenance');

console.log('=== to-dos go through the board to GP Tasks ===');
r = await call('leadMeetTodo', D.concat([{ text: 'Get three quotes for a new pump', owner: 'st_o', cardId: iss1 }]));
const card1 = r.board.cards.find(c => c.id === iss1), td1 = card1.tasks[0];
ok('a to-do made while solving an issue is a task on that card, due in seven days', r.ok && card1.tasks.length === 1 && td1.text === 'Get three quotes for a new pump' && td1.owner === 'st_o' && td1.due === addDays(today, 7) && td1.meeting === today, JSON.stringify(td1));
ok('… kept on the meeting as a new to-do', r.run.todos.join() === td1.id && r.todo === td1.id);
const gp1 = (mem.gpTasks.tasks || []).find(t => t.leadId === td1.id);
ok('… and it is a GP Task in the Leadership team list, given to that person', !!gp1 && gp1.assignees.join() === 'st_o' && gp1.due === addDays(today, 7) &&
  (mem.gpTasks.lists || []).some(l => l.id === gp1.listId && /Leadership team/.test(l.title || l.name || '')), JSON.stringify(gp1));
r = await call('leadMeetTodo', O.concat([{ text: 'Tell the kitchen about Friday', owner: 'st_d', due: addDays(today, 3) }]));
const tc = r.board.cards.find(c => c.id === r.todoCard);
ok('a to-do with no issue goes on the meeting’s own card — not among the issues', r.ok && !!tc && tc.col !== 'agenda' && tc.tasks.length === 1 && tc.tasks[0].due === addDays(today, 3) && r.run.todos.length === 2);
r = await call('leadMeetTodo', O.concat([{ text: 'Another one' }]));
ok('… the same card next time', r.board.cards.filter(c => c.title === tc.title).length === 1 && r.board.cards.find(c => c.id === tc.id).tasks.length === 2);
ok('a to-do needs words', (await call('leadMeetTodo', D.concat([{ text: ' ' }]))).err === 'bad_task');
/* ticked in GP Tasks → ticked on the board */
r = await call('saveGpTask', O.concat([{ id: gp1.id, done: true }]));
const bAfter = await call('getLeadBoard', D);
ok('ticking it in GP Tasks ticks it on the board', r.ok !== false && bAfter.cards.find(c => c.id === iss1).tasks[0].done === true);

console.log('=== solving an issue goes through the card ===');
ok('a decision is needed', (await call('leadMeetSolve', D.concat([{ cardId: iss1, decision: ' ' }]))).err === 'bad_decision');
r = await call('leadMeetSolve', D.concat([{ cardId: iss1, issue: 'Nobody owns maintenance', decision: 'Oli owns maintenance from today; budget $300 for a new pump.' }]));
const solved = r.board.cards.find(c => c.id === iss1);
ok('Solved: the decision is written on the card, which moves to the finished column', r.ok && solved.col === 'done' && !!solved.doneAt && /Third time this month/.test(solved.notes) && /Nobody owns maintenance/.test(solved.notes) && /Oli owns maintenance/.test(solved.notes), solved.notes);
ok('… and the meeting remembers it, and moves off it', r.run.solved.length === 1 && r.run.solved[0].title === 'Water pump keeps failing' && r.run.issue === '' && r.run.top.join() === iss2);
ok('an unknown card is not found', (await call('leadMeetSolve', D.concat([{ cardId: 'nope', decision: 'x' }]))).err === 'not_found');

console.log('=== wrapping up ===');
r = await call('leadMeetUpdate', O.concat([{ part: 6, messages: ['  Water off Thursday morning ', '', 'Retreat is 14–16 March'], rating: 8 }]));
ok('the messages for our teams, and a leader’s own rating', r.run.messages.length === 2 && r.run.messages[0] === 'Water off Thursday morning' && r.run.ratings.st_o === 8);
r = await call('leadMeetUpdate', D.concat([{ ratings: { st_d: 9, st_o: 3, st_c: 10, st_p: 10 } }]));
ok('whoever started (or leads) may enter the others’ — only this campus’s people', r.run.ratings.st_d === 9 && r.run.ratings.st_o === 3 && r.run.ratings.st_c === 10 && !('st_p' in r.run.ratings));
mem.staff.push({ ...st({ id: 'st_n', name: 'Nia New', username: 'nia', dept: 'Campus Leadership', ministry: 'Skills Training' }), pinSalt: 'st_n', pinHash: mkHash('1234', 'st_n') });
r = await call('leadMeetUpdate', ['nia', '1234', { ratings: { st_d: 1, st_n: 7 }, rating: 7 }]);
ok('anyone else only their own', r.run.ratings.st_d === 9 && r.run.ratings.st_n === 7);
r = await call('leadMeetUpdate', D.concat([{ ratings: { st_o: 8 }, rating: 15 }]));
ok('a rating is 1 to 10', r.run.ratings.st_o === 8 && r.run.ratings.st_d === 9);
/* a to-do carried on a week in the meeting is still one that wasn't done */
await call('saveLeadTask', D.concat([proj, { id: t2, text: 'Send the invite', owner: 'st_d', due: addDays(today, 6) }]));
r = await call('leadMeetUpdate', D.concat([{ carried: [t2, t2, 5] }]));
ok('carried to-dos are remembered by the meeting', r.run.carried.join() === t2);
r = await call('leadMeetEnd', D.concat([{}]));
const rec = r.past[r.past.length - 1];
ok('End: the meeting is over and a record is kept', r.ok && !r.run && r.past.length === 1 && rec.date === today && rec.id === r.ended);
ok('… who led and who was there, by name', rec.leader.name === 'Oli Overseer' && rec.present.map(p => p.name).join() === 'Dee Director,Oli Overseer');
ok('… the minutes each part took', rec.mins.checkin === 5 && typeof rec.mins.issues === 'number' && rec.total >= 5 && rec.planned === 90, JSON.stringify(rec.mins));
ok('… last week’s to-dos: one of two done (the carried one still counts; the one due later and the new ones don’t)', rec.todo.done === 1 && rec.todo.total === 2 && rec.todo.pct === 50, JSON.stringify(rec.todo));
ok('… the issues solved with their decisions, and the new to-dos', rec.solved.length === 1 && /Oli owns/.test(rec.solved[0].decision) && rec.newTodos.length === 3 && rec.newTodos[0].owner === 'Oli Overseer');
ok('… the headlines go into the record and off the list', rec.headlines.length === 2 && rec.headlines[0].by === 'Oli Overseer' && r.headlines.length === 0);
ok('… the messages, the ratings and their average', rec.messages.length === 2 && rec.ratings.length === 4 && rec.avg === 8.5, JSON.stringify(rec.ratings));
ok('the next week’s to-dos count from when this meeting ended', r.todoSince === rec.endedAt);

console.log('=== a meeting started by mistake ===');
await call('saveLeadHeadline', D.concat([{ text: 'New headline' }]));
r = await call('leadMeetStart', O);
ok('with nobody on the schedule the one who starts leads', r.ok && r.run.by === 'st_o' && r.run.leader.id === 'st_o');
r = await call('leadMeetEnd', O.concat([{ cancel: true }]));
ok('cancelled: no record, and the headlines stay for the real one', r.ok && !r.run && r.past.length === 1 && r.headlines.length === 1);

console.log('=== campuses apart, and nothing leaks ===');
r = await call('getLeadMeeting', ['pat', '1234']);
ok('Poipet has its own meeting', r.ok && !r.score.length && !r.rocks.length && !r.past.length && !r.headlines.length);
const roster = await call('teamRoster', D);
ok('nothing of it is on the roster', !/leadMeet|Open the new dorm|Water pump/.test(JSON.stringify(roster)));
const data = await call('getData', ['', g.year]);
ok('… nor in the public figures', !/Open the new dorm|Water pump|baptised on Sunday/.test(JSON.stringify(data)));
r = await call('demoCall', ['getLeadMeeting', ['demo', '0000']]);
ok('the preview’s made-up person (not in leadership) gets nothing', !r || r.ok === false);
r = await call('demoCall', ['leadMeetStart', ['demo', '0000']]);
ok('… and the preview never runs a meeting write', !r || r.ok === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
