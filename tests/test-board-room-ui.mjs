/* The Advisory Board in the browser — against the real api.js (Nov 2026, Uriah).

   An admin makes an invite link; someone opens it and signs up (a username + PIN, or Google); a staff member opens one
   and the seat lands on their profile. A board member's own sign-in then has: the Overview (the big picture, both
   campuses, phone and laptop), Campuses → a department → a ministry with its Scorecard and Rocks to read and no
   control anywhere, a campus's leadership team to read, the Finances dashboard, and the Board room — where they add an
   issue and a rock and run a short board meeting, all on the board's own data. A staff member on the board gets the
   same from ☰, and the campus's own meeting board never mixes with the board's. Khmer, 320px and 1024px.
   Every name is made up. BD_SHOTS=<folder> saves pictures. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('board-room-ui');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
process.env.GP_ADMIN_CODE = 'admincode'; process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: '', staffType: 'campus', country: 'Cambodia', google: { sub: 'g-' + o.id }, leads: [], ministries: [], created: '2025-01-01T00:00:00Z' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st_ada', name: 'Ada Admin', username: 'ada', email: 'ada@example.org', dept: 'Campus Leadership', ministry: 'Campus Director', cdKind: 'national', isAdmin: true }),
  mk({ id: 'st_oli', name: 'Oli Overseer', username: 'oli', email: 'oli@example.org', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st_sam', name: 'Sam Seated', username: 'sam', email: 'sam@example.org', dept: 'Community Service', ministry: 'Cafe', leads: ['Community Service|Cafe'], country: 'USA' }),
  mk({ id: 'st_ned', name: 'Ned Ordinary', username: 'ned', email: 'ned@example.org', dept: 'Community Service', ministry: 'Cafe', staffType: 'yap' }),
  mk({ id: 'st_cal', name: 'Cal Poipet', username: 'cal', email: 'cal@example.org', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director' }),
];
mem.board = [
  { id: 'bd_bea', name: 'Bea Board', role: 'President', email: 'bea@example.org', phone: '', bio: 'Chairs the board.', photo: '', staffId: '', order: 0, active: true, safeguarding: true, username: 'bea', pinSalt: 'bd_bea', pinHash: H('4321', 'bd_bea') },
  { id: 'bd_sam', name: '', role: 'Secretary', email: '', phone: '', bio: '', photo: '', staffId: 'st_sam', order: 0, active: true, safeguarding: false },
];
const call = async (fn, args) => (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json();
const O0 = await call('getBoardOverview', ['bea', '4321']), wk = O0.week, YEAR = O0.year, Q = O0.q;
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
mem.entries = [];
for (let w = Math.max(1, wk - 3); w <= wk; w++) {
  mem.entries.push({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Customers Served', week: w, year: YEAR, value: 100 + w, by: 'st_ned', updated: new Date().toISOString() });
  mem.entries.push({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: w, year: YEAR, value: 30, by: 'st_ned', updated: new Date().toISOString() });
}
mem.metricOverrides = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', goals: { 'Customers Served': { goal: 100, dir: 'gte' }, 'Cups Sold': { goal: 200, dir: 'gte' } } }];
mem.rocks = { seeded: today, rocks: [
  { id: 'rk1', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', owner: 'st_ned', year: YEAR, q: Q, title: 'A second espresso machine', status: 'on', note: 'Quotes are in' },
  { id: 'rk2', campus: 'siemreap', dept: 'Community Service', ministry: '', owner: '', year: YEAR, q: Q, title: 'Every ministry has a leader', status: 'off', note: '' },
  { id: 'rk3', campus: 'siemreap', dept: 'Campus Leadership', ministry: '', owner: 'st_ada', year: YEAR, q: Q, title: 'The new dorm is open', status: 'on', note: '' }] };
mem['fin2:siemreap'] = { rev: 2, at: new Date().toISOString(), by: 'st_ada', byName: 'Ada Admin', state: { bal: [{ asOf: today, rec: today, aba: 1000, us: 500, cash: 250, at: 1 }] } };
await call('saveLeadCard', ['ada', '1234', { title: 'Campus card SR', type: 'agenda', col: 'agenda', owner: 'st_ada' }]);
mem['leadMeet:siemreap'] = { score: [{ id: 'sc1', name: 'Guests welcomed', owner: 'st_oli', goal: 5, dir: 'gte', src: 'manual', metric: null, vals: { [YEAR + '-' + wk]: 7 } }], rocks: [], headlines: [],
  past: [{ id: 'mt1', date: today, endedAt: new Date().toISOString(), avg: 8.5, todo: { done: 9, total: 10, pct: 90 }, solved: [{ title: 'Water pump', decision: 'Replace it' }], ratings: [], present: [], mins: {}, total: 88, leader: { id: 'st_ada', name: 'Ada Admin' }, headlines: [], newTodos: [], messages: [] }], run: null, minutes: {} };

/* Google's tokeninfo, stood in for the server; its script, stood in for the page */
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.indexOf('tokeninfo') > -1) return u.indexOf('tok-gina') > -1 ? { ok: true, json: async () => ({ aud: 'cid.apps.googleusercontent.com', email: 'gina.guest@gmail.com', email_verified: 'true', expires_in: '3500', sub: 'g-gina' }) } : { ok: false, json: async () => ({}) };
  if (u.indexOf('userinfo') > -1) return { ok: true, json: async () => ({ name: 'Gina Google' }) };
  return { ok: false, json: async () => ({}) };
};
const FAKE_GSI = `window.google={accounts:{oauth2:{initTokenClient:function(o){return{requestAccessToken:function(){ setTimeout(function(){ o.callback({access_token:'tok-gina'}); },30); }};}}}};`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const sent = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}'); sent.push(body);
    const r = await api.default({ method: 'POST', json: async () => body, headers: new Map() }, {});
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(await r.text()); return;
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
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined && extra !== '' ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined && extra !== '' ? '  → ' + extra : '')); }
}
const SHOTS = process.env.BD_SHOTS || '';
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function ctxFor(store, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: opts.height || 860 }, timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GSI }));
  await page.addInitScript(o => { if (!localStorage.getItem('gp-test-started')) { localStorage.setItem('gp-test-started', '1'); localStorage.setItem('gp-ask-test', '1'); Object.keys(o).forEach(k => localStorage.setItem(k, o[k])); } }, store || {});
  return { ctx, page };
}
const staffStore = (u) => ({ 'gp-staff': JSON.stringify({ user: u, pin: '1234' }), 'gp-ggl-skip': new Date().toDateString() });
const boardStore = { 'gp-board': JSON.stringify({ user: 'bea', pin: '4321' }) };
const txt = (page, sel) => page.$eval(sel, e => e.innerText);
const wait = (page, ms) => page.waitForTimeout(ms || 450);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
const fnsSince = (n) => sent.slice(n).map(x => x.fn);

