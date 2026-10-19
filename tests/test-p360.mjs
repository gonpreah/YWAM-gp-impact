/* 360 reviews (api.js — p360*). Anonymous by construction: answers keep nothing that says whose
   they are; the person sees counts, never who; results only once closed and from three or more;
   comments shuffled per question; shared read-only with whoever the person picks; the action plan
   and its quarterly reviews are the person's own. All names here are made up. */
import { tmpDir } from './env.mjs';
import { REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('p360');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const stores={};
export function getStore(o){
  const name=(typeof o==='string') ? o : o.name;
  const mem=stores[name]||(stores[name]=new Map());
  return {
    get: async (k,opt)=>{ if(!mem.has(k)) return null; const v=mem.get(k); return (opt&&opt.type==='text') ? v : JSON.parse(v); },
    set: async (k,v)=>{ mem.set(k, String(v)); },
    setJSON: async (k,v)=>{ mem.set(k, JSON.stringify(v)); },
    delete: async (k)=>{ mem.delete(k); },
    list: ()=>({ [Symbol.asyncIterator]: async function*(){ yield { blobs: [...mem.keys()].map(key=>({key})), directories: [] }; } })
  };
}
export const __stores=stores;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__stores['gp-data'] || (blobs.getStore({ name: 'gp-data' }), blobs.__stores['gp-data']);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
const H = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  withPin({ id: 'st_me', name: 'Mark Hill', username: 'mark', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, mentorId: 'st_ann' }),
  withPin({ id: 'st_ann', name: 'Ann Lee', username: 'ann', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Community Service', active: true }),
  withPin({ id: 'st_bo', name: 'Bo Chan', username: 'bo', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Youth Education', active: true }),
  withPin({ id: 'st_cy', name: 'Cy Ros', username: 'cy', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_di', name: 'Di Sok', username: 'di', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_out', name: 'Not Asked', username: 'out', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_admin', name: 'Ada Min', username: 'ada', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true })
]);
await blobs.getStore({ name: 'gp-data' }).setJSON('board', [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }]);
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json();
}
const rows = () => JSON.parse(mem.get('p360') || '[]');
const R = (ratings, keep, start, stop) => ({ ratings, keep, start, stop, other: '' });
const all = (n) => ({ faith: n, vision: n, care: n, comms: n, team: n, reliable: n, humble: n, decide: n, culture: n });

console.log('=== starting one ===');
let r = await call('p360Create', ['mark', '1234', { title: 'My 2026 360', reviewers: ['st_ann', 'st_bo'] }]);
ok('it needs at least three people asked — fewer can’t stay anonymous', !r.ok && r.err === 'too_few');
r = await call('p360Create', ['mark', '1234', { title: 'My 2026 360', note: 'Be honest, please.', reviewers: ['st_ann', 'st_bo', 'st_cy', 'st_di', 'bd1', 'st_me', 'nobody', 'st_ann'] }]);
ok('staff from any campus and the board can be asked; not yourself, nobody twice', r.ok && r.review.asked === 5 && r.review.reviewers.map((p) => p.id).sort().join() === 'bd1,st_ann,st_bo,st_cy,st_di');
const id = r.review.id;
r = await call('p360Create', ['mary', '4321', { reviewers: ['st_ann', 'st_bo', 'st_cy'] }]);
ok('a review is a staff member’s own (a board login can answer, not start one)', !r.ok && r.err === 'staff_only');
r = await call('p360List', ['ann', '1234']);
ok('the people asked see it waiting for them, with whose it is', r.ok && r.asked.length === 1 && r.asked[0].subject.name === 'Mark Hill' && r.asked[0].note === 'Be honest, please.');
r = await call('p360List', ['out', '1234']);
ok('nobody else does', r.ok && !r.asked.length && !r.mine.length && !r.shared.length);
r = await call('getMyBoot', ['ann', '1234']);
ok('My Home knows one is waiting for them', r.p360 && r.p360.asked === 1);

console.log('=== answering ===');
r = await call('p360Answer', ['out', '1234', id, R(all(5), 'x')]);
ok('only someone asked can answer', !r.ok);
r = await call('p360Answer', ['ann', '1234', id, R(all(4), 'Clear vision', 'Delegating more', 'Late emails')]);
ok('someone asked answers', r.ok);
r = await call('p360Answer', ['ann', '1234', id, R(all(1), 'again')]);
ok('… once', !r.ok && r.err === 'already');
r = await call('p360Answer', ['bo', '1234', id, { ratings: { faith: 9, vision: 2.5, care: 'x' } }]);
ok('an answer with nothing real in it isn’t kept', !r.ok && r.err === 'empty');
await call('p360Answer', ['bo', '1234', id, R({ faith: 5, vision: 3, care: 4, comms: 3, team: 4, reliable: 5, humble: 4, decide: 3, culture: null }, 'Prays with us', '', 'Overcommitting')]);
await call('p360Answer', ['mary', '4321', id, R({ faith: 5, vision: 4, care: 5, comms: 2, team: 3, reliable: 4, humble: 4, decide: 4, culture: null }, 'Faithful', 'Asking for help', '')]);
const doc = rows().find((x) => x.id === id);
ok('an answer is kept with nothing that says whose it is', doc.answers.length === 3 && doc.answers.every((a) => Object.keys(a).sort().join() === 'keep,other,ratings,start,stop'));
ok('… and the list of who has answered is just names in order, apart from the answers', doc.done.join() === [...doc.done].sort().join() && doc.done.length === 3);
r = await call('p360Get', ['mark', '1234', id]);
ok('the person sees how many have answered — never who', r.ok && r.review.answered === 3 && r.review.asked === 5 && !JSON.stringify(r).includes('"done"') && !/declined/.test(JSON.stringify(r)));
ok('… and no results while it is open (a change could be matched to whoever just answered)', r.review.results === null && !r.review.closed);
r = await call('p360Get', ['ann', '1234', id]);
ok('a reviewer can’t open the review', !r.ok);
r = await call('p360Decline', ['cy', '1234', id]);
ok('someone asked can say no', r.ok && !(await call('p360List', ['cy', '1234'])).asked.length);
r = await call('p360Self', ['mark', '1234', id, R(all(3), 'Teaching', 'Rest', 'Rushing')]);
ok('the person answers about themselves', r.ok && r.review.self.ratings.faith === 3);
r = await call('p360Self', ['ann', '1234', id, R(all(1))]);
ok('… nobody else can', !r.ok);

console.log('=== the results ===');
r = await call('p360Close', ['ann', '1234', id]);
ok('only the person closes it', !r.ok);
r = await call('p360Close', ['mark', '1234', id]);
const res = r.review.results;
ok('closed: the results, from three answers', r.ok && r.review.closed && res && res.n === 3);
ok('… each area’s average', res.areas.faith.avg === 4.7 && res.areas.comms.avg === 3 && res.areas.faith.dist.join() === '0,0,0,1,2');
ok('… an area fewer than three rated shows no average', res.areas.culture.avg === null && res.areas.culture.n === 1);
ok('… the comments word for word, without the empty ones', res.comments.keep.length === 3 && res.comments.start.length === 2 && res.comments.stop.length === 2 && res.comments.keep.includes('Prays with us'));
r = await call('p360Answer', ['di', '1234', id, R(all(5), 'late')]);
ok('nobody answers once it is closed', !r.ok && r.err === 'closed');
let shuffled = false;
for (let i = 0; i < 12 && !shuffled; i++) { const x = (await call('p360Get', ['mark', '1234', id])).review.results.comments.keep.join('|'); if (x !== res.comments.keep.join('|')) shuffled = true; }
ok('the comments come in a different order each time, so one person’s can’t be read across', shuffled);

console.log('=== a review with too few answers ===');
r = await call('p360Create', ['mark', '1234', { reviewers: ['st_ann', 'st_bo', 'st_cy'] }]);
const id2 = r.review.id;
await call('p360Answer', ['ann', '1234', id2, R(all(5), 'a')]); await call('p360Answer', ['bo', '1234', id2, R(all(1), 'b')]);
r = await call('p360Close', ['mark', '1234', id2]);
ok('closed with two answers: nothing shown, so nobody can be worked out', r.ok && r.review.closed && r.review.results === null && r.review.answered === 2);

console.log('=== sharing ===');
r = await call('p360Share', ['mark', '1234', id, ['st_ann', 'st_me', 'nobody']]);
ok('the person shares it with whoever they choose (not themselves, only real people)', r.ok && r.review.sharedWith.map((p) => p.id).join() === 'st_ann');
r = await call('p360Get', ['ann', '1234', id]);
ok('… who then see the results and the plan, read-only — and not who was asked', r.ok && r.review.results && !r.review.mine && !r.review.reviewers && !r.review.sharedWith);
r = await call('p360SavePlan', ['ann', '1234', id, [{ what: 'x' }]]);
ok('… and can’t change the plan', !r.ok);
r = await call('p360Get', ['ada', '1234', id]);
ok('an admin doesn’t see it either, unless shared', !r.ok);

console.log('=== the action plan and its quarterly reviews ===');
r = await call('p360SavePlan', ['mark', '1234', id, [{ area: 'comms', what: 'Answer emails within two days', measure: 'Inbox under 20 on Fridays', by: '2027-Q1' },
  { area: 'bogus', what: 'Delegate the Tuesday meeting', measure: '', by: 'soon' }, { what: '' }]]);
const acts = r.review.plan.actions;
ok('actions from the results: what, how I’ll know, by when', r.ok && acts.length === 2 && acts[0].area === 'comms' && acts[0].by === '2027-Q1' && acts[1].area === '' && acts[1].by === '');
r = await call('getMyBoot', ['mark', '1234']);
ok('a plan with no review this quarter is due on My Home', r.p360 && r.p360.reviewDue === true && r.p360.has);
const q = (await call('p360List', ['mark', '1234'])).quarter;
r = await call('p360Review', ['mark', '1234', id, q, [{ actionId: acts[0].id, status: 'ontrack', note: 'Most weeks' }, { actionId: acts[1].id, status: 'flying' }, { actionId: 'nope', status: 'done' }], 'A good start.']);
ok('the quarter’s review: each action’s progress and a reflection', r.ok && r.review.plan.reviews[q].items[acts[0].id].status === 'ontrack' && r.review.plan.reviews[q].items[acts[1].id].status === 'notstarted' && !r.review.plan.reviews[q].items.nope && r.review.plan.reviews[q].reflection === 'A good start.');
ok('… and it is no longer due', (await call('getMyBoot', ['mark', '1234'])).p360.reviewDue === false);
r = await call('p360Review', ['mark', '1234', id, '2099-Q1', [], '']);
ok('a quarter not here yet can’t be reviewed', !r.ok && r.err === 'bad_quarter');

console.log('=== taking it out ===');
r = await call('p360Delete', ['ann', '1234', id]);
ok('only the person can delete their review', !r.ok && rows().some((x) => x.id === id));
r = await call('p360Delete', ['mark', '1234', id2]);
ok('the person can', r.ok && !rows().some((x) => x.id === id2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
