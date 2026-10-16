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
mem.okrs = [{ id: 'o1', campus: 'siemreap', dept: 'Community Service', quarter: Math.min(3, Math.floor((WK - 1) / 13)) + 1, year: YR, objective: 'Open the second cafe', krs: [] }];
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
  ok('a board member signs in on the same screen and gets their own app: YWAM GP · Campuses · Report · Library', tabs.join('|') === 'YWAM GP|Campuses|Report|Library', tabs.join('|'));
  let txt = await main(page);
  ok('… welcomed by name and role', /Welcome, Mary Board/.test(txt) && /President/i.test(txt));
  ok('… with no staff sign-in behind it', await page.evaluate(() => !S.auth.user && S.board && S.guest));
  await page.click('nav.bottom [data-tab="base"]'); await page.waitForTimeout(800);
  txt = await main(page);
  ok('Campuses: each campus\'s leadership, departments with their directors and ministry leaders', /Campus Leadership Team/i.test(txt) && /Departments/i.test(txt) && /Director: Dara Sok/.test(txt) && /Cafe · Kanha Lim/.test(txt));
  ok('… without the staff-only prompt to fill in a profile', !/Add it to my profile/.test(txt));
  ok('… and nobody in it can be opened — no staff pages', !(await page.$('[data-orgperson]')) && !(await page.$('[data-person]')));
  ok('the board view fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await page.click('nav.bottom [data-tab="report"]'); await page.waitForTimeout(700);
  const rep = await main(page);
  ok('Report: the quarter for YWAM GP and each campus — staff, health from 3+ check-ins, salvations against last quarter, objectives',
    /Q\d \d{4} report/.test(rep) && /YWAM Poipet/.test(rep) && /YWAM Siem Reap/.test(rep) && /3 check-ins/.test(rep) && /needs 3 check-ins or more/.test(rep) && /Salvations\n5\nQ\d: \d/.test(rep) && /Open the second cafe/.test(rep) && /Dara Sok/.test(rep), rep.slice(0, 400).replace(/\n/g, ' / '));
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

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
