/* My Home's dashboard card arranged like a phone's Home Screen (teams/19-ux.js): hold or ✎ to edit, everything wiggles, drag to
   move apps / widgets / rows, ＋ adds widgets and apps, ✕ only on what was added; saveDashLayout. Made-up people. */
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
const wids = (page) => page.$$eval('#dashWidgets .dashItem[data-dashw]', els => els.map(e => e.getAttribute('data-dashw')));
const rowIds = (page) => page.$$eval('#dashRows .dashRow[data-dashrow]', els => els.map(e => e.getAttribute('data-dashrow')));
const lay = (id) => (mem.staff.find(s => s.id === id) || {}).dashLayout;
const call = async (fn, args) => JSON.parse(await (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).text());
const hold = async (page, sel) => { const b = await (await page.$(sel)).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up(); await page.waitForTimeout(350); };
const drag = async (page, fromSel, toSel) => {
  const a = await (await page.$(fromSel)).boundingBox(), b = await (await page.$(toSel)).boundingBox();
  const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
  await page.mouse.move(ax, ay); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(ax + (bx - ax) * i / 14, ay + (by - ay) * i / 14); await page.waitForTimeout(25); }
  await page.mouse.up(); await page.waitForTimeout(800);
};

// ---- the server ----
{
  const d1 = await call('saveDashLayout', ['di', '1234', { apps: ['library', 'Library', 'bad id!', 'library', 'khmer'], widgets: ['goals', 'books', 'books', 'NOPE', 'x'], rows: ['base', 'reading'] }]);
  ok('saveDashLayout keeps well-formed ids, once each', d1.ok && JSON.stringify(lay('st5')) === JSON.stringify({ apps: ['library', 'khmer'], widgets: ['goals', 'books'], rows: ['base', 'reading'] }), JSON.stringify(lay('st5')));
  ok('… and the apps as quickApps too, for an older page', JSON.stringify((mem.staff.find(s => s.id === 'st5')).quickApps) === '["library","khmer"]');
  const many = Array.from({ length: 14 }, (_, i) => 'app' + i);
  ok('… ten apps and eight widgets at most', (await call('saveDashLayout', ['di', '1234', { apps: many, widgets: many.map(x => x.replace(/\d/g, '') + 'abcdefghij'.slice(0, 1 + (many.indexOf(x) % 9))), rows: [] }])).ok && lay('st5').apps.length === 10 && lay('st5').widgets.length <= 8);
  ok('a wrong PIN saves nothing', !(await call('saveDashLayout', ['di', '9999', { apps: ['library'] }])).ok && lay('st5').apps.length === 10);
  ok('null puts the default back', (await call('saveDashLayout', ['di', '1234', null])).ok && lay('st5') === undefined && (mem.staff.find(s => s.id === 'st5')).quickApps === undefined);
  ok('the public roster never carries it', !/dashLayout|quickApps/.test(JSON.stringify(await call('teamRoster', []))));
}

