/* Khmer review (Oct 2026): a Khmer reviewer checks the draft Khmer one phrase at a
   time — "reads right" or a fix — a fix shows for everyone at once, only reviewers
   (and admins) get in, a fix must be Khmer and keep its {placeholders}, and an
   admin's download builds into REVIEWED_KM with scripts/apply-km-review.mjs.
   Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('kmr-ui');
const OUT = tmpDir('kmr-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) {
  if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
}
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe',
  role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Sreilea Chan', username: 'sreilea', email: 's@e.com', kmReviewer: true }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com' })
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const r = await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {});
    const t = await r.text(); res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(t); return;
  }
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}




const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);


const call = async (fn, args) => {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return (await r.json().catch(() => null)) || {};
};
const KMJS = fs.readFileSync(PUBLIC + '/km.js', 'utf8');
const kctx = {}; vm.createContext(kctx); vm.runInContext(KMJS + ';this.P=PENDING_KM;this.R=REVIEWED_KM;', kctx);
const drafts = Object.keys(kctx.P).filter((k) => !(k in kctx.R));
const plain = drafts.find((k) => !/\{/.test(k) && k.length < 40);
const slotted = drafts.find((k) => /\{n\}/.test(k) && !/\{(?!n\})/.test(k.replace(/\{n\}/g, '')));

/* ---------- 1. the server ---------- */
{
  let r = await call('getKmReview', ['dara', '1234']);
  ok('someone who is not a Khmer reviewer cannot open it', r.ok === false && r.err === 'not_authorized');
  r = await call('saveKmReview', ['dara', '1234', plain, 'ok']);
  ok('… nor answer', r.ok === false);
  r = await call('saveKmReview', ['sreilea', '1234', plain, 'fix', 'not khmer at all']);
  ok('a fix must be written in Khmer', r.ok === false && r.err === 'not_khmer');
  r = await call('saveKmReview', ['sreilea', '1234', slotted, 'fix', 'ខ្មែរ គ្មានកន្លែងលេខ']);
  ok('… and keep its {placeholders}', r.ok === false && r.err === 'placeholders', slotted);
  r = await call('saveKmReview', ['sreilea', '1234', slotted, 'fix', 'ខ្មែរ {n} ថ្មី']);
  ok('a good fix is kept, with who made it', r.ok && r.row.verdict === 'fix' && r.row.byName === 'Sreilea Chan');
  const boot = await call('getMyBoot', ['dara', '1234']);
  ok('… and reaches everyone in the boot', boot.kmFixes && boot.kmFixes[slotted] === 'ខ្មែរ {n} ថ្មី');
  r = await call('saveKmReview', ['sreilea', '1234', slotted, 'clear']);
  ok('Undo takes it back', r.ok && !(await call('getMyBoot', ['dara', '1234'])).kmFixes[slotted]);
  r = await call('adminUpdateStaff', ['uriah', '1234', 'st3', { kmReviewer: true }]);
  ok('an admin makes someone a Khmer reviewer', r.ok && (await call('getKmReview', ['dara', '1234'])).ok === true);
  await call('adminUpdateStaff', ['uriah', '1234', 'st3', { kmReviewer: false }]);
}

/* ---------- 2. the screen ---------- */
{
  const { ctx, page } = await open('sreilea', { km: true });
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  ok('a reviewer has Khmer review in the menu', !!(await page.$('[data-menu-item="kmreview"]')));
  await page.click('[data-menu-item="kmreview"]'); await page.waitForTimeout(900);
  const first = await page.$eval('.kmrCard', (e) => e.getAttribute('data-kmrkey'));
  ok('it opens on the first draft nobody has checked, with the English and the draft Khmer',
    !!first && (await page.$eval('.kmrEn', (e) => e.textContent)) === first && (await page.$eval('.kmrKm', (e) => e.textContent)) === kctx.P[first]);
  await page.screenshot({ path: OUT + '/km-review.png', fullPage: true });
  await page.click('#kmrOk'); await page.waitForTimeout(600);
  const second = await page.$eval('.kmrCard', (e) => e.getAttribute('data-kmrkey'));
  ok('✓ Reads right saves it and moves to the next', second !== first && (mem.kmReview || []).some((r) => r.key === first && r.verdict === 'ok'));
  await page.click('#kmrFix'); await page.waitForTimeout(200);
  await page.fill('#kmrText', 'ពាក្យថ្មីដែលត្រឹមត្រូវ' + (/\{/.test(second) ? ' ' + (second.match(/\{[a-zA-Z0-9_]+\}/g) || []).join(' ') : ''));
  await page.click('#kmrSaveFix'); await page.waitForTimeout(600);
  const fixRow = (mem.kmReview || []).find((r) => r.key === second);
  ok('✏️ a fix is saved', fixRow && fixRow.verdict === 'fix' && /ពាក្យថ្មី/.test(fixRow.km));
  ok('… and the app uses it at once', await page.evaluate((k) => t(k), second) === fixRow.km);
  await page.click('[data-kmrfilter="fix"]'); await page.waitForTimeout(300);
  ok('the Fixed list shows it, with who fixed it', /Sreilea Chan/.test(await main(page)) && (await page.$eval('.kmrCard', (e) => e.getAttribute('data-kmrkey'))) === second);
  ok('the screen fits a 320px-wide phone too', await page.evaluate(() => { document.body.style.width = '320px'; return document.querySelector('.kmrCard').scrollWidth <= 330; }));
  await ctx.close();
  const d = await open('dara');
  await d.page.click('#menuBtn'); await d.page.waitForTimeout(200);
  ok('… and staff who are not reviewers have no Khmer review', !(await d.page.$('[data-menu-item="kmreview"]')));
  await d.ctx.close();
}

/* ---------- 3. the admin's download builds into REVIEWED_KM ---------- */
{
  const { ctx, page } = await open('uriah');
  await page.evaluate(() => { S.view = 'kmreview'; S.kmr = null; render(); }); await page.waitForTimeout(900);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#kmrExport')]);
  const file = TMP + '/review.json'; await dl.saveAs(file);
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('an admin downloads the checked phrases', Object.keys(exp.ok).length === 1 && Object.keys(exp.fix).length === 1);
  fs.mkdirSync(TMP + '/repo/public', { recursive: true }); fs.mkdirSync(TMP + '/repo/scripts', { recursive: true });
  fs.copyFileSync(PUBLIC + '/km.js', TMP + '/repo/public/km.js');
  fs.copyFileSync(REPO + '/scripts/apply-km-review.mjs', TMP + '/repo/scripts/apply-km-review.mjs');
  const { execFileSync } = await import('node:child_process');
  const outTxt = execFileSync(process.execPath, [TMP + '/repo/scripts/apply-km-review.mjs', file]).toString();
  const c2 = {}; vm.createContext(c2); vm.runInContext(fs.readFileSync(TMP + '/repo/public/km.js', 'utf8') + ';this.P=PENDING_KM;this.R=REVIEWED_KM;', c2);
  const okKey = Object.keys(exp.ok)[0], fixKey = Object.keys(exp.fix)[0];
  ok('scripts/apply-km-review.mjs moves them into REVIEWED_KM and out of the drafts',
    c2.R[okKey] === kctx.P[okKey] && c2.R[fixKey] === exp.fix[fixKey] && !(okKey in c2.P) && !(fixKey in c2.P) &&
    Object.keys(c2.P).length === Object.keys(kctx.P).length - 2, outTxt.trim());
  ok('… and km.js still loads with nothing else changed', Object.keys(c2.R).length === Object.keys(kctx.R).length + 2);
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
