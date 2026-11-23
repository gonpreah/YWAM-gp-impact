/* The finance tool's records (api.js — fin2Get, fin2Save; public/finance.html).

   The Finances office saves a campus's whole finance document; Campus Leadership on that
   campus reads it; anyone else sees nothing. Saves count up a revision, and a save made from an
   older revision is refused and handed the newer copy, so nothing is silently overwritten.
   Unknown parts of a document are dropped. All names and figures are made up. */
import { tmpDir } from './env.mjs';
import { REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('fin2');
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
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  withPin({ id: 'st_fin', name: 'Bopha Keo', username: 'bopha', campus: 'poipet', dept: 'Skills Training', ministry: 'Finances', active: true }),
  withPin({ id: 'st_fin2', name: 'Lina Ros', username: 'lina', campus: 'poipet', dept: 'Skills Training', ministry: 'Kitchen', ministries: ['Skills Training|Finances'], active: true }),
  withPin({ id: 'st_cd', name: 'Mark Hill', username: 'mark', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_dl', name: 'Sophea Lim', username: 'sophea', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Community Service', active: true }),
  withPin({ id: 'st_dara', name: 'Dara Sok', username: 'dara', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_vanna', name: 'Vanna Chan', username: 'vanna', campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', active: true }),
  withPin({ id: 'st_pich', name: 'Srey Pich', username: 'pich', campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', active: true }),
  withPin({ id: 'st_sr', name: 'Tom Ray', username: 'tom', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_admin', name: 'Ada Min', username: 'ada', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true })
]);
async function call(fn, args) { const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return res.json(); }
const U = (u) => [u, '1234'];
const st1 = { bal: [{ asOf: '2026-11-16', aba: 50000, us: 20000, cash: 1671.15, at: 1 }], incomes: [], expenses: [], published: {}, junk: 'x' };

// who may read
let r = await call('fin2Get', [...U('bopha')]);
ok('the office reads an empty document', r.ok && r.rev === 0 && r.state === null && r.canEdit === true, JSON.stringify(r).slice(0, 80));
ok('the office gets the campus staff to link names to (active, this campus only)', Array.isArray(r.staff) && r.staff.some(x => x.id === 'st_vanna') && !r.staff.some(x => x.id === 'st_sr'));
r = await call('fin2Get', [...U('dara')]);
ok('ordinary staff are refused', !r.ok && r.err === 'not_authorized');
r = await call('fin2Get', ['bopha', '9999']);
ok('a wrong PIN is refused', !r.ok);

// saving
r = await call('fin2Save', [...U('bopha'), '', st1, 0]);
ok('the office saves from revision 0', r.ok && r.rev === 1, JSON.stringify(r).slice(0, 80));
ok('unknown parts are dropped', r.ok && r.state && r.state.junk === undefined && r.state.bal.length === 1);
ok('stored under fin2:<campus>, nothing in the old finance document', mem.has('fin2:poipet') && !mem.has('finance:poipet'));
r = await call('fin2Save', [...U('lina'), '', { ...st1, bal: [] }, 0]);
ok('a save from an older revision is refused and handed the newer copy', !r.ok && r.err === 'conflict' && r.rev === 1 && r.state.bal.length === 1);
r = await call('fin2Save', [...U('lina'), '', { ...st1, bal: [] }, 1]);
ok('a Finances member (other ministry) saves from the current revision', r.ok && r.rev === 2 && r.state.bal.length === 0);
r = await call('fin2Save', [...U('mark'), '', st1, 2]);
ok('Campus Leadership cannot save', !r.ok && r.err === 'not_authorized');
r = await call('fin2Save', [...U('bopha'), '', 'nope', 2]);
ok('a document that is not an object is refused', !r.ok && r.err === 'bad_state');
r = await call('fin2Save', [...U('bopha'), '', { incomes: ['x'.repeat(3100000)] }, 2]);
ok('a document over the size cap is refused', !r.ok && r.err === 'too_large');

// leadership reads, read-only; another campus is apart
r = await call('fin2Get', [...U('mark')]);
ok('the Campus Director reads it, cannot edit, gets no staff list', r.ok && r.canEdit === false && r.rev === 2 && r.staff.length === 0);
r = await call('fin2Get', [...U('tom')]);
ok('Siem Reap leadership sees Siem Reap’s (empty), not Poipet’s', r.ok && r.campus === 'siemreap' && r.rev === 0 && r.state === null);
r = await call('fin2Get', [...U('mark'), 'siemreap']);
ok('a non-admin cannot ask for another campus', r.ok && r.campus === 'poipet');
r = await call('fin2Save', [...U('ada'), 'siemreap', st1, 0]);
ok('an admin may save another campus', r.ok && r.campus === 'siemreap' && r.rev === 1);

// a new A/R Ageing report feeds each department's Staff Debt ($), as The numbers used to
const entries = () => JSON.parse(mem.get('entries') || '[]');
const debtSt = { bal: [], debt: { asOf: '2026-11-23', file: 'ageing.xlsx', people: [
  { n: 'Dara Sok', b: [100, 50, 0, 0, 0], tot: 150, d: 'Community Service', staffId: 'st_dara' },
  { n: 'Vanna Chan', b: [20, 0, 0, 0, 0], tot: 20, d: '', staffId: 'st_vanna' },
  { n: 'Someone Gone', b: [5, 0, 0, 0, 0], tot: 5, d: '', staffId: null }] } };
r = await call('fin2Get', [...U('bopha')]);
r = await call('fin2Save', [...U('bopha'), '', debtSt, r.rev]);
const sd = (dept) => { const e = entries().filter(x => x.campus === 'poipet' && x.dept === 'Campus Leadership' && x.ministry === dept && x.metric === 'Staff Debt ($)'); return e.length ? e[e.length - 1].value : null; };
ok('a new ageing report writes each department’s Staff Debt ($)', r.ok && sd('Community Service') === 150 && sd('Youth Education') === 20, sd('Community Service') + ' / ' + sd('Youth Education'));
ok('… and 0 for a department nobody on it owes', sd('Media') === 0 || sd('Skills Training') === 0);
const before = entries().length;
r = await call('fin2Save', [...U('bopha'), '', { ...debtSt, bal: [{ asOf: '2026-11-23', aba: 1, us: 0, cash: 0 }] }, r.rev]);
ok('a save that doesn’t change the debt writes nothing more', r.ok && entries().length === before);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