console.log('=== an admin makes the invite link ===');
let link = '';
{
  const { ctx, page } = await ctxFor(staffStore('ada'));
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await wait(page, 600);
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'board'; render(); });
  await page.waitForSelector('#bdiForm', { timeout: 8000 });
  ok('Admin → Advisory Board leads with “Invite a board member”', /Invite a board member/.test(await txt(page, '#bdiForm')) && (await page.$$('[data-bdidays]')).length === 4 && !!(await page.$('#bdAdd')));
  await page.fill('#bdiRole', 'Treasurer'); await page.click('[data-bdidays="14"]'); await wait(page, 150);
  ok('the role typed survives picking the days', (await page.$eval('#bdiRole', e => e.value)) === 'Treasurer' && !!(await page.$('[data-bdidays="14"].on')));
  await page.fill('#bdiNote', 'for Tess'); await page.click('#bdiMake'); await page.waitForSelector('#bdiLink', { timeout: 8000 });
  link = await page.$eval('#bdiLink', e => e.value);
  ok('the link is shown once: teams.html?board=<48 hex>, with Copy', /\/teams\.html\?board=[a-f0-9]{48}$/.test(link) && !!(await page.$('#bdiCopy')) && /as Treasurer/.test(await txt(page, '#bdiMade')), link.slice(-60));
  ok('… and listed as open, with a way to turn it off', /for Tess/.test(await txt(page, '#bdiList')) && !!(await page.$('[data-bdioff]')));
  await shot(page, 'admin-invite');
  await ctx.close();
}
const tokenOf = (l) => l.split('board=')[1];

