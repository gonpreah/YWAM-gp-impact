/* GP Tasks as an app of its own (Nov 2026, Andrew: "a separate app for our tasks and calendar … synced and
   linked to the main app"), the server's part and the files: getTasksBoot is the tasks app's one call per
   open — who you are, the roster, the tasks (the Inbox made on the first open, as getGpTasks does), the
   calendar's month only when asked — and nothing of the main app's page (logs, check-ins, the base's
   numbers); a wrong PIN is 'auth', an applicant is refused. tasks.html is teams.html built by
   scripts/build-tasks-page.mjs and must be what that script writes; it has its own manifest and icons,
   the service worker keeps it, and the deploy stamps it like teams.html. */
import { REPO, PUBLIC, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TMP = tmpDir('tasks-app');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora', email: 'c@e.com' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'a1', name: 'Ann Applicant', username: 'ann@e.com', kind: 'applicant', applicant: { type: 'volunteer' } })
];
const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

let r = await call('getTasksBoot', ['cora', '9999', '']);
ok('a wrong PIN is "auth" (so only that signs someone out)', r.ok === false && r.err === 'auth');
r = await call('getTasksBoot', ['ann@e.com', '1234', '']);
ok('an applicant is refused', r.ok === false);
r = await call('getTasksBoot', ['cora', '1234', '']);
ok('the boot: who you are and the roster', r.ok && r.app === 'tasks' && r.staff.id === 'c1' && r.roster.length === 2 && !r.roster.some(x => x.id === 'a1'), r.roster && r.roster.map(x => x.id).join(','));
const inbox = r.gpTasks && r.gpTasks.lists.find(L => L.scope === 'personal' && L.title === 'Inbox');
ok('… the tasks, with the Inbox and the Cafe’s list made on the first open', r.gpTasks && r.gpTasks.ok && !!inbox && r.gpTasks.lists.some(L => L.scope === 'ministry' && L.ministry === 'Cafe'));
ok('… and the bell’s task counts', !!r.gpTaskInfo);
ok('no calendar unless asked for', r.cal === null);
ok('nothing of the main app’s page', !('logs' in r) && !('checkins' in r) && !('base' in r) && !('goals' in r) && !('mentees' in r));
ok('the profile is only what the tasks need — no debt, no phone', !('debt' in r.profile) && !('phone' in r.profile));
await call('saveGpTask', ['cora', '1234', { listId: inbox.id, title: 'Buy coffee beans' }]);
r = await call('getTasksBoot', ['cora', '1234', '']);
ok('the same tasks as the main app (a task saved there is in the next boot)', r.gpTasks.tasks.some(x => x.title === 'Buy coffee beans'));
r = await call('getTasksBoot', ['cora', '1234', '2026-10-27']);
ok('asked for the calendar, the month comes too (here nothing connected), marked with its first day', r.cal && r.cal.ok && r.cal.from === '2026-10-27' && r.cal.connected === false, JSON.stringify(r.cal));

/* the files */
const chk = spawnSync(process.execPath, [REPO + '/scripts/build-tasks-page.mjs', '--check'], { encoding: 'utf8' });
ok('tasks.html is what scripts/build-tasks-page.mjs makes from teams.html (run it after changing teams.html)', chk.status === 0, (chk.stdout + chk.stderr).trim());
const page = fs.readFileSync(PUBLIC + '/tasks.html', 'utf8');
ok('tasks.html says it is the tasks app before any script runs', page.indexOf("<script>window.GP_APP='tasks';</script>") > -1 && page.indexOf("window.GP_APP='tasks'") < page.indexOf('<script src='));
ok('… with its own title, name, icons and manifest', /<title>GP Tasks<\/title>/.test(page) && /apple-mobile-web-app-title" content="GP Tasks"/.test(page) && /href="tasks-180\.png"/.test(page) && /href="tasks-manifest\.json"/.test(page));
const man = JSON.parse(fs.readFileSync(PUBLIC + '/tasks-manifest.json', 'utf8'));
ok('its manifest is its own app (id and start on tasks.html), icons there', man.id === './tasks.html' && man.start_url === './tasks.html' && man.short_name === 'GP Tasks' && man.icons.every(i => fs.existsSync(PUBLIC + '/' + i.src)));
const sw = fs.readFileSync(PUBLIC + '/sw.js', 'utf8');
ok('the service worker keeps it for opening offline', /'tasks\.html'/.test(sw) && /'tasks-manifest\.json'/.test(sw));
const stamp = fs.readFileSync(REPO + '/scripts/stamp-assets.mjs', 'utf8');
ok('the deploy names its files by version, like teams.html', /PAGES = \['teams\.html', 'tasks\.html'\]/.test(stamp));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
