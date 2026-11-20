/* The preview (Look around): demoCall runs the app's own handlers on a campus made up in memory for one request
   (Nov 2026, Andrew: "a view of the app, but none of the real data … a mock-up"). What must hold: the real store is
   never read or written; only the made-up person can be signed in; nothing outside the everyday reads and writes
   (accounts, admin, HR, QuickBooks, Google, Anthropic) runs; and a "save" never outlives its request. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('demo');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={}; export const touched=[];
export function getStore(o){ const name=(o&&o.name)||o; return {
  get: async (k)=>{ touched.push(name+':'+k); return (k in mem)?JSON.parse(JSON.stringify(mem[k])):null; },
  setJSON: async (k,v)=>{ touched.push('W '+name+':'+k); mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ touched.push('D '+name+':'+k); delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
mem.staff = [{ id: 'r1', name: 'Real Person', username: 'demo', email: 'real@e.com', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, isAdmin: true, pinSalt: 'r1', pinHash: H('0000', 'r1') }];
mem.entries = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: 3, year: 2026, value: 777 }];

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const call = async (fn, args) => (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json();
const realBefore = JSON.stringify(mem);
blobs.touched.length = 0;

const b = await call('demoCall', ['getMyBoot', ['demo', '0000']]);
ok('the preview boots as the made-up person — not the real account that happens to share the username', b.ok && b.staff.name === 'Dara Sok' && !b.staff.isAdmin, b.staff && b.staff.name);
ok('… with a made-up team, goals, check-ins and the base’s numbers', b.roster.length >= 10 && b.goals.length >= 1 && b.checkins.length > 5 && !!b.base);
ok('… and none of the real data: no real person, no real number', !/Real Person|real@e\.com/.test(JSON.stringify(b)) && !/"value":777/.test(JSON.stringify(b)));
ok('the real store is not touched at all', blobs.touched.length === 0, JSON.stringify(blobs.touched));
const other = await call('demoCall', ['getMyBoot', ['demo-grace', '0000']]);
ok('nobody else on the made-up campus can be signed in', !other.ok);
for (const fn of ['adminListStaff', 'hrList', 'portalBoot', 'staffRegister', 'qboSyncNow', 'voiceTasks', 'grantAdmin', 'adminSetActive', 'getTasksBoot', 'demoCall', 'constructor', 'toString', 'nope'])
  ok('“' + fn + '” is not run in the preview', (await call('demoCall', [fn, ['demo', '0000']])).err === 'preview');
const saved = await call('demoCall', ['saveGoals', ['demo', '0000', 10, [{ text: 'A goal from the preview', pct: 40 }]]]);
ok('an everyday write runs, and answers like the app', saved && saved.ok !== false, JSON.stringify(saved).slice(0, 120));
const again = await call('demoCall', ['getMyBoot', ['demo', '0000']]);
ok('… but is gone on the next request — nothing is kept', !/A goal from the preview/.test(JSON.stringify(again)));
const tasks = await call('demoCall', ['getGpTasks', ['demo', '0000']]);
ok('GP Tasks, Team and the rest answer from the same made-up campus', tasks.ok && tasks.tasks.length >= 3);
ok('after all of it, the real store is exactly as it was, and was never opened', JSON.stringify(mem) === realBefore && blobs.touched.length === 0, JSON.stringify(blobs.touched));
const real = await call('getMyBoot', ['demo', '0000']);
ok('outside the preview, the same call reaches the real store as always', real.ok && real.staff.name === 'Real Person');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