console.log('=== opening it: a username and a PIN ===');
{
  const { ctx, page } = await ctxFor({});
  const mark = sent.length;
  await page.goto(BASE + '/teams.html?board=' + tokenOf(link), { waitUntil: 'load' });
  await page.waitForSelector('#bdInvForm', { timeout: 15000 });
  ok('the page says the role and who invited them', /You’re invited to the YWAM GP Advisory Board as Treasurer/.test(await txt(page, '#bdInvite')) && /Invited by Ada Admin/.test(await txt(page, '#bdInvForm')));
  ok('the token is out of the address before anything else', (await page.evaluate(() => location.search)).indexOf('board=') === -1);
  ok('Google is offered first, with a username + PIN behind it', !!(await page.$('#bdInvGoogle')) && !!(await page.$('#bdInvPinWay')) && !(await page.$('#bdi_user')));
  ok('no staff boot is asked for', fnsSince(mark).indexOf('getMyBoot') === -1, fnsSince(mark).join());
  await shot(page, 'invite-page');
  await page.fill('#bdi_name', 'Tess Treasurer'); await page.click('#bdInvPinWay'); await page.waitForSelector('#bdi_user');
  ok('the name typed survives the switch', (await page.$eval('#bdi_name', e => e.value)) === 'Tess Treasurer');
  await page.fill('#bdi_user', 'tess'); await page.fill('#bdi_pin', '2468'); await page.click('#bdInvJoin'); await wait(page, 400);
  ok('an email is asked for', /Add your email/.test(await txt(page, '#bdInvErr')));
  await page.fill('#bdi_email', 'ned@example.org'); await page.click('#bdInvJoin'); await page.waitForSelector('#bdInvErr'); await wait(page, 500);
  ok('a staff member’s email is told to sign in first', /belongs to a staff profile/.test(await txt(page, '#bdInvErr')));
  await page.fill('#bdi_email', 'tess@example.org'); await page.fill('#bdi_bio', 'An accountant in Siem Reap.'); await page.click('#bdInvJoin');
  await page.waitForSelector('nav.bottom [data-tab="bdover"]', { timeout: 10000 }); await page.waitForSelector('#bdOver', { timeout: 10000 });
  const tabs = await page.$$eval('nav.bottom button', b => b.map(x => x.getAttribute('data-tab')).join());
  ok('signed up and in at once: Overview · Campuses · Finances · Board room · Report', tabs === 'bdover,bdcamp,bdfin,bdroom,report', tabs);
  ok('… as a board member with the invite’s role', mem.board.some(b => b.name === 'Tess Treasurer' && b.role === 'Treasurer' && b.username === 'tess' && b.active) && /You: Treasurer/.test(await txt(page, '#bdOver')));
  ok('… and the phone remembers the sign-in the board way, not as staff', !!(await page.evaluate(() => localStorage.getItem('gp-board'))) && !(await page.evaluate(() => localStorage.getItem('gp-staff'))));
  await ctx.close();
  const again = await ctxFor({});
  await again.page.goto(BASE + '/teams.html?board=' + tokenOf(link), { waitUntil: 'load' }); await again.page.waitForSelector('#bdInvGone', { timeout: 10000 });
  ok('the same link a second time says plainly it has been used', /already been used/.test(await txt(again.page, '#bdInvGone')) && !(await again.page.$('#bdInvJoin')));
  await again.page.click('#bdInvToLogin'); await wait(again.page);
  ok('… and leads back to the sign-in screen', !!(await again.page.$('#loginBtn, #googleLogin')));
  await again.ctx.close();
}

console.log('=== opening one: Continue with Google ===');
{
  const inv = await call('adminMakeBoardInvite', ['ada', '1234', { role: 'Advisor', days: 7 }]);
  const { ctx, page } = await ctxFor({});
  await page.goto(BASE + '/teams.html?board=' + inv.token, { waitUntil: 'load' }); await page.waitForSelector('#bdInvGoogle', { timeout: 15000 });
  await page.fill('#bdi_bio', 'From the church.'); await page.click('#bdInvGoogle');
  await page.waitForSelector('#bdOver', { timeout: 12000 });
  const m = mem.board.find(b => b.email === 'gina.guest@gmail.com');
  ok('Google’s name and email, no PIN: a device token is the sign-in', !!m && m.name === 'Gina Google' && m.role === 'Advisor' && !m.pinHash && m.bio === 'From the church.' && /^[a-f0-9]{48}$/.test(JSON.parse(await page.evaluate(() => localStorage.getItem('gp-board'))).pin));
  await page.evaluate(() => { localStorage.removeItem('gp-board'); }); await page.goto(BASE + '/teams.html', { waitUntil: 'load' }); await page.waitForSelector('#googleLogin', { timeout: 10000 });
  await page.click('#googleLogin'); await page.waitForSelector('#bdOver', { timeout: 12000 });
  ok('next time Continue with Google on the sign-in screen brings them straight back to the board', (await page.$$eval('nav.bottom button', b => b.length)) === 5 && !(await page.$('#gglNew')));
  await ctx.close();
}

console.log('=== a staff member opens one: the seat lands on their profile ===');
{
  const inv = await call('adminMakeBoardInvite', ['ada', '1234', { role: 'Advisor', days: 7 }]);
  const { ctx, page } = await ctxFor(staffStore('ned'));
  await page.goto(BASE + '/teams.html?board=' + inv.token, { waitUntil: 'load' }); await page.waitForSelector('#bdInvStaff', { timeout: 15000 });
  ok('signed in as staff: “your seat is added to this profile”', /signed in as Ned Ordinary/.test(await txt(page, '#bdInvStaff')) && /as Advisor/.test(await txt(page, '#bdInvite')));
  await page.click('#bdInvStaffJoin'); await page.waitForSelector('#bdOver', { timeout: 12000 });
  ok('no second identity: one linked seat, and the Overview opens with its four tabs on top', mem.board.filter(b => b.staffId === 'st_ned').length === 1 && !mem.board.some(b => b.name === 'Ned Ordinary') && (await page.$$('[data-bdtab]')).length === 4);
  await page.click('#menuBtn'); await wait(page, 300);
  ok('… and ☰ has 🛡️ Advisory Board from now on', /Advisory Board/.test(await txt(page, '.drawer')));
  await ctx.close();
  mem.board = mem.board.filter(b => b.staffId !== 'st_ned');
}

