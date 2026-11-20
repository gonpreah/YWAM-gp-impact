/* My Home's quick apps (teams/19-ux.js): the row of small icons, hold to arrange, add, take off, drag; saveQuickApps. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('qa-ui');
const OUT = tmpDir('qa-ui-out');
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
  mk({ id: 'st1', name: 'Mark Hill', username: 'mark', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Ann Lee', username: 'ann', email: 'a@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st3', name: 'Bo Chan', username: 'bo', email: 'b@e.com', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'st4', name: 'Cy Ros', username: 'cy', email: 'c@e.com', dept: 'Campus Leadership', ministry: 'Skills Training' }),
  mk({ id: 'st5', name: 'Di Sok', username: 'di', email: 'd@e.com', dept: 'Community Service', ministry: 'Cafe' })
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }];
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
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('#qaBar', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const ids = (page) => page.$$eval('#qaBar .qaItem[data-qa]', els => els.map(e => e.getAttribute('data-qa')));
const saved = (id) => (mem.staff.find(s => s.id === id) || {}).quickApps;

// ---- the server ----
{
  const r1 = await api.default({ method: 'POST', json: async () => ({ fn: 'saveQuickApps', args: ['di', '1234', ['library', 'Library', 'bad id!', 'library', 'khmer', '<x>', 'a'.repeat(50)]] }), headers: new Map() }, {});
  const d1 = JSON.parse(await r1.text());
  ok('saveQuickApps keeps only well-formed ids, once each', d1.ok && JSON.stringify(saved('st5')) === '["library","khmer"]', JSON.stringify(d1));
  const many = Array.from({ length: 14 }, (_, i) => 'app' + i);
  const r2 = JSON.parse(await (await api.default({ method: 'POST', json: async () => ({ fn: 'saveQuickApps', args: ['di', '1234', many] }), headers: new Map() }, {})).text());
  ok('… and ten at most', r2.ok && saved('st5').length === 10);
  const r3 = JSON.parse(await (await api.default({ method: 'POST', json: async () => ({ fn: 'saveQuickApps', args: ['di', '9999', ['library']] }), headers: new Map() }, {})).text());
  ok('a wrong PIN saves nothing', !r3.ok && saved('st5').length === 10);
  const r4 = JSON.parse(await (await api.default({ method: 'POST', json: async () => ({ fn: 'saveQuickApps', args: ['di', '1234', null]}), headers: new Map() }, {})).text());
  ok('null puts the default back', r4.ok && saved('st5') === undefined);
  ok('the public roster never carries it', !JSON.stringify(JSON.parse(await (await api.default({ method: 'POST', json: async () => ({ fn: 'teamRoster', args: [] }), headers: new Map() }, {})).text())).includes('quickApps'));
}

// ---- Di: the default row ----
{
  const { ctx, page } = await open('di');
  const first = await ids(page);
  ok('the default quick apps: GP Calendar/Tasks, Library, Learn Khmer, Leave, Prayer', JSON.stringify(first) === '["caltasks","library","khmer","leave","prayer"]', JSON.stringify(first));
  const box = await page.$eval('#qaBar', e => ({ inHero: !!e.closest('.myHero'), h: e.getBoundingClientRect().height, top: e.getBoundingClientRect().top < document.querySelector('.myHero [data-jump="sec-goals"]').getBoundingClientRect().top }));
  ok('it is a small row at the top of the summary card', box.inHero && box.h < 90 && box.top, JSON.stringify(box));
  const labels = await page.$$eval('#qaBar .qaLabel', els => els.map(e => e.textContent));
  ok('each icon has its name under it', labels.includes('Library') && labels.includes('Language') && labels.includes('Calendar') && labels.includes('Leave'), JSON.stringify(labels));
  ok('an ✎ Edit icon at the end', !!(await page.$('#qaEditBtn')));

  await page.click('#qaBar [data-qago="library"]');
  await page.waitForTimeout(600);
  ok('a tap opens it (Library)', await page.evaluate(() => S.view) === 'library');
  await page.click('nav.bottom [data-tab="week"]').catch(() => {});
  await page.waitForSelector('#qaBar');
  await page.click('#qaBar [data-qago="khmer"]');
  await page.waitForTimeout(800);
  ok('Learn Khmer is one tap away', await page.evaluate(() => S.view) === 'khmer');
  await page.click('nav.bottom [data-tab="week"]').catch(() => {});
  await page.waitForSelector('#qaBar');

  // hold to arrange
  const b = await (await page.$('#qaBar [data-qago="leave"]')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
  await page.waitForTimeout(300);
  ok('holding an icon starts arranging (the icons wiggle, a Done button)', await page.$eval('#qaBar', e => e.classList.contains('edit')) && !!(await page.$('#qaDone')) && await page.evaluate(() => S.view) === 'week');
  ok('… with an ✕ on each and ＋ Add', (await page.$$('#qaBar [data-qarm]')).length === 5 && !!(await page.$('#qaAdd')));
  ok('the row only takes the finger while arranging', await page.$eval('#qaBar', e => getComputedStyle(e).touchAction) === 'none');

  await page.click('#qaBar [data-qarm="prayer"]');
  await page.waitForTimeout(900);
  ok('✕ takes one off, and it is saved', !(await ids(page)).includes('prayer') && JSON.stringify(saved('st5')) === '["caltasks","library","khmer","leave"]', JSON.stringify(saved('st5')));

  await page.click('#qaAdd');
  await page.waitForSelector('#qaAddSheet');
  const offer = await page.$$eval('#qaAddSheet [data-qapick]', els => els.map(e => e.getAttribute('data-qapick')));
  ok('＋ Add offers the rest of their menu (Prayer back, YWAM GP…)', offer.includes('prayer') && offer.includes('ywamgp') && offer.includes('base'), JSON.stringify(offer));
  ok('… never what their role doesn’t have, a bottom-bar tab, or Log out', !offer.includes('admin') && !offer.includes('hr') && !offer.some(x => /^tab:|logout/.test(x)));
  ok('… nor anything already on the bar', !offer.includes('library') && !offer.includes('leave'));
  await page.click('#qaAddSheet [data-qapick="ywamgp"]');
  await page.waitForTimeout(900);
  ok('picking one adds it at the end, saved', (await ids(page)).slice(-1)[0] === 'ywamgp' && saved('st5').slice(-1)[0] === 'ywamgp' && !(await page.$('#qaAddSheet')));

  // drag the last one to the front
  const last = await (await page.$('#qaBar .qaItem[data-qa="ywamgp"]')).boundingBox();
  const firstB = await (await page.$('#qaBar .qaItem[data-qa="caltasks"]')).boundingBox();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(last.x + last.width / 2 - (last.x - firstB.x + 10) * i / 12, last.y + last.height / 2); await page.waitForTimeout(30); }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const afterDrag = await ids(page);
  ok('dragging an icon moves it (YWAM GP to the front)', afterDrag[0] === 'ywamgp', JSON.stringify(afterDrag));
  ok('… and the order is saved', JSON.stringify(saved('st5')) === JSON.stringify(afterDrag), JSON.stringify(saved('st5')));

  await page.click('#qaDone');
  await page.waitForTimeout(400);
  ok('Done stops arranging', !(await page.$eval('#qaBar', e => e.classList.contains('edit'))) && !(await page.$('#qaDone')) && !!(await page.$('#qaEditBtn')));
  ok('… and the row scrolls normally again', /pan/.test(await page.$eval('#qaBar', e => getComputedStyle(e).touchAction)));
  await page.click('#qaEditBtn'); await page.waitForTimeout(250);
  ok('✎ Edit starts arranging too', await page.$eval('#qaBar', e => e.classList.contains('edit')));
  await page.click('#qaDone'); await page.waitForTimeout(800);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#qaBar'); await page.waitForTimeout(500);
  ok('opened again, their own row in their own order', JSON.stringify(await ids(page)) === JSON.stringify(afterDrag), JSON.stringify(await ids(page)));
  await ctx.close();
}

// ---- Mark (an admin): his own menu's apps; Khmer at 320px ----
{
  const { ctx, page } = await open('mark');
  await page.click('#qaEditBtn'); await page.waitForTimeout(250);
  await page.click('#qaAdd'); await page.waitForSelector('#qaAddSheet');
  const offer = await page.$$eval('#qaAddSheet [data-qapick]', els => els.map(e => e.getAttribute('data-qapick')));
  ok('an admin can put Admin and HR on his bar', offer.includes('admin') && offer.includes('hr'), JSON.stringify(offer));
  await page.click('#qaAddSheet [data-qapick="admin"]'); await page.waitForTimeout(300);
  await page.click('#qaDone'); await page.waitForTimeout(900);
  ok('… saved on his record, Di’s untouched', saved('st1').includes('admin') && !saved('st5').includes('admin'));
  await page.click('#qaBar [data-qago="admin"]'); await page.waitForTimeout(600);
  ok('… and it opens Admin', await page.evaluate(() => S.view) === 'admin');
  await ctx.close();
}
{
  const { ctx, page } = await open('di', { km: true, small: true });
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
  ok('in Khmer on a 320px phone the page doesn’t widen', w.doc <= w.win, JSON.stringify(w));
  const lab = await page.$eval('#qaBar [data-qago="library"] .qaLabel', e => e.textContent);
  ok('… and the names are Khmer', /[ក-៿]/.test(lab), lab);
  await ctx.close();
}

ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
