/* Support raising (Oct 2026): your partners and monthly goal, private like staff
   debt — you see and edit the list; your mentor sees totals only and only when you
   tick it; the roster, a teammate's page, admins and leadership see nothing.
   Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('sup-ui');
const OUT = tmpDir('sup-ui-out');
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
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com', mentorId: 'st3', mentorStatus: 'approved' }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com' })
];
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



const call = async (fn, args) => {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return (await r.json().catch(() => null)) || {};
};

/* ---------- 1. the server ---------- */
{
  let r = await call('saveMySupport', ['kanha', '1234', { goal: 1200, mentorVisible: false, partners: [
    { name: 'Grace Church', amount: 500, freq: 'month', status: 'giving', last: '2026-10-01' },
    { name: 'Aunt May', amount: 1200, freq: 'year', status: 'giving', last: '2026-01-01' },
    { name: 'Tom & Ann', amount: 50, freq: 'month', status: 'asked' },
    { name: 'Pastor Lee', status: 'toask' },
    { name: '', amount: 999 }, { name: 'One-off gift', amount: 300, freq: 'once', status: 'giving', last: '2026-09-30' }] }]);
  ok('saving the list: blank names dropped, a year counts as a twelfth, a one-off gift is not monthly', r.ok && r.support.partners.length === 5 && r.summary.pledged === 600 && r.summary.pct === 50, JSON.stringify(r.summary));
  ok('… counts by where things are, and who to thank or follow up (90 days, or never in touch after asking)', r.summary.giving === 3 && r.summary.asked === 1 && r.summary.toask === 1 && r.summary.followUp === 2);
  const roster = JSON.stringify(await call('teamRoster', ['dara', '1234']));
  ok('the roster carries nothing of it', !/Grace Church|support|pledged/.test(roster));
  const prof = JSON.stringify(await call('staffProfile', ['dara', '1234', 'st2']));
  ok('… nor a teammate\'s page', !/Grace Church|support/.test(prof));
  const adm = JSON.stringify(await call('adminListStaff', ['uriah', '1234']));
  ok('… nor the admin\'s staff list', !/Grace Church|support/.test(adm));
  r = await call('getMenteeLogs', ['dara', '1234', 'st2']);
  ok('the mentor sees nothing until it is shared', r.ok && r.support === null);
  await call('saveMySupport', ['kanha', '1234', Object.assign({}, (await call('getMySupport', ['kanha', '1234'])).support, { mentorVisible: true })]);
  r = await call('getMenteeLogs', ['dara', '1234', 'st2']);
  ok('… then the totals, never the names', r.ok && r.support && r.support.pledged === 600 && r.support.goal === 1200 && !/Grace|Aunt|Tom|Lee/.test(JSON.stringify(r)));
  r = await call('getMenteeLogs', ['uriah', '1234', 'st2']);
  ok('someone who is not their mentor gets nothing', r.ok === false);
  r = await call('getMyBoot', ['kanha', '1234']);
  ok('your own boot has your totals for My Home', r.supportSummary && r.supportSummary.pledged === 600 && !/Grace Church/.test(JSON.stringify(r)));
}

/* ---------- 2. the page ---------- */
{
  const { ctx, page } = await open('kanha');
  ok('My Home has a Support raising tile with the month so far', /\$600 of \$1,?200 a month/.test(await page.$eval('#supTile', (e) => e.textContent)));
  await page.click('#supTile'); await page.waitForTimeout(800);
  let txt = await main(page);
  ok('the page: goal, pledged, the partners', /\$600 a month pledged/.test(txt) && /Grace Church/.test(txt) && /Pastor Lee/.test(txt) && /50%/.test(txt));
  await page.screenshot({ path: OUT + '/support.png', fullPage: true });
  await page.click('#supAdd'); await page.waitForTimeout(200);
  await page.fill('#supName', 'Phnom Penh Fellowship'); await page.fill('#supAmt', '100'); await page.selectOption('#supStatus', 'giving');
  await page.click('#supToday'); await page.click('#supSave'); await page.waitForTimeout(800);
  const k = mem.staff.find((s) => s.id === 'st2');
  ok('adding a partner saves the list', k.support.partners.some((p) => p.name === 'Phnom Penh Fellowship' && p.amount === 100 && p.status === 'giving' && p.last) && /\$700 a month pledged/.test(await main(page)));
  await page.click('[data-supfilter="due"]'); await page.waitForTimeout(300);
  txt = await main(page);
  ok('"To thank or follow up" shows who it has been a while for', /Aunt May/.test(txt) && /Tom & Ann/.test(txt) && !/Grace Church/.test(txt));
  await page.click('[data-supfilter="all"]'); await page.waitForTimeout(200);
  const pid = mem.staff.find((s) => s.id === 'st2').support.partners.find((p) => p.name === 'Pastor Lee').id;
  await page.click('[data-supedit="' + pid + '"]'); await page.waitForTimeout(200);
  await page.click('#supDel'); await page.waitForTimeout(800);
  ok('a partner can be removed', !mem.staff.find((s) => s.id === 'st2').support.partners.some((p) => p.name === 'Pastor Lee'));
  await ctx.close();
  const sm = await open('kanha', { small: true });
  await sm.page.evaluate(() => { S.view = 'support'; S.sup = null; render(); }); await sm.page.waitForTimeout(700);
  await sm.page.evaluate(() => { S.supEdit = 'new'; render(); }); await sm.page.waitForTimeout(200);
  ok('the page and its form fit a 320px phone', await sm.page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await sm.ctx.close();
}
{
  const { ctx, page } = await open('dara');
  await page.evaluate(() => { S.view = 'team'; render(); }); await page.waitForTimeout(300);
  await page.evaluate(() => new Promise((res) => run('getMenteeLogs', [S.auth.user, S.auth.pin, 'st2'], (d) => {
    S.view = 'mentor'; S.mentee = d.mentee; S.menteeWeek = null; S.menteeLogs = d.logs; S.menteeGoals = d.goals || []; S.menteeProfile = d.profile; S.menteeCheckins = d.checkins || [];
    S.menteeSupport = d.support || null; S.menteeHabits = d.habits || []; S.menteeMinistry = d.ministry || null; S.menteeTrips = d.trips || null; S.menteeSmart = d.smartGoals || []; render(); res();
  })));
  await page.waitForTimeout(400);
  const txt = await main(page);
  ok('the mentor\'s page shows the totals Kanha shares, and says the names are not shared', /\$700 of \$1,?200 a month/.test(txt) && /never the names/.test(txt) && !/Grace Church/.test(txt));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