console.log('=== the Overview: the big picture ===');
const { ctx, page } = await ctxFor(boardStore);
let mark = sent.length;
await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
await page.waitForSelector('#bdOver', { timeout: 15000 }); await wait(page, 600);
ok('a board member lands on the Overview', !!(await page.$('nav.bottom [data-tab="bdover"].on')) && /The big picture/.test(await txt(page, '#bdOver')));
ok('one call for the Overview, beside what board mode already loads', fnsSince(mark).filter(f => f === 'getBoardOverview').length === 1 && fnsSince(mark).indexOf('getMyBoot') === -1, fnsSince(mark).join());
const allTxt = await txt(page, '#bdAll');
ok('all of YWAM GP: staff with Khmer / international, health, salvations, the schools', /STAFF/i.test(allTxt) && /4 Khmer · 1 international/.test(allTxt) && /Staff Health Score/i.test(allTxt) && /needs 3 check-ins or more/.test(allTxt) && /Salvations/i.test(allTxt), allTxt.replace(/\n/g, ' ').slice(0, 160));
const sr = await txt(page, '[data-bdcard="siemreap"]');
ok('each campus: Scorecards “n of m numbers on target this week”, with each department’s line', /1 of 2 numbers on target this week/.test(sr) && /Community Service\s*1 \/ 2/.test(sr), sr.replace(/\n/g, ' ').slice(0, 300));
ok('… Rocks “n of m on track”, with leadership’s and each department’s', /2 of 3 on track/.test(sr) && /Campus Leadership\s*1 \/ 1/.test(sr) && /Community Service\s*1 \/ 2/.test(sr));
ok('… numbers in, the balance and whether it is reconciled', /Numbers in on time/.test(sr) && /ministries this week/.test(sr) && /\$1,750/.test(sr) && /reconciled/.test(sr) && !/not reconciled/.test(sr));
ok('… leadership’s last meeting: rated 8.5, 90% of To-Dos done, 1 issue open', /rated 8\.5/.test(sr) && /90% of To-Dos done/.test(sr) && /1 open on their list/.test(sr));
ok('… and who is on campus tonight', /On campus tonight/i.test(sr));
ok('the fine print says what the board never sees', /changes nothing outside its own Board room/.test(await txt(page, '#bdFine')) && /nobody’s own answers/.test(await txt(page, '#bdFine')));
ok('nothing to type or switch on the Overview', (await page.$$('#bdOver input, #bdOver select, #bdOver textarea')).length === 0);
ok('it fits a phone', !(await overflow(page)));
await shot(page, 'overview-390');
await page.setViewportSize({ width: 320, height: 700 }); await wait(page, 300);
ok('… and a 320px phone, five tabs on one line', !(await overflow(page)) && (await page.$$eval('nav.bottom button', b => new Set(b.map(x => Math.round(x.getBoundingClientRect().top))).size)) === 1);
await page.setViewportSize({ width: 1024, height: 768 }); await wait(page, 400);
const cols = await page.$$eval('.bdCampus', c => c.map(x => Math.round(x.getBoundingClientRect().left)));
ok('on a laptop the two campuses sit side by side', cols.length === 2 && cols[1] > cols[0] + 200 && !(await overflow(page)), cols.join());
await shot(page, 'overview-1024');
await page.setViewportSize({ width: 390, height: 860 }); await wait(page, 300);

