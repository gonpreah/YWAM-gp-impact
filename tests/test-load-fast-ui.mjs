/* Opening the app quickly and without a jump (Nov 2026, Uriah: "when the app loads, it's getting
   a little slow … the card is still like a different size when it hasn't loaded … an awkward like
   plop every time you open it up").
   - scripts/stamp-assets.mjs names each file teams.html loads by its contents (?v=<hash>): the
     scripts, the stylesheet, and the fonts — the preload links and the @font-face url()s alike.
   - sw.js keeps a ?v= file the first time and then serves it with no network: the second open
     asks the server for the page and nothing else it already has; a changed file is asked for
     once, under its new name, and its old copy goes.
   - My Home's card eases to its new size when the fresh boot replaces the kept copy.
   - the "is there a new version" HEADs wait until the fresh boot has landed. */
import { PUBLIC, CHROMIUM, tmpDir } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { stampHtml } from '../scripts/stamp-assets.mjs';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

/* ---- the stamping ---- */
const src = fs.readFileSync(PUBLIC + '/teams.html', 'utf8');
const r = stampHtml(src, PUBLIC);
const scripts = [...src.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
ok('every script, the stylesheet and the fonts are named by version', r.missing.length === 0 && scripts.every((u) => r.stamped.indexOf(u) > -1) && r.stamped.indexOf('teams/teams.css') > -1 && r.stamped.filter((u) => /woff2$/.test(u)).length === 5, r.stamped.length + ' files');
const fontNames = (h, f) => [...h.matchAll(new RegExp(f.replace('.', '\\.') + '\\?v=[0-9a-f]{12}', 'g'))].map((m) => m[0]);
const kl = fontNames(r.html, 'fonts/koulen-latin.woff2'), kk = fontNames(r.html, 'fonts/kantumruy-khmer.woff2');
ok('… a font has one name everywhere it appears (preload and @font-face), so it never loads twice', kl.length === 2 && new Set(kl).size === 1 && kk.length === 2 && new Set(kk).size === 1, kl.concat(kk).join(' '));
ok('… nothing else in the page is changed', r.html.replace(/\?v=[0-9a-f]{12}/g, '') === src);
const r2 = stampHtml('<script src="https://x.org/a.js"></script><script src="nope.js"></script><link rel="stylesheet" href="teams/teams.css">', PUBLIC);
ok('… a file elsewhere is left alone, one that isn’t there is left plain', /src="https:\/\/x\.org\/a\.js"/.test(r2.html) && /src="nope\.js"/.test(r2.html) && r2.missing.join() === 'nope.js' && /teams\.css\?v=/.test(r2.html));
const hashOf = (h, f) => (new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=([0-9a-f]{12})').exec(h) || [])[1];
ok('… and the name is the contents: the same file, the same name', hashOf(stampHtml(src, PUBLIC).html, 'teams/01-core.js') === hashOf(r.html, 'teams/01-core.js'));

/* ---- a deployed copy: stamped, served with ETags, the worker on ---- */
const SITE = tmpDir('load-fast-site');
fs.cpSync(PUBLIC, SITE, { recursive: true });
fs.writeFileSync(SITE + '/teams.html', stampHtml(fs.readFileSync(SITE + '/teams.html', 'utf8'), SITE).html);
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
let hits = [];
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const ME = { id: 'st1', name: 'Dara Pich', username: 'dara', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: '', photo: '', staffType: 'campus', country: 'Cambodia', leads: [], ministries: [] };
const wkOf = () => { const d = new Date(Date.now() + 7 * 3600e3); const y = d.getUTCFullYear(), j = Date.UTC(y, 0, 1), m = j / 864e5 - ((new Date(j).getUTCDay() + 6) % 7); return Math.max(1, Math.min(52, Math.floor((Math.floor(d / 864e5) - m) / 7) + 1)); };
const BOOT = { ok: true, staff: ME, profile: {}, roster: [ME], logs: [{ date: today, habits: {} }], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
  trips: { ok: true, trips: [], totals: {}, reasons: { work: ['x'], personal: ['y'] }, hasMentor: false }, tripRequests: [], ministry: null, base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [] } };
let FRESH = BOOT, BOOT_WAIT = 0, bootAt = 0;
const srv = http.createServer(async (q, s) => {
  if (q.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of q) b += c; const fn = (JSON.parse(b || '{}')).fn;
    let o = { ok: true };
    if (fn === 'getMyBoot') { if (BOOT_WAIT) await new Promise((w) => setTimeout(w, BOOT_WAIT)); o = FRESH; bootAt = Date.now(); }
    s.writeHead(200, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(o)); return;
  }
  hits.push({ url: q.url, method: q.method, at: Date.now() });
  let u = q.url.split('?')[0]; if (u === '/') u = '/teams.html';
  const f = path.join(SITE, decodeURIComponent(u));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  const body = fs.readFileSync(f), etag = '"' + body.length + '-' + fs.statSync(f).mtimeMs + '"';
  s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: etag });
  s.end(q.method === 'HEAD' ? undefined : body);
}).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
const b = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('gp-sw-test', '1'); localStorage.setItem('gp-staff', JSON.stringify({ user: 'dara', pin: '1234' })); });
const vfiles = (list) => list.filter((h) => /\?v=[0-9a-f]{12}/.test(h.url) && h.method === 'GET');
await p.goto(BASE + '/teams.html'); await p.waitForSelector('.hero'); await p.waitForTimeout(1500);
await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
hits = [];
await p.reload(); await p.waitForSelector('.hero'); await p.waitForTimeout(1200);   // the worker now in charge: it keeps each ?v= file it serves
const firstUnderWorker = vfiles(hits).length;
hits = [];
await p.reload(); await p.waitForSelector('.hero'); await p.waitForTimeout(1200);
ok('opening again asks the server for none of the files it already has', vfiles(hits).length === 0 && hits.some((h) => /^\/teams\.html/.test(h.url)), 'kept the first time: ' + firstUnderWorker + '; asked again now: ' + vfiles(hits).map((h) => h.url).join(', '));
ok('… the page itself still comes from the network first', hits.filter((h) => /^\/teams\.html/.test(h.url) && h.method === 'GET').length >= 1);
ok('… and the app is drawn from them as before', await p.evaluate(() => !!document.querySelector('.hero') && typeof gpBootFresh_ === 'function'));
// a release changes one file: only that one is asked for, under its new name; its old copy goes
fs.appendFileSync(SITE + '/teams/12-tasks.js', '\n/* a new release */\n');
fs.writeFileSync(SITE + '/teams.html', stampHtml(src, SITE).html);
hits = [];
await p.reload(); await p.waitForSelector('.hero'); await p.waitForTimeout(1500);
ok('a release that changes one file: just that file is fetched', vfiles(hits).length === 1 && /teams\/12-tasks\.js\?v=/.test(vfiles(hits)[0].url), vfiles(hits).map((h) => h.url).join(', '));
const kept = await p.evaluate(async () => (await (await caches.open('gp-files')).keys()).map((k) => new URL(k.url).pathname + new URL(k.url).search).filter((u) => /12-tasks/.test(u)));
ok('… and only its new version is kept', kept.length === 1 && kept[0].indexOf(hashOf(stampHtml(src, SITE).html, 'teams/12-tasks.js')) > -1, kept.join(' '));

