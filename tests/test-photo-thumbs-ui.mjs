/* Photos in lists are the small copy (Nov 2026) — the page's half: uploading a photo
   sends a 160px copy with it, and someone whose photo was saved before gets theirs
   made once, quietly, after a good boot. Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('photo-thumbs-ui');
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
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
mem.staff = [
  mk({ id: 'st1', name: 'Sokha Chan', username: 'sokha', email: 's@e.com' }),
  mk({ id: 'st2', name: 'Dara Keo', username: 'dara', email: 'd@e.com' })
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
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
/* a real JPEG, 600×400, drawn in a browser */
const maker = await (await browser.newContext()).newPage();
const JPEG = await maker.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d');
  g.fillStyle = '#1F44FF'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#FFB323'; g.beginPath(); g.arc(300, 200, 120, 0, 7); g.fill(); return c.toDataURL('image/jpeg', 0.9); });
async function open(user) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  await ctx.addInitScript(u => { localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })); localStorage.setItem('gp-lang', 'en'); }, user);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  await page.goto(BASE + '/teams.html'); await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  return page;
}
const rec = id => mem.staff.find(s => s.id === id);

/* ---- 1. an old photo gets its small copy after a boot ---- */
rec('st2').photo = JPEG;
const d = await open('dara');
await d.waitForTimeout(3000);
const th = rec('st2').photoThumb || '';
ok('an old photo gets a small copy after the boot', /^data:image\/jpeg;base64,/.test(th));
const dims = await d.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r(i.width + 'x' + i.height); i.src = src; }), th);
ok('… 160px square', dims === '160x160', dims);
ok('… much smaller than the photo', th.length < JPEG.length / 2, th.length + ' vs ' + JPEG.length);
ok('… and the full photo is untouched', rec('st2').photo === JPEG);

/* ---- 2. uploading a photo sends the small copy with it ---- */
const s = await open('sokha');
await s.click('nav.bottom [data-tab="profile"]'); await s.waitForTimeout(500);
const buf = Buffer.from(JPEG.split(',')[1], 'base64');
await s.setInputFiles('#photoInput', { name: 'me.jpg', mimeType: 'image/jpeg', buffer: buf });
await s.waitForTimeout(2000);
ok('an upload saves the photo', /^data:image\/jpeg;base64,/.test(rec('st1').photo || ''));
ok('… and its small copy', /^data:image\/jpeg;base64,/.test(rec('st1').photoThumb || '') && rec('st1').photoThumb.length < rec('st1').photo.length);

/* ---- 3. what the roster carries now ---- */
const roster = await s.evaluate(() => S.roster.map(r => [r.id, (r.photo || '').length]));
ok('the roster carries the small copies', roster.every(([id, n]) => n === (rec(id).photoThumb || '').length), JSON.stringify(roster));
ok('my own record keeps the full photo', await s.evaluate(() => S.me.photo.length) === rec('st1').photo.length);

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
