/* The structure whiteboard (teams/23-structure.js, Nov 2026, Andrew): Campus Leadership arranges a quarter on My Ministry →
   Structure — a tree to pan and zoom, faces to drag from the tray onto a ministry, ＋ to add people or a typed-in name, a tap
   to make someone the leader or move them — saved for that quarter only, never into a profile until the quarter is made
   live (the last blocks: a second ministry, Make Qn live, the bell, My Ministry's pills); Team → Structure shows it,
   as the list and as the same tree, read only. Against the real api.js. Made-up people. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('structure-board-ui');
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
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Mark Hill', username: 'mark', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national' }),
  mk({ id: 'st2', name: 'Ann Lee', username: 'ann', email: 'a@e.com', dept: 'Community Service', ministry: 'Cafe', leads: ['Community Service|Cafe'] }),
  mk({ id: 'st3', name: 'Bo Chan', username: 'bo', email: 'b@e.com', dept: 'Youth Education', ministry: 'GP Media' }),
  mk({ id: 'st4', name: 'Cy Ros', username: 'cy', email: 'c@e.com', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'st5', name: 'Di Sok', username: 'di', email: 'd@e.com', dept: 'Old Department', ministry: 'Gone' }),
  mk({ id: 'st6', name: 'Ed Pou', username: 'ed', email: 'e@e.com', dept: 'Community Service', ministry: 'Cafe' }),
  mk({ id: 'st7', name: 'Pich Poipet', username: 'pich', email: 'p@e.com', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe' })
];
const profBefore = JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.leads]));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
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
// the quarter the leadership tab opens on: the next one, as the page works it out
const now = new Date(Date.now() + 7 * 3600e3), cq = Math.floor(now.getUTCMonth() / 3) + 1;
const NEXT = cq === 4 ? { year: now.getUTCFullYear() + 1, q: 1 } : { year: now.getUTCFullYear(), q: cq + 1 };
const planOf = () => (mem.structurePlans || []).find(r => r.campus === 'siemreap' && Number(r.year) === NEXT.year && Number(r.quarter) === NEXT.q);

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, vw, touch) {
  const ctx = await browser.newContext({ viewport: { width: vw || 390, height: 844 }, timezoneId: 'Asia/Phnom_Penh', hasTouch: !!touch });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|Failed to load/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(u => { localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })); localStorage.setItem('gp-game-intro-v2', JSON.stringify({ off: true })); }, user);
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
/* it opens on View (Nov 2026); most checks below edit, so they switch to Edit first */
const openBoard = async (page, edit = true) => { await page.evaluate(() => { S.view = 'ministry'; S.lwTab = 'struct'; render(); }); await page.waitForSelector('#sbWrap', { timeout: 8000 }); await page.waitForTimeout(400);
  if (edit && await page.$('#sbModeEdit:not(.on)')) { await page.click('#sbModeEdit'); await page.waitForSelector('#sbTray'); await page.waitForTimeout(200); }
  await page.$eval('#sbView', v => v.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); };
// bring a box into the middle of the view
const centerOn = (page, sel) => page.evaluate((sel) => { const v = document.getElementById('sbView').getBoundingClientRect(), b = document.querySelector(sel).getBoundingClientRect();
  S.sb.x += (v.left + v.width / 2) - (b.left + b.width / 2); S.sb.y += (v.top + v.height * 0.4) - (b.top + b.height / 2); sbApply_(); }, sel);
const center = async (page, sel) => { const b = await page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); return b; };
async function drag(page, fromSel, toSel) {
  const a = await center(page, fromSel), b = await center(page, toSel);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x, a.y - 30, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}
const settle = (page) => page.waitForTimeout(1100);

