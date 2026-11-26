/* YWAM GP on the page (Oct 2026): Campus Leadership titles on My Ministry and the
   org chart, the YWAM GP page (GP leadership, both campuses' leadership teams, the
   advisory board and how to reach them), Admin → Advisory Board, and a board
   member's own board-only sign-in. Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('gp-ui');
const OUT = tmpDir('gp-ui-out');
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
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, cdKind: 'international', gpRole: 'director',
    gstrengths: { top: ['hardworker', 'coordinator', 'valuesdriven', 'fairminded', 'careful'] }, personality: { type: 'ENFJ' } }),
  mk({ id: 'st2', name: 'Sokha Chan', username: 'sokha', email: 's@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national' }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st4', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com', dept: 'Community Service', ministry: 'Cafe', leads: ['Community Service|Cafe'],
    gstrengths: { top: ['careful', 'coordinator', 'hardworker', 'fairminded', 'valuesdriven'] }, personality: { type: 'ISTJ' } })
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', email: 'mary@board.org', phone: '+855 12 345 678', bio: 'A pastor in Phnom Penh who has walked with YWAM for twenty years.', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true, safeguarding: true },
  { id: 'bd2', name: '', role: 'Advisor', staffId: 'st1', active: true }];
/* figures for the quarter report: three check-ins and some salvations this quarter, fewer the quarter before */
const YR = new Date().getFullYear();
const WK = (() => { const d = new Date(), j = new Date(YR, 0, 1); const m = new Date(YR, 0, 1 - ((j.getDay() + 6) % 7)); return Math.max(1, Math.min(52, Math.floor((d - m) / (7 * 86400000)) + 1)); })();
const srow = (id) => ({ campus: 'siemreap', week: WK, year: YR, device: 'tok_' + id, lonely: 2, clarity: 8, porn: 0, oneOnOne: 1, exercise: 1, quietTime: 1, debt: 0 });
mem.survey = [srow('st1'), srow('st2'), srow('st3')];
mem.entries = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Salvations', week: WK, year: YR, value: 5, updated: '' },
  { campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Salvations', week: Math.max(1, WK - 13), year: YR, value: 2, updated: '' }];
/* the quarter's rocks (they replaced the objectives): the board's report lists them with where each stands — never a note */
mem.rocks = { seeded: 'test', rocks: [{ id: 'k1', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', owner: '', year: YR, q: Math.min(3, Math.floor((WK - 1) / 13)) + 1, title: 'Open the second cafe', status: 'off', note: 'A note only staff read', by: '', at: '', updated: '' }] };
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

/* ---------- 1. My Ministry, Campus Leadership: your title and your team ---------- */
{
  const { ctx, page } = await open('sokha');
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(500);
  const txt = await main(page);
  ok('My Ministry says your role: National Campus Director', /Your role: National Campus Director/.test(txt), txt.slice(0, 200));
  await page.click('[data-lwtab="base"]'); await page.waitForTimeout(400);
  const ov = await main(page);
  ok('… and its Overview tab shows the campus leadership team with every title', /Your role: National Campus Director/.test(ov) && /Campus Leadership Team/i.test(ov) && /International Campus Director/.test(ov) && /Director of Community Service/.test(ov));
  await page.screenshot({ path: OUT + '/my-ministry.png', fullPage: true });
  /* org chart */
  await page.evaluate(() => { S.view = 'team'; S.teamMode = 'org'; render(); }); await page.waitForTimeout(500);
  const org = await main(page);
  await page.click('[data-teamcampus="ywamgp"]'); await page.waitForTimeout(400);
  const gp = await main(page);
  ok('Structure → YWAM GP: the Advisory Board, the YWAM GP team with every place, and both campuses\' leadership teams',
    /Advisory Board/.test(gp) && /Mary Board/.test(gp) && /President/.test(gp) && /YWAM GP Leadership Team/.test(gp) && /YWAM GP Director/.test(gp) &&
    /Education Lead/.test(gp) && /Not filled yet/.test(gp) && /YWAM Poipet/.test(gp) && /YWAM Siem Reap/.test(gp) && /International Campus Director/.test(gp) && /National Campus Director/.test(gp));
  ok('… someone with several roles is in each box: Uriah as board Advisor, YWAM GP Director and International Campus Director',
    (gp.match(/Uriah Lyford/g) || []).length === 3);
  await page.screenshot({ path: OUT + '/structure-ywamgp.png', fullPage: true });
  await page.click('.orgOpenCampus[data-teamcampus="siemreap"]'); await page.waitForTimeout(400);
  const org0 = await main(page);
  ok('… and a campus box opens that campus\'s own chart', /Department directors/i.test(org0) && await page.evaluate(() => S.teamCampus === 'siemreap'));
  ok('the org chart names them too: Campus Directors, International / National, department directors', /Campus Directors/i.test(org) && /International Campus Director/.test(org) && /Department directors/i.test(org) && /Director of Community Service/.test(org) && !/Overseen by|overseers/i.test(org));
  await ctx.close();
}

/* ---------- 1b. YWAM GP and the board as teams: Directory, Strengths, Personalities ---------- */
{
  const { ctx, page } = await open('kanha', { small: true });
  await page.evaluate(() => { S.view = 'team'; S.teamMode = 'dir'; S.teamCampus = null; render(); }); await page.waitForTimeout(500);
  ok('every Team view has YWAM GP and Board next to the campuses', !!(await page.$('[data-teamcampus="ywamgp"]')) && !!(await page.$('[data-teamcampus="board"]')));
  await page.click('[data-teamcampus="ywamgp"]'); await page.waitForTimeout(400);
  let txt = await main(page);
  ok('Directory → YWAM GP: each place on the leadership team and who holds it', /YWAM GP Leadership Team/.test(txt) && /YWAM GP Director/.test(txt) && /Uriah Lyford/.test(txt) && /Education Lead/.test(txt) && /Not filled yet/i.test(txt) && !/Kanha/.test(txt));
  ok('… and the 4 buttons fit a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.screenshot({ path: OUT + '/directory-ywamgp.png', fullPage: true });
  await page.click('[data-teamcampus="board"]'); await page.waitForTimeout(400);
  txt = await main(page);
  ok('Directory → Board: the board, how to reach them, and the safeguarding contacts', /Mary Board/.test(txt) && /President/i.test(txt) && !!(await page.$('#orgConcern')) && !/Kanha/.test(txt));
  await page.click('[data-teammode="str"]'); await page.waitForTimeout(400);
  txt = await main(page);
  await page.screenshot({ path: OUT + '/strengths-board.png', fullPage: true });
  ok('Strengths → Board: only board members on staff (Uriah), with a note why', /Uriah/.test(txt) && !/Kanha/.test(txt) && /also on staff/.test(txt));
  await page.click('[data-teamcampus="ywamgp"]'); await page.waitForTimeout(400);
  txt = await main(page);
  ok('Strengths → YWAM GP: the leadership team\'s Top 5s', /1 people have shared their Top 5/.test(txt) && /Uriah/.test(txt) && !/Kanha/.test(txt));
  await page.click('[data-teammode="pers"]'); await page.waitForTimeout(400);
  txt = await main(page);
  await page.screenshot({ path: OUT + '/personalities-ywamgp.png', fullPage: true });
  ok('Personalities → YWAM GP: the team\'s types, with no campus team picker', /ENFJ/.test(txt) && !/ISTJ ·/.test(txt) && /1 of 1 people/.test(txt) && !(await page.$('#teamPScope')));
  await page.click('[data-teamcampus="siemreap"]'); await page.waitForTimeout(400);
  txt = await main(page);
  ok('… and a campus is as before, with its picker', /ISTJ/.test(txt) && !!(await page.$('#teamPScope')));
  await page.click('[data-teammode="org"]'); await page.click('[data-teamcampus="board"]'); await page.waitForTimeout(400);
  ok('Structure → Board shows the board', /Mary Board/.test(await main(page)));
  await ctx.close();
}

/* ---------- 1c. Campus Leadership picks its own title in the profile ---------- */
{
  const { ctx, page } = await open('dara');
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(600);
  const opts = await page.$$eval('#p_ministry option', (o) => o.map((x) => x.value + '=' + x.textContent));
  ok('the Main ministry list for Campus Leadership is titles: International / National Campus Director, Director of each department',
    opts.some((o) => o === 'Campus Director#international=International Campus Director') && opts.some((o) => o === 'Campus Director#national=National Campus Director') &&
    opts.some((o) => o === 'Community Service=Director of Community Service') && !opts.some((o) => /=Campus Director$/.test(o)), opts.join(' | '));
  ok('… with their own title chosen', await page.$eval('#p_ministry', (e) => e.value) === 'Community Service');
  await page.selectOption('#p_ministry', 'Campus Director#national');
  await page.click('#saveProfBtn'); await page.waitForTimeout(900);
  const d = mem.staff.find((r) => r.id === 'st3');
  ok('choosing National Campus Director saves it', d.ministry === 'Campus Director' && d.cdKind === 'national', d.ministry + '/' + d.cdKind);
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(600);
  ok('… and the profile shows it next time', await page.$eval('#p_ministry', (e) => e.value) === 'Campus Director#national');
  await page.selectOption('#p_ministry', 'Community Service');
  await page.click('#saveProfBtn'); await page.waitForTimeout(900);
  const d2 = mem.staff.find((r) => r.id === 'st3');
  ok('… and back to Director of Community Service', d2.ministry === 'Community Service' && !d2.cdKind, d2.ministry + '/' + d2.cdKind);
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(400);
  await page.selectOption('#p_dept', 'Community Service'); await page.waitForTimeout(200);
  const other = await page.$$eval('#p_ministry option', (o) => o.map((x) => x.value));
  ok('another department still lists its ministries', other.indexOf('Cafe') > -1 && !other.some((v) => v.indexOf('#') > -1));
  await ctx.close();
}

/* ---------- 1d. moving yourself into Campus Leadership waits for an admin ---------- */
{
  const { ctx, page } = await open('kanha');
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(500);
  await page.selectOption('#p_dept', 'Campus Leadership'); await page.waitForTimeout(200);
  await page.selectOption('#p_ministry', 'Community Service');
  await page.click('#saveProfBtn'); await page.waitForTimeout(900);
  let k = mem.staff.find((r) => r.id === 'st4');
  ok('a staff member choosing Campus Leadership is not moved yet', k.dept === 'Community Service' && k.cltRequest && k.cltRequest.ministry === 'Community Service');
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(400);
  ok('… their profile says it is waiting for an admin, as Director of Community Service', /waiting for an admin/.test(await main(page)) && /Director of Community Service/.test(await page.$eval('#cltWaiting', (e) => e.textContent)));
  await ctx.close();
  const a = await open('uriah');
  await a.page.evaluate(() => { S.view = 'admin'; S.adminSub = 'approvals'; render(); }); await a.page.waitForTimeout(900);
  ok('Admin → Approvals lists the move', /Moving into Campus Leadership/.test(await main(a.page)) && /Kanha Lim/.test(await main(a.page)));
  await a.page.screenshot({ path: OUT + '/approvals.png', fullPage: true });
  await a.page.click('[data-cltyes="st4"]'); await a.page.waitForTimeout(900);
  k = mem.staff.find((r) => r.id === 'st4');
  ok('… and approving moves them', k.dept === 'Campus Leadership' && k.ministry === 'Community Service' && !k.cltRequest);
  await a.ctx.close();
  await api.default({ method: 'POST', json: async () => ({ fn: 'adminUpdateStaff', args: ['uriah', '1234', 'st4', { dept: 'Community Service', ministry: 'Cafe' }] }), headers: new Map() }, {});
}

/* ---------- 2. the YWAM GP page: GP leadership, both campuses, the board and how to reach them ---------- */
{
  const { ctx, page } = await open('kanha');
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  await page.click('[data-menu-item="ywamgp"]'); await page.waitForTimeout(500);
  const txt = await main(page);
  ok('every staff member has a YWAM GP page in the menu', /YWAM GP leadership/i.test(txt) && /GP Director/.test(txt));
  ok('… with each campus\'s leadership team', /Campus leadership teams/i.test(txt) && /National Campus Director/.test(txt));
  ok('… and the advisory board: role, bio, and a way to reach each one',
    /YWAM GP Advisory Board/i.test(txt) && /Mary Board/.test(txt) && /President/i.test(txt) && /pastor in Phnom Penh/.test(txt) &&
    !!(await page.$('a[href="mailto:mary%40board.org"]')) && !!(await page.$('a[href^="tel:+85512345678"]')));
  ok('a staff member on the board shows with their own name and photo', /Uriah Lyford/.test(txt.slice(txt.search(/Advisory Board/i))));
  const all = await page.getAttribute('#orgEmailBoard', 'href');
  ok('"Email the whole board" goes to everyone on it', /mary%40board\.org/.test(all) && /u%40e\.com/.test(all));
  const concern = await page.getAttribute('#orgConcern', 'href');
  ok('a serious concern goes only to the safeguarding contacts — not to a board member who is a staff leader', /mary%40board\.org/.test(concern) && !/u%40e\.com/.test(concern) && /raise something serious/.test(txt) && /Safeguarding contact/.test(txt));
  ok('the YWAM GP team shows every place: its Director, and the areas not filled yet', /YWAM GP Director/.test(txt) && /Education Lead/.test(txt) && /Not filled yet/.test(txt));
  await page.screenshot({ path: OUT + '/ywam-gp.png', fullPage: true });
  await page.click('[data-safeguide]'); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined', null, { timeout: 15000 }); await page.waitForTimeout(400);
  ok('the concern card opens the Library\'s safeguarding guide', await page.evaluate(() => S.view === 'library' && S.libBook === 'keeping-each-other-safe') && /Keeping Each Other Safe/.test(await main(page)));
  await page.evaluate(() => { S.view = 'ywamgp'; S.libBook = null; render(); }); await page.waitForTimeout(300);
  await page.click('[data-orgperson="st3"]'); await page.waitForTimeout(600);
  ok('tapping a leader opens their page, with their title', /Director of Community Service/.test(await main(page)) && await page.evaluate(() => S.view === 'team' && !!S.person));
  await ctx.close();
}

/* ---------- 3. an admin adds a board member ---------- */
{
  const { ctx, page } = await open('uriah');
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForTimeout(400);
  ok('an admin is told on the YWAM GP page how many places are empty', /5 places on the YWAM GP Leadership Team are not filled yet/.test(await main(page)));
  await page.click('[data-adminsubgo="loose"]'); await page.waitForTimeout(1200);
  const loose = await main(page);
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForTimeout(300);
  await page.click('#orgReport'); await page.waitForTimeout(500);
  ok('Campus Leadership and admins open the board\'s report from the YWAM GP page', await page.evaluate(() => S.view === 'report') && /report/.test(await main(page)));
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'loose'; render(); }); await page.waitForTimeout(900);
  ok('… and Loose ends lists them under the YWAM GP structure', /The YWAM GP structure isn’t filled in/.test(loose) && /Education Lead/.test(loose) && !/YWAM GP Director\s*nobody yet/.test(loose));
  await page.evaluate(() => { const x = S.adminStaff.find((p) => p.id === 'st2'); x.cdKind = ''; render(); }); await page.waitForTimeout(300);
  ok('… and a Campus Director with no International / National chosen', /International or National not chosen yet/.test(await main(page)) && /Sokha Chan/.test(await main(page)));
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'board'; render(); }); await page.waitForTimeout(900);
  ok('Admin → Advisory Board lists the board', /Mary Board/.test(await main(page)) && /signs in as mary/.test(await main(page)));
  await page.click('#bdAdd'); await page.waitForTimeout(200);
  await page.fill('#bd_name', 'Tom Treasurer'); await page.fill('#bd_role', 'Treasurer'); await page.fill('#bd_email', 'tom@board.org');
  await page.fill('#bd_bio', 'Accountant.'); await page.fill('#bd_user', 'tom'); await page.fill('#bd_pin', '2468');
  await page.click('#bdSave'); await page.waitForTimeout(600);
  const tom = (mem.board || []).find((b) => b.name === 'Tom Treasurer');
  ok('… and adds one, with their own sign-in', tom && tom.role === 'Treasurer' && tom.username === 'tom' && !!tom.pinHash);
  await ctx.close();
}

/* ---------- 4. a board member signs in: a board-only app ---------- */
{
  const { ctx, page } = await open('', { small: true });
  await page.fill('#li_user', 'mary'); await page.fill('#li_pin', '4321');
  await page.click('#loginBtn'); await page.waitForTimeout(1500);
  const tabs = await page.$$eval('nav.bottom button', (b) => b.map((x) => x.textContent.trim()));
  /* Nov 2026 (the Advisory Board's oversight, teams/30-boardroom.js): the bar is Overview · Campuses · Finances · Board room · Report;
     the YWAM GP page and the campus page with the public base figures moved to ☰ (YWAM GP, Base). The checks below are the same, reached from there. */
  ok('a board member signs in on the same screen and gets their own app: Overview · Campuses · Finances · Board room · Report', tabs.join('|') === 'Overview|Campuses|Finances|Board room|Report', tabs.join('|'));
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  const menuItems = await page.$$eval('[data-menu-item]', (b) => b.map((x) => x.getAttribute('data-menu-item')).join());
  ok('… with YWAM GP, Base and the Library in ☰', menuItems === 'bdhub,ywamgp,base,qreport,p360,library,boardlogout', menuItems);
  await page.click('[data-menu-item="ywamgp"]'); await page.waitForTimeout(500);
  let txt = await main(page);
  ok('… welcomed by name and role', /Welcome, Mary Board/.test(txt) && /President/i.test(txt));
  ok('… with no staff sign-in behind it', await page.evaluate(() => !S.auth.user && S.board && S.guest));
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  await page.click('[data-menu-item="base"]'); await page.waitForTimeout(800);
  txt = await main(page);
  ok('Campuses: each campus\'s leadership, departments with their directors and ministry leaders', /Campus Leadership Team/i.test(txt) && /Departments/i.test(txt) && /Director: Dara Sok/.test(txt) && /Cafe · Kanha Lim/.test(txt));
  ok('… without the staff-only prompt to fill in a profile', !/Add it to my profile/.test(txt));
  ok('… and nobody in it can be opened — no staff pages', !(await page.$('[data-orgperson]')) && !(await page.$('[data-person]')));
  ok('the board view fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.click('nav.bottom [data-tab="report"]'); await page.waitForTimeout(700);
  const rep = await main(page);
  ok('Report: the quarter for YWAM GP and each campus — staff, health from 3+ check-ins, salvations against last quarter, the quarter’s rocks with where each stands (title and status, no note)',
    /Q\d \d{4} report/.test(rep) && /YWAM Poipet/.test(rep) && /YWAM Siem Reap/.test(rep) && /3 check-ins/.test(rep) && /needs 3 check-ins or more/.test(rep) && /Salvations\n5\nQ\d: \d/.test(rep) && /Rocks for Q\d/i.test(rep) && /Open the second cafe/.test(rep) && /Off track/.test(rep) && !/A note only staff read/.test(rep) && !/[Oo]bjective|OKR/.test(rep) && /Dara Sok/.test(rep), rep.slice(0, 400).replace(/\n/g, ' / '));
  ok('… with Print or save as PDF, and it fits the phone too', !!(await page.$('#repPrint')) && await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.screenshot({ path: OUT + '/board-report.png', fullPage: true });
  await page.screenshot({ path: OUT + '/board-campus.png', fullPage: true });
  await page.reload(); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(1200);
  ok('opening the app again keeps them signed in', await page.evaluate(() => !!S.board));
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  await page.click('[data-menu-item="boardlogout"]'); await page.waitForTimeout(500);
  ok('… until they log out', !!(await page.$('#loginBtn')) && await page.evaluate(() => !localStorage.getItem('gp-board')));
  await ctx.close();
}

/* ---------- 5. a staff member's wrong PIN still just says so ---------- */
{
  const { ctx, page } = await open('');
  await page.fill('#li_user', 'kanha'); await page.fill('#li_pin', '9999');
  await page.click('#loginBtn'); await page.waitForTimeout(1200);
  ok('a wrong staff PIN: no board sign-in, the usual message', await page.evaluate(() => !S.board && !S.me) && !!(await page.$('#loginBtn')));
  await ctx.close();
}

/* ---------- 6. in Khmer ---------- */
{
  const { ctx, page } = await open('kanha', { km: true });
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForTimeout(400);
  const txt = await main(page);
  ok('the titles are Khmer too', /នាយកមូលដ្ឋានអន្តរជាតិ/.test(txt) && /ក្រុមប្រឹក្សាយោបល់/.test(txt));
  await ctx.close();
}

/* ---------- several positions for one person: set together, seen together (Oct 2026) ---------- */
{
  const { ctx, page } = await open('uriah');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'person'; S.adminPersonId = 'st1'; S.adminStaff = null; render(); }); await page.waitForTimeout(1200);
  await page.click('[data-adminedit="st1"]'); await page.waitForTimeout(400);
  ok('a person\'s account has one Positions box: YWAM GP places to tick, and the Advisory Board', !!(await page.$('.admPositions')) && (await page.$$('[data-admgp]')).length === 6 &&
    await page.$eval('[data-admgp="director"]', (e) => e.checked) && await page.$eval('#adm_board', (e) => e.checked) && await page.$eval('#adm_boardrole', (e) => e.value) === 'Advisor');
  await page.check('[data-admgp="campuses"]'); await page.selectOption('#adm_boardrole', 'President');
  await page.evaluate(() => render()); await page.waitForTimeout(300);
  ok('… ticks survive a redraw while editing', await page.$eval('[data-admgp="campuses"]', (e) => e.checked) && await page.$eval('#adm_boardrole', (e) => e.value) === 'President');
  await (await page.$('.admPositions')).screenshot({ path: OUT + '/positions-admin.png' });
  await page.click('[data-adminsave="st1"]'); await page.waitForTimeout(1200);
  const me = mem.staff.find((x) => x.id === 'st1');
  ok('saved: two YWAM GP places and the board seat, on the one account', (me.gpRoles || []).join() === 'director,campuses' && mem.board.filter((b) => b.staffId === 'st1').length === 1 && mem.board.find((b) => b.staffId === 'st1').role === 'President');
  await page.evaluate(() => new Promise((res) => run('getYwamGp', [S.auth.user, S.auth.pin], (d) => { S.org = d; res(); })));
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(500);
  const pos = await page.$eval('.myPos', (e) => e.parentElement.innerText).catch(() => '');
  ok('Profile & settings → My positions lists every one', /International Campus Director/.test(pos) && /YWAM GP Director/.test(pos) && /Campuses Lead/.test(pos) && /President/.test(pos) && /Advisory Board/.test(pos), pos.replace(/\n/g, ' | '));
  await (await page.$('.myPos')).evaluateHandle((e) => e.parentElement).then((h) => h.asElement().screenshot({ path: OUT + '/positions-profile.png' }));
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForTimeout(500);
  const gpt = await main(page);
  ok('the YWAM GP page has them in each place they hold', (gpt.match(/Uriah Lyford/g) || []).length >= 3);
  await ctx.close();
}

/* ---------- YWAM GP's own job titles, and a job in YWAM GP itself (Nov 2026) ---------- */
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
let NM = '';
{
  const { ctx, page } = await open('uriah');
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForSelector('#gpRolesAdmin');
  ok('admins get “YWAM GP job titles” on the YWAM GP page', /YWAM GP job titles/i.test(await page.$eval('#gpRolesAdmin', e => e.innerText)) && await page.$('#gprAdd') !== null);
  await page.click('#gprAdd'); await page.waitForTimeout(300);
  ok('an empty title is not added', !mem.gpRolesCustom);
  await page.fill('#gprEn', 'New Ministries Lead'); await page.fill('#gprKm', 'អ្នកដឹកនាំកិច្ចការបម្រើថ្មី');
  await page.evaluate(() => render()); await page.waitForTimeout(200);
  ok('what is typed survives a redraw', await page.$eval('#gprEn', e => e.value) === 'New Ministries Lead');
  await page.click('#gprAdd'); await page.waitForFunction(() => document.querySelectorAll('[data-gprrow]').length === 1, null, { timeout: 8000 });
  NM = mem.gpRolesCustom[0].id;
  ok('an admin adds a job title', mem.gpRolesCustom.length === 1 && mem.gpRolesCustom[0].en === 'New Ministries Lead' && NM === 'c_new_ministries_lead');
  let txt = await main(page);
  ok('… it is a place on the YWAM GP team at once, “Not filled yet”', /New Ministries Lead/.test(txt) && await page.$eval('#gprEn', e => e.value) === '');
  await page.fill('#gprEn', 'Temp Title'); await page.click('#gprAdd'); await page.waitForFunction(() => document.querySelectorAll('[data-gprrow]').length === 2, null, { timeout: 8000 });
  const tmp = mem.gpRolesCustom[1].id;
  await page.click('[data-gprolename="' + tmp + '"]'); await page.waitForSelector('#gprEditEn');
  await page.fill('#gprEditEn', 'Ministry Growth Lead'); await page.click('#gprEditSave'); await page.waitForFunction(() => !document.getElementById('gprEditEn'), null, { timeout: 8000 });
  ok('… renames one', mem.gpRolesCustom[1].en === 'Ministry Growth Lead' && mem.gpRolesCustom[1].id === tmp && /Ministry Growth Lead/.test(await main(page)));
  await page.click('[data-gproledel="' + tmp + '"]'); await page.waitForFunction(() => document.querySelectorAll('[data-gprrow]').length === 1, null, { timeout: 8000 });
  ok('… and removes one', mem.gpRolesCustom.length === 1 && !/Ministry Growth Lead/.test(await main(page)));
  await (await page.$('#gpRolesAdmin')).screenshot({ path: OUT + '/gp-job-titles.png' });

  /* Admin → Sokha → Positions */
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'person'; S.adminPersonId = 'st2'; S.adminStaff = null; render(); }); await page.waitForTimeout(1200);
  await page.click('[data-adminedit="st2"]'); await page.waitForTimeout(400);
  ok('Positions offers the new title beside the six built in', (await page.$$('[data-admgp]')).length === 7 && /New Ministries Lead/.test(await page.$eval('.admGpPick', e => e.innerText)));
  ok('… and “Works for YWAM GP (not in a campus ministry)”, unticked, the campus job showing', /Works for YWAM GP \(not in a campus ministry\)/.test(await page.$eval('.admPositions', e => e.innerText)) && !(await page.$eval('#adm_gphome', e => e.checked)) && await page.isVisible('#adm_dept'));
  await page.check('#adm_gphome'); await page.waitForTimeout(300);
  ok('ticked, the campus job folds away (department, ministry, which director, leader of)', !(await page.isVisible('#adm_dept')) && !(await page.isVisible('#adm_cdkind')) && !(await page.isVisible('#adm_leads')) && await page.$eval('#adm_gphome', e => e.checked));
  await page.click('[data-adminsave="st2"]'); await page.waitForTimeout(600);
  ok('… it needs a YWAM GP role: said, and nothing saved', /at least one YWAM GP role/.test(await page.evaluate(() => (document.getElementById('msg') || document.querySelector('.toast,.msg') || {}).innerText || document.body.innerText)) && !mem.staff.find(x => x.id === 'st2').gpHome);
  await page.check('[data-admgp="' + NM + '"]');
  await (await page.$('.admPositions')).screenshot({ path: OUT + '/positions-gphome.png' });
  await page.click('[data-adminsave="st2"]'); await page.waitForFunction(() => !document.querySelector('[data-adminsave]'), null, { timeout: 8000 });
  const so = mem.staff.find(x => x.id === 'st2');
  ok('saved: Sokha works for YWAM GP — no campus department or ministry, still on Siem Reap', so.gpHome === true && so.dept === '' && so.ministry === '' && so.campus === 'siemreap' && so.gpRoles.join() === NM && so.gpWas.ministry === 'Campus Director');
  ok('… his account says so where the ministry stood', /YWAM GP · New Ministries Lead/.test(await main(page)), (await main(page)).slice(0, 200).replace(/\n/g, ' | '));
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'loose'; S.adminLoose = null; S.adminCampusTab = 'siemreap'; render(); }); await page.waitForTimeout(1300);
  const loose = await main(page);
  ok('Loose ends: the National Campus Director’s seat shows as empty', await page.$('[data-loosecd="national"]') !== null && await page.$('[data-loosecd="international"]') === null);
  ok('… and he is not listed as having no department or ministry', !/Sokha Chan[\s\S]{0,40}no (department|ministry)/.test(loose) && !/no department/.test(loose), loose.slice(0, 300).replace(/\n/g, ' | '));
  /* a new National Campus Director, the usual way */
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'person'; S.adminPersonId = 'st4'; render(); }); await page.waitForTimeout(700);
  await page.click('[data-adminedit="st4"]'); await page.waitForTimeout(400);
  await page.selectOption('#adm_dept', 'Campus Leadership'); await page.waitForTimeout(200);
  await page.selectOption('#adm_ministry', 'Campus Director#national'); await page.waitForTimeout(150);
  ok('picking “National Campus Director” as the ministry sets “which one” with it', await page.$eval('#adm_cdkind', e => e.value) === 'national');
  await page.click('[data-adminsave="st4"]'); await page.waitForFunction(() => !document.querySelector('[data-adminsave]'), null, { timeout: 8000 });
  const ka = mem.staff.find(x => x.id === 'st4');
  ok('the free seat goes to someone else: Kanha is National Campus Director', ka.dept === 'Campus Leadership' && ka.ministry === 'Campus Director' && ka.cdKind === 'national');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'loose'; S.adminLoose = null; S.adminStaff = null; render(); }); await page.waitForTimeout(1400);
  ok('… and Loose ends no longer lists the seat', await page.$('[data-loosecd]') === null);
  await ctx.close();
}
{
  /* a teammate: the charts, the directory, his page */
  const { ctx, page } = await open('dara');
  ok('the staff count on Team still has everyone', /·\s*4\s*staff/.test((await (async () => { await page.evaluate(() => { S.view = 'team'; S.person = null; S.teamMode = 'dir'; S.teamCampus = 'siemreap'; render(); }); await page.waitForTimeout(600); return main(page); })()).replace(/\n/g, ' ')));
  const dir = await page.$eval('#dirGpHome', e => e.innerText).catch(() => '');
  ok('the directory keeps him on Siem Reap, under YWAM GP, with his title', /Sokha Chan/.test(dir) && /New Ministries Lead/.test(dir) && /count in this campus’s staff/i.test(dir), dir.replace(/\n/g, ' | '));
  ok('… and the campus heading counts him', /YWAM Siem Reap\s*·\s*4/.test((await main(page)).replace(/\n/g, ' ')));
  await page.evaluate(() => { S.teamMode = 'org'; S.sbTeam = false; render(); }); await page.waitForTimeout(900);
  const chart = await main(page);
  ok('Structure: he holds no box on the campus chart — one line says he lives here', await page.$('.orgChart [data-person="st2"]') === null && !/Not placed yet/.test(chart) && /YWAM GP team living here:\s*Sokha Chan/.test(chart));
  ok('… and Kanha sits where the National Campus Director sits', await page.$('.orgChart [data-person="st4"]') !== null);
  await page.evaluate(() => { S.teamCampus = 'ywamgp'; render(); }); await page.waitForTimeout(600);
  const gpc = await page.$eval('.orgGpChart', e => e.innerText);
  ok('the YWAM GP chart has him under his title, with where he lives', /Sokha Chan\s*New Ministries Lead · lives in Siem Reap/.test(gpc.replace(/\n+/g, ' ')), gpc.replace(/\n+/g, ' | ').slice(0, 400));
  await page.evaluate(() => { S.teamMode = 'dir'; render(); }); await page.waitForTimeout(500);
  ok('Team → Directory → YWAM GP lists the title and who holds it', await page.$('[data-gprole="' + NM + '"]') !== null && /Sokha Chan\s*lives in Siem Reap/.test((await page.$eval('[data-gprole="' + NM + '"]', e => e.innerText)).replace(/\n+/g, ' ')));
  await page.evaluate(() => { S.view = 'ywamgp'; render(); }); await page.waitForTimeout(500);
  ok('the YWAM GP page too — and no job-title editor for someone who is not an admin', /New Ministries Lead · lives in Siem Reap/.test(await main(page)) && await page.$('#gpRolesAdmin') === null);
  await page.click('[data-orgperson="st2"]'); await page.waitForSelector('#personGpHome');
  ok('his page reads “YWAM GP · New Ministries Lead” where a ministry would be', (await page.$eval('#personGpHome', e => e.innerText)) === 'YWAM GP · New Ministries Lead' && /lives in Siem Reap/.test(await main(page)));
  ok('a teammate has no oversight in the menu', await page.evaluate(() => !gpOverCan_() && !bdCan_()));
  await ctx.close();
}
{
  /* Sokha himself */
  const { ctx, page } = await open('sokha');
  ok('his Home says YWAM GP and his title', /YWAM GP · New Ministries Lead/.test(await main(page)));
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForSelector('#gpMinistry');
  let txt = await main(page);
  ok('My Ministry is YWAM GP’s page: his title, where he lives — no “choose my ministry”', /YWAM GP/.test(txt) && /New Ministries Lead · lives in Siem Reap/.test(await page.$eval('#gpmRoles', e => e.innerText)) && await page.$('#goProfile') === null && await page.$('#mmSwitch') === null);
  ok('… no way into a campus ministry for someone who is not an admin', await page.$('#gpmCampusMin') === null);
  await page.fill('[data-rkadd="gp|YWAM GP|"]', 'Start two new ministries'); await page.press('[data-rkadd="gp|YWAM GP|"]', 'Enter');
  await page.waitForSelector('#gpRocks .lmRock', { timeout: 8000 });
  const rk = () => mem.rocks.rocks.find(r => r.title === 'Start two new ministries');
  ok('he adds a YWAM GP rock', rk() && rk().campus === 'gp' && rk().dept === 'YWAM GP' && rk().owner === 'st2');
  await page.click('#gpRocks [data-rockst="' + rk().id + '|off"]'); await page.waitForTimeout(900);
  ok('… and says where it stands', rk().status === 'off' && await page.$('#gpRocks .lmRock.off') !== null);
  await page.click('[data-gpmtab="tasks"]'); await page.waitForTimeout(1200);
  ok('Tasks is his own GP Tasks', await page.$('#gpMinistry .gtTab[data-gptlist]') !== null, (await main(page)).slice(0, 160).replace(/\n/g, ' | '));
  await (await page.$('#gpMinistry')).screenshot({ path: OUT + '/gp-my-ministry.png' });
  await page.click('#hamb').catch(() => {}); await page.evaluate(() => { S.menuOpen = true; renderMenu(); }); await page.waitForTimeout(300);
  const menu = await page.evaluate(() => (document.getElementById('menu') || document.querySelector('.menu,.drawer') || document.body).innerText);
  ok('☰ has “YWAM GP oversight”, not the Advisory Board', /YWAM GP oversight/.test(menu) && !/Advisory Board/.test(menu) && await page.evaluate(() => gpOverCan_() && bdCan_() && !bdRoomCan_()));
  await page.evaluate(() => { S.menuOpen = false; renderMenu(); gpOverOpen_(); }); await page.waitForSelector('#bdOver', { timeout: 10000 });
  ok('it opens the big picture of both campuses', /YWAM Poipet/.test(await main(page)) && /YWAM Siem Reap/.test(await main(page)));
  ok('… with Overview · Campuses · Finances and no Board room', (await page.$$('[data-bdtab]')).length === 3 && await page.$('[data-bdtab="bdroom"]') === null);
  await page.evaluate(() => { S.view = 'bdroom'; render(); }); await page.waitForTimeout(500);
  ok('… the Board room cannot be opened by its address either', await page.evaluate(() => S.view === 'bdover' && !S.brActive));
  await page.click('[data-bdtab="bdcamp"]'); await page.waitForTimeout(700);
  ok('… the campuses, to read', await page.evaluate(() => S.view === 'bdcamp') && /Campus Leadership|leadership/i.test(await main(page)));
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(600);
  ok('Profile & settings says his job is YWAM GP and asks for no ministry', await page.isVisible('#profGpHome') && !(await page.isVisible('#p_dept')) && !(await page.isVisible('#p_ministry')) && await page.$('#myPosGpHome') !== null);
  await page.click('#saveProfBtn'); await page.waitForTimeout(1200);
  const so = mem.staff.find(x => x.id === 'st2');
  ok('… saving his profile leaves his job where the admin put it', so.gpHome === true && so.dept === '' && so.ministry === '' && await page.evaluate(() => S.me.gpHome === true));
  await ctx.close();
}
{
  /* a 320px phone, in Khmer */
  const { ctx, page } = await open('sokha', { small: true, km: true });
  await page.evaluate(() => { S.view = 'ministry'; S.gpmTab = 'rocks'; render(); }); await page.waitForSelector('#gpMinistry');
  ok('320px, Khmer: his My Ministry page fits', await fits(page) && /[ក-៿]/.test(await page.$eval('#gpMinistry .mmBannerNote', e => e.innerText)));
  ok('… the job title is shown in the Khmer the admin gave', /អ្នកដឹកនាំកិច្ចការបម្រើថ្មី/.test(await page.$eval('#gpmRoles', e => e.innerText)));
  await page.evaluate(() => { gpOverOpen_(); }); await page.waitForSelector('#bdOver', { timeout: 10000 });
  ok('… the oversight pages fit', await fits(page));
  await ctx.close();
  const d = await open('dara');
  await d.page.evaluate(() => { S.view = 'ywamgp'; render(); }); await d.page.waitForSelector('#gpRocks');
  ok('every staff member reads YWAM GP’s rocks on the YWAM GP page — to read only', /Start two new ministries/.test(await d.page.$eval('#gpRocks', e => e.innerText)) && await d.page.$('#gpRocks [data-rockst]') === null && await d.page.$('#gpRocks [data-rkadd]') === null && await d.page.$('#gpRocks .rkBadge') !== null);
  await d.ctx.close();
  const a = await open('uriah', { small: true });
  await a.page.evaluate(() => { S.view = 'ywamgp'; render(); }); await a.page.waitForSelector('#gpRolesAdmin');
  ok('an admin can write YWAM GP’s rocks there', await a.page.$('#gpRocks [data-rkadd="gp|YWAM GP|"]') !== null && await a.page.$('#gpRocks [data-rockst]') !== null);
  ok('320px: the job-title editor fits', await fits(a.page));
  await a.page.evaluate(() => { S.view = 'admin'; S.adminSub = 'person'; S.adminPersonId = 'st2'; S.adminStaff = null; render(); }); await a.page.waitForTimeout(1200);
  await a.page.click('[data-adminedit="st2"]'); await a.page.waitForTimeout(400);
  ok('320px: Positions fits, the tick on, the campus job folded', await fits(a.page) && await a.page.$eval('#adm_gphome', e => e.checked) && !(await a.page.isVisible('#adm_dept')));
  await a.page.uncheck('#adm_gphome'); await a.page.waitForTimeout(400);
  ok('unticked, the campus job comes back with what he had before', await a.page.isVisible('#adm_dept') && await a.page.$eval('#adm_dept', e => e.value) === 'Campus Leadership' && await a.page.$eval('#adm_ministry', e => e.value) === 'Campus Director');
  await a.page.selectOption('#adm_dept', 'Community Service'); await a.page.waitForTimeout(200); await a.page.selectOption('#adm_ministry', 'Cafe');
  await a.page.click('[data-adminsave="st2"]'); await a.page.waitForFunction(() => !document.querySelector('[data-adminsave]'), null, { timeout: 8000 });
  const so = mem.staff.find(x => x.id === 'st2');
  ok('… saved: back in a campus ministry, off the YWAM GP job', !so.gpHome && so.dept === 'Community Service' && so.ministry === 'Cafe' && so.gpRoles.join() === NM);
  await a.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