console.log('=== Campuses → a department → a ministry ===');
await page.click('[data-bdcard="siemreap"] [data-bdblock="score"] .bdSub'); await page.waitForSelector('#bdMins', { timeout: 8000 });
ok('a department’s line opens the department: its own rocks and its ministries', /Community Service/.test(await txt(page, '.bdTitle')) && /Every ministry has a leader/.test(await txt(page, '#bdDeptRocks')) && !!(await page.$('[data-bdmin="Cafe"]')));
ok('… each ministry with who leads it, how many serve, its scorecard and rocks in a line', /Sam Seated/.test(await txt(page, '[data-bdmin="Cafe"]')) && /2 serve/.test(await txt(page, '[data-bdmin="Cafe"]')) && /1 of 2 on target/.test(await txt(page, '[data-bdmin="Cafe"]')));
await page.click('[data-bdmin="Cafe"]'); await page.waitForSelector('#scoreBoard', { timeout: 8000 });
ok('the ministry: led by, how many serve', /Led by/.test(await txt(page, '#bdMin')) && /Sam Seated/.test(await txt(page, '#bdMin')) && /2 people/.test(await txt(page, '#bdMin')));
ok('its Scorecard: the goals, ✓ / ✗ weeks and the headline', /1 of 2 on target this week/.test(await txt(page, '#sbdHeadline')) && (await page.$$('#scoreBoard .sbdC')).length >= 13 && /≥ 100/.test(await txt(page, '#scoreBoard')));
ok('… to read: no Goals button', !(await page.$('#sbdEdit')) && (await page.$$('#scoreBoard input, #scoreBoard select')).length === 0);
ok('the period totals: this quarter and the year', /This quarter and this year/.test(await txt(page, '#bdTotals')) && /Customers Served/.test(await txt(page, '#bdTotals')));
ok('its Rocks as badges — no status buttons, no Edit, nothing to add', /A second espresso machine/.test(await txt(page, '#bdMinRocks')) && !!(await page.$('#bdMinRocks .rkBadge')) && (await page.$$('#bdCamp [data-rockst], #bdCamp [data-rockedit], #bdCamp [data-rkadd], #bdCamp input, #bdCamp textarea')).length === 0);
ok('the ministry page fits a phone', !(await overflow(page)));
await shot(page, 'ministry-390');
mark = sent.length;
await page.click('#bdMinReport'); await page.waitForSelector('#qrPage', { timeout: 10000 }); await wait(page, 900);
ok('a link to its page in the quarterly report', fnsSince(mark).indexOf('getQuarterReport') > -1 && !!(await page.$('.qrMin[data-qrmin="Community Service|Cafe"]')));
await page.click('nav.bottom [data-tab="bdcamp"]'); await wait(page);
await page.click('[data-bdup="dept"]'); await wait(page); await page.click('[data-bdup="campus"]'); await page.waitForSelector('#bdDepts');
ok('back up to the campus: its leadership team and departments', /Campus Leadership Team/i.test(await txt(page, '#bdCamp')) && /Ada Admin/.test(await txt(page, '#bdCamp')) && /Director: Oli Overseer/.test(await txt(page, '#bdDepts')), (await txt(page, '#bdCamp')).replace(/\n/g, ' ').slice(0, 400));
await page.click('[data-bdcampus="poipet"]'); await wait(page);
ok('the other campus is one tap away', /Cal Poipet/.test(await txt(page, '#bdCamp')) && !!(await page.$('[data-bdcampus="poipet"].on')));
await page.click('[data-bdcampus="siemreap"]'); await wait(page);

console.log('=== a campus’s leadership team, to read ===');
mark = sent.length;
await page.click('#bdLeadGo'); await page.waitForSelector('#bdLead .lmScoreRow', { timeout: 10000 });
ok('their Scorecard, without a box to type in', fnsSince(mark).filter(f => f === 'getBoardLeadership').length === 1 && /Guests welcomed/.test(await txt(page, '#bdLead')) && /Goal ≥ 5/.test(await txt(page, '#bdLead')) && (await page.$$('#bdLead input')).length === 0);
await page.click('[data-bdleadsec="rocks"]'); await wait(page);
ok('their rocks, as badges', /The new dorm is open/.test(await txt(page, '#bdLead')) && /Ada/.test(await txt(page, '#bdLead')) && (await page.$$('#bdLead [data-rockst], #bdLead [data-lmrockst]')).length === 0);
await page.click('[data-bdleadsec="kanban"]'); await wait(page);
ok('their Kanban, as a list', /Campus card SR/.test(await txt(page, '#bdLead')) && (await page.$$('#bdLead [data-leadcard], #bdLead #leadNew')).length === 0);
await page.click('[data-bdleadsec="past"]'); await wait(page);
ok('their past meetings', /8\.5/.test(await txt(page, '#bdLead')) && (await page.$$('#bdLead .lmPastItem')).length === 1);
ok('the fine print about the meeting format is kept', /not affiliated with or endorsed by EOS Worldwide/.test(await txt(page, '#bdLead #lmFine')) && /nothing here can be changed/.test(await txt(page, '#bdLead')));

console.log('=== Finances ===');
mark = sent.length;
await page.click('nav.bottom [data-tab="bdfin"]'); await page.waitForSelector('#fin2Frame', { timeout: 8000 });
const src = await page.$eval('#fin2Frame', e => e.getAttribute('src'));
ok('the finance tool’s Dashboard, for the campus, read with the board’s sign-in', /view=dash/.test(src) && /campus=siemreap/.test(src) && /as=board/.test(src), src);
const frame = page.frames().find(f => /finance\.html/.test(f.url()));
await frame.waitForFunction(() => document.body.classList.contains('ro'), null, { timeout: 15000 }).catch(() => {});
await wait(page, 600);
const got = sent.slice(mark).filter(x => x.fn === 'fin2Get');
ok('it loads: fin2Get as the board member, read only', got.length === 1 && got[0].args[0] === 'bea' && got[0].args[2] === 'siemreap' && await frame.evaluate(() => document.body.classList.contains('ro') && !document.querySelector('.finMsg')));
await page.click('[data-bdfincampus="poipet"]'); await wait(page, 900);
ok('the other campus too', /campus=poipet/.test(await page.$eval('#fin2Frame', e => e.getAttribute('src'))) && sent.slice(mark).filter(x => x.fn === 'fin2Get' && x.args[2] === 'poipet').length === 1);
ok('nothing was saved from there', sent.slice(mark).filter(x => x.fn === 'fin2Save').length === 0 && mem['fin2:siemreap'].rev === 2);

