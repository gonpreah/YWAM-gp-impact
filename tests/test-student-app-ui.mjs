/* Students in the GP app (Oct 2026): staff make a profile from SR Hospitality and send the invite; the student joins with Google, sees their application in the portal with Go to GP app, and uses the GP app in student mode — the same look, only their own goals, habits, mentorship (Leadership Development only), strengths, schedules and Library, saved apart from staff data. On the real backend. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('student-app-ui');
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
  mk({ id: 'hosp', name: 'Hana Host', username: 'hana', email: 'h@e.com', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'ld1', name: 'Lina Leader', username: 'lina', email: 'l@e.com', dept: 'Leadership Development', ministry: 'GPDTS' }),
  mk({ id: 'cafe', name: 'Cafe Person', username: 'cafe', email: 'c@e.com' }),
  mk({ id: 'adm', name: 'Ada Admin', username: 'ada', email: 'a@e.com', isAdmin: true })
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

const day = n => new Date(Date.now() + 7 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);
mem['hosp:siemreap'] = { buildings: [], rooms: [], bookings: [
  { id: 'k1', category: 'student', name: 'DTS Oct', from: day(-20), to: day(60), count: 1, people: [{ name: 'Sokha Student', sex: 'm' }], bedIds: [] }
] };
mem.candidates = [];
process.env.GP_GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
globalThis.fetch = async () => ({ ok: true, json: async () => ({ aud: 'test-client.apps.googleusercontent.com', iss: 'https://accounts.google.com', email: 'sokha@example.org', email_verified: 'true', exp: Math.floor(Date.now() / 1000) + 600, name: 'Sokha G', sub: '77' }) });
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(url, init, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|accounts\.google/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.route('**accounts.google.com/**', r => r.abort());
  if (init) await page.addInitScript(init.fn, init.arg);
  await page.goto(BASE + url, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  return { ctx, page };
}
const main = page => page.$eval('#main', e => e.innerText);

/* ---------- staff: 🎓 Students → make a profile → the invite ---------- */
let token;
{
  const { ctx, page } = await open('/teams.html', { fn: u => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), arg: 'hana' });
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('Hospitality has 🎓 Students in the ☰ menu', !!(await page.$('[data-menu-item="students"]')));
  await page.click('[data-menu-item="students"]'); await page.waitForTimeout(800);
  ok('it lists the students staying with us, with Make profile', /Sokha Student/.test(await main(page)) && !!(await page.$('[data-stumake="Sokha Student"]')));
  await page.click('[data-stumake="Sokha Student"]'); await page.waitForTimeout(700);
  token = mem.candidates[0] && mem.candidates[0].portal.invite.token;
  ok('Make profile makes it and offers the invite', !!token && !!(await page.$('[data-stucopy="' + token + '"]')));
  await page.click('[data-stucopy="' + token + '"]:not([data-stushare])'); await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('Copy invite copies a message with the portal join link', /portal\.html\?join=/.test(clip) && clip.includes(token) && /Sokha/.test(clip), clip.slice(0, 120));
  await ctx.close();
}
{
  const { ctx, page } = await open('/teams.html', { fn: u => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), arg: 'cafe' });
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('ordinary staff don\'t have Students', !(await page.$('[data-menu-item="students"]')));
  await ctx.close();
}

