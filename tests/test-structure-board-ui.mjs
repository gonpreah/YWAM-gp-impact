/* The structure whiteboard (teams/23-structure.js, Nov 2026, Andrew): Campus Leadership arranges a quarter on My Ministry →
   Structure — a tree to pan and zoom, faces to drag from the tray onto a ministry, ＋ to add people or a typed-in name, a tap
   to make someone the leader or move them — saved for that quarter only, never into a profile; Team → Structure shows it,
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
const openBoard = async (page) => { await page.evaluate(() => { S.view = 'ministry'; S.lwTab = 'struct'; render(); }); await page.waitForSelector('#sbWrap', { timeout: 8000 }); await page.waitForTimeout(400); await page.$eval('#sbView', v => v.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); };
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

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
