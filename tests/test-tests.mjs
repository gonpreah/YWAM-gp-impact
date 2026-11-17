/* Tests (Nov 2026): the fivefold gifts (APEST) and the couple check-up — api.js saveMyApest, mc*.
   APEST: scored on the server from the answers alone, its statement list the same length and order as
   the page's; a teammate sees the top two only while shared. Couple check-up: only the two partners
   and their counsellor ever see it; nothing of the other partner's answers before both are in. Made-up names. */
import { tmpDir } from './env.mjs';
import { REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('tests-apest-mc');
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
const P = (o) => ({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, ...o, pinSalt: o.id, pinHash: mkHash('1234', o.id) });
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  P({ id: 's_dara', name: 'Dara Sok', username: 'dara' }), P({ id: 's_lina', name: 'Lina Chan', username: 'lina' }),
  P({ id: 's_tom', name: 'Tom Reed', username: 'tom' }), P({ id: 's_eve', name: 'Eve Park', username: 'eve', isAdmin: true }),
  P({ id: 's_old', name: 'Old Hand', username: 'old', active: false })
]);
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };

/* ---- the statements: the page's list and the server's agree ---- */
const src = fs.readFileSync(REPO + '/public/teams/17-tests.js', 'utf8'), apiSrc = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const pageGifts = [...src.slice(src.indexOf('var APEST_QS=['), src.indexOf('var APEST_SCALE')).matchAll(/\n  \['([apest])',\{en:/g)].map((m) => m[1]);
const srvGifts = JSON.parse(apiSrc.match(/const APEST_ITEMS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
ok('APEST: the page and the server list the same 30 statements, gift for gift', pageGifts.length === 30 && pageGifts.join() === srvGifts.join(), pageGifts.length);
ok('APEST: six statements for each of the five gifts', ['a', 'p', 'e', 's', 't'].every((g) => srvGifts.filter((x) => x === g).length === 6));
const mcPage = [...src.slice(src.indexOf('var MC_QS=['), src.indexOf('var MC_SCALE')).matchAll(/\n  \['(\w+)',\{en:/g)].map((m) => m[1]);
ok('couple check-up: the page has the 40 statements the server asks for, four in each of ten areas', mcPage.length === Number(apiSrc.match(/const MC_N = (\d+)/)[1]) && new Set(mcPage).size === 10 && [...new Set(mcPage)].every((a) => mcPage.filter((x) => x === a).length === 4));
const kmOf = (block) => [...block.matchAll(/km:'([^']*)'/g)].map((m) => m[1]);
const khmer = (x) => { const l = x.replace(/[\s\d\p{P}\p{S}]/gu, ''); return l && (l.match(/[ក-៿]/g) || []).length / l.length > 0.6; };
ok('every statement, gift and area has its Khmer', kmOf(src.slice(src.indexOf('var APEST_GIFTS'), src.indexOf('function mcArea_'))).every(khmer) && (src.match(/\{en:/g) || []).length === (src.match(/\bkm:'/g) || []).length);

/* ---- APEST: scored on the server ---- */
const all = (v) => Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['q' + i, typeof v === 'function' ? v(i) : v]));
let r = await call('saveMyApest', ['dara', '1234', { answers: { q0: 5 } }]);
ok('half a test is refused', !r.ok && r.err === 'incomplete');
r = await call('saveMyApest', ['dara', '1234', { answers: all(9) }]);
ok('an answer out of 1–5 is refused', !r.ok && r.err === 'incomplete');
r = await call('saveMyApest', ['dara', '1234', { answers: all((i) => srvGifts[i] === 's' ? 5 : srvGifts[i] === 't' ? 4 : 1), top: ['a', 'p'] }]);
ok('the server works out the gifts — a "top" sent by the page is ignored', r.ok && r.apest.top[0] === 's' && r.apest.top[1] === 't' && r.apest.scores.s === 100 && r.apest.scores.a === 0, r.apest && r.apest.top.join());
ok('… and the roster carries the top two while shared', r.staff.apest && r.staff.apest.join() === 's,t');
let p = await call('staffProfile', ['lina', '1234', 's_dara']);
ok('a teammate sees the top two, never the answers or scores', p.ok && p.apest.join() === 's,t' && !JSON.stringify(p).includes('"answers"'));
let pub = await call('teamRoster', []);
ok('the public roster carries none of it', !JSON.stringify(pub).includes('apest'));
r = await call('saveMyApest', ['dara', '1234', { share: false }]);
p = await call('staffProfile', ['lina', '1234', 's_dara']);
ok('sharing off: a teammate sees nothing', r.ok && !p.apest && r.apest.share === false);
let boot = await call('getMyBoot', ['dara', '1234']);
ok('the owner still has it all on their own boot', boot.profile && boot.profile.apest && boot.profile.apest.top[0] === 's' && Object.keys(boot.profile.apest.answers).length === 30);

/* ---- the couple check-up: private to the two and their counsellor ---- */
const mcA = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['q' + i, 4]));
const mcB = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['q' + i, i < 4 ? 1 : 5]));
r = await call('mcStart', ['dara', '1234', { partnerId: 's_dara' }]);
ok('you can’t be your own partner', !r.ok && r.err === 'bad_partner');
r = await call('mcStart', ['dara', '1234', { partnerId: 's_old' }]);
ok('nor pick someone no longer active', !r.ok && r.err === 'bad_partner');
r = await call('mcStart', ['dara', '1234', { partnerId: 's_lina', counselorId: 's_lina' }]);
ok('the counsellor can’t be one of the couple', !r.ok && r.err === 'bad_counselor');
r = await call('mcStart', ['dara', '1234', { partnerId: 's_lina', counselorId: 's_tom', stage: 'engaged' }]);
const id = r.id;
ok('Dara starts one with Lina, Tom as counsellor', r.ok && id && r.list.length === 1 && r.list[0].b.id === 's_lina' && r.list[0].counselor.id === 's_tom');
r = await call('mcAnswer', ['dara', '1234', id, { q0: 4 }]);
ok('half the statements is refused', !r.ok && r.err === 'incomplete');
r = await call('mcAnswer', ['dara', '1234', id, mcA]);
ok('Dara answers: sees her own answers, no results yet', r.ok && r.list[0].doneA && !r.list[0].both && r.list[0].mine.q0 === 4 && r.list[0].answers === null);
let l = await call('mcList', ['lina', '1234']);
ok('Lina sees it is waiting for her — and nothing of Dara’s answers', l.ok && l.list.length === 1 && l.list[0].doneA && !l.list[0].mine && !l.list[0].answers && !JSON.stringify(l).includes('"q0"'));
let tl = await call('mcList', ['tom', '1234']);
ok('Tom, the counsellor, sees who has answered and nothing else', tl.ok && tl.list[0].role === 'counselor' && tl.list[0].doneA && !tl.list[0].mine && !tl.list[0].answers);
let el = await call('mcList', ['eve', '1234']);
ok('an admin who is not in it sees nothing at all', el.ok && el.list.length === 0);
r = await call('mcAnswer', ['tom', '1234', id, mcA]);
ok('the counsellor can’t answer for them', !r.ok && r.err === 'not_found');
r = await call('mcAnswer', ['lina', '1234', id, mcB]);
ok('Lina answers: now both see both sets of answers', r.ok && r.list[0].both && r.list[0].answers.a.q0 === 4 && r.list[0].answers.b.q0 === 1);
tl = await call('mcList', ['tom', '1234']);
ok('… and so does their counsellor', tl.list[0].both && tl.list[0].answers.b.q5 === 5);
r = await call('mcSetCounselor', ['tom', '1234', id, 's_eve']);
ok('only the couple choose the counsellor', !r.ok);
r = await call('mcSetCounselor', ['lina', '1234', id, '']);
tl = await call('mcList', ['tom', '1234']);
ok('taking the counsellor off: they see it no more', r.ok && tl.list.length === 0);
r = await call('mcDelete', ['eve', '1234', id]);
ok('an outsider can’t delete it', !r.ok);
r = await call('mcDelete', ['dara', '1234', id]);
ok('either partner can delete it, answers and all', r.ok && r.list.length === 0 && (await blobs.getStore({ name: 'gp-data' }).get('mcheck')).length === 0);
for (let i = 0; i < 3; i++) await call('mcStart', ['dara', '1234', { partnerId: 's_lina' }]);
r = await call('mcStart', ['dara', '1234', { partnerId: 's_tom' }]);
ok('no more than three waiting to be finished', !r.ok && r.err === 'too_many');
r = await call('mcList', ['nobody', '1234']);
ok('no sign-in, nothing', !r.ok);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
