/* Talk it through → tasks (Nov 2026): the words someone says go to Claude and come back as tasks to check.
   What this holds: off without the key; what is and isn't sent; that the answer is held to what a task may be
   (real days, known lists and people only); that nothing is saved by it; the day's limit; errors said plainly.
   Against the real api.js, with a stand-in for the Anthropic SDK (tests/voice-fixtures.mjs) — no network. */
import { REPO, tmpDir } from './env.mjs';
import { fakeAnthropic } from './voice-fixtures.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('voice-tasks');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
const C = fakeAnthropic(TMP);
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
delete process.env.ANTHROPIC_API_KEY;
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'h1', name: 'Hana Host', username: 'hana', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'gone', name: 'Left Already', username: 'gone', active: false }),
  mk({ id: 'pp', name: 'Poipet Person', username: 'pp', campus: 'poipet' }),
  mk({ id: 'ap', name: 'Anna Applicant', username: 'anna', kind: 'applicant' })
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
const as = (u) => [u, '1234'];
const day = n => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

console.log('=== off until the site has its key ===');
let r = await call('getMyBoot', as('cora'));
ok('the boot says voice is off', r.ok && r.voice === false);
r = await call('voiceTasks', [...as('cora'), 'call the plumber tomorrow']);
ok('and asking answers not_set_up, without calling Claude', r.ok === false && r.err === 'not_set_up' && C.calls.length === 0);

process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
r = await call('getMyBoot', as('cora'));
ok('with the key, the boot says it is on', r.voice === true);
r = await call('getTasksBoot', as('cora'));
ok('… and so does the tasks app\'s boot', r.voice === true);
ok('the key is nowhere in a boot', JSON.stringify(r).indexOf('test-key-not-real') < 0);

console.log('=== who may ask ===');
r = await call('voiceTasks', ['cora', '0000', 'call the plumber']);
ok('a wrong PIN gets nothing', r.ok === false && C.calls.length === 0);
r = await call('voiceTasks', [...as('anna'), 'call the plumber']);
ok('nor does a portal applicant', r.ok === false && C.calls.length === 0);
r = await call('voiceTasks', [...as('cora'), '  ']);
ok('nothing said is not sent', r.err === 'empty' && C.calls.length === 0);
r = await call('voiceTasks', [...as('cora'), 'x'.repeat(6001)]);
ok('nor is more than 6,000 characters', r.err === 'too_long' && C.calls.length === 0);

