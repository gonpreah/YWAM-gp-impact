/* Admin → Arrivals & departures, on the real backend: the invite link carries the
   campus, department and ministry; opening it shows the sign-up form with those
   chosen and a line saying so, and signing up makes the person's own account
   there with their own PIN; a link naming no real campus is the plain form.
   Archiving several: search by ministry or role, Select all shown, a confirm
   step, the reason recorded, the rest untouched, and they drop off the list. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('groups-ui');
const OUT = tmpDir('groups-ui-out');
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
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe',
  role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'ad', name: 'Uriah Admin', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'd1', name: 'Anna DTS', username: 'anna', email: 'a@e.com', dept: 'Leadership Development', ministry: 'GPDTS', role: 'DTS student' }),
  mk({ id: 'd2', name: 'Ben DTS', username: 'ben', email: 'b@e.com', dept: 'Leadership Development', ministry: 'GPDTS', role: 'DTS student' }),
  mk({ id: 'cf', name: 'Cora Cafe', username: 'cora', email: 'c@e.com' })
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
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  if (opts.at) await page.clock.setFixedTime(opts.at);
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => {
    localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' }));
    if (a.km) localStorage.setItem('gp-lang', 'km');
  }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.click('nav.bottom button[data-tab="week"]');
  await page.waitForTimeout(400);
  return { ctx, page };
}




const toGroups = async page => {
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'home'; render(); }); await page.waitForTimeout(800);
  await page.click('[data-adminsub="groups"]'); await page.waitForTimeout(500);
};
let link = '';
{
  const { ctx, page } = await open('uriah');
  /* the Admin home in sections (Nov 2026, Andrew: "simplify … categorizing them into sections") */
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'home'; render(); }); await page.waitForTimeout(800);
  const secs = await page.$$eval('[data-adminsec]', els => els.map(e => e.getAttribute('data-adminsec') + ':' + e.querySelectorAll('[data-adminsub]').length));
  ok('Admin is in four sections — People, Students & applications, Ministries & numbers, Messages & settings — every tool in one', secs.join() === 'people:7,school:2,numbers:3,settings:4', secs.join());
  ok('… with each section’s heading', (await page.$$eval('.adminSecHead', hs => hs.map(h => h.innerText.trim().toLowerCase()))).join('|') === 'people|students & applications|ministries & numbers|messages & settings');
  ok('… and nothing waiting says so', /Nothing is waiting on you/.test(await page.$eval('#adminDue', e => e.innerText)));
  await page.screenshot({ path: OUT + '/admin-home.png', fullPage: true });
  await toGroups(page);
  ok('Invite staff: a form for the link, and nothing about archiving', !!(await page.$('#grpMake')) && !(await page.$('#grpSearch')) && /No invite links yet/.test(await page.$eval('#main', e => e.innerText)));
  await page.selectOption('#grpCampus', 'siemreap'); await page.waitForTimeout(150);
  await page.selectOption('#grpDept', 'Leadership Development'); await page.waitForTimeout(150);
  await page.selectOption('#grpMin', 'GPDTS'); await page.waitForTimeout(150);
  await page.fill('#grpNote', 'Dana');
  await page.click('#grpMake'); await page.waitForSelector('#grpLink', { timeout: 8000 });
  link = await page.$eval('#grpLink', e => e.value);
  ok('Make the invite link: a link with a one-time token, shown once', /teams\.html\?reg=1&invite=[a-f0-9]{48}$/.test(link), link);
  const inv = (mem.invites || [])[0];
  ok('… kept only as a hash, for that place, one person, a week', inv && inv.hash && !JSON.stringify(mem.invites).includes(link.split('invite=')[1]) && inv.campus === 'siemreap' && inv.dept === 'Leadership Development' && inv.ministry === 'GPDTS' && inv.uses === 1 && inv.note === 'Dana' && (Date.parse(inv.exp) - Date.now()) > 6.9 * 864e5);
  ok('… and listed under Invite links, open', /Dana/.test(await page.$eval('#invList', e => e.innerText)) && !!(await page.$('#invList .invState.ok')));
  await page.screenshot({ path: OUT + '/groups-invite.png', fullPage: true });

  // archive several: its own Admin card now
  await page.evaluate(() => { S.adminSub = 'home'; render(); }); await page.waitForTimeout(300);
  await page.click('[data-adminsub="leaving"]'); await page.waitForTimeout(500);
  ok('Archive several people is its own card', !!(await page.$('#grpSearch')) && !(await page.$('#grpLink')));
  await page.fill('#grpSearch', 'dts'); await page.waitForTimeout(300);
  const names = await page.$$eval('#grpList .grpRow b', bs => bs.map(b => b.textContent));
  ok('search finds them by ministry or role', names.join() === 'Anna DTS,Ben DTS', names.join());
  ok('the admin is never in the list', !(await page.$('[data-grppick="ad"]')));
  await page.click('#grpAll'); await page.waitForTimeout(200);
  ok('Select all shown ticks both', (await page.$$('[data-grppick]:checked')).length === 2);
  await page.fill('#grpReason', 'DTS finished');
  await page.click('#grpArchive'); await page.waitForTimeout(200);
  ok('archiving asks first', /Archive 2 people\? They will not be able to log in\./.test(await page.$eval('#main', e => e.innerText)) && mem.staff.find(x => x.id === 'd1').active);
  await page.screenshot({ path: OUT + '/groups-confirm.png' });
  await page.click('#grpYes'); await page.waitForTimeout(1200);
  const d1 = mem.staff.find(x => x.id === 'd1'), d2 = mem.staff.find(x => x.id === 'd2');
  ok('Yes archives both, with the reason', !d1.active && !d2.active && d1.archived.reason === 'DTS finished' && d1.archived.by === 'ad');
  ok('… and leaves the rest', mem.staff.find(x => x.id === 'cf').active);
  await page.fill('#grpSearch', ''); await page.waitForTimeout(300);
  const left = await page.$$eval('#grpList .grpRow b', bs => bs.map(b => b.textContent));
  ok('they drop off the list', left.join() === 'Cora Cafe', left.join());
  ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**fonts.g**', r => r.abort());
  await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'load' });
  await page.waitForSelector('#inviteOk', { timeout: 15000 }); await page.waitForTimeout(300);
  const ban = await page.$eval('#inviteOk', e => e.innerText);
  ok('the link opens sign-up saying who invited them, where to, and that there is no waiting', /Uriah Admin invited you to join GPDTS · Leadership Development · .*Siem Reap/.test(ban) && /no waiting/.test(ban), ban);
  ok('… and the token is taken out of the address', !/invite=/.test(page.url()));
  ok('… asking nothing about campus, department or ministry', !(await page.$('#r_campus')) && !(await page.$('#r_dept')) && !(await page.$('#r_ministry')));
  await page.screenshot({ path: OUT + '/groups-signup.png' });
  await page.fill('#r_name', 'Dana New'); await page.fill('#r_email', 'dana@e.com');
  await page.fill('#r_user', 'dana'); await page.fill('#r_pin', '4321');
  await page.click('#regBtn'); await page.waitForSelector('#setup', { timeout: 15000 });
  const dana = mem.staff.find(x => x.username === 'dana');
  ok('signing up with it: in at once — active, no waiting — in that ministry, its setup still to do', dana && dana.active === true && !dana.awaiting && dana.campus === 'siemreap' && dana.dept === 'Leadership Development' && dana.ministry === 'GPDTS' && dana.setupTodo === true && dana.invitedBy && dana.invitedBy.adminId === 'ad', JSON.stringify(dana && { a: dana.active, w: dana.awaiting, c: dana.campus }));
  ok('… the invite is used up', mem.invites[0].used.length === 1 && mem.invites[0].used[0].name === 'Dana New');
  await page.click('#suNext'); await page.waitForTimeout(200);
  ok('… and the setup steps start from the link’s place', await page.$eval('[data-sucampus="siemreap"]', e => e.classList.contains('on')).catch(() => false));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**fonts.g**', r => r.abort());
  await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'load' });
  await page.waitForSelector('#inviteGone', { timeout: 15000 });
  ok('a used link says so — and sign-up still works, waiting for an admin', /already been used/.test(await page.$eval('#inviteGone', e => e.innerText)) && !!(await page.$('#r_name')));
  await page.fill('#r_name', 'Eve Late'); await page.fill('#r_email', 'eve@e.com'); await page.fill('#r_user', 'eve'); await page.fill('#r_pin', '4321');
  await page.click('#regBtn'); await page.waitForSelector('#setup', { timeout: 15000 });
  const eve = mem.staff.find(x => x.username === 'eve');
  ok('… that sign-up waits for an admin as any other', eve && eve.active === false && eve.awaiting === true && !eve.invitedBy);
  await ctx.close();
}
{
  /* a group link, turned off */
  const r = await api.default({ method: 'POST', json: async () => ({ fn: 'adminMakeInvite', args: ['uriah', '1234', { campus: 'poipet', uses: 10, days: 3 }] }), headers: new Map() }, {});
  const made = await r.json();
  const info = async () => (await (await api.default({ method: 'POST', json: async () => ({ fn: 'inviteInfo', args: [made.token] }), headers: new Map() }, {})).json());
  ok('a group link: ten people, three days', made.ok && made.invite.uses === 10 && (await info()).ok);
  const notAdmin = await (await api.default({ method: 'POST', json: async () => ({ fn: 'adminMakeInvite', args: ['cora', '1234', { campus: 'poipet' }] }), headers: new Map() }, {})).json();
  ok('only an admin can make one', !notAdmin.ok && !notAdmin.token);
  await api.default({ method: 'POST', json: async () => ({ fn: 'adminInviteOff', args: ['uriah', '1234', made.invite.id] }), headers: new Map() }, {});
  ok('turned off, it works no more', (await info()).err === 'off');
  const reg = await (await api.default({ method: 'POST', json: async () => ({ fn: 'staffRegister', args: [{ name: 'Zed', email: 'z@e.com', username: 'zed', pin: '1111', invite: made.token }] }), headers: new Map() }, {})).json();
  ok('… and signing up with it is refused, saying why', !reg.ok && reg.err === 'invite_off');
  ok('a made-up token is no invite', (await (await api.default({ method: 'POST', json: async () => ({ fn: 'inviteInfo', args: ['a'.repeat(48)] }), headers: new Map() }, {})).json()).err === 'bad');
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**fonts.g**', r => r.abort());
  await page.goto(BASE + '/teams.html?reg=1&campus=siemreap&dept=Leadership%20Development&ministry=GPDTS', { waitUntil: 'load' });
  await page.waitForSelector('#inviteBanner', { timeout: 15000 });
  ok('an old-style link (no token) still says where they are joining, and waits for an admin as before', /You’re joining GPDTS/.test(await page.$eval('#inviteBanner', e => e.innerText)));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.route('**fonts.g**', r => r.abort());
  await page.goto(BASE + '/teams.html?reg=1&campus=nowhere&dept=Fake', { waitUntil: 'load' });
  await page.waitForSelector('#r_name', { timeout: 15000 });
  ok('a link with a campus that does not exist is just the plain form', !(await page.$('#inviteBanner')));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