/* ---------- 1. Campus Leadership opens the whiteboard ---------- */
{
  const { ctx, page } = await open('mark');
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(300);
  ok('Campus Leadership has a Structure tab on its My Ministry row', await page.$('[data-lwtab="struct"]') !== null);
  await openBoard(page);
  ok('it opens on the quarter ahead, with this quarter beside it', await page.$eval('[data-sbq].on', b => b.getAttribute('data-sbq')) === NEXT.year + '|' + NEXT.q && (await page.$$('[data-sbq]')).length === 2);
  ok('it says the quarter starts from everyone’s profile until the first change', /Starting from everyone’s profile/.test(await page.$eval('.sbFrom', e => e.innerText)));
  const tree = await page.evaluate(() => ({ cols: document.querySelectorAll('.sbCol').length, cafe: [...document.querySelectorAll('[data-sbdrop="Community Service|Cafe"] [data-sbp]')].map(f => f.getAttribute('data-sbp') + (f.classList.contains('lead') ? '👑' : '')), lead: [...document.querySelectorAll('[data-sbdrop="Campus Leadership|Campus Director"] [data-sbp]')].map(f => f.getAttribute('data-sbp')), tray: [...document.querySelectorAll('#sbTrayFaces [data-sbfrom="_off"]')].map(f => f.getAttribute('data-sbp')), poipet: !!document.querySelector('[data-sbp="st7"]') }));
  ok('a tree: Campus Leadership with the director, a column per department plus the students', tree.cols >= 5 && JSON.stringify(tree.lead) === '["st1"]', JSON.stringify(tree));
  ok('each ministry has its people as faces, the leader first with a crown', JSON.stringify(tree.cafe) === '["st2👑","st6"]', JSON.stringify(tree.cafe));
  ok('someone whose profile points nowhere on the chart waits in the tray; the other campus is not there', JSON.stringify(tree.tray) === '["st5"]' && !tree.poipet, JSON.stringify(tree));
  ok('nothing is written just by looking', !planOf());

  /* zoom and fit */
  const k0 = await page.evaluate(() => S.sb.k);
  await page.click('#sbIn'); const k1 = await page.evaluate(() => S.sb.k);
  await page.click('#sbOut'); await page.click('#sbOut'); const k2 = await page.evaluate(() => S.sb.k);
  ok('＋ and − zoom in and out', k1 > k0 && k2 < k1, [k0, k1, k2].map(n => n.toFixed(2)).join(' → '));
  await page.click('#sbFit');
  ok('⤢ fits the whole tree in the board', await page.evaluate(() => { const v = document.getElementById('sbView').getBoundingClientRect(), t = document.getElementById('sbTree').getBoundingClientRect(); return t.left >= v.left - 1 && t.right <= v.right + 1 && t.top >= v.top - 1 && t.bottom <= v.bottom + 1; }));
  /* the mouse wheel zooms around the pointer; dragging the background moves it */
  const v = await center(page, '#sbView');
  const kw = await page.evaluate(() => S.sb.k);
  await page.mouse.move(v.x, v.y); await page.mouse.wheel(0, -300); await page.waitForTimeout(100);
  ok('the wheel zooms in', await page.evaluate(k => S.sb.k > k, kw), String(kw));
  const x0 = await page.evaluate(() => S.sb.x);
  await page.mouse.move(v.x - 100, v.y + 150); await page.mouse.down(); await page.mouse.move(v.x - 20, v.y + 150, { steps: 5 }); await page.mouse.up();
  ok('dragging the board moves it', await page.evaluate(x => Math.abs(S.sb.x - x - 80) < 3, x0));

  /* drag a face from the tray onto a ministry */
  await page.click('#sbFit'); await centerOn(page, '[data-sbdrop="Youth Education|GP Media"]');
  await drag(page, '#sbTrayFaces [data-sbp="st5"]', '[data-sbdrop="Youth Education|GP Media"]');
  await settle(page);
  let p = planOf();
  ok('dragging a face from the tray onto a ministry puts them there for the quarter', p && p.place.st5 && p.place.st5.dept === 'Youth Education' && p.place.st5.ministry === 'GP Media', JSON.stringify(p && p.place));
  ok('… the first change makes the whole quarter its own: everyone where they stood, the leaders as they were', p && p.place.st2.ministry === 'Cafe' && p.place.st1.ministry === 'Campus Director' && JSON.stringify(p.leads) === JSON.stringify({ 'Community Service|Cafe': ['st2'] }), JSON.stringify(p && p.leads));
  ok('… and the face is in the box now, out of the tray', await page.$('[data-sbdrop="Youth Education|GP Media"] [data-sbp="st5"]') !== null && await page.$('#sbTrayFaces [data-sbfrom="_off"]') === null);
  ok('it says it saved', /Saved/.test(await page.$eval('#sbSaved', e => e.textContent)));

  /* ＋ on a box: a typed-in name, and the leader */
  await page.click('#sbFit'); await centerOn(page, '[data-sbdrop="Skills Training|Hospitality"]');
  await page.click('[data-sbbox="Skills Training|Hospitality"]'); await page.waitForSelector('#sbSheet');
  ok('＋ opens the box: its people and a way to add', /Hospitality/.test(await page.$eval('#sbSheet', e => e.innerText)) && await page.$('#sbSheet [data-sblead="Skills Training|Hospitality|st4"]') !== null && await page.$('#sbSheet [data-ppickq="sb"]') !== null);
  await page.fill('#sbNewName', 'Sophea New'); await page.click('#sbNewAdd'); await settle(page);
  p = planOf();
  const xid = p && p.extra[0] && p.extra[0].id;
  ok('a name for someone not in the app goes on the chart, in that box', !!xid && p.extra[0].name === 'Sophea New' && p.place[xid].ministry === 'Hospitality', JSON.stringify(p && p.extra));
  await page.click('#sbSheet [data-sblead="Skills Training|Hospitality|st4"]'); await settle(page);
  p = planOf();
  ok('“Make leader” makes them the ministry’s leader for the quarter', JSON.stringify(p.leads['Skills Training|Hospitality']) === '["st4"]');
  ok('… and the sheet says so', /Leader/.test(await page.$eval('#sbSheet [data-sblead="Skills Training|Hospitality|st4"]', e => e.textContent)));
  await page.fill('#sbSheet [data-ppickq="sb"]', 'Bo'); await page.waitForTimeout(150);
  await page.click('#sbSheet [data-ppickit="sb|st3"]'); await settle(page);
  ok('picking a name in the sheet moves them into the box', planOf().place.st3.ministry === 'Hospitality');
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  ok('✕ closes the sheet', !(await page.$('#sbSheet')));

  /* a tap on a face: move them, take the crown away */
  await page.click('#sbFit'); await centerOn(page, '[data-sbdrop="Community Service|Cafe"]');
  await page.click('[data-sbdrop="Community Service|Cafe"] [data-sbp="st2"]'); await page.waitForSelector('#sbSheet');
  ok('a tap on a face opens them: where they are and what their profile says', /Ann Lee/.test(await page.$eval('#sbSheet', e => e.innerText)) && /Their profile says/.test(await page.$eval('#sbSheet', e => e.innerText)));
  await page.click('#sbSheet [data-sblead="Community Service|Cafe|st2"]'); await settle(page);
  ok('“Not the leader” takes the crown off', !planOf().leads['Community Service|Cafe']);
  await page.click('#sbSheetClose'); await page.waitForTimeout(150);
  await page.click('[data-sbdrop="Community Service|Cafe"] [data-sbp="st6"]'); await page.waitForSelector('#sbMoveSel');
  await page.selectOption('#sbMoveSel', '_stu:dts'); await page.click('#sbMoveGo'); await settle(page);
  ok('“Move to” a school makes them a student this quarter', planOf().students.st6 === 'dts' && await page.$('[data-sbdrop="_students"] [data-sbp="st6"]') !== null);
  /* drag a face onto the tray: off the chart */
  await page.click('#sbFit'); await centerOn(page, '[data-sbdrop="Youth Education|GP Media"]');
  await drag(page, '[data-sbdrop="Youth Education|GP Media"] [data-sbp="st5"]', '#sbTray');
  await settle(page);
  ok('dropping a face on the tray takes them off the chart for the quarter', planOf().place.st5.dept === '_off' && await page.$('#sbTrayFaces [data-sbfrom="_off"][data-sbp="st5"]') !== null);
  ok('profiles are never touched', JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.leads])) === profBefore);

  /* full screen */
  await page.click('#sbFull'); await page.waitForTimeout(250);
  ok('⛶ makes the board the whole screen (the bottom bar out of the way)', await page.evaluate(() => { const r = document.getElementById('sbWrap').getBoundingClientRect(); return document.getElementById('sbWrap').classList.contains('full') && r.top <= 1 && Math.abs(r.width - innerWidth) < 2 && getComputedStyle(document.querySelector('nav.bottom')).display === 'none'; }));
  await page.click('#sbFull'); await page.waitForTimeout(200);
  ok('… and ✕ puts it back', await page.evaluate(() => !document.getElementById('sbWrap').classList.contains('full')));
  ok('nothing slides sideways', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

  /* Team → Structure: the same quarter */
  await page.evaluate((n) => { S.view = 'team'; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.structYear = n.year; S.structQ = n.q; S.structCache = {}; render(); }, NEXT);
  await page.waitForSelector('.orgChart', { timeout: 8000 }); await page.waitForTimeout(300);
  const list = await page.evaluate(() => ({ hosp: document.querySelector('[data-orgmin="Skills Training|Hospitality"]').innerText.replace(/\s+/g, ' '), cafe: document.querySelector('[data-orgmin="Community Service|Cafe"]').innerText.replace(/\s+/g, ' '), stu: (document.querySelector('[data-orgbox="students"]') || {}).innerText || '' }));
  ok('Team → Structure shows the quarter as arranged: the leader crowned, the typed-in name, the student', /👑 Cy Ros/.test(list.hosp) && /Sophea New/.test(list.hosp) && /Bo Chan/.test(list.hosp) && !/👑/.test(list.cafe) && /Ed Pou/.test(list.stu), JSON.stringify(list));
  ok('a typed-in name is not a link to a profile', await page.$('[data-orgmin="Skills Training|Hospitality"] .orgPerson.extra') !== null && !(await page.$('[data-orgmin="Skills Training|Hospitality"] .orgPerson.extra[data-person]')));
  ok('the old Arrange button is gone; Campus Leadership has Edit, everyone “See it as a tree”', !(await page.$('#structArrangeBtn')) && await page.$('#sbTeamEdit') !== null && await page.$('#sbTeamOpen') !== null);
  await page.click('#sbTeamOpen'); await page.waitForSelector('#sbWrap');
  ok('“See it as a tree” draws the same tree, read only — no tray, no ＋, faces open profiles', !(await page.$('#sbTray')) && !(await page.$('.sbPlus')) && !(await page.$('[data-sbp]')) && await page.$('#sbTree [data-person="st4"]') !== null);
  await page.click('#sbTeamBack'); await page.waitForTimeout(200);
  await page.click('#sbTeamEdit'); await page.waitForSelector('#sbWrap'); await page.waitForTimeout(300);
  ok('Edit goes to Campus Leadership → Structure on that quarter', await page.evaluate(() => S.view === 'ministry') && await page.$('[data-lwtab="struct"].on') !== null && await page.$('#sbTray') !== null);

  /* start again from profiles */
  await page.evaluate(() => localStorage.removeItem('gp-ask-test'));
  await page.click('#sbReset'); await settle(page);
  p = planOf();
  ok('“Start again from everyone’s profile” clears the quarter', p && JSON.stringify(p.place) === '{}' && p.leads === null);
  await ctx.close();
}