/* ---- the card, when the fresh boot has more in it than the kept copy ---- */
FRESH = Object.assign({}, BOOT, { gpTaskInfo: { open: 4, due: 1, inbox: 0, bell: [] }, goals: [{ week: wkOf(), pct: 30, updated: '', items: [{ text: 'Meet the Khmer leadership about the base plant', pct: 50 }, { text: 'Finish the 2027 budget', pct: 0 }] }] });
BOOT_WAIT = 1200;
await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('gp-boot-cache')); c.d.goals = []; delete c.d.gpTaskInfo; localStorage.setItem('gp-boot-cache', JSON.stringify(c)); });
hits = [];
const t0 = Date.now();
await p.reload(); await p.waitForSelector('.hero');
const samples = await p.evaluate(() => new Promise((res) => {
  const out = [], t0 = performance.now();
  (function tick() { const h = document.querySelector('.hero'); out.push([Math.round(performance.now() - t0), h ? Math.round(h.getBoundingClientRect().height) : 0, !!(window.S && S.bootStale)]);
    if (performance.now() - t0 < 2600) requestAnimationFrame(tick); else res(out); })();
}));
const staleH = samples.filter((x) => x[2]).map((x) => x[1]), freshH = samples.filter((x) => !x[2]).map((x) => x[1]);
const small = Math.max.apply(null, staleH), big = freshH[freshH.length - 1];
const between = freshH.filter((h) => h > small + 1 && h < big - 1);
ok('when the fresh boot makes My Home’s card bigger, it eases to its new size — no jump', big > small + 20 && between.length >= 3, 'copy ' + small + 'px → fresh ' + big + 'px, ' + between.length + ' frames between');
const heads = hits.filter((h) => h.method === 'HEAD' && /\?ver=/.test(h.url));
ok('the new-version check waits until the fresh boot has landed', heads.length > 0 && heads.every((h) => h.at >= bootAt), heads.length + ' HEADs, first ' + (heads.length ? heads[0].at - bootAt : '-') + 'ms after the boot');
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
