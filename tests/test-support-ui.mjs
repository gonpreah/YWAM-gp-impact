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
import { makePdf, supportTracker, SUP_OUT } from './fin-fixtures.mjs';

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
  await page.screenshot({ path: OUT + '/support-add.png', fullPage: true });
  ok('the new-partner form: a styled name box, a tap for where things are and how often', await page.$eval('#supName', (e) => e.type === 'text' && getComputedStyle(e).paddingLeft !== '0px') &&
    (await page.$$('[data-supstatus]')).length === 4 && (await page.$$('[data-supfreq]')).length === 3 && !(await page.$('#supForm select')));
  await page.fill('#supName', 'Phnom Penh Fellowship'); await page.fill('#supAmt', '100'); await page.click('[data-supstatus="giving"]');
  ok('… a tap changes the choice and keeps what was typed', await page.$eval('#supStatus', (e) => e.value) === 'giving' && await page.$eval('#supName', (e) => e.value) === 'Phnom Penh Fellowship' && !!(await page.$('[data-supstatus="giving"].on')));
  await page.click('#supToday'); await page.click('#supSave'); await page.waitForTimeout(800);
  const k = mem.staff.find((s) => s.id === 'st2');
  ok('adding a partner saves the list', k.support.partners.some((p) => p.name === 'Phnom Penh Fellowship' && p.amount === 100 && p.status === 'giving' && p.last) && /\$700 a month pledged/.test(await main(page)));
  await page.click('[data-supfilter="due"]'); await page.waitForTimeout(300);
  txt = await main(page);
  ok('"To thank or follow up" shows who it has been a while for', /Aunt May/.test(txt) && /Tom & Ann/.test(txt) && !/Grace Church/.test(txt));
  await page.click('[data-supfilter="all"]'); await page.waitForTimeout(200);
  const pid = mem.staff.find((s) => s.id === 'st2').support.partners.find((p) => p.name === 'Pastor Lee').id;
  await page.click('[data-supedit="' + pid + '"]'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/support-edit.png', fullPage: true });
  ok('editing opens the same card above the list, named for who it is', /Edit Pastor Lee/.test(await page.$eval('#supForm', (e) => e.innerText)) && !!(await page.$('[data-supstatus="toask"].on')));
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

/* ---------- 3. who we support, and bringing in a tracker (Oct 2026) ---------- */
{
  let r = await call('saveMySupport', ['dara', '1234', { goal: 0, partners: [{ name: 'X Church', amount: 10, status: 'giving', channel: '  Home church  ' }],
    giving: [{ name: 'Lina', amount: 40, freq: 'month', channel: 'via GP', location: 'Poipet' }, { name: '', amount: 5 }, { name: 'Yearly gift', amount: 120, freq: 'year' }, { name: 'Odd', amount: -3, freq: 'weekly' }] }]);
  ok('who you support is kept: blank names dropped, amounts and frequencies checked', r.ok && r.support.giving.length === 3 && r.support.giving[2].amount === 0 && r.support.giving[2].freq === 'month' && r.support.partners[0].channel === 'Home church');
  ok('… and what goes out a month adds up (a year as a twelfth)', r.givenMonthly === 50);
  await call('saveMySupport', ['dara', '1234', Object.assign({}, r.support, { mentorVisible: true })]);
  mem.staff.find((s) => s.id === 'st3').mentorId = 'st2'; mem.staff.find((s) => s.id === 'st3').mentorStatus = 'approved';
  r = await call('getMenteeLogs', ['kanha', '1234', 'st3']);
  ok('a mentor sees the partners’ totals — never who is supported, or how much goes out', r.ok && r.support && r.support.pledged === 10 && !/Lina|Yearly|givenMonthly|giving"\s*:\s*\[/.test(JSON.stringify(r.support)));
  const boot = JSON.stringify(await call('getMyBoot', ['kanha', '1234']));
  ok('… and nobody else’s boot carries it', !/Lina|Yearly gift/.test(boot));
  mem.staff.find((s) => s.id === 'st3').mentorId = ''; mem.staff.find((s) => s.id === 'st3').mentorStatus = '';
}
{
  const pdf = TMP + '/Giving-Support.pdf'; fs.writeFileSync(pdf, makePdf(supportTracker()));
  const { ctx, page } = await open('kanha');
  await page.evaluate(() => { S.view = 'support'; S.sup = null; render(); }); await page.waitForTimeout(800);
  await page.setInputFiles('#supFile', pdf);
  await page.waitForSelector('.supImport', { timeout: 20000 }).catch(() => {});
  const pv = await page.$eval('.supImport', (e) => e.innerText).catch(() => '');
  ok('a tracker PDF is read on the page, and shown before anything is saved', /7 partners/.test(pv) && /\$925 a month/.test(pv) && /6 you support/.test(pv) && /\$325 a month/.test(pv), pv.replace(/\n/g, ' | '));
  ok('… with both totals checked against the sheet', /Both totals match/.test(pv));
  await page.screenshot({ path: OUT + '/support-import.png', fullPage: true });
  const before = mem.staff.find((s) => s.id === 'st2').support.partners.length;
  await page.click('#supImpAdd'); await page.waitForTimeout(1000);
  let k = mem.staff.find((s) => s.id === 'st2').support;
  ok('"Add to my lists" adds the partners, giving, with their channels and notes', k.partners.length === before + 7 && k.partners.some((p) => p.name === 'The Barretts' && p.status === 'giving' && p.note === 'irregular / partnership' && p.channel === 'Hope Church'));
  ok('… and who you support, with where', k.giving.length === SUP_OUT.length && k.giving.some((g) => g.name === 'dara' && g.location === 'Poipet' && g.amount === 100 && g.channel === 'via GP'));
  let txt = await main(page);
  ok('the page now shows coming in, going out and kept a month', /Coming in\s*\$1,625/.test(txt) && /Going out\s*\$325/.test(txt) && /Kept\s*\$1,300/.test(txt), (txt.match(/Coming in[\s\S]{0,60}/) || [''])[0].replace(/\n/g, ' '));
  ok('… and the partners grouped by how they come, each with its month', /Hope Church · 3\s*\$350 a month/.test(txt) && /Northside · 2\s*\$425 a month/.test(txt));
  await page.click('[data-suptab="out"]'); await page.waitForTimeout(400);
  txt = await main(page);
  ok('"We support": everyone, grouped by how it goes, with the places', /via GP · 3\s*\$175 a month/.test(txt) && /via Bank · 2/.test(txt) && /Poipet\s*\$125/.test(txt) && /Siem Reap\s*\$50/.test(txt));
  await page.screenshot({ path: OUT + '/support-we-support.png', fullPage: true });
  await page.click('#supGAdd'); await page.waitForTimeout(200);
  await page.fill('#supName', 'Bopha'); await page.fill('#supAmt', '30'); await page.fill('#supChannel', 'via GP'); await page.fill('#supLoc', 'Siem Reap');
  await page.click('#supGSave'); await page.waitForTimeout(900);
  k = mem.staff.find((s) => s.id === 'st2').support;
  ok('someone can be added by hand', k.giving.some((g) => g.name === 'Bopha' && g.amount === 30 && g.location === 'Siem Reap') && /via GP · 4\s*\$205 a month/.test(await main(page)));
  const gid = k.giving.find((g) => g.name === 'Hill school').id;
  await page.click('[data-supgedit="' + gid + '"]'); await page.waitForTimeout(200);
  ok('… and edited in the same card above the list', /Edit Hill school/.test(await page.$eval('#supForm', (e) => e.innerText)));
  await page.click('#supGDel'); await page.waitForTimeout(900);
  ok('… or taken off', !mem.staff.find((s) => s.id === 'st2').support.giving.some((g) => g.name === 'Hill school'));
  await page.setInputFiles('#supFile', pdf);
  await page.waitForSelector('.supImport', { timeout: 20000 }).catch(() => {});
  ok('bringing the same tracker in again says they are already there', /are already on your lists/.test(await page.$eval('.supImport', (e) => e.innerText).catch(() => '')));
  await page.click('#supImpAdd'); await page.waitForTimeout(1000);
  k = mem.staff.find((s) => s.id === 'st2').support;
  ok('… and updates them rather than adding them twice', k.partners.filter((p) => p.name === 'Grace Fellowship').length === 1 && k.giving.filter((g) => g.name === 'dara').length === 1);
  ok('the page fits a phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