/* ---------- 2. an ordinary staff member ---------- */
{
  const { ctx, page } = await open('ed', 320);
  await page.evaluate((n) => { S.view = 'team'; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.structYear = n.year; S.structQ = n.q; render(); }, NEXT);
  await page.waitForSelector('.orgChart', { timeout: 8000 });
  ok('staff see the structure and the tree, but no Edit', await page.$('#sbTeamOpen') !== null && !(await page.$('#sbTeamEdit')));
  await page.click('#sbTeamOpen'); await page.waitForSelector('#sbWrap');
  ok('the tree fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const r = await page.evaluate((n) => new Promise(res => run('saveStructurePlan', [S.auth.user, S.auth.pin, 'siemreap', n.year, n.q, {}, { st6: { dept: 'Campus Leadership', ministry: 'Campus Director' } }, {}, []], res, () => res(null))), NEXT);
  ok('and the server refuses them a change', r && r.ok === false && r.err === 'not_authorized', JSON.stringify(r));
  await ctx.close();
}

/* ---------- 3. on a phone: two fingers pinch (even starting on a face), one finger moves a face ---------- */
{
  const { ctx, page } = await open('mark', 390, true);
  await openBoard(page);
  const cdp = await ctx.newCDPSession(page);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const lead = await center(page, '[data-sbdrop="Campus Leadership|Campus Director"] [data-sbp="st1"]');
  const k0 = await page.evaluate(() => S.sb.k);
  await T('touchStart', [[lead.x, lead.y], [lead.x + 60, lead.y + 20]]);
  for (let i = 1; i <= 5; i++) await T('touchMove', [[lead.x - i * 8, lead.y], [lead.x + 60 + i * 8, lead.y + 20]]);
  await T('touchEnd', []); await page.waitForTimeout(200);
  ok('two fingers pinch to zoom — even when one lands on a face, which is not dragged', await page.evaluate(k => S.sb.k > k * 1.1, k0) && !((planOf().place.st1 || {}).dept || '').startsWith('_') && await page.$('[data-sbdrop="Campus Leadership|Campus Director"] [data-sbp="st1"]') !== null, String(await page.evaluate(() => S.sb.k)));
  await page.click('#sbFit'); await centerOn(page, '[data-sbdrop="Youth Education|GP Media"]');
  const f = await center(page, '#sbTrayFaces [data-sbp="st5"]'), tg = await center(page, '[data-sbdrop="Youth Education|GP Media"]');
  await T('touchStart', [[f.x, f.y]]); for (let i = 1; i <= 10; i++) await T('touchMove', [[f.x + (tg.x - f.x) * i / 10, f.y + (tg.y - f.y) * i / 10]]); await T('touchEnd', []);
  await settle(page);
  ok('a finger drags a face from the tray onto a ministry', planOf().place.st5 && planOf().place.st5.ministry === 'GP Media', JSON.stringify(planOf().place.st5));
  const x0 = await page.evaluate(() => S.sb.x), vb = await page.$eval('#sbView', v => { const r = v.getBoundingClientRect(); return { x: r.right - 12, y: r.top + 60 }; });
  await T('touchStart', [[vb.x, vb.y]]); for (let i = 1; i <= 5; i++) await T('touchMove', [[vb.x - i * 12, vb.y + i * 4]]); await T('touchEnd', []);
  ok('one finger on the board itself moves it', await page.evaluate(x => S.sb.x < x - 30, x0));
  await ctx.close();
}

/* ---------- 4. View and Edit, the schools running in the quarter, and a drag on the board is never a pull to refresh ---------- */
{
  const { ctx, page } = await open('mark', 390, true);
  await page.evaluate(() => { window.__ptr = 0; window.gpPullRefresh_ = function(){ window.__ptr++; return Promise.resolve(); }; window.scrollTo(0, 0); });
  await openBoard(page, false);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150);
  const grp = await page.evaluate(() => { const g = document.querySelector('[data-sbgroup="srmin"]'); if (!g) return null;
    return { head: g.querySelector('.sbHead').textContent, boxes: [...g.querySelectorAll('[data-sbdrop]')].map(b => b.getAttribute('data-sbdrop') + '=' + b.querySelector('.sbHead span').textContent.trim()),
      inCs: !!g.closest('[data-sbdept]') || g.parentElement.closest('.sbCol').querySelector('[data-sbdept="Community Service"]') !== null,
      alone: ['Sry Noi', 'LTN', 'Ponlork School'].every(m => document.querySelectorAll('[data-sbdrop="Community Service|' + m + '"]').length === 1) }; });
  ok('SR Ministries: one heading in Community Service with Sry Noi, LTN and Ponlork Hope under it, each still its own box', grp && /SR Ministries/.test(grp.head) && grp.inCs && grp.alone &&
    JSON.stringify(grp.boxes) === JSON.stringify(['Community Service|Sry Noi=📚 Sry Noi', 'Community Service|LTN=📚 LTN', 'Community Service|Ponlork School=🌱 Ponlork Hope']), JSON.stringify(grp));
  ok('the board opens on View: no tray, no ＋, nobody can be picked up', await page.$('#sbModeView.on') !== null && !(await page.$('#sbTray')) && !(await page.$('.sbPlus')) && !(await page.$('[data-sbp]')) && !(await page.$('#sbRun')));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/sb-view.png' });
  ok('… and says so', /nobody can be moved by accident/.test(await page.$eval('.sbModeRow', e => e.innerText)));
  const cdp = await ctx.newCDPSession(page);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) });
  const swipeDown = async (x, y) => { await T('touchStart', [[x, y]]); for (let i = 1; i <= 12; i++) await T('touchMove', [[x, y + i * 20]]); await T('touchEnd', []); await page.waitForTimeout(500); };
  const before = JSON.stringify(planOf() || null);
  const vb = await page.$eval('#sbView', v => { const r = v.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20, top: r.top }; });
  const y0 = await page.evaluate(() => S.sb.y);
  await swipeDown(vb.x, vb.y);
  ok('a finger dragged down the board moves the board, and is not a pull to refresh', await page.evaluate(y => S.sb.y > y + 100, y0) && await page.evaluate(() => window.__ptr) === 0 && await page.evaluate(() => S.view === 'ministry'), 'top ' + Math.round(vb.top) + ' ptr ' + await page.evaluate(() => window.__ptr));
  const face = await page.$eval('#sbTree [data-person]', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.getAttribute('data-person') }; }).catch(() => null);
  if (face && face.y > vb.top && face.y < vb.top + 300) await swipeDown(face.x, face.y);
  ok('dragging a face in View moves nobody', JSON.stringify(planOf() || null) === before && await page.evaluate(() => S.view === 'ministry'));
  const hd = await center(page, '.sbTop h3');
  await swipeDown(hd.x, hd.y);
  ok('(the same pull above the board still refreshes the page)', await page.evaluate(() => window.__ptr) === 1, String(await page.evaluate(() => window.__ptr)));

  await page.click('#sbModeEdit'); await page.waitForSelector('#sbTray');
  ok('Edit brings the tray, ＋ and the schools to tick', await page.$('#sbModeEdit.on') !== null && await page.$('.sbPlus') !== null && await page.$('#sbRun') !== null && await page.$('#sbWrap.editing') !== null);
  const all = await page.$$eval('[data-sbrun]', bs => bs.map(b => b.getAttribute('data-sbrun') + (b.classList.contains('on') ? '+' : '')));
  ok('every school the campus has, all running until said otherwise', JSON.stringify(all) === JSON.stringify(['GPDTS+', 'DBS+', 'SMS+', 'BCS+', 'SOMD+']), JSON.stringify(all));
  for (const m of ['DBS', 'SMS', 'BCS', 'SOMD']) { await page.click('[data-sbrun="' + m + '"]'); await page.waitForTimeout(120); }
  await settle(page);
  ok('ticking off the others: only GPDTS runs that quarter', JSON.stringify(planOf().schools) === '["GPDTS"]', JSON.stringify(planOf().schools));
  ok('… the tree has a GPDTS box and none for the others, and says which aren’t running', await page.$('[data-sbdrop="Leadership Development|GPDTS"]') !== null && !(await page.$('[data-sbdrop="Leadership Development|DBS"]')) && /DBS · SMS · BCS · SOMD/.test(await page.$eval('#sbNotRun', e => e.textContent)));
  await centerOn(page, '[data-sbdrop="Leadership Development|GPDTS"]');
  if (process.env.GP_SHOT) { await page.$eval('#sbRun', e => e.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); await page.screenshot({ path: process.env.GP_SHOT + '/sb-edit.png' }); }
  await page.click('[data-sbbox="Leadership Development|GPDTS"]'); await page.waitForSelector('#sbSheet');
  await page.fill('#sbSheet [data-ppickq="sb"]', 'Ed'); await page.waitForTimeout(150);
  await page.click('#sbSheet [data-ppickit="sb|st6"]'); await settle(page);
  await page.click('#sbSheet [data-sblead="Leadership Development|GPDTS|st6"]'); await settle(page);
  ok('the school’s leader and staff go in its box', planOf().place.st6 && planOf().place.st6.ministry === 'GPDTS' && JSON.stringify(planOf().leads['Leadership Development|GPDTS']) === '["st6"]', JSON.stringify(planOf().place.st6));
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  /* someone in two ministries, added from the box itself (Nov 2026, Andrew) */
  const st3Main = JSON.stringify(planOf().place.st3 || null);
  await page.evaluate(() => { sbState_().sheet = { kind: 'box', key: 'Community Service|LTN' }; render(); }); await page.waitForSelector('#sbAddAlso');
  await page.fill('#sbSheet [data-ppickq="sbalso"]', 'Bo'); await page.waitForTimeout(150);
  await page.click('#sbSheet [data-ppickit="sbalso|st3"]'); await settle(page);
  ok('＋ on a ministry → “Also serves here”: they join it as a second ministry and keep their main one', JSON.stringify((planOf().also || {}).st3 || []).indexOf('Community Service|LTN') > -1 && JSON.stringify(planOf().place.st3 || null) === st3Main && await page.$('[data-sbdrop="Community Service|LTN"] .sbFace.also') !== null, JSON.stringify(planOf().also));
  ok('… and no profile changed', JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.leads])) === profBefore);
  if (await page.$('#sbSheetClose')) { await page.click('#sbSheetClose'); await page.waitForTimeout(200); }
  await page.evaluate(() => { sbState_().sheet = { kind: 'school', id: 'st4' }; render(); }); await page.waitForSelector('#sbSheet');
  ok('a staff member doing a school that quarter can only pick a school that runs', JSON.stringify(await page.$$eval('[data-sbschool]', bs => bs.map(b => b.getAttribute('data-sbschool')))) === '["dts"]');
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  await page.click('#sbModeView'); await page.waitForTimeout(300);
  ok('back to View: one line says which schools run', /Schools running in Q\d \d{4}: GPDTS$/.test((await page.$eval('#sbRunLine', e => e.textContent)).trim()) && !(await page.$('#sbTray')));
  await page.evaluate((n) => { S.view = 'team'; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.structYear = n.year; S.structQ = n.q; S.sbTeam = false; render(); }, NEXT);
  await page.waitForSelector('.orgChart', { timeout: 8000 });
  ok('Team → Structure’s list follows: GPDTS with its leader, no box for a school not running', await page.$('[data-orgmin="Leadership Development|GPDTS"]') !== null && !(await page.$('[data-orgmin="Leadership Development|DBS"]')) && /Ed Pou/.test(await page.$eval('[data-orgmin="Leadership Development|GPDTS"]', e => e.innerText)) && await page.$('.orgNotRun') !== null);
  const nq = NEXT.q === 4 ? { year: NEXT.year + 1, q: 1 } : { year: NEXT.year, q: NEXT.q + 1 };
  const later = await page.evaluate((n) => new Promise(res => run('getStructure', [S.auth.user, S.auth.pin, 'siemreap', n.year, n.q], res, () => res(null))), nq);
  ok('the quarter after starts from the same schools', later && later.plan && JSON.stringify(later.plan.schools) === '["GPDTS"]', JSON.stringify(later && later.plan && later.plan.schools));
  ok('profiles are still never touched', JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.leads])) === profBefore);
  if (process.env.GP_SHOT) { await openBoard(page, false); await page.evaluate(() => { S.sb.k = 0.8; sbApply_(); }); await centerOn(page, '[data-sbgroup="srmin"]'); await page.waitForTimeout(200); await page.screenshot({ path: process.env.GP_SHOT + '/sb-group.png' }); }
  await ctx.close();
}