console.log('=== the Board room ===');
mark = sent.length;
await page.click('nav.bottom [data-tab="bdroom"]'); await page.waitForSelector('#lmStart', { timeout: 10000 }); await wait(page);
ok('the Board room: the board meeting, its Issues and To-Dos, notes — no weekly rota', /Board room/.test(await txt(page, '#bdRoom')) && (await page.$$eval('[data-leadtab]', b => b.map(x => x.getAttribute('data-leadtab')).join())) === 'meet,board,notes' && /Board meeting/.test(await txt(page, '[data-leadtab="meet"]')));
ok('every call goes through the board’s room, none straight to a campus', fnsSince(mark).every(f => f === 'boardRoom') && sent.slice(mark)[0].args[2] === 'getLeadMeeting', fnsSince(mark).join());
ok('whoever starts it leads; the fine print is there', /Whoever starts the meeting leads it/.test(await txt(page, '.lmHead')) && /not affiliated with or endorsed by EOS Worldwide/.test(await txt(page, '#lmFine')) && !(await page.$('#lmPlanWho')));
await page.fill('#lmIssueText', 'No written reserves policy'); await page.evaluate(() => render());
ok('typing survives a redraw', (await page.$eval('#lmIssueText', e => e.value)) === 'No written reserves policy');
await page.press('#lmIssueText', 'Enter'); await wait(page, 700);
ok('an issue lands on the board’s own Kanban — not a campus’s', mem['leadBoard:board'].cards.some(c => c.title === 'No written reserves policy') && mem['leadBoard:siemreap'].cards.length === 1);
await page.click('[data-lmsec="rocks"]'); await wait(page); await page.click('#lmRockAdd'); await page.waitForSelector('#lmRockForm');
await page.fill('[data-lmrf="title"]', 'A reserves policy the board has signed');
const pick = await page.$$eval('#lmRockForm [data-ppickit]', b => b.map(x => x.textContent.trim()));
ok('the people to pick from are the board’s members', pick.some(x => /Bea Board/.test(x)) && pick.some(x => /Sam Seated/.test(x)) && pick.some(x => /Tess Treasurer/.test(x)) && !pick.some(x => /Ned|Oli|Ada/.test(x)), pick.join(' | '));
await page.click('#lmRockForm [data-ppickit$="|bd_bea"]'); await wait(page, 200);
await page.click('#lmRockSave'); await wait(page, 800);
ok('a rock for the board, with its owner — kept apart from every campus rock', mem['rocks:board'].rocks.length === 1 && mem['rocks:board'].rocks[0].owner === 'bd_bea' && mem.rocks.rocks.length === 3 && /A reserves policy the board has signed/.test(await txt(page, '#lmRocks')) && /Bea Board/.test(await txt(page, '#lmRocks')));
await page.click('[data-lmsec="score"]'); await wait(page); await page.click('#lmScoreAdd'); await page.waitForSelector('#lmScoreForm');
await page.fill('[data-lmsf="name"]', 'Cafe customers'); await page.click('[data-lmsrc="metric"]'); await wait(page, 200);
ok('a scorecard number can be linked to either campus’s numbers', (await page.$$eval('[data-lmsf="campus"] option', o => o.length)) === 2);
await page.selectOption('[data-lmsf="campus"]', 'siemreap'); await wait(page, 200); await page.selectOption('[data-lmsf="dept"]', 'Community Service'); await wait(page, 200);
await page.selectOption('[data-lmsf="ministry"]', 'Cafe'); await wait(page, 200); await page.selectOption('[data-lmsf="metric"]', 'Customers Served'); await page.fill('[data-lmsf="goal"]', '90');
await page.click('#lmScoreSave'); await wait(page, 900);
ok('… and fills itself in from what that ministry enters', new RegExp(String(100 + wk)).test(await txt(page, '.lmScoreRow')) && /Siem Reap/.test(await txt(page, '.lmScoreRow')) && mem['leadMeet:board'].score[0].metric.campus === 'siemreap', (await txt(page, '.lmScoreRow')).replace(/\n/g, ' ').slice(0, 120));
await shot(page, 'board-room-390');
/* a short board meeting */
await page.click('#lmStart'); await page.waitForSelector('#lmRun', { timeout: 8000 });
ok('the board meeting starts: part 1 of 7, led by Bea', /Part 1 of 7/i.test(await txt(page, '#lmRun')) && /Led by Bea Board/.test(await txt(page, '#lmRun')) && (await page.$$eval('[data-lmhere]', b => b.map(x => x.textContent.trim()).join())).indexOf('Bea') > -1, (await txt(page, '#lmRun')).replace(/\n/g, ' ').slice(0, 300));
for (let i = 0; i < 5; i++) { await page.click('#lmNext'); await wait(page, 500); }
await page.waitForSelector('#lmIssues');
await page.click('[data-lmrank]'); await wait(page, 700); await page.click('#lmWork'); await page.waitForSelector('#lmIds', { timeout: 8000 });
await page.fill('#lmDecision', 'Tess drafts one for the next meeting');
await page.fill('[data-lmtodoin="itodo"]', 'Draft the reserves policy'); await page.click('[data-lmtodoadd="itodo"]'); await wait(page, 900);
ok('a To-Do in the meeting stays on the board’s Kanban — no GP Tasks', mem['leadBoard:board'].cards.some(c => (c.tasks || []).some(tk => tk.text === 'Draft the reserves policy')) && !mem.gpTasks);
await page.click('#lmSolve'); await wait(page, 900);
ok('the issue is solved: its decision on the card', /Tess drafts one/.test(mem['leadBoard:board'].cards.find(c => c.title === 'No written reserves policy').notes));
await page.click('#lmNext'); await page.waitForSelector('#lmWrap', { timeout: 8000 });
await page.selectOption('[data-lmrate="bd_bea"]', '9'); await wait(page, 700);
await page.click('#lmEnd'); await page.waitForSelector('#lmPast', { timeout: 8000 }); await wait(page, 500);
const past = mem['leadMeet:board'].past;
ok('ended: the board’s own record, rated, with the issue solved', past.length === 1 && past[0].avg === 9 && past[0].leader.name === 'Bea Board' && past[0].solved.length === 1 && (await page.$$('.lmPastItem')).length === 1);
ok('the campus’s meeting record never moved', mem['leadMeet:siemreap'].past.length === 1 && mem['leadBoard:siemreap'].cards.length === 1);
await page.click('[data-leadtab="board"]'); await page.waitForSelector('#leadBoard'); await wait(page);
ok('Issues and To-Dos is the board’s Kanban, with no “task for which department”', /No written reserves policy/.test(await txt(page, '#leadBoard')) && !/Campus card SR/.test(await txt(page, '#leadBoard')));
await page.click('#leadNew'); await page.waitForSelector('#leadForm');
ok('… a new card’s owner is a board member, and there is no department picker', !(await page.$('[data-lf="taskMin"]')) && (await page.$$eval('#leadForm [data-ppickit]', b => b.map(x => x.textContent).join('|'))).indexOf('Bea Board') > -1);
await page.click('#leadClose'); await wait(page, 200);
ok('the room fits a phone', !(await overflow(page)));
const roomCalls = sent.slice(mark).map(x => x.fn);
ok('all of it went through boardRoom', roomCalls.filter(f => /Lead|leadMeet/.test(f)).length === 0 && roomCalls.filter(f => f === 'boardRoom').length > 10);

