/* Who's here (Oct 2026): Base's "On campus now" and its page — staff (dimmed when on leave or away), teams with their portal people and photos, students, volunteers, guests and speakers staying tonight. On the real backend. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('whos-here-ui');
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
  mk({ id: 'me', name: 'Sreilea Chan', username: 'sreilea', email: 's@e.com' }),
  mk({ id: 'mt', name: 'Mealea Sok', username: 'mealea', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'd2', name: 'Dara Pen', username: 'dara', email: 'd@e.com' }),
  mk({ id: 'nc', name: 'No Campus', username: 'nocampus', email: 'n@e.com', campus: '' }),
  mk({ id: 'pp', name: 'Poipet Person', username: 'pp', email: 'p@e.com', campus: 'poipet' }),
  mk({ id: 'ap', name: 'Applicant Example', username: 'ap@e.com', email: 'ap@e.com', kind: 'applicant', dept: '', ministry: '' })
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

const day = n => { const d = new Date(Date.now() + 7 * 3600 * 1000 + n * 86400000); return d.toISOString().slice(0, 10); };
mem.trips = [{ id: 't1', staffId: 'd2', campus: 'siemreap', from: day(-2), to: day(3), type: 'personal', status: 'approved', created: day(-5) }];
mem.teamTrips = [{ id: 'tt1', candidateId: 'cdT', campus: 'siemreap', name: 'Grace Church Team', country: 'Australia', from: day(-1), to: day(5), size: 2, status: 'active', metrics: {} }];
mem.candidates = [{ id: 'cdT', type: 'team', campus: 'siemreap', name: 'Pat Leader', stage: 'arrived', portal: { form: { answers: { teamName: 'Grace Church Team', leaderName: 'Pat Leader' } }, members: [{ id: 'm1', name: 'Mia Member', sex: 'f' }], docs: [] }, log: [] }];
mem['tphotos:cdT'] = { photos: { leader: { data: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVQI12P4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', at: day(-3) } } };
mem['hosp:siemreap'] = { buildings: [{ id: 'b1', name: 'House' }], rooms: [], bookings: [
  { id: 'kT', category: 'team', name: 'Grace Church Team', from: day(-1), to: day(5), count: 2, males: 0, females: 2, bedIds: [], tripId: 'tt1' },
  { id: 'kS', category: 'student', name: 'DTS student', from: day(-10), to: '', permanent: true, count: 1, people: [{ name: 'Sokha Student', sex: 'm' }], bedIds: [] },
  { id: 'kV', category: 'volunteer', name: 'Volunteer Example', from: day(0), to: day(2), count: 2, bedIds: [] },
  { id: 'kP', category: 'speaker', name: 'Pastor Example', from: day(-1), to: day(1), count: 1, bedIds: [] },
  { id: 'kOld', category: 'guest', name: 'Old Guest', from: day(-6), to: day(0), count: 1, bedIds: [] },
  { id: 'kNext', category: 'guest', name: 'Future Guest', from: day(2), to: day(4), count: 1, bedIds: [] }
] };

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); }, { u: user });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };

/* ---------- the server ---------- */
{
  const r = await call('getWhosHere', ['sreilea', '1234']);
  ok('staff on the campus, the one on leave marked away; no other campus, no applicants', r.ok && r.staff.map(x => x.id).sort().join() === 'd2,me,mt' && r.staff.find(x => x.id === 'd2').away && r.staff.find(x => x.id === 'd2').away.type === 'personal' && !r.staff.find(x => x.id === 'me').away, JSON.stringify(r.staff));
  ok('tonight\'s bookings by kind: the team with its portal people, the student, volunteers, the speaker — not a stay that ended or one still to come',
    r.groups.team.length === 1 && r.groups.team[0].people.map(p => p.name).join() === 'Pat Leader,Mia Member' && r.groups.student[0].names.join() === 'Sokha Student' && r.groups.volunteer[0].count === 2 && r.groups.speaker.length === 1 && r.groups.guest.length === 0, JSON.stringify(r.groups));
  ok('the count: 2 staff here + 2 team + 1 student + 2 volunteers + 1 speaker = 8', r.count === 8 && r.staffHere === 2 && r.staffAway === 1, r.count);
  ok('someone not signed in gets nothing', (await call('getWhosHere', ['sreilea', '9999'])).ok === false);
  ok('an applicant gets nothing', (await call('getWhosHere', ['ap@e.com', '1234'])).ok === false);
  const ph = await call('whosHereTeamPhotos', ['sreilea', '1234', 'cdT']);
  ok('team photos come one team at a time, by person', ph.ok && ph.photos.leader === 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVQI12P4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==' && !ph.photos.m1);
}

/* ---------- Base → Who's here ---------- */
{
  const { ctx, page } = await open('sreilea');
  await page.click('#menuBtn'); await page.waitForTimeout(250); await page.click('[data-menu-item="base"]'); await page.waitForTimeout(900);
  ok('Base shows how many are on campus now', /On campus now\s*8/.test(await page.$eval('#goWhosHere', e => e.innerText)), await page.$eval('#goWhosHere', e => e.innerText).catch(() => 'none'));
  await page.click('#goWhosHere'); await page.waitForTimeout(900);
  const txt = await page.$eval('#main', e => e.innerText);
  ok('Who\'s here: tonight, 8 people, by kind', /Who’s here/.test(txt) && /8 people on campus/.test(txt) && /Staff\s*2/.test(txt) && /Teams\s*2/.test(txt) && /Students\s*1/.test(txt) && /Volunteers\s*2/.test(txt) && /Speakers\s*1/.test(txt), txt.slice(0, 300));
  const away = await page.$$eval('.whoTile.away', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ')));
  ok('staff on leave are dimmed, with “Off campus right now” and why', away.length === 1 && /Dara Pen/.test(away[0]) && /Off campus right now/.test(away[0]) && /On break/.test(away[0]), JSON.stringify(away));
  ok('… and come after those who are here; no one from Poipet', (await page.$eval('.whoGrid', g => [...g.querySelectorAll('.whoName')].map(x => x.textContent))).pop() === 'Dara Pen' && !/Poipet Person/.test(txt));
  const team = await page.$eval('.whoTeam', e => ({ t: e.innerText, imgs: [...e.querySelectorAll('img.avatar')].map(i => i.src.slice(0, 22)) }));
  ok('the team, with the people its leader listed in the portal, and the leader\'s photo', /Grace Church Team/.test(team.t) && /Pat Leader/.test(team.t) && /Leader/.test(team.t) && /Mia Member/.test(team.t) && team.imgs.length === 1 && team.imgs[0] === 'data:image/jpeg;base64', JSON.stringify(team));
  ok('students, volunteers and the speaker by name; not the guest who left or the one still to come', /Sokha Student/.test(txt) && /Staying long-term/.test(txt) && /Volunteer Example/.test(txt) && /\+1/.test(txt) && /Pastor Example/.test(txt) && !/Old Guest|Future Guest/.test(txt));
  await page.click('#whosBack'); await page.waitForTimeout(400);
  ok('← goes back to Base', await page.evaluate(() => S.view === 'base'));
  await ctx.close();
}
/* ---------- My Home → Who's here ---------- */
{
  const { ctx, page } = await open('sreilea');
  await page.waitForTimeout(600);
  ok('My Home shows how many are on campus now', await page.evaluate(() => S.view === 'week') && /On campus now\s*8/.test(await page.$eval('#goWhosHereHome', e => e.innerText).catch(() => 'none')), await page.$eval('#goWhosHereHome', e => e.innerText).catch(() => 'none'));
  await page.click('#goWhosHereHome'); await page.waitForTimeout(900);
  ok('… tap it: Who\'s here, with ← My Home', /8 people on campus/.test(await page.$eval('#main', e => e.innerText)) && /My Home/.test(await page.$eval('#whosBack', e => e.innerText)));
  await page.click('#whosBack'); await page.waitForTimeout(400);
  ok('… and back goes to My Home', await page.evaluate(() => S.view === 'week'));
  await ctx.close();
}
{
  const { ctx, page } = await open('sreilea', { small: true });
  await page.evaluate(() => { S.view = 'whoshere'; render(); whosHereLoad_(true); }); await page.waitForTimeout(900);
  ok('Who\'s here fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321) && !!(await page.$('.whoTile')));
  await ctx.close();
}
/* someone with no campus set is answered for the default campus — Base must not keep asking and redrawing */
{
  const { ctx, page } = await open('nocampus');
  let asks = 0;
  page.on('request', r => { if ((r.postData() || '').indexOf('getWhosHere') > -1) asks++; });
  await page.click('#menuBtn'); await page.waitForTimeout(250); await page.click('[data-menu-item="base"]');
  await page.waitForTimeout(2500);
  ok('no campus set: Base asks at most once and settles (no redraw loop)', asks <= 1 && await page.evaluate(() => !!S.whosHere) && !!(await page.$('#goWhosHere')), 'asked ' + asks + ' times');
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
