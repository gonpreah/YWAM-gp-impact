/* Pulling down brings in a new version of the app (Oct 2026). The page notes
   the version it started on (ETags of teams.html, km.js, library.js, by HEAD);
   a pull with nothing new just refreshes the data, a pull after a deploy
   reloads — back to the same tab, with ?fresh= gone from the address — and a
   page the service worker served from its offline copy reloads on the first
   pull that reaches the server. A failed check never blocks the data refresh. */
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

const extra = {};   // file → text appended, to stand in for a deploy
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  const body = Buffer.concat([fs.readFileSync(f), Buffer.from(extra[p.slice(1)] || '')]);
  const etag = '"' + crypto.createHash('md5').update(body).digest('hex') + '-df"';
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'ETag': etag });
  r.end(q.method === 'HEAD' ? undefined : body);
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let pass = 0, fail = 0;
const ok = (name, cond, extra2) => { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (extra2 !== undefined ? '  → ' + extra2 : '')); } };

const ME = { id: 'st1', name: 'Dara Pich', username: 'dara', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', role: '', photo: '' };
let apiCalls = [];
const b = await chromium.launch({ executablePath: CHROMIUM });
const p = await b.newPage({ viewport: { width: 400, height: 860 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
let navs = 0; p.on('framenavigated', fr => { if (fr === p.mainFrame()) navs++; });
await p.route('**/.netlify/functions/api', r => { const q = JSON.parse(r.request().postData() || '{}'); apiCalls.push(q.fn); let o = { ok: true };
  if (q.fn === 'getMyBoot') o = { ok: true, staff: ME, profile: {}, roster: [ME], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
    trips: { ok: true, trips: [], totals: {}, reasons: { work: ['x'], personal: ['y'] }, hasMentor: false }, tripRequests: [], ministry: null, base: { leader: false, entries: { poipet: {} }, okrs: [], survey: [] } };
  else if (q.fn === 'teamRoster') o = [ME];
  else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
  else if (q.fn === 'getData') o = { leader: false, entries: {}, okrs: [], survey: [] };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) }); });
await p.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'dara', pin: '1234' })));
await p.goto(BASE + '/teams.html'); await p.waitForSelector('nav.bottom button', { timeout: 15000 });
await p.waitForTimeout(2500);
ok('the page notes the version it started on', /\|/.test(await p.evaluate(() => gpVerBase || '')));

/* 1. nothing new: just the data */
navs = 0; apiCalls = [];
await p.evaluate(() => gpPullRefresh_());
await p.waitForTimeout(500);
ok('a pull with nothing new refreshes the data and does not reload', navs === 0 && apiCalls.indexOf('getMyLogs') > -1, navs + ' / ' + apiCalls.join(','));

/* 2. the check fails (offline): the data still refreshes */
await p.route('**/*ver=*', r => r.abort());
navs = 0; apiCalls = [];
await p.evaluate(() => gpPullRefresh_());
await p.waitForTimeout(600);
ok('if the version check fails, the pull still refreshes the data', navs === 0 && apiCalls.indexOf('getMyLogs') > -1);
await p.unroute('**/*ver=*');

/* 3. a deploy: km.js changed */
extra['km.js'] = '\n/* a new version */\n';
await p.evaluate(() => { S.view = 'library'; render(); });
navs = 0;
p.evaluate(() => { gpPullRefresh_(); }).catch(() => {});
await p.waitForTimeout(400);
ok('after a deploy the pull says it is updating', /Updating to the latest version/.test(await p.evaluate(() => document.body.innerText)).valueOf() || navs > 0);
await p.waitForURL(/teams\.html/, { timeout: 8000 });
await p.waitForSelector('nav.bottom button', { timeout: 15000 });
await p.waitForTimeout(1200);
ok('… and reloads into the new version', navs >= 1);
ok('… back on the same tab, with ?fresh= gone from the address', (await p.evaluate(() => S.view)) === 'library' && !/fresh=/.test(p.url()), (await p.evaluate(() => S.view)) + ' ' + p.url());
await p.waitForTimeout(1500);
navs = 0;
await p.evaluate(() => gpPullRefresh_()); await p.waitForTimeout(500);
ok('the next pull, with nothing newer, stays put', navs === 0);

/* 4. served from the offline copy: the next pull that reaches the server reloads */
await p.evaluate(() => caches.open('gp-meta').then(c => c.put('served-from-cache', new Response(String(Date.now())))));
await p.reload(); await p.waitForSelector('nav.bottom button', { timeout: 15000 }); await p.waitForTimeout(2500);
ok('a page that came from the offline copy knows it', await p.evaluate(() => gpVerStale === true));
navs = 0;
p.evaluate(() => { gpPullRefresh_(); }).catch(() => {});
await p.waitForTimeout(1500);
ok('… and its first pull reloads it', navs >= 1);

ok('no page errors', errs.length === 0, errs.join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await b.close(); srv.close();
process.exit(fail ? 1 : 0);