/* ---------- the student: the invite page, then the portal's Go to GP app ---------- */
{
  const { ctx, page } = await open('/portal.html?join=' + token);
  ok('the invite page greets them and offers Google', /Hi Sokha/i.test(await main(page)) && !!(await page.$('#googleBtn')), (await main(page)).slice(0, 160));
  await ctx.close();
}
const joined = await call('portalJoin', [token, 'h.p.s']);
ok('(joining with Google makes the account)', joined.ok && joined.token);
const STU = { user: joined.user, pin: joined.token };
{
  const { ctx, page } = await open('/portal.html', { fn: a => localStorage.setItem('gp-portal', JSON.stringify(a)), arg: STU });
  await page.waitForSelector('#goGpApp', { timeout: 8000 }).catch(() => {});
  ok('in the portal a student has their application and a Go to GP app button', !!(await page.$('#goGpApp')) && !!(await page.$('#statusPill')));
  await Promise.all([page.waitForURL(/teams\.html\?student=1/, { timeout: 8000 }).catch(() => {}), page.click('#goGpApp')]);
  await page.waitForTimeout(1200);
  ok('it opens the GP app in student mode', /teams\.html\?student=1/.test(page.url()) && await page.evaluate(() => !!S.student && S.view === 'week'));
  const txt = await main(page);
  ok('a student\'s My Home: hello, weekly goals, habits, mentorship, about me', /Hi Sokha/.test(txt) && !!(await page.$('#sec-goals')) && !!(await page.$('#sec-habits')) && !!(await page.$('#stuMentorCard')) && !!(await page.$('#sec-strengths')), txt.slice(0, 200));
  ok('… no staff things: no ministry, health, support raising or base', !/My Ministry|Support raising|Health check-in/.test(txt) && !(await page.$('#supTile')) && !(await page.$('#dashToBase')));
  ok('the bar: My Home, Schedules, Library — and no bell', (await page.$$eval('nav.bottom [data-tab]', b => b.map(x => x.dataset.tab).join())) === 'week,sched,library' && !(await page.$('#bellBtn')));
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('the menu: Library, My application, Log out', (await page.$$eval('[data-menu-item]', b => b.map(x => x.dataset.menuItem).join())) === 'library,stuportal,boardlogout');
  await page.evaluate(() => { S.menuOpen = false; renderMenu(); });
  const opts = await page.$$eval('#stuMentorSel option', o => o.map(x => x.textContent));
  ok('mentors to choose from are Leadership Development only', opts.length === 2 && /Lina Leader/.test(opts[1]) && !opts.some(o => /Hana|Cafe/.test(o)), JSON.stringify(opts));
  await page.fill('#newGoalText', 'Memorise Psalm 23'); await page.click('#addGoalBtn'); await page.waitForTimeout(700);
  const sid = mem.staff.find(s => s.email === 'sokha@example.org').id;
  ok('a weekly goal saves to the student\'s own place, not staff goals', (mem['stu:' + sid].goals || []).length === 1 && !(mem.goals || []).length && /Memorise Psalm 23/.test(await main(page)));
  ok('… their goal has no ministry KPI link', !!(await page.$('.wgRow')) && !(await page.$('.goalLinkSel')));
  await page.selectOption('#stuMentorSel', 'ld1'); await page.click('#stuMentorAsk'); await page.waitForTimeout(700);
  ok('asking Lina to be their mentor: waiting for her', /Waiting for Lina to accept/.test(await page.$eval('#stuMentorCard', e => e.innerText)));
  await page.click('nav.bottom [data-tab="sched"]'); await page.waitForTimeout(700);
  ok('Schedules open read-only', await page.evaluate(() => S.view === 'sched') && !(await page.$('#schedSave, #schedPublish')));
  await ctx.close();
}
{
  const { ctx, page } = await open('/teams.html?student=1', { fn: a => localStorage.setItem('gp-student', JSON.stringify(a)), arg: STU }, { small: true });
  ok('a student\'s My Home fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await ctx.close();
}

/* ---------- Lina, in Leadership Development, sees and accepts ---------- */
{
  const { ctx, page } = await open('/teams.html', { fn: u => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), arg: 'lina' });
  await page.evaluate(() => { S.view = 'mentor'; S.mentee = null; render(); }); await page.waitForTimeout(400);
  ok('Lina\'s Mentorship page shows the student asking', /Sokha Student, a student, asked you to be their mentor/.test(await main(page)));
  await page.click('[data-stuaccept]'); await page.waitForTimeout(600);
  ok('accepting makes Sokha her student', /Sokha Student/.test(await page.$eval('#stuMentorStaff', e => e.innerText)) && !(await page.$('[data-stuaccept]')));
  await ctx.close();
}
/* ---------- an admin: Admin → Students, by school → Sokha → their app, read only ---------- */
{
  const { ctx, page } = await open('/teams.html', { fn: u => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), arg: 'ada' });
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'home'; render(); }); await page.waitForTimeout(300);
  ok('Admin has a 🎓 Students card', !!(await page.$('[data-adminsub="students"]')));
  await page.click('[data-adminsub="students"]'); await page.waitForTimeout(800);
  const txt = await main(page);
  ok('… the profiles by school, with how each is doing', /DTS/.test(txt) && /Sokha Student/.test(txt) && /Mentor: Lina Leader/.test(txt) && /1 goals this week|goals this week/.test(txt), txt.slice(0, 300));
  await page.click('[data-adminstu]'); await page.waitForTimeout(800);
  const one = await main(page);
  ok('one student: their mentor, weekly goals, habits, strengths and Library', /Sokha Student/.test(one) && /Lina Leader/.test(one) && /Memorise Psalm 23/.test(one) && /of the last 7 days/.test(one) && /Library/.test(one), one.slice(0, 300));
  const before = JSON.stringify(mem['stu:' + mem.staff.find(s => s.email === 'sokha@example.org').id]);
  const myLib = await page.evaluate(() => localStorage.getItem('gp-lib-read'));
  await page.click('#adminStuPreview'); await page.waitForTimeout(600);
  ok('See their app: their My Home, as they see it, under a read-only bar', await page.evaluate(() => S.student && !!S.stuPreview && S.view === 'week') && /Hi Sokha/.test(await main(page)) && /Memorise Psalm 23/.test(await main(page)) && !!(await page.$('.stuPreviewBar')) && !(await page.$('#bellBtn')));
  ok('… the same bar as theirs: My Home, Schedules, Library', (await page.$$eval('nav.bottom [data-tab]', b => b.map(x => x.dataset.tab).join())) === 'week,sched,library');
  await page.fill('#newGoalText', 'Admin typed this'); await page.click('#addGoalBtn'); await page.waitForTimeout(600);
  ok('… nothing an admin does there is saved to the student', JSON.stringify(mem['stu:' + mem.staff.find(s => s.email === 'sokha@example.org').id]) === before);
  await page.click('nav.bottom [data-tab="library"]'); await page.waitForTimeout(500);
  ok('… and the admin\'s own Library marks are left alone', (await page.evaluate(() => localStorage.getItem('gp-lib-read'))) === myLib);
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('the menu in the preview: Library and Back to Admin', (await page.$$eval('[data-menu-item]', b => b.map(x => x.dataset.menuItem).join())) === 'library,stuexit');
  await Promise.all([page.waitForNavigation({ timeout: 8000 }).catch(() => {}), page.click('[data-menu-item="stuexit"]')]);
  await page.waitForTimeout(1500);
  ok('Back to Admin: yourself again, on Sokha\'s profile', await page.evaluate(() => !S.student && !S.stuPreview && S.view === 'admin' && S.adminSub === 'stuone') && /Memorise Psalm 23/.test(await main(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('/teams.html', { fn: u => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), arg: 'hana' });
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'students'; render(); }); await page.waitForTimeout(500);
  ok('not an admin: no Admin → Students', !(await page.$('[data-adminstu]')));
  await ctx.close();
}
ok('staff data untouched by the student', !(mem.goals || []).length && !(mem.dailyLogs || []).length && !mem.staff.some(s => s.mentorId));
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