// ---- Di: the default card ----
{
  const { ctx, page } = await open('di');
  ok('the default quick apps: Calendar, Library, Language, Leave, Prayer', JSON.stringify(await ids(page)) === '["caltasks","library","khmer","leave","prayer"]', JSON.stringify(await ids(page)));
  ok('… then the four widgets and the rows', JSON.stringify(await wids(page)) === '["goals","habits","health","tasks"]' || JSON.stringify(await wids(page)) === '["goals","habits","health"]', JSON.stringify(await wids(page)));
  ok('… the reading row and the base at a glance', (await rowIds(page)).includes('reading') && (await rowIds(page)).includes('base'), JSON.stringify(await rowIds(page)));
  const pen = await page.$eval('#qaEditBtn', e => { const r = e.getBoundingClientRect(), h = document.querySelector('.myHero').getBoundingClientRect(); return { w: r.width, right: h.right - r.right, top: r.top - h.top }; });
  ok('a small ✎ in the card’s top corner, not an icon in the row', pen.w <= 30 && pen.right < 20 && pen.top < 20 && !(await page.$('#qaBar #qaEditBtn')), JSON.stringify(pen));
  ok('nothing wiggles yet', await page.$eval('.myHero', e => !e.classList.contains('dashEditing')) && await page.$eval('.dashItem', e => getComputedStyle(e).animationName === 'none'));

  await page.click('#qaBar [data-qago="library"]'); await page.waitForTimeout(600);
  ok('a tap opens an app (Library)', await page.evaluate(() => S.view) === 'library');
  await page.click('nav.bottom [data-tab="week"]'); await page.waitForSelector('#qaBar');

  // hold a widget: the whole card goes into edit mode
  await hold(page, '.dashItem[data-dashw="habits"] .heroW');
  ok('holding a widget puts the whole card in edit mode, and does not open it', await page.$eval('.myHero', e => e.classList.contains('dashEditing')) && await page.evaluate(() => S.view) === 'week');
  const anims = await page.$$eval('.myHero .qaItem, .myHero .dashItem, .myHero .dashRow', els => els.map(e => getComputedStyle(e).animationName));
  ok('… everything on it wiggles — apps, widgets and rows', anims.length >= 9 && anims.every(a => /dashWiggle/.test(a)), anims.join(','));
  ok('… a ＋ and Done on top, the ✎ gone', !!(await page.$('.dashEditBar #qaAdd')) && !!(await page.$('.dashEditBar #qaDone')) && !(await page.$('#qaEditBtn')));
  ok('… and what came with the card has no ✕ — it can be moved, not taken off', (await page.$$('.myHero .qaX')).length === 0);
  ok('the card only takes the finger while editing', await page.$eval('.myHero', e => getComputedStyle(e).touchAction) === 'none');
  await page.click('.dashItem[data-dashw="habits"] .heroW', { force: true }); await page.waitForTimeout(400);
  ok('… and a tap on a widget while editing does nothing', await page.evaluate(() => S.view === 'week' && S.qaEdit === true));

  // ＋ : widgets and apps
  await page.click('#qaAdd'); await page.waitForSelector('#qaAddSheet');
  const offer = await page.$$eval('#qaAddSheet [data-qapick]', els => els.map(e => e.getAttribute('data-qapick')));
  ok('＋ offers more widgets (days off, mentor, streak, books, year goals)', ['w:daysoff', 'w:mentor', 'w:streak', 'w:books', 'w:yeargoals'].every(x => offer.includes(x)), JSON.stringify(offer));
  ok('… and the rest of their own menu as apps — never what their role doesn’t have, a tab or Log out', offer.includes('a:ywamgp') && offer.includes('a:base') && !offer.includes('a:admin') && !offer.includes('a:hr') && !offer.some(x => /^a:tab:|logout/.test(x)) && !offer.includes('a:library'));
  await page.click('#qaAddSheet [data-qapick="w:daysoff"]'); await page.waitForTimeout(900);
  ok('a widget added goes on the card, with a ✕, and is saved', (await wids(page)).slice(-1)[0] === 'daysoff' && !!(await page.$('.dashItem[data-dashw="daysoff"] .qaX')) && lay('st5') && lay('st5').widgets.includes('daysoff'), JSON.stringify(lay('st5')));
  ok('… still in edit mode', await page.$eval('.myHero', e => e.classList.contains('dashEditing')));
  ok('… the Days off widget says how many are left', /30\s*Days off/.test(await page.$eval('.dashItem[data-dashw="daysoff"]', e => e.innerText)), await page.$eval('.dashItem[data-dashw="daysoff"]', e => e.innerText));
  await page.click('#qaAdd'); await page.waitForSelector('#qaAddSheet');
  await page.click('#qaAddSheet [data-qapick="a:ywamgp"]'); await page.waitForTimeout(900);
  ok('an app added goes at the end of the row, with a ✕, saved', (await ids(page)).slice(-1)[0] === 'ywamgp' && !!(await page.$('.qaItem[data-qa="ywamgp"] .qaX')) && lay('st5').apps.slice(-1)[0] === 'ywamgp');

  // drag
  await drag(page, '.dashItem[data-dashw="daysoff"]', '.dashItem[data-dashw="goals"]');
  ok('dragging a widget moves it (Days off to the front), saved', (await wids(page))[0] === 'daysoff' && lay('st5').widgets[0] === 'daysoff', JSON.stringify(await wids(page)));
  await drag(page, '.qaItem[data-qa="prayer"]', '.qaItem[data-qa="caltasks"]');
  ok('dragging an app moves it (Prayer to the front), saved', (await ids(page))[0] === 'prayer' && lay('st5').apps[0] === 'prayer', JSON.stringify(await ids(page)));
  const r0 = await rowIds(page);
  await drag(page, '.dashRow[data-dashrow="' + r0[r0.length - 1] + '"]', '.dashRow[data-dashrow="' + r0[0] + '"]');
  const r1 = await rowIds(page);
  ok('dragging a row moves it (the last row to the top), saved', r1[0] === r0[r0.length - 1] && lay('st5').rows[0] === r0[r0.length - 1], JSON.stringify([r0, r1]));

  // take off what was added
  await page.click('.qaItem[data-qa="ywamgp"] .qaX', { force: true }); await page.waitForTimeout(900);
  ok('✕ takes an added app off, saved', !(await ids(page)).includes('ywamgp') && !lay('st5').apps.includes('ywamgp'));

  await page.click('#qaDone'); await page.waitForTimeout(500);
  ok('Done: the wiggle stops, the ✎ is back', await page.$eval('.myHero', e => !e.classList.contains('dashEditing')) && !!(await page.$('#qaEditBtn')) && !(await page.$('.myHero .qaX')));
  ok('… and the card scrolls with the page again', await page.$eval('.myHero', e => getComputedStyle(e).touchAction) !== 'none');
  await page.click('.dashItem[data-dashw="daysoff"] .heroW'); await page.waitForTimeout(600);
  ok('the Days off widget opens Leave', await page.evaluate(() => S.view) === 'leave');
  await page.click('nav.bottom [data-tab="week"]'); await page.waitForSelector('#qaEditBtn');

  await page.click('#qaEditBtn'); await page.waitForTimeout(300);
  ok('the ✎ puts it in edit mode too', await page.$eval('.myHero', e => e.classList.contains('dashEditing')));
  await page.click('#qaDone'); await page.waitForTimeout(400);
  await hold(page, '#qaBar [data-qago="khmer"]');
  ok('holding an app does the same, without opening it', await page.$eval('.myHero', e => e.classList.contains('dashEditing')) && await page.evaluate(() => S.view) === 'week');
  await page.click('#qaDone'); await page.waitForTimeout(900);

  const before = { apps: await ids(page), w: await wids(page), r: await rowIds(page) };
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#qaBar'); await page.waitForTimeout(500);
  ok('opened again: their own card, in their own order', JSON.stringify({ apps: await ids(page), w: await wids(page), r: await rowIds(page) }) === JSON.stringify(before), JSON.stringify(before));
  await ctx.close();
}