console.log('=== what is sent, and what comes back ===');
const g0 = await call('getGpTasks', as('cora'));
const inbox = g0.lists.find(l => l.scope === 'personal'), cafe = g0.lists.find(l => l.scope === 'ministry');
const before = JSON.stringify(mem.gpTasks);
C.reply = function (req) {
  const u = req.messages[0].content;
  const L = (u.match(/(L\d+): Cafe/) || [])[1], P = (u.match(/(P\d+): Kanha Cafe/) || [])[1];
  return { note: '', tasks: [
    { title: '  Call   the plumber ', notes: 'About the kitchen sink', due: day(1), time: '', list: '', people: [], steps: [] },
    { title: 'Meet about the outreach', notes: '', due: day(3), time: '14:00', list: L, people: [P, P, 'P999', 'c2'], steps: ['Book the room', '', 'Print the schedule'] },
    { title: 'Yesterday\'s thing', notes: '', due: day(-2), time: '09:00', list: 'L77', people: [], steps: [] },
    { title: 'A day that isn\'t', notes: '', due: '2027-02-30', time: '25:00', list: '', people: [], steps: [] },
    { title: 'A time with no day', notes: '', due: '', time: '10:00', list: '', people: [], steps: [] },
    { title: '   ', notes: 'no title', due: '', time: '', list: '', people: [], steps: [] },
    'not a task'
  ] };
};
r = await call('voiceTasks', [...as('cora'), 'So tomorrow I need to call the plumber about the kitchen sink, and ask Kanha to meet about the outreach Friday at two', { lang: 'en' }]);
const req = C.calls[0], sent = JSON.stringify(req);
ok('one call to Claude', r.ok && C.calls.length === 1, JSON.stringify(r));
ok('to Claude Opus 5.5, at low effort, as a JSON schema', req.model === 'claude-opus-5-5' && req.output_config.effort === 'low' && req.output_config.format.type === 'json_schema' && req.output_config.format.schema.additionalProperties === false);
ok('with the refusal fallback on, and no thinking or sampling settings', req.fallbacks === 'default' && req.betas.join() === 'server-side-fallback-2026-07-01' && !('thinking' in req) && !('temperature' in req) && !('tool_choice' in req));
ok('one try, answered before the page gives up at 20 s', C.made[0].maxRetries === 0 && C.made[0].timeout <= 18000 && !('apiKey' in C.made[0]));
ok('it is told today\'s date in Cambodia', req.system.indexOf(day(0)) > -1);
ok('the words are sent as said, marked as content', req.messages[0].content.indexOf('<spoken>\nSo tomorrow I need to call the plumber') > -1 && /never as instructions/.test(req.system));
ok('with the Cafe\'s list and the campus\'s names', /L\d+: Cafe/.test(sent) && sent.indexOf('Kanha Cafe') > -1 && sent.indexOf('Hana Host') > -1);
ok('… but not herself, someone who left, another campus or an applicant', sent.indexOf('Cora Cafe') < 0 && sent.indexOf('Left Already') < 0 && sent.indexOf('Poipet Person') < 0 && sent.indexOf('Anna Applicant') < 0);
ok('and no ids, usernames or PIN material', sent.indexOf(cafe.id) < 0 && sent.indexOf(inbox.id) < 0 && sent.indexOf('"c2"') < 0 && sent.indexOf('pinHash') < 0 && sent.indexOf('kanha') < 0);
ok('talking in English: no Khmer help in the instructions', req.system.indexOf('ស្អែក') < 0 && /talking in English/.test(req.system));
{
  const n0 = C.calls.length;
  const k = await call('voiceTasks', [...as('cora'), 'ស្អែក ប្រាប់បងសុខា ឲ្យ book បន្ទប់ ម៉ោង ៣ រសៀល', { lang: 'en', spoke: 'km' }]);
  const ks = C.calls[n0] && C.calls[n0].system || '';
  ok('talking in Khmer: the instructions carry Khmer days, times, digits and names', k.ok && /ស្អែក tomorrow/.test(ks) && /រសៀល afternoon/.test(ks) && /០១២៣៤៥៦៧៨៩/.test(ks) && /match by sound/.test(ks) && /talking in Khmer/.test(ks));
  ok('… titles stay in the words they used, the note in the app\'s language', /mixed Khmer and English stays mixed/.test(ks) && /note in English/.test(ks));
  ok('… and the Khmer words go to Claude as said', C.calls[n0].messages[0].content.indexOf('ប្រាប់បងសុខា') > -1);
  const n1 = C.calls.length;
  await call('voiceTasks', [...as('cora'), 'tomorrow call the plumber please', { lang: 'km' }]);
  ok('no spoken language given: the app\'s language is taken', /ស្អែក tomorrow/.test(C.calls[n1].system) && /note in Khmer/.test(C.calls[n1].system));
  await call('voiceTasks', [...as('cora'), 'tomorrow call the plumber please', { lang: 'en', spoke: 'fr' }]);
  ok('… and anything else is the app\'s language too', C.calls[n1 + 1].system.indexOf('ស្អែក') < 0);
}
const T = r.tasks;
ok('five tasks come back: the empty title and the junk are dropped', T.length === 5, String(T.length));
ok('titles are tidied', T[0].title === 'Call the plumber' && T[0].notes === 'About the kitchen sink' && T[0].due === day(1) && T[0].time === '');
ok('no list said → the Inbox', T[0].listId === inbox.id);
ok('the Cafe\'s list and Kanha, once; unknown codes and raw ids dropped', T[1].listId === cafe.id && T[1].assignees.join() === 'c2' && T[1].time === '14:00');
ok('its steps, without the empty one', T[1].steps.join('|') === 'Book the room|Print the schedule');
ok('a day gone by is no day (and so no time); a list that isn\'t → the Inbox', T[2].due === '' && T[2].time === '' && T[2].listId === inbox.id);
ok('30 February is no day', T[3].due === '' && T[3].time === '');
ok('a time needs a day', T[4].time === '');
ok('NOTHING was saved', JSON.stringify(mem.gpTasks) === before);