console.log('=== the Report, the menu, Khmer ===');
await page.click('nav.bottom [data-tab="report"]'); await page.waitForSelector('.repGrid', { timeout: 8000 });
ok('Report is still the board’s quarter report, with every campus rock', /report/i.test(await txt(page, '.repHead')) && /A second espresso machine/.test(await txt(page, '.repGrid')) && !/reserves policy/.test(await txt(page, '.repGrid')));
await page.click('#menuBtn'); await wait(page, 300);
const menu = await txt(page, '.drawer');
ok('☰: Overview, YWAM GP, Base, Quarterly report, 360 reviews, Library, Log out — nothing staff', /YWAM GP/.test(menu) && /Library/.test(menu) && /Quarterly report/.test(menu) && /Log out/.test(menu) && !/Admin|HR|Leave|Prayer|Support/.test(menu), menu.replace(/\n/g, ' · '));
await page.evaluate(() => { S.menuOpen = false; renderMenu(); }); await wait(page, 200);
await page.click('nav.bottom [data-tab="bdover"]'); await wait(page); await page.click('#langBtn'); await wait(page, 500);
const km = await txt(page, '#bdOver'), bar = await txt(page, 'nav.bottom');
ok('Khmer: the Overview and the five tabs', /រូបភាពរួម/.test(km) && /តារាងពិន្ទុ/.test(km) && /ថ្មធំ/.test(km) && /ក្រុមប្រឹក្សា|បន្ទប់ប្រឹក្សា/.test(bar) && !/The big picture|Scorecards|on target/.test(km), bar.replace(/\n/g, ' '));
await page.setViewportSize({ width: 320, height: 700 }); await wait(page, 300);
ok('… on one line at 320px, nothing wider than the phone', !(await overflow(page)) && (await page.$$eval('nav.bottom button', b => new Set(b.map(x => Math.round(x.getBoundingClientRect().top))).size)) === 1);
await page.click('nav.bottom [data-tab="bdroom"]'); await page.waitForSelector('#leadBoard, #leadMeet'); await wait(page);
ok('… and the Board room in Khmer', /បន្ទប់ក្រុមប្រឹក្សា/.test(await txt(page, '#bdRoom')) && !(await overflow(page)));
await page.click('#langBtn'); await wait(page, 300);
await ctx.close();