/* ---------- a second ministry on the board, and the quarter made live (Nov 2026, Uriah) ---------- */
const THIS = { year: now.getUTCFullYear(), q: cq };
const planNow = () => (mem.structurePlans || []).find(r => r.campus === 'siemreap' && Number(r.year) === THIS.year && Number(r.quarter) === THIS.q);
const prof = id => mem.staff.find(s => s.id === id);
const openNow = async (page) => { await openBoard(page, false); await page.click('[data-sbq="' + THIS.year + '|' + THIS.q + '"]'); await page.waitForSelector('#sbLive', { timeout: 8000 }); await page.waitForTimeout(300);
  if (await page.$('#sbModeEdit:not(.on)')) { await page.click('#sbModeEdit'); await page.waitForSelector('#sbTray'); await page.waitForTimeout(200); } };
const personSheet = async (page, id) => { await page.evaluate((id) => { sbState_().sheet = { kind: 'person', id: id }; render(); }, id); await page.waitForSelector('#sbSheet'); };
{
  const before = JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.ministries || null, s.leads || null]));
  const { ctx, page } = await open('mark');
  await openNow(page);
  ok('above the board: where the quarter stands, and one button', await page.$eval('#sbLive', e => e.getAttribute('data-sblive')) === 'off' && /already matches/.test(await page.$eval('#sbLiveLine', e => e.textContent)) && /Make Q\d \d{4} live/.test(await page.$eval('#sbLiveBtn', e => e.textContent)));
  ok('the tab no longer says nobody’s profile changes', !/nobody’s profile changes/i.test(await page.$eval('.sbTop', e => e.innerText)));
  await personSheet(page, 'st3');
  ok('a person’s sheet names their main ministry', /GP Media/.test(await page.$eval('#sbAlso .sbAlsoRow', e => e.innerText)) && /Main ministry/.test(await page.$eval('#sbMainTag', e => e.textContent)));
  const optsA = await page.$$eval('#sbAlsoSel option', os => os.map(o => o.value));
  ok('“Also serves in…” offers the campus’s ministries: not the main one, never a Campus Leadership row', optsA.includes('Community Service|Cafe') && !optsA.includes('Youth Education|GP Media') && !optsA.some(v => v.indexOf('Campus Leadership|') === 0), optsA.length + ' options');
  await page.selectOption('#sbAlsoSel', 'Community Service|Cafe'); await page.click('#sbAlsoAdd'); await settle(page);
  ok('adding a second ministry is saved on the quarter', planNow() && JSON.stringify(planNow().also.st3) === '["Community Service|Cafe"]' && planNow().place.st3.ministry === 'GP Media', JSON.stringify(planNow() && planNow().also));
  ok('… the sheet lists it, with “Make this their main ministry”', await page.$('[data-sbalsorow="Community Service|Cafe"] [data-sbmain]') !== null);
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  const two = await page.evaluate(() => ({ main: [...document.querySelectorAll('#sbTree [data-sbdrop="Youth Education|GP Media"] [data-sbp="st3"]')].map(f => f.classList.contains('also')),
    second: [...document.querySelectorAll('#sbTree [data-sbdrop="Community Service|Cafe"] [data-sbp="st3"]')].map(f => f.classList.contains('also') && !!f.querySelector('.sbAlsoTag')),
    n: document.querySelector('#sbTree [data-sbdrop="Community Service|Cafe"] .sbN').textContent.replace(/\s+/g, ' ').trim() }));
  ok('the tree shows them in both boxes — the second face marked “also”, and not counted in that box', JSON.stringify(two.main) === '[false]' && JSON.stringify(two.second) === '[true]' && two.n === '2 +1', JSON.stringify(two));
  ok('the line says one profile would change — and nothing has', /1 person’s profile would change/.test(await page.$eval('#sbLiveLine', e => e.textContent)) && JSON.stringify(mem.staff.map(s => [s.id, s.dept, s.ministry, s.ministries || null, s.leads || null])) === before);
  // dragging the second face back onto their main box changes nothing; dragging it elsewhere moves the MAIN place
  await centerOn(page, '[data-sbdrop="Community Service|Cafe"]');
  await personSheet(page, 'st3');
  await page.click('[data-sbmain="Community Service|Cafe|st3"]'); await settle(page);
  ok('“Make this their main ministry” swaps the two', planNow().place.st3.ministry === 'Cafe' && JSON.stringify(planNow().also.st3) === '["Youth Education|GP Media"]', JSON.stringify([planNow().place.st3, planNow().also]));
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  await personSheet(page, 'st4');
  await page.selectOption('#sbMoveSel', 'Campus Leadership|Skills Training'); await page.click('#sbMoveGo'); await settle(page);
  ok('(Cy is put on the Director spot of Skills Training)', planNow().place.st4.dept === 'Campus Leadership');
  await ctx.close();
}
{
  // the next time Campus Leadership opens the app: the bell
  const { ctx, page } = await open('mark');
  ok('the boot says this quarter is arranged and not live', await page.evaluate(() => !!S.structReady && S.structReady.q) === THIS.q);
  await page.click('#bellBtn'); await page.waitForSelector('#notifRoot [data-gostruct]', { timeout: 5000 });
  ok('the bell: “Q’s structure is ready — make it live”', /structure is ready — make it live/.test(await page.$eval('#notifRoot', e => e.innerText)));
  await page.click('#notifRoot [data-gostruct]'); await page.waitForSelector('#sbLive', { timeout: 8000 });
  ok('… opens the Structure tab on this quarter', await page.$eval('[data-sbq].on', b => b.getAttribute('data-sbq')) === THIS.year + '|' + THIS.q);
  const other = await open('ann');
  ok('nobody outside Campus Leadership gets it', await other.page.evaluate(() => !S.structReady && !notifItems_().some(i => /structure is ready/.test(i.text))));
  await other.ctx.close();
  ok('two profiles would change', /2 people’s profiles would change/.test(await page.$eval('#sbLiveLine', e => e.textContent)), await page.$eval('#sbLiveLine', e => e.textContent));
  await page.click('#sbLiveBtn'); await page.waitForSelector('#sbLiveSheet');
  const rows = await page.$$eval('#sbLiveList li', ls => ls.map(l => l.getAttribute('data-sbchange') + ': ' + l.innerText.replace(/\s+/g, ' ')));
  ok('the sheet lists each change in plain words', rows.length === 2 && rows.some(r => /^st3: Bo Chan GP Media → Cafe · \+ also GP Media$/.test(r)) && rows.some(r => /^st4: Cy Ros waits for an admin: Director of Skills Training$/.test(r)), JSON.stringify(rows));
  ok('… no “hasn’t started yet” for this quarter, and it says who is left alone', !(await page.$('#sbLiveEarly')) && /off the chart/.test(await page.$eval('#sbLiveSheet', e => e.innerText)));
  ok('… on a phone the sheet fits', await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/sb-live-sheet.png' });
  ok('nothing is written before Confirm', prof('st3').ministry === 'GP Media' && !planNow().live);
  await page.click('#sbLiveConfirm'); await page.waitForSelector('#sbLive[data-sblive="live"]', { timeout: 8000 });
  ok('Confirm: the main ministry and the other one are on the profile', prof('st3').dept === 'Community Service' && prof('st3').ministry === 'Cafe' && JSON.stringify(prof('st3').ministries) === '["Youth Education|GP Media"]', JSON.stringify([prof('st3').dept, prof('st3').ministry, prof('st3').ministries]));
  ok('… the move into Campus Leadership waits for an admin (the editor is not one)', prof('st4').dept === 'Skills Training' && prof('st4').cltRequest && prof('st4').cltRequest.ministry === 'Skills Training');
  ok('… the plan is live and the line says a later change waits for Apply again', !!planNow().live && /is live — profiles match it\. A change on the board waits until you tap Apply again/.test(await page.$eval('#sbLiveLine', e => e.textContent)) && /1 move into Campus Leadership is waiting/.test(await page.$eval('#sbLiveLine', e => e.textContent)));
  ok('… this phone’s roster follows, and the bell item is gone', await page.evaluate(() => S.roster.find(p => p.id === 'st3').ministry === 'Cafe' && !S.structReady && !notifItems_().some(i => /structure is ready/.test(i.text))));
  // live: a change on the board touches no profile until Apply again (Nov 2026, Andrew: "doesn't affect anything else")
  await page.click('#sbModeEdit'); await page.waitForSelector('#sbTray');
  const st6Before = JSON.stringify(prof('st6'));
  await personSheet(page, 'st6');
  await page.selectOption('#sbAlsoSel', 'Youth Education|GP Media'); await page.click('#sbAlsoAdd'); await settle(page);
  ok('once live, a change on the board writes no profile', JSON.stringify(prof('st6')) === st6Before && !!planNow().also && JSON.stringify(planNow().also.st6) === '["Youth Education|GP Media"]', JSON.stringify(prof('st6').ministries));
  await page.click('#sbSheetClose'); await page.waitForTimeout(200);
  ok('… the line says a profile differs, with Apply again', await page.$eval('#sbLive', e => e.getAttribute('data-sblive')) === 'drift' && /1 profile differs from this structure/.test(await page.$eval('#sbLiveLine', e => e.textContent)), await page.$eval('#sbLiveLine', e => e.textContent));
  await page.click('#sbLiveAgain'); await page.waitForSelector('#sbLive[data-sblive="live"]', { timeout: 8000 });
  ok('… Apply again writes it', JSON.stringify(prof('st6').ministries) === '["Youth Education|GP Media"]' && prof('st6').ministry === 'Cafe', JSON.stringify(prof('st6').ministries));
  // Team → Structure's list shows a second ministry too
  await page.evaluate((n) => { S.view = 'team'; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.structYear = n.year; S.structQ = n.q; S.sbTeam = false; render(); }, THIS);
  await page.waitForSelector('.orgChart', { timeout: 8000 });
  const lst = await page.evaluate(() => ({ media: [...document.querySelectorAll('[data-orgmin="Youth Education|GP Media"] .orgPerson')].map(p => p.getAttribute('data-person') + (p.classList.contains('also') ? '~' : '')),
    cafe: [...document.querySelectorAll('[data-orgmin="Community Service|Cafe"] .orgPerson')].map(p => p.getAttribute('data-person') + (p.classList.contains('also') ? '~' : '')), n: document.querySelector('[data-orgmin="Youth Education|GP Media"] .orgMinN').textContent }));
  ok('Team → Structure’s list shows them in each ministry, the second marked “also”', JSON.stringify(lst.media.sort()) === '["st3~","st6~"]' && lst.cafe.includes('st3') && lst.cafe.includes('st6') && lst.n === '0 +2' && await page.$('[data-orgmin="Youth Education|GP Media"] .orgAlsoTag') !== null, JSON.stringify(lst));
  // someone edits their own profile: it differs
  Object.assign(prof('st3'), { dept: 'Youth Education', ministry: 'GP Media', ministries: [] });
  await page.evaluate(() => { S.structCache = {}; }); await openNow(page);
  ok('a profile edited since: “1 profile differs from this structure”, with See and Apply again', await page.$eval('#sbLive', e => e.getAttribute('data-sblive')) === 'drift' && /1 profile differs from this structure/.test(await page.$eval('#sbLiveLine', e => e.textContent)) && await page.$('#sbLiveSee') !== null);
  await page.click('#sbLiveSee'); await page.waitForSelector('#sbLiveSheet');
  ok('See lists it', /Bo Chan/.test(await page.$eval('#sbLiveList', e => e.innerText)));
  await page.click('#sbLiveCancel'); await page.waitForTimeout(200);
  await page.click('#sbLiveAgain'); await page.waitForSelector('#sbLive[data-sblive="live"]', { timeout: 8000 });
  ok('Apply again puts the profile back', prof('st3').ministry === 'Cafe' && JSON.stringify(prof('st3').ministries) === '["Youth Education|GP Media"]');
  // the next quarter: made live early, it says so
  await page.click('[data-sbq="' + NEXT.year + '|' + NEXT.q + '"]'); await page.waitForSelector('#sbLive[data-sblive="off"]', { timeout: 8000 });
  await page.click('#sbLiveBtn'); await page.waitForSelector('#sbLiveSheet');
  ok('a quarter that hasn’t started says profiles would change today', await page.$('#sbLiveEarly') !== null);
  await page.click('#sbLiveCancel'); await page.waitForTimeout(150);
  ok('… and nothing was written for it', !planOf().live);
  // start again from everyone's profile clears live
  await page.click('[data-sbq="' + THIS.year + '|' + THIS.q + '"]'); await page.waitForSelector('#sbReset', { timeout: 8000 });
  await page.click('#sbReset'); await page.waitForSelector('#sbLive[data-sblive="off"]', { timeout: 8000 });
  ok('“Start again from everyone’s profile” still works and the quarter is no longer live', !planNow().live && Object.keys(planNow().place).length === 0 && prof('st3').ministry === 'Cafe');
  await ctx.close();
}

/* ---------- My Ministry for someone in two ministries: the row of pills ---------- */
{
  Object.assign(prof('st4'), { ministries: ['Community Service|Cafe'] }); delete prof('st4').cltRequest;
  const { ctx, page } = await open('cy', 320);
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForSelector('#mmMine', { timeout: 8000 });
  const pills = await page.$$eval('#mmMine [data-mmgo]', bs => bs.map(b => b.getAttribute('data-mmgo') + (b.classList.contains('on') ? '*' : '') + (b.querySelector('small') ? ' (' + b.querySelector('small').textContent + ')' : '')));
  ok('in two ministries: one slim row names both, the open one marked, the main one said', JSON.stringify(pills) === JSON.stringify(['Skills Training|Hospitality* (main)', 'Community Service|Cafe']), JSON.stringify(pills));
  ok('Switch ▾ is still there, and the row fits a 320px phone', await page.$('#mmSwitch') !== null && await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1));
  await page.click('[data-mmgo="Community Service|Cafe"]'); await page.waitForTimeout(900);
  ok('a tap opens the other ministry — its name, “One of your ministries”, the pill marked', /Cafe/.test(await page.$eval('.mmBannerName', e => e.textContent)) && /One of your ministries/.test(await page.$eval('.mmBannerNote', e => e.textContent)) && await page.$('[data-mmgo="Community Service|Cafe"].on') !== null);
  ok('… with that ministry’s own tool tabs (the Cafe’s), and the server lets them in', (await page.$$('[data-cafetab]')).length >= 4 && await page.evaluate(() => !!S.cafe && !S.cafeErr), await page.evaluate(() => String(S.cafeErr || '')));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/mm-pills.png' });
  await page.click('#mmSwitch'); await page.waitForSelector('[data-mmpick="Skills Training|Hospitality"]');
  await page.click('[data-mmpick="Skills Training|Hospitality"]'); await page.waitForTimeout(400);
  ok('Switch ▾ works as before', /Hospitality/.test(await page.$eval('.mmBannerName', e => e.textContent)) && await page.$('[data-mmgo="Skills Training|Hospitality"].on') !== null);
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForSelector('#myPosMin', { timeout: 8000 });
  ok('Profile → My positions says it plainly: “Main: … · Also: …”', /Main: Hospitality/.test(await page.$eval('#myPosMin', e => e.innerText)) && /Also: Cafe/.test(await page.$eval('#myPosMin', e => e.innerText)), await page.$eval('#myPosMin', e => e.innerText));
  await ctx.close();
  const one = await open('pich');
  await one.page.evaluate(() => { S.view = 'ministry'; render(); }); await one.page.waitForSelector('#mmBanner');
  ok('someone in one ministry has no such row', !(await one.page.$('#mmMine')));
  await one.ctx.close();
}