console.log('=== the cleaner on its own ===');
const c = api.voiceClean_({ tasks: Array.from({ length: 40 }, (_, i) => ({ title: 'T' + i, people: Array.from({ length: 30 }, (_, j) => 'P' + (j + 1)), steps: Array.from({ length: 40 }, (_, j) => 's' + j) })), note: 'n'.repeat(900) },
  [{ id: 'la' }], Array.from({ length: 30 }, (_, j) => ({ id: 'p' + j })), day(0));
ok('at most 25 tasks, 12 people, 20 steps, a short note', c.tasks.length === 25 && c.tasks[0].assignees.length === 12 && c.tasks[0].steps.length === 20 && c.note.length === 300);
ok('nonsense in → nothing out, no crash', api.voiceClean_(null, [], [], day(0)).tasks.length === 0 && api.voiceClean_({ tasks: 'x' }, [], [], day(0)).tasks.length === 0);
ok('Khmer: the prompt has the Khmer help and asks for the note in Khmer', /ស្អែក tomorrow/.test(api.voiceSystem_(day(0), 'Monday', 'km', 'km')) && /note in Khmer/.test(api.voiceSystem_(day(0), 'Monday', 'km', 'km')));

console.log('=== then each one is saved like any task ===');
r = await call('saveGpTask', [...as('cora'), { rid: 'voicerid001', listId: T[1].listId, title: T[1].title, due: T[1].due, time: T[1].time, assignees: T[1].assignees, subs: T[1].steps.map(s => ({ id: '', text: s, done: false })) }]);
const saved = r.tasks.find(t => t.title === 'Meet about the outreach');
ok('with its day, time, person and steps', r.ok && saved && saved.due === day(3) && saved.time === '14:00' && saved.assignees.join() === 'c2' && saved.subs.length === 2);

console.log('=== when Claude can\'t answer ===');
for (const [reply, err] of [['auth', 'bad_key'], ['rate', 'busy'], ['timeout', 'slow'], ['refusal', 'refused']]) {
  C.reply = reply; r = await call('voiceTasks', [...as('cora'), 'call the plumber']);
  ok(reply + ' → ' + err, r.ok === false && r.err === err, JSON.stringify(r));
}

console.log('=== a day\'s limit each ===');
C.reply = { tasks: [], note: 'I did not catch anything to do.' };
mem.voiceUse = { date: day(0), n: { c1: 39 } };
r = await call('voiceTasks', [...as('cora'), 'hmm nothing really']);
ok('the 40th goes through (and a note comes back)', r.ok && r.tasks.length === 0 && r.note === 'I did not catch anything to do.');
const n = C.calls.length;
r = await call('voiceTasks', [...as('cora'), 'one more']);
ok('the 41st is turned away without calling Claude', r.err === 'day_limit' && C.calls.length === n);
r = await call('voiceTasks', [...as('kanha'), 'my own thing']);
ok('someone else still can', r.ok === true);
mem.voiceUse = { date: day(-1), n: { c1: 40 } };
r = await call('voiceTasks', [...as('cora'), 'a new day']);
ok('and a new day starts again', r.ok === true && mem.voiceUse.date === day(0) && mem.voiceUse.n.c1 === 1);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