console.log('=== a staff member on the board, and the campus’s own board beside it ===');
{
  const { ctx, page } = await ctxFor(staffStore('sam'));
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await wait(page, 700);
  ok('their app is the staff app', (await page.$$eval('nav.bottom button', b => b.map(x => x.getAttribute('data-tab')).join())) === 'week,ministry,team,health,profile');
  await page.click('#menuBtn'); await wait(page, 300);
  const item = await page.$$eval('.drawer button', b => b.map(x => x.textContent.trim()).filter(x => /Advisory Board/.test(x)));
  ok('☰ has one entry: 🛡️ Advisory Board', item.length === 1 && /🛡️/.test(item[0]), item.join());
  await page.evaluate(() => { [...document.querySelectorAll('.drawer button')].find(b => /Advisory Board/.test(b.textContent)).click(); });
  await page.waitForSelector('#bdOver', { timeout: 10000 });
  ok('it opens the same Overview — the other campus included — with the four tabs on top', !!(await page.$('[data-bdcard="poipet"]')) && (await page.$$('[data-bdtab]')).length === 4 && /You: Secretary/.test(await txt(page, '#bdOver')));
  await page.click('[data-bdtab="bdfin"]'); await page.waitForSelector('#fin2Frame'); await page.click('[data-bdfincampus="poipet"]'); await wait(page, 800);
  ok('Finances reads with their own staff sign-in (no “as=board”)', !/as=board/.test(await page.$eval('#fin2Frame', e => e.getAttribute('src'))) && sent.some(x => x.fn === 'fin2Get' && x.args[0] === 'sam' && x.args[2] === 'poipet'));
  await page.click('[data-bdtab="bdroom"]'); await page.waitForSelector('#lmStart', { timeout: 10000 }); await wait(page);
  await page.click('[data-lmsec="rocks"]'); await wait(page);
  ok('the Board room shows the board’s rock, with its buttons', /A reserves policy the board has signed/.test(await txt(page, '#lmRocks')) && (await page.$$('[data-lmrockst]')).length === 3);
  await page.click('[data-lmrockst$="|off"]'); await wait(page, 800);
  ok('… which this member can move', mem['rocks:board'].rocks[0].status === 'off' && mem['rocks:board'].rocks[0].updatedBy === 'st_sam');
  await page.click('#bdBackHome'); await wait(page);
  ok('← My Home leaves it', !!(await page.$('nav.bottom [data-tab="week"].on')));
  await ctx.close();
}
{
  /* an admin in Campus Leadership: their campus's Kanban, then the board's, then the campus's again */
  const { ctx, page } = await ctxFor(Object.assign(staffStore('ada'), {}));
  await page.addInitScript(() => { sessionStorage.setItem('gp-lw-tab', 'board'); });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await wait(page, 700);
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForSelector('#leadBoard', { timeout: 10000 }); await wait(page, 600);
  ok('Campus Leadership’s own Kanban, as it was', /Campus card SR/.test(await txt(page, '#leadBoard')) && !/reserves policy/.test(await txt(page, '#leadBoard')) && (await page.$$eval('[data-leadtab]', b => b.length)) === 4);
  await page.evaluate(() => bdOpen_('bdroom')); await page.waitForSelector('#bdRoom', { timeout: 8000 });
  await page.click('[data-leadtab="board"]'); await page.waitForSelector('#leadBoard'); await wait(page, 800);
  ok('an admin opens the Board room: the board’s cards, none of the campus’s', /No written reserves policy/.test(await txt(page, '#leadBoard')) && !/Campus card SR/.test(await txt(page, '#leadBoard')));
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForSelector('#leadBoard', { timeout: 10000 }); await wait(page, 500);
  ok('back on My Ministry the campus’s Kanban is its own again', /Campus card SR/.test(await txt(page, '#leadBoard')) && !/reserves policy/.test(await txt(page, '#leadBoard')));
  const m2 = sent.length;
  await page.click('#leadNew'); await page.waitForSelector('#leadForm'); await page.fill('#leadForm [data-lf="title"]', 'Campus card two'); await page.click('#leadSave'); await wait(page, 800);
  ok('… and a card added there goes to the campus, straight — never through the board’s room', sent.slice(m2).some(x => x.fn === 'saveLeadCard') && !sent.slice(m2).some(x => x.fn === 'boardRoom') && mem['leadBoard:siemreap'].cards.length === 2 && !mem['leadBoard:board'].cards.some(c => c.title === 'Campus card two'));
  await ctx.close();
}
{
  const { ctx, page } = await ctxFor(staffStore('oli'));
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await wait(page, 700);
  await page.click('#menuBtn'); await wait(page, 300);
  ok('Campus Leadership who is not on the board has no such entry', !/🛡️/.test(await txt(page, '.drawer')));
  await page.evaluate(() => { S.menuOpen = false; renderMenu(); S.view = 'bdroom'; render(); }); await wait(page, 500);
  ok('… and the page says it is for the Advisory Board', /for the Advisory Board/.test(await txt(page, '#main')) && !(await page.$('#leadMeet')));
  await ctx.close();
}
ok('no script error on any screen', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