/* ---------- Nov 2026 (Uriah): a dragged person lands — a leader, a Director; main job or second job in one gesture;
   nobody is on the board more than they should be ---------- */
{
  const CS = 'Community Service', CSM = ['Cafe', 'Outreach Teams', 'Ponlork School', 'LTN', 'Sry Noi'].map(m => CS + '|' + m);
  const seed = () => { mem.staff = [
    mk({ id: 'bo', name: 'Boss Hill', username: 'boss', email: 'bo@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national' }),
    mk({ id: 'di', name: 'Dana Direct', username: 'dana', email: 'di@e.com', dept: 'Campus Leadership', ministry: CS, ministries: CSM.concat(['Youth Education|Worship']), leads: [CS + '|Outreach Teams'] }),
    mk({ id: 'le', name: 'Lena Lead', username: 'lena', email: 'le@e.com', dept: CS, ministry: 'Cafe', leads: [CS + '|Cafe'] }),
    mk({ id: 'ra', name: 'Ray Sims', username: 'ray', email: 'ra@e.com', dept: CS, ministry: 'Cafe' }),
    mk({ id: 'ki', name: 'Kim Lowe', username: 'kim', email: 'ki@e.com', dept: 'Skills Training', ministry: 'Hospitality', ministries: [CS + '|Cafe'] }),
    mk({ id: 'lu', name: 'Luke Moss', username: 'luke', email: 'lu@e.com', dept: 'Youth Education', ministry: 'GP Media', leads: ['Youth Education|Worship'] }),
    mk({ id: 'ne', name: 'Ned Orr', username: 'ned', email: 'ne@e.com', dept: 'Skills Training', ministry: 'Culinary' })
  ]; mem.structurePlans = []; mem.structure = []; };
  const faces = (page) => page.evaluate(() => { const o = {}; document.querySelectorAll('#sbTree .sbFace').forEach(f => { const id = f.getAttribute('data-sbp') || f.getAttribute('data-person'), box = f.closest('[data-sbdrop]');
    (o[id] = o[id] || []).push((box ? box.getAttribute('data-sbdrop') : '?') + (f.classList.contains('lead') ? '👑' : '') + (f.classList.contains('also') ? '~' : '')); }); return o; });
  const J = JSON.stringify, toast = (page) => page.evaluate(() => document.getElementById('msg').textContent);
  const box = k => '[data-sbdrop="' + k + '"]', face = (k, id, also) => box(k) + ' [data-sbp="' + id + '"]' + (also ? '[data-sbalso]' : ':not([data-sbalso])');
  async function tdrag(page, fromSel, toSel) {
    const a = await center(page, fromSel), b = await center(page, toSel), cdp = await page.context().newCDPSession(page), tp = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(a.x, a.y) });
    for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(a.x + (b.x - a.x) * i / 12, a.y + (b.y - a.y) * i / 12) }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /* --- the mouse, on a computer --- */
  seed();
  const { ctx, page } = await open('boss', 1280);
  await openBoard(page, false);
  let f = await faces(page);
  ok('a Director is on the board once — not in the ministries of their department, nor in any their profile lists, nor where they lead', J(f.di) === J(['Campus Leadership|' + CS + '👑']), J(f.di));
  ok('one solid face at the main job; a dashed one for a second job, and for leading a ministry from another one', J(f.ki.slice().sort()) === J([CS + '|Cafe~', 'Skills Training|Hospitality']) && J(f.lu) === J(['Youth Education|GP Media', 'Youth Education|Worship👑~']) && J(f.le) === J([CS + '|Cafe👑']), J([f.ki, f.lu, f.le]));
  ok('nobody has two solid faces', Object.keys(f).every(id => f[id].filter(k => !/~$/.test(k)).length === 1), J(f));
  await centerOn(page, box(CS + '|Cafe'));
  await drag(page, box(CS + '|Cafe') + ' [data-person="le"]', box(CS + '|LTN')); await page.waitForTimeout(300);
  ok('View: trying to drag a face moves nobody, and says why with a way to Edit', await page.$eval('#sbNudge', n => !n.hidden && /Edit/.test(n.innerText)) && !planOf() && await page.evaluate(() => !S.person));
  await page.click('#sbNudgeEdit'); await page.waitForSelector('#sbTray');
  ok('… “Switch to Edit” is Edit', await page.$('#sbModeEdit.on') !== null && await page.$(face(CS + '|Cafe', 'le')) !== null);
  await page.$eval('#sbView', v => v.scrollIntoView({ block: 'start' })); await page.click('#sbFit'); await centerOn(page, box(CS + '|Ponlork School'));

  await drag(page, face(CS + '|Cafe', 'le'), box(CS + '|LTN')); await page.waitForSelector('#sbDrop');
  const ch = await page.$eval('#sbDrop', e => { const r = e.getBoundingClientRect(); return { text: e.innerText, in: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  ok('a LEADER dragged onto another ministry: a chooser right there — Main job here, Second job here, Cancel', /Lena Lead/.test(ch.text) && /LTN/.test(ch.text) && ch.in && await page.$('#sbDropMain') !== null && await page.$('#sbDropAlso') !== null && await page.$('#sbDropCancel') !== null, ch.text.replace(/\n/g, ' | '));
  ok('… nothing has moved yet', !planOf());
  await page.click('#sbDropCancel'); await page.waitForTimeout(200);
  ok('Cancel leaves them where they were', !(await page.$('#sbDrop')) && !planOf() && await page.$(face(CS + '|Cafe', 'le')) !== null);
  await drag(page, face(CS + '|Cafe', 'le'), box(CS + '|LTN')); await page.waitForSelector('#sbDropMain'); await page.click('#sbDropMain'); await settle(page);
  f = await faces(page);
  ok('Main job here: the leader lands in the new ministry — and no longer leads, or shows in, the old one', planOf().place.le.ministry === 'LTN' && !planOf().leads[CS + '|Cafe'] && J(f.le) === J([CS + '|LTN']), J([planOf().place.le, planOf().leads, f.le]));

  await drag(page, face(CS + '|Cafe', 'ra'), box(CS + '|LTN') + ' .sbFace'); await page.waitForSelector('#sbDropAlso'); await page.click('#sbDropAlso'); await settle(page);
  f = await faces(page);
  ok('let go over a face inside the box still lands; Second job here keeps the main job and adds a dashed face', planOf().place.ra.ministry === 'Cafe' && J(planOf().also.ra) === J([CS + '|LTN']) && J(f.ra) === J([CS + '|Cafe', CS + '|LTN~']), J(f.ra));
  await drag(page, face(CS + '|LTN', 'ra', true), box(CS + '|Sry Noi')); await settle(page);
  f = await faces(page);
  ok('the dashed face dragged to another ministry moves THAT second job — the main job stays, no question asked', !(await page.$('#sbDrop')) && planOf().place.ra.ministry === 'Cafe' && J(planOf().also.ra) === J([CS + '|Sry Noi']) && J(f.ra) === J([CS + '|Cafe', CS + '|Sry Noi~']), J(f.ra));
  await drag(page, face(CS + '|Sry Noi', 'ra', true), '#sbTray'); await settle(page);
  ok('the dashed face dropped on the row of faces takes the second job off, not the person', planOf().place.ra.ministry === 'Cafe' && !planOf().also.ra && J((await faces(page)).ra) === J([CS + '|Cafe']));

  await page.click('#sbFit'); await centerOn(page, box(CS + '|Cafe'));
  await drag(page, face('Campus Leadership|' + CS, 'di'), box(CS + '|Cafe')); await page.waitForSelector('#sbDrop');
  ok('a DIRECTOR dragged onto a ministry they oversee: main job only, and it says why there is no second job', await page.$('#sbDropMain') !== null && !(await page.$('#sbDropAlso')) && /already oversee/.test(await page.$eval('#sbDropWhy', e => e.textContent)));
  await page.click('#sbDropMain'); await settle(page);
  f = await faces(page);
  ok('… and the Director lands in it, once', planOf().place.di.dept === CS && planOf().place.di.ministry === 'Cafe' && J(f.di.filter(k => k.indexOf(CS + '|Cafe') === 0)) === J([CS + '|Cafe']) && f.di.every(k => k.indexOf('Campus Leadership') !== 0), J(f.di));
  await drag(page, face(CS + '|Cafe', 'di'), box('Campus Leadership|' + CS)); await settle(page);
  f = await faces(page);
  ok('dragged back onto the Director spot they land there with no question, and are out of the ministries again', !(await page.$('#sbDrop')) && planOf().place.di.dept === 'Campus Leadership' && f.di.filter(k => k.indexOf('Campus Leadership|') === 0).length === 1 && f.di.every(k => k.indexOf(CS + '|') !== 0), J(f.di));

  await drag(page, face('Skills Training|Culinary', 'ne'), box('Campus Leadership|Skills Training')); await page.waitForTimeout(500);
  ok('into Campus Leadership by someone who is not an admin: it says, at the drop, that the profile waits for an admin', /admin says yes/.test(await toast(page)) && /Ned Orr/.test(await toast(page)), await toast(page));
  ok('… and the face carries a waiting tag', await page.$(box('Campus Leadership|Skills Training') + ' [data-sbwait="ne"]') !== null);
  await settle(page);

  /* from the row of faces, towards a box more to the side than up (this never left the row before) */
  await page.click('#sbFit'); await page.waitForTimeout(150);
  const a = await center(page, '#sbTrayFaces [data-sbp="ra"]');
  const side = await page.evaluate((a) => { let best = null; document.querySelectorAll('#sbTree .sbMin').forEach(b => { const r = b.getBoundingClientRect(), dx = Math.abs(r.left + r.width / 2 - a.x), dy = Math.abs(r.top + r.height / 2 - a.y); if (dx > dy * 1.5 && b.getAttribute('data-sbdrop') !== 'Community Service|Cafe' && (!best || dx > best.dx)) best = { k: b.getAttribute('data-sbdrop'), dx }; }); return best && best.k; }, a);
  if (side) {
    const b = await center(page, box(side));
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 15 }); await page.mouse.up(); await page.waitForTimeout(300);
    ok('a face dragged from the row towards a box off to the side is picked up and lands (the chooser comes up)', await page.$('#sbDrop') !== null, side);
    await page.click('#sbDropCancel');
  } else ok('(no box off to the side at this size — skipped)', true);
  await drag(page, face(CS + '|Cafe', 'ra'), '.sbRoot'); await page.waitForTimeout(250);
  ok('let go on nothing: it says where a face can go', /Let go on a ministry/.test(await toast(page)), await toast(page));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/sb-jobs.png' });

  /* Team → Structure's list, the same quarter */
  await page.evaluate((n) => { S.view = 'team'; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.structYear = n.year; S.structQ = n.q; S.structCache = {}; S.sbTeam = false; render(); }, NEXT);
  await page.waitForSelector('.orgChart', { timeout: 8000 }); await page.waitForTimeout(300);
  const lst = await page.evaluate(() => { const o = {}; document.querySelectorAll('.orgChart [data-orgmin]').forEach(m => { o[m.getAttribute('data-orgmin')] = m.innerText.replace(/\s+/g, ' '); }); return o; });
  ok('Team → Structure: the Director is in none of their department’s ministries', Object.keys(lst).filter(k => k.indexOf(CS + '|') === 0).every(k => !/Dana/.test(lst[k])) && /Dana Direct/.test(await page.$eval('[data-orgbox="' + CS + '"]', e => e.innerText)), J(lst[CS + '|Cafe']));
  ok('… and someone leading a ministry from another one is there once each: main, and “also” with the crown', /Luke Moss/.test(lst['Youth Education|GP Media']) && /👑 Luke Moss/.test(lst['Youth Education|Worship']) && await page.$('[data-orgmin="Youth Education|Worship"] .orgPerson.also') !== null && !/👑/.test(lst['Youth Education|GP Media']), J([lst['Youth Education|GP Media'], lst['Youth Education|Worship']]));
  await ctx.close();

  /* --- a finger, on a phone; and a live quarter --- */
  seed();
  const yq = [now.getUTCFullYear(), cq];
  const post = async (fn, args) => (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json();
  const place0 = {}; mem.staff.forEach(s => { place0[s.id] = { dept: s.dept, ministry: s.ministry }; });
  await post('saveStructurePlan', ['boss', '1234', 'siemreap', yq[0], yq[1], {}, place0, { [CS + '|Cafe']: ['le'] }, [], null, {}]);
  const lv = await post('applyStructure', ['boss', '1234', 'siemreap', yq[0], yq[1], {}]);
  ok('(this quarter is live for the phone checks; the Director kept every ministry page on their profile)', lv.ok && prof('di').ministries.length === 6, J(lv.ok && prof('di').ministries));
  const ph = await open('boss', 390, true);
  await ph.page.evaluate((q) => { sbState_().year = q[0]; sbState_().q = q[1]; }, yq);
  await openBoard(ph.page);
  const planNow = () => (mem.structurePlans || []).find(r => r.campus === 'siemreap' && Number(r.year) === yq[0] && Number(r.quarter) === yq[1]);
  await centerOn(ph.page, box(CS + '|Ponlork School'));
  await tdrag(ph.page, face(CS + '|Cafe', 'le'), box(CS + '|LTN')); await ph.page.waitForSelector('#sbDrop');
  ok('a finger: the chooser fits the phone', await ph.page.$eval('#sbDrop', e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
  await ph.page.click('#sbDropMain'); await settle(ph.page);
  ok('a finger drags a LEADER to another ministry and they land — live, yet their profile waits for Apply again', planNow().place.le.ministry === 'LTN' && prof('le').ministry === 'Cafe' && !((planNow().leads || {})[CS + '|Cafe'] || []).includes('le') && J((await faces(ph.page)).le) === J([CS + '|LTN']), J([prof('le').ministry, prof('le').leads]));
  await centerOn(ph.page, box(CS + '|Outreach Teams'));
  await tdrag(ph.page, face('Campus Leadership|' + CS, 'di'), box(CS + '|Cafe')); await ph.page.waitForSelector('#sbDropMain'); await ph.page.click('#sbDropMain'); await settle(ph.page);
  ok('a finger drags a DIRECTOR into a ministry and they land', planNow().place.di.ministry === 'Cafe' && prof('di').dept === 'Campus Leadership' && J((await faces(ph.page)).di.filter(k => !/~$/.test(k))) === J([CS + '|Cafe']), J((await faces(ph.page)).di));
  await centerOn(ph.page, box(CS + '|Sry Noi'));
  await tdrag(ph.page, face(CS + '|Cafe', 'ra'), box(CS + '|LTN')); await ph.page.waitForSelector('#sbDropAlso'); await ph.page.click('#sbDropAlso'); await settle(ph.page);
  ok('a finger: Second job here — the plan gets the second ministry, the main one stays, the profile waits', planNow().place.ra.ministry === 'Cafe' && J((planNow().also || {}).ra) === J([CS + '|LTN']) && prof('ra').ministry === 'Cafe' && !(prof('ra').ministries || []).length);
  await ph.page.click('#sbFit'); await ph.page.waitForTimeout(150);
  await tdrag(ph.page, face(CS + '|Cafe', 'ra'), box('Campus Leadership|Skills Training')); await ph.page.waitForTimeout(500);
  const said = await toast(ph.page); await settle(ph.page);
  ok('live, not an admin, into Campus Leadership: said plainly at the drop; the profile has not moved and nothing is asked until Apply again', /admin says yes/.test(said) && prof('ra').dept === CS && !prof('ra').cltRequest && await ph.page.$('[data-sbwait="ra"]') !== null, said);
  ok('… and it is never called “profile is updated”', !/profile is updated/.test(await toast(ph.page)), await toast(ph.page));
  ok('the board fits the phone', await ph.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await ph.ctx.close();
}

/* ---- someone whose job is YWAM GP itself (gpHome): on the campus's staff, on none of its board ---- */
{
  mem.staff.push(mk({ id: 'gw', name: 'Gwen Home', username: 'gwen', email: 'gw@e.com', dept: '', ministry: '', gpHome: true, gpRoles: ['campuses'], gpRole: 'campuses' }));
  const g = await open('boss', 1100);
  await openBoard(g.page);
  ok('the board has no face for her — not in a box, not in the tray', await g.page.$('#sbWrap [data-sbp="gw"], #sbWrap [data-person="gw"]') === null && await g.page.$('#sbTray') !== null);
  ok('… and she is not counted as “not on the chart yet”', !/Gwen/.test(await g.page.$eval('#sbTray', e => e.innerText)));
  ok('one quiet line under the board says she lives here and works for YWAM GP', /YWAM GP team living here/.test(await g.page.$eval('[data-orggphere="siemreap"]', e => e.innerText)) && /Gwen Home/.test(await g.page.$eval('[data-orggphere="siemreap"]', e => e.innerText)));
  await g.page.evaluate(() => { S.view = 'team'; S.person = null; S.teamMode = 'org'; S.teamCampus = 'siemreap'; S.sbTeam = false; render(); }); await g.page.waitForTimeout(900);
  const chart = await g.page.$eval('#main', e => e.innerText);
  ok('Team → Structure’s list: not in a box, never “Not placed yet”', await g.page.$('.orgChart [data-person="gw"]') === null && !/Not placed yet/.test(chart) && /YWAM GP team living here:\s*Gwen Home/.test(chart), chart.slice(-260).replace(/\n/g, ' | '));
  await g.page.click('[data-gogpchart]'); await g.page.waitForTimeout(700);
  ok('… and the line opens the YWAM GP chart, where she is', await g.page.evaluate(() => S.teamCampus === 'ywamgp' && S.teamMode === 'org') && /Gwen Home/.test(await g.page.$eval('.orgGpChart', e => e.innerText)) && /lives in Siem Reap/.test(await g.page.$eval('.orgGpChart', e => e.innerText)));
  await g.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
