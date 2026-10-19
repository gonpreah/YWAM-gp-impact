/* GP Tasks (Oct 2026): lists for a ministry, a department or yourself (shared or not), tasks
   with a day and a time, people assigned, asking another ministry for help (a request it
   accepts or declines), Campus Leadership's tasks landing straight in a ministry's list, the
   saved filter, and a board card linked to a ministry and a person. Who sees and who changes
   what is the point of most of this. Against the real api.js. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('gp-tasks');
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
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'h1', name: 'Hana Host', username: 'hana', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'l1', name: 'Uriah Lead', username: 'uriah', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'pp', name: 'Poipet Person', username: 'pp', campus: 'poipet' })
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
const as = (u) => [u, '1234'];
const day = n => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const task = (r, title) => (r.tasks || []).find(t => t.title === title);

console.log('=== a ministry\'s list ===');
let r = await call('saveGpTaskList', [...as('hana'), { scope: 'ministry', dept: 'Community Service', ministry: 'Cafe', title: 'Cafe jobs' }]);
ok('someone outside the Cafe can\'t make the Cafe a list', r.ok === false && r.err === 'not_authorized');
r = await call('saveGpTaskList', [...as('cora'), { scope: 'ministry', dept: 'Community Service', ministry: 'Cafe', title: 'Cafe jobs' }]);
const cafe = r.lists.find(l => l.title === 'Cafe jobs');
ok('the Cafe makes its own list', r.ok && cafe && cafe.scope === 'ministry' && cafe.mine && cafe.canEdit);
r = await call('saveGpTask', [...as('cora'), { listId: cafe.id, title: 'Order milk', due: day(1), time: '09:30', assignees: ['c2', 'pp', 'nobody'] }]);
let t1 = task(r, 'Order milk');
ok('a task with a day and a time, given to Kanha (not to someone off campus or unknown)', t1 && t1.due === day(1) && t1.time === '09:30' && t1.assignees.join() === 'c2' && t1.status === 'open');
r = await call('saveGpTask', [...as('cora'), { listId: cafe.id, title: 'No day', time: '10:00' }]);
ok('a time needs a day', task(r, 'No day').time === '');
r = await call('getGpTasks', as('kanha'));
ok('Kanha sees the Cafe list and the task given to her', r.ok && r.lists.some(l => l.id === cafe.id) && !!task(r, 'Order milk'));
r = await call('getMyBoot', as('kanha'));
ok('… and her bell is told: Cora gave you a task', r.gpTaskInfo && r.gpTaskInfo.open === 1 && r.gpTaskInfo.notices.some(n => n.kind === 'assigned' && n.title === 'Order milk' && n.by === 'c1'), JSON.stringify(r.gpTaskInfo));
r = await call('getGpTasks', as('hana'));
ok('Hospitality doesn\'t see the Cafe\'s list', r.ok && !r.lists.some(l => l.id === cafe.id) && !task(r, 'Order milk'));
r = await call('getGpTasks', as('pp'));
ok('nor does Poipet', !r.lists.some(l => l.id === cafe.id));

console.log('=== asking another ministry for help ===');
r = await call('saveGpTask', [...as('hana'), { listId: cafe.id, title: 'Coffee for the team arriving Friday', due: day(4) }]);
let rq = task(r, 'Coffee for the team arriving Friday');
ok('Hospitality asks the Cafe: a request, from Hospitality', rq && rq.status === 'request' && rq.from && rq.from.label === 'Hospitality', JSON.stringify(r).slice(0, 300));
r = await call('getMyBoot', as('kanha'));
ok('the Cafe\'s people are told in the bell', r.gpTaskInfo.notices.some(n => n.kind === 'request' && n.from === 'Hospitality'));
r = await call('saveGpTask', [...as('hana'), { id: rq.id, done: true }]);
ok('a request can\'t be ticked off before it is taken', task(r, 'Coffee for the team arriving Friday').done === false);
r = await call('respondGpTask', [...as('hana'), rq.id, true]);
ok('the one asking can\'t accept it for the Cafe', r.ok === false);
r = await call('respondGpTask', [...as('kanha'), rq.id, true]);
ok('the Cafe accepts: it is in their list like any task', r.ok && task(r, 'Coffee for the team arriving Friday').status === 'open');
r = await call('saveGpTask', [...as('hana'), { listId: cafe.id, title: 'Cater a wedding' }]);
const rq2 = task(r, 'Cater a wedding');
r = await call('respondGpTask', [...as('cora'), rq2.id, false]);
ok('… or declines', task(r, 'Cater a wedding').status === 'declined');
r = await call('getMyBoot', as('hana'));
ok('… and the one who asked is told', r.gpTaskInfo.notices.some(n => n.kind === 'declined' && n.title === 'Cater a wedding'));
r = await call('saveGpTask', [...as('pp'), { listId: cafe.id, title: 'From Poipet' }]);
ok('another campus can\'t ask', r.ok === false);

console.log('=== Campus Leadership ===');
r = await call('getGpTasks', as('uriah'));
ok('Campus Leadership sees every list on the campus', r.ok && r.canAll && r.lists.some(l => l.id === cafe.id));
r = await call('saveGpTask', [...as('uriah'), { listId: cafe.id, title: 'Price list for the new menu', assignees: ['h1'] }]);
const lt = task(r, 'Price list for the new menu');
ok('its task lands straight in the list, from Campus Leadership — no request to accept', lt && lt.status === 'open' && lt.from && lt.from.label === 'Campus Leadership');
r = await call('getGpTasks', as('hana'));
ok('Hana, given it, sees it though she doesn\'t see the Cafe\'s list', !!task(r, 'Price list for the new menu') && r.lists.find(l => l.id === cafe.id).onlyAssigned === true);
r = await call('saveGpTask', [...as('hana'), { id: lt.id, done: true }]);
ok('… and ticks it off', task(r, 'Price list for the new menu').done === true);
r = await call('saveGpTask', [...as('hana'), { id: t1.id, title: 'Hijacked' }]);
ok('but can\'t change the Cafe\'s other tasks', r.ok === false);
r = await call('deleteGpTask', [...as('hana'), t1.id]);
ok('… nor delete them', r.ok === false);
r = await call('saveGpTaskFilter', [...as('uriah'), ['Community Service|Cafe']]);
ok('a saved filter, kept on them', r.ok && r.filter && r.filter.keys.join() === 'Community Service|Cafe' && mem.staff.find(s => s.id === 'l1').taskFilter);
r = await call('saveGpTaskFilter', [...as('uriah'), null]);
ok('… and cleared', r.ok && r.filter === null);

console.log('=== a board card for a ministry and a person ===');
r = await call('saveLeadCard', [...as('uriah'), { title: 'Fix the cafe sign', type: 'project', owner: 'c2', due: day(5), taskMin: 'Community Service|Cafe' }]);
const card = r.saved;
r = await call('getGpTasks', as('kanha'));
let ct = (r.tasks || []).find(t => t.cardId === card.id);
ok('it shows up in the Cafe\'s list, given to Kanha, from Campus Leadership', ct && ct.title === 'Fix the cafe sign' && ct.assignees.join() === 'c2' && ct.from.label === 'Campus Leadership' && ct.due === day(5));
r = await call('getMyBoot', as('kanha'));
ok('… and her bell says so', r.gpTaskInfo.notices.some(n => n.kind === 'assigned' && n.title === 'Fix the cafe sign'));
const done = (await call('getLeadBoard', as('uriah'))).cols.find(c => c.done).id;
await call('saveLeadCard', [...as('uriah'), Object.assign({}, card, { col: done })]);
r = await call('getGpTasks', as('kanha'));
ok('the card done on the board: the task is done too', (r.tasks || []).find(t => t.cardId === card.id).done === true);
await call('saveLeadCard', [...as('uriah'), Object.assign({}, card, { taskMin: '' })]);
r = await call('getGpTasks', as('kanha'));
ok('unlinked: the task goes', !(r.tasks || []).some(t => t.cardId === card.id));

console.log('=== personal lists ===');
r = await call('saveGpTaskList', [...as('kanha'), { scope: 'personal', title: 'Mine' }]);
const pl = r.lists.find(l => l.title === 'Mine');
await call('saveGpTask', [...as('kanha'), { listId: pl.id, title: 'Call home' }]);
r = await call('getGpTasks', as('cora'));
ok('a personal list is yours alone', !r.lists.some(l => l.id === pl.id) && !task(r, 'Call home'));
await call('saveGpTaskList', [...as('kanha'), { id: pl.id, shared: true }]);
r = await call('getGpTasks', as('cora'));
ok('shared: others on the campus see it…', r.lists.some(l => l.id === pl.id && !l.canEdit) && !!task(r, 'Call home'));
r = await call('saveGpTask', [...as('cora'), { listId: pl.id, title: 'Sneaky' }]);
ok('… but can\'t add to it', r.ok === false);
r = await call('saveGpTaskList', [...as('uriah'), { id: pl.id, title: 'Renamed' }]);
ok('… nor rename it (not even leadership)', r.ok === false);
r = await call('getGpTasks', as('pp'));
ok('… and another campus doesn\'t see it', !r.lists.some(l => l.id === pl.id));
r = await call('saveGpTaskList', [...as('kanha'), { id: pl.id, remove: true }]);
ok('deleting a list takes its tasks with it', !r.lists.some(l => l.id === pl.id) && !mem.gpTasks.tasks.some(t => t.listId === pl.id));

console.log('=== a department\'s list ===');
r = await call('saveGpTaskList', [...as('cora'), { scope: 'dept', dept: 'Community Service', title: 'Community Service' }]);
const dl = r.lists.find(l => l.scope === 'dept');
ok('a department list, for everyone in the department', dl && dl.dept === 'Community Service' && dl.ministry === '');
r = await call('getGpTasks', as('hana'));
ok('… not for another department', !r.lists.some(l => l.id === dl.id));
r = await call('clearDoneGpTasks', [...as('cora'), cafe.id]);
ok('Clear completed takes the done ones off', r.ok && !r.tasks.some(t => t.listId === cafe.id && t.done));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