// ---- what came with the card comes back ----
{
  await call('saveDashLayout', ['di', '1234', { apps: ['ywamgp'], widgets: ['books'], rows: ['reading'] }]);
  const { ctx, page } = await open('di');
  const a = await ids(page), w = await wids(page), r = await rowIds(page);
  ok('a saved layout missing the defaults gets them back (they can’t be taken off)', ['caltasks', 'library', 'khmer', 'leave', 'prayer'].every(x => a.includes(x)) && a[0] === 'ywamgp' && ['goals', 'habits', 'health'].every(x => w.includes(x)) && w[0] === 'books' && r.includes('base') && r[0] === 'reading', JSON.stringify({ a, w, r }));
  await ctx.close();
}

// ---- Mark (an admin): his own menu's apps; Khmer at 320px ----
{
  const { ctx, page } = await open('mark');
  await page.click('#qaEditBtn'); await page.waitForTimeout(250);
  await page.click('#qaAdd'); await page.waitForSelector('#qaAddSheet');
  const offer = await page.$$eval('#qaAddSheet [data-qapick]', els => els.map(e => e.getAttribute('data-qapick')));
  ok('an admin can put Admin and HR on his card', offer.includes('a:admin') && offer.includes('a:hr'), JSON.stringify(offer));
  await page.click('#qaAddSheet [data-qapick="a:admin"]'); await page.waitForTimeout(300);
  await page.click('#qaDone'); await page.waitForTimeout(900);
  ok('… saved on his record, Di’s untouched', lay('st1').apps.includes('admin') && !lay('st5').apps.includes('admin'));
  await page.click('#qaBar [data-qago="admin"]'); await page.waitForTimeout(600);
  ok('… and it opens Admin', await page.evaluate(() => S.view) === 'admin');
  await ctx.close();
}
{
  const { ctx, page } = await open('di', { km: true, small: true });
  await page.click('#qaEditBtn'); await page.waitForTimeout(300);
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: innerWidth }));
  ok('in Khmer on a 320px phone, editing, the page doesn’t widen', w.doc <= w.win, JSON.stringify(w));
  const lab = await page.$eval('#qaBar [data-qago="library"] .qaLabel', e => e.textContent);
  ok('… and the names are Khmer', /[ក-៿]/.test(lab), lab);
  await ctx.close();
}

ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
