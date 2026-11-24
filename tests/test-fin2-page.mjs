/* The finance tool in Impact (public/finance.html, built from docs/drafts/finance-redesign.html), in the
   browser against the real api.js:
     - public/finance.html is exactly what scripts/build-finance-page.mjs builds from the draft;
     - it opens from the server (fin2Get) for the Finances office: no draft bar, no sample amounts or
       names, inside My Ministry (?embed=1) no tab row of its own;
     - what is entered is saved to the server (fin2Save) and is there again on reopening;
     - a save made from an older copy (someone else saved first) shows the newer copy and says so;
     - Campus Leadership opens it read-only: the Dashboard, no Input;
     - the demo's "Copy my entries" text brings everything in, and Undo puts back what was there;
     - nobody signed in, or someone not allowed, gets a plain message.
   All names and figures are made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
let built = true; try { execFileSync('node', [REPO + '/scripts/build-finance-page.mjs', '--check'], { stdio: 'pipe' }); } catch (e) { built = false; }
ok('public/finance.html is up to date with the draft', built);

const TMP = tmpDir('fin2-page');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', pinSalt: o.id, pinHash: H('1234', o.id) }, o);
mem.staff = [
  mk({ id: 'f1', name: 'Bopha Keo', username: 'bopha', dept: 'Skills Training', ministry: 'Finances' }),
  mk({ id: 'l1', name: 'Mark Hill', username: 'mark', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'c1', name: 'Dara Sok', username: 'dara', dept: 'Community Service', ministry: 'Cafe' })
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const sent = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}'); sent.push(body.fn);
    const r = await api.default({ method: 'POST', json: async () => body, headers: new Map() }, {});
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(await r.text()); return;
  }
  let u = req.url.split('?')[0];
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, q) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  if (user) await ctx.addInitScript((u) => { localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })); }, user);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/finance.html' + (q || ''), { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page };
}
const doc = () => mem['fin2:siemreap'] || {};

/* 1. the office opens it */
let { ctx, page } = await open('bopha', '?embed=1&view=input');
ok('it loads from the server (fin2Get)', sent.indexOf('fin2Get') > -1);
ok('no draft bar, no header of its own, no tab row inside My Ministry', await page.evaluate(() => getComputedStyle(document.querySelector('.draftBar')).display === 'none' && getComputedStyle(document.querySelector('nav.tabs')).display === 'none'));
ok('it opens on Input (?view=input)', await page.evaluate(() => S.tab === 'input') && !!(await page.$('#inBalances')));
ok('with no A/R Ageing report yet, no “Invalid Date” anywhere', !/Invalid Date/.test(await page.evaluate(() => { S.tab = 'dash'; render(); return document.body.innerText; })));
await page.evaluate(() => { S.tab = 'input'; render(); });
ok('no sample amounts or names', await page.evaluate(() => ALLOC.every(g => g.items.every(it => it[1] === 0)) && DEBT.people.length === 0 && !/Sample Person/.test(document.body.innerText)));
ok('the office can bring in the demo’s entries', !!(await page.$('#inImport')));

/* 2. saving */
await page.click('#inBalances summary'); await page.fill('#inB_aba', '50000'); await page.fill('#inB_us', '20000'); await page.fill('#inB_cash', '1671.15'); await page.click('#inBalSave');
await page.waitForTimeout(1500);
ok('what is entered is saved to the server', doc().rev === 1 && doc().state && doc().state.bal.length === 1 && doc().state.bal[0].aba === 50000, JSON.stringify(doc()).slice(0, 80));
ok('it says it is saved', /Saved/.test(await page.$eval('#finSave', e => e.textContent)));
await ctx.close();
({ ctx, page } = await open('bopha', '?embed=1&view=input'));
ok('opened again, it is there', await page.evaluate(() => BAL_DAYS.length === 1 && BAL_DAYS[0].cash === 1671.15));

/* 3. someone else saved first */
const d = doc(); d.rev = 5; d.state.bal[0].cash = 999; mem['fin2:siemreap'] = d;
if (!(await page.evaluate(() => document.getElementById('inBalances').open))) await page.click('#inBalances summary');
await page.fill('#inB_aba', '50000'); await page.fill('#inB_us', '20000'); await page.fill('#inB_cash', '1700'); await page.click('#inBalSave'); await page.waitForTimeout(1500);
ok('a save from an older copy is refused and the newer copy is shown', await page.evaluate(() => BAL_DAYS[0].cash === 999) && doc().rev === 5);
ok('… and it says so', /Someone else saved first/.test(await page.evaluate(() => document.body.innerText)));

/* 4. the demo's entries */
const demo = { gpFinDemo: 1, state: { bal: [{ asOf: '2026-11-16', aba: 1, us: 2, cash: 3, at: 1 }], incomes: [], expenses: [] } };
await page.click('#inImport summary'); await page.fill('#impText', 'not it'); await page.click('#impGo');
ok('text that isn’t the demo’s is refused', /isn’t the text the demo copies/.test(await page.$eval('#inImport', e => e.innerText)));
await page.fill('#impText', JSON.stringify(demo)); await page.click('#impGo');
ok('with entries already here, it asks first', /replaces what is here/.test(await page.$eval('#impGo', e => e.textContent)));
await page.click('#impGo'); await page.waitForTimeout(1500);
ok('the demo’s entries are brought in and saved', await page.evaluate(() => BAL_DAYS.length === 1 && BAL_DAYS[0].aba === 1) && doc().rev === 6 && doc().state.bal[0].aba === 1);
await page.click('#undoLast'); await page.click('#undoLast'); await page.waitForTimeout(1500);
ok('Undo puts back what was there', await page.evaluate(() => BAL_DAYS[0].cash === 999) && doc().state.bal[0].cash === 999);
await ctx.close();

/* 5. leadership: read-only */
({ ctx, page } = await open('mark', ''));
ok('Campus Leadership opens the Dashboard, with no Input', await page.evaluate(() => S.tab === 'dash' && document.body.classList.contains('ro') && getComputedStyle(document.querySelector('.tab[data-tab="input"]')).display === 'none'));
ok('… and sees the office’s figures', /1,000|999/.test(await page.evaluate(() => document.getElementById('pane').innerText)) || await page.evaluate(() => BAL_DAYS.length === 1));
ok('… no Tasks or OKRs of its own (the app has them)', await page.evaluate(() => getComputedStyle(document.querySelector('.tab[data-tab="tasks"]')).display === 'none'));
await ctx.close();

/* 6. not allowed, not signed in */
({ ctx, page } = await open('dara', ''));
ok('someone else is told who can open it', /Only the Finances office and Campus Leadership/.test(await page.evaluate(() => document.body.innerText)));
await ctx.close();
({ ctx, page } = await open('', ''));
ok('nobody signed in is sent to sign in', /Sign in to the YWAM GP app first/.test(await page.evaluate(() => document.body.innerText)));
await ctx.close();

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
