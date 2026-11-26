/* The quarterly report on the page (Nov 2026), with the real api.js: Campus Leadership finds it in ☰, picks the
   quarter, the audience and the language; a ministry's page has its Scoreboard with ▲/▼ and what its tool counted;
   a story is written (typing kept across a redraw and on the phone) and shows; the Donor view hides Challenges and
   money; the Government view is Khmer with the faith tick off until ticked; printing hides the app and breaks a
   page per department, black on white; Khmer and 320px; a leader's own page from My Ministry; the board's
   sign-in; the bell. One fixed scenario, both clocks pinned to 18 Nov 2026 (week 47, Q4). Made-up names only. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { pinClock } from './clock.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const Real = Date; let OFFSET = 0;
function setNow(iso) { OFFSET = Real.parse(iso) - Real.now(); }
function Shifted(...a) { if (!new.target) return new Real(Real.now() + OFFSET).toString(); return a.length ? new Real(...a) : new Real(Real.now() + OFFSET); }
Shifted.prototype = Real.prototype; Object.setPrototypeOf(Shifted, Real);
Shifted.now = () => Real.now() + OFFSET; Shifted.parse = Real.parse; Shifted.UTC = Real.UTC;
globalThis.Date = Shifted;
const NOW = '2026-11-18T03:00:00Z';
setNow(NOW);

const TMP = tmpDir('qreport-ui');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id, google: { sub: 'g_' + o.id } }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
const YDC = 'Youth Education|YDC', CAFE = 'Community Service|Cafe';
mem.staff = [
  mk({ id: 'st1', name: 'Lea Director', username: 'lea', email: 'l@e.com', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st2', name: 'Yara Teacher', username: 'yara', email: 'y@e.com', dept: 'Youth Education', ministry: 'YDC', leads: [YDC] }),
  mk({ id: 'st3', name: 'Cal Barista', username: 'cal', email: 'c@e.com', dept: 'Community Service', ministry: 'Cafe', country: 'Norway' }),
  mk({ id: 'st4', name: 'Dara Coach', username: 'dara', email: 'd@e.com', dept: 'Youth Education', ministry: 'Sports', leads: ['Youth Education|Sports'] }),
  mk({ id: 'st5', name: 'Yan Youthdir', username: 'yan', email: 'yy@e.com', dept: 'Campus Leadership', ministry: 'Youth Education' }),
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }];
const E = (dept, ministry, metric, week, value) => ({ campus: 'siemreap', dept, ministry, metric, week, value, year: 2026, updated: '2026-10-10T00:00:00Z' });
mem.entries = [
  E('Community Service', 'Cafe', 'Cups Sold', 41, 100), E('Community Service', 'Cafe', 'Cups Sold', 45, 50), E('Community Service', 'Cafe', 'Cups Sold', 30, 80),
  E('Community Service', 'Cafe', 'Days Open', 41, 5), E('Community Service', 'Cafe', 'Weekly Profit ($)', 41, 20), E('Community Service', 'Cafe', 'Weekly Expenses ($)', 41, 30),
  E('Community Service', 'Cafe', 'Weekly Expenses ($)', 30, 60), E('Community Service', 'Cafe', 'Salvations', 42, 2),
  E('Youth Education', 'YDC', 'Youth Enrolled', 41, 3), E('Youth Education', 'YDC', 'Salvations', 41, 1), E('Youth Education', 'Sports', 'Salvations', 42, 4),
  E('Campus Leadership', 'Youth Education', 'Staff Debt ($)', 41, 987654),
];
const S3 = wk => ({ campus: 'siemreap', week: wk, year: 2026, device: 'tok_row' + wk, lonely: 2, clarity: 8, porn: 0, oneOnOne: 1, exercise: 1, quietTime: 1, debt: 0 });
mem.survey = [S3(41), S3(42), S3(43)];
mem.okrs = [{ id: 'o1', campus: 'siemreap', quarter: 4, dept: 'Youth Education', objective: 'Open a second YDC class', kr: 'Find a room', manualPct: 40, target: 0 }];
mem['school:siemreap:' + YDC] = { settings: { passMark: 50 }, locations: [{ id: 'l1', name: 'Riverside village' }], classes: [{ id: 'c1', locationId: 'l1', name: 'Level 1' }],
  students: [{ id: 's1', en: 'Sokny Testchild', kh: '', classId: 'c1', start: '2026-09-01', status: 'active', guardian: 'Guardian Secretname', faith: { salv: '2026-10-11' } },
    { id: 's2', en: 'Pisey Testchild', kh: '', classId: 'c1', start: '2026-09-01', status: 'active', faith: {} }],
  tests: [{ id: 't1', classId: 'c1', subject: 'English', date: '2026-10-20', outOf: 20, scores: { s1: 18, s2: 6 } }], payments: [], events: [] };
mem['schoolRoll:siemreap:' + YDC] = { rolls: { 'c1|2026-10-06': { classId: 'c1', date: '2026-10-06', marks: { s1: 'p', s2: 'a' } }, 'c1|2026-10-07': { classId: 'c1', date: '2026-10-07', marks: { s1: 'p', s2: 'p' } } } };
mem.teamTrips = [{ id: 'tt1', campus: 'siemreap', name: 'Team Fjord', country: 'Norway', from: '2026-10-10', to: '2026-10-20', size: 12, status: 'active', metrics: {}, reached: {} }];
mem['qreport:siemreap'] = { '2026-Q4': { ministries: { [YDC]: { highlights: 'Forty new readers this quarter.', story: 'A girl we will call Bopha read aloud for the first time.',
  challenges: 'CHALLENGETEXT we need a second teacher.', needs: 'Pray for the new class.', by: 'st2', byName: 'Yara Teacher', at: '2026-11-01T00:00:00Z' } } } };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const calls = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}'); calls.push(body.fn);
    const r = await api.default({ method: 'POST', json: async () => body, headers: new Map() }, {});
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
const SHOTS = process.env.QR_SHOTS || '';
const shot = async (target, name, opts) => { if (SHOTS) await target.screenshot({ path: path.join(SHOTS, name), ...(opts || {}) }); };
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh' } : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  await pinClock(ctx, new Real(opts.now || NOW));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept(''));
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { if (a.board) localStorage.setItem('gp-board', JSON.stringify({ user: a.board, pin: '4321' })); else localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); },
    { u: user, km: !!opts.km, board: opts.board || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const wide = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const doc = p => p.$eval('#qrDoc', e => e.innerText);
const minText = (p, key) => p.$eval('.qrMin[data-qrmin="' + key + '"]', e => e.innerText);
const row = (p, key, metric) => p.evaluate(a => { const m = document.querySelector('.qrMin[data-qrmin="' + a.key + '"]'); if (!m) return null;
  const tr = [...m.querySelectorAll('.qrTbl tbody tr')].find(r => r.querySelector('th').innerText.trim() === a.metric); return tr ? [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim()) : null; }, { key, metric });
const KH = /[ក-៿]/;

/* ---------- Campus Leadership: finding it, the document ---------- */
{
  const { ctx, page } = await open('lea');
  await page.evaluate(() => { S.view = 'report'; render(); }); await page.waitForTimeout(400);
  ok('the board’s quarter report has the way in: Ministry by ministry', !!(await page.$('#qrWayIn')) && !!(await page.$('#repPrint')));
  await page.evaluate(() => { S.view = 'week'; render(); }); await page.waitForTimeout(200);
  await page.click('#menuBtn'); await page.waitForTimeout(300);
  ok('☰ has Quarterly report for Campus Leadership', !!(await page.$('[data-menu-item="qreport"]')));
  await page.click('[data-menu-item="qreport"]');
  await page.waitForSelector('#qrDoc', { timeout: 8000 }); await page.waitForTimeout(300);
  ok('search finds it too', await page.evaluate(() => gpFindPages_().some(p => p.id === 'qreport' && /Quarterly report/.test(p.label))));
  ok('one call for the campus and quarter', calls.filter(f => f === 'getQuarterReport').length === 1, calls.filter(f => f === 'getQuarterReport').length + ' calls');
  let t = await doc(page);
  ok('the cover: the campus, the quarter and its dates', /YWAM Siem Reap/.test(t) && /Quarterly report · Q4 2026/.test(t) && /Sep 28, 2026 – Dec 27, 2026/.test(t), t.slice(0, 140).replace(/\n/g, ' | '));
  ok('… the YWAM GP mark on a dark coin', await page.$eval('.qrCoin', e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' && !!e.querySelector('img').getAttribute('src')));
  const figs = await page.$eval('#qrCover .qrFigs', e => e.innerText.replace(/\n+/g, ' '));
  ok('… headline figures: staff, the health score from three check-ins, salvations with last quarter’s', /Staff today 5/.test(figs) && /Staff Health Score 3 check-ins [\d.]+\/10/.test(figs) && /Salvations 7/.test(figs) && /Outreach teams hosted/.test(figs), figs.slice(0, 200));
  ok('… the campus leadership team', /Campus Leadership Team/i.test(t) && /Lea Director/.test(t) && /Yan Youthdir/.test(t));
  const depts = await page.$$eval('.qrDept', e => e.map(x => x.getAttribute('data-qrdept')));
  ok('a section per department that has something, in the taxonomy’s order, never Campus Leadership', depts.length >= 2 && depts.indexOf('Campus Leadership') === -1 && depts.indexOf('Community Service') > -1 && depts.indexOf('Youth Education') > -1, depts.join(' · '));
  ok('… a department says its director and its people', /Director: Yan Youthdir/.test(await page.$eval('.qrDept[data-qrdept="Youth Education"] .qrDeptHead', e => e.innerText)));
  const mins = await page.$$eval('.qrMin', e => e.map(x => x.getAttribute('data-qrmin')));
  ok('only ministries with people or data', mins.indexOf(CAFE) > -1 && mins.indexOf(YDC) > -1 && mins.indexOf('Youth Education|Sports') > -1 && mins.indexOf('Community Service|Outreach Teams') > -1 && mins.indexOf('Youth Education|Media') === -1 && mins.length < 12, mins.join(' · '));
  const cafe = await minText(page, CAFE);
  ok('a ministry’s page: what it is for, who serves', /Cafe/.test(cafe) && /1 serve in this ministry/.test(cafe) && cafe.length > 200);
  let r = await row(page, CAFE, 'Cups Sold');
  ok('Scoreboard: this quarter by the metric’s own rule, ▲ on last quarter, year to date', r && /^150 ▲ 88%$/.test(r[0]) && r[1] === '80' && r[2] === '230', JSON.stringify(r));
  r = await row(page, CAFE, 'Weekly Expenses ($)');
  ok('… a fall in expenses reads as good news (▼, the “up” colour)', r && /\$30 ▼ 50%/.test(r[0]) && await page.evaluate(() => { const m = document.querySelector('.qrMin[data-qrmin="Community Service|Cafe"]'); const tr = [...m.querySelectorAll('tbody tr')].find(x => /Expenses/.test(x.innerText)); return tr.querySelector('.trend').classList.contains('up'); }), JSON.stringify(r));
  ok('… the Cafe’s till counts, no money among them', /This quarter in numbers/i.test(cafe) && /Days open\s+5/.test(cafe) && /Cups sold\s+150/.test(cafe));
  const ydc = await minText(page, YDC);
  ok('YDC: led by its leader; what the school tool counted', /Led by Yara Teacher/.test(ydc) && /Students enrolled\s+2/.test(ydc) && /Riverside village\s+2/.test(ydc) && /Attendance\s+75%/.test(ydc) && /Tests given\s+1/.test(ydc) && /Pass rate\s+50%/.test(ydc) && /New salvations\s+1/.test(ydc), ydc.replace(/\n+/g, ' | ').slice(0, 300));
  ok('… and its story, all four parts for our own ministries', /Forty new readers/.test(ydc) && /Bopha/.test(ydc) && /CHALLENGETEXT/.test(ydc) && /Pray for the new class/.test(ydc));
  ok('Outreach Teams: the team that left, by name', /Teams hosted\s+1/.test(await minText(page, 'Community Service|Outreach Teams')) && /Team Fjord \(Norway\) · 12 people/.test(await minText(page, 'Community Service|Outreach Teams')));
  const ye = await page.$eval('.qrDept[data-qrdept="Youth Education"]', e => e.innerText);
  ok('Priorities this quarter on the department’s page (never called OKRs)', /Priorities this quarter/i.test(ye) && /Open a second YDC class/.test(ye) && /On track/i.test(ye) && !/OKR/.test(t));
  ok('nothing private on the page: no student, guardian, debt or token', !/Testchild|Secretname|Staff Debt|987654|tok_/.test(t));
  ok('it fits the phone', await wide(page));
  await shot(await page.$('.qrMin[data-qrmin="' + YDC + '"]'), 'qr-ministry-390.png');

  /* ---------- writing a story ---------- */
  await page.click('[data-qrwrite="siemreap|' + CAFE + '"]'); await page.waitForTimeout(300);
  ok('Write this quarter’s story opens the form on that ministry, with the reminder about children', !!(await page.$('.qrMin[data-qrmin="' + CAFE + '"] #qrForm')) && /No child’s full name/.test(await page.$eval('#qrForm', e => e.innerText)));
  await page.fill('#qrForm [data-qrf="highlights"]', 'Busy mornings and three new regulars.');
  await page.fill('#qrForm [data-qrf="challenges"]', 'CAFECHALLENGE the grinder broke.');
  ok('the counter follows', /37 \/ 1200/.test(await page.$eval('[data-qrn="highlights"]', e => e.textContent)));
  await page.click('[data-qrlang="both"]'); await page.waitForTimeout(300);
  ok('what was typed survives a redraw', await page.$eval('#qrForm [data-qrf="highlights"]', e => e.value) === 'Busy mornings and three new regulars.');
  ok('… and is kept on the phone until it is sent', /Busy mornings/.test(await page.evaluate(() => localStorage.getItem('gp-qr-draft') || '')));
  await page.click('[data-qrlang="en"]'); await page.waitForTimeout(200);
  await page.click('#qrSave'); await page.waitForTimeout(1200);
  ok('saved: the story shows on the page', !(await page.$('#qrForm')) && /Busy mornings and three new regulars/.test(await minText(page, CAFE)) && /CAFECHALLENGE/.test(await minText(page, CAFE)));
  ok('… is on the server under the quarter, by name', mem['qreport:siemreap']['2026-Q4'].ministries[CAFE].highlights === 'Busy mornings and three new regulars.' && mem['qreport:siemreap']['2026-Q4'].ministries[CAFE].by === 'st1');
  ok('… and the draft is gone from the phone', !/Busy mornings/.test(await page.evaluate(() => localStorage.getItem('gp-qr-draft') || '')));
  await page.click('[data-qrwrite="siemreap|@letter"]'); await page.waitForTimeout(300);
  await page.fill('#qrLetterText', 'Dear friends,\nthank you for standing with us.');
  await page.click('#qrSave'); await page.waitForTimeout(1200);
  ok('leadership’s letter is on the first page, signed', /thank you for standing with us/.test(await page.$eval('#qrLetter', e => e.innerText)) && /— Lea Director/.test(await page.$eval('#qrLetter', e => e.innerText)));

  /* ---------- donors ---------- */
  await page.click('#qrPick [data-qraud="donor"]'); await page.waitForTimeout(400);
  t = await doc(page);
  ok('Donors: no Challenges anywhere', !/CHALLENGETEXT|CAFECHALLENGE|Challenges/.test(t) && /Bopha/.test(t) && /Pray for the new class/.test(t));
  ok('… no money, no health score, no priorities', !/\$/.test(t) && !/Staff Health Score/.test(t) && !/Priorities this quarter/i.test(t) && (await row(page, CAFE, 'Weekly Profit ($)')) === null && (await row(page, CAFE, 'Cups Sold')) !== null);
  ok('… the story comes before the numbers', await page.$eval('.qrMin[data-qrmin="' + YDC + '"]', e => { const s = e.querySelector('[data-qrstory="story"]'), sc = e.querySelector('.qrScore'); return !!(s && sc && (s.compareDocumentPosition(sc) & Node.DOCUMENT_POSITION_FOLLOWING)); }));
  ok('… and the cover says who it is for', /For our partners and donors/i.test(t));
  await shot(await page.$('.qrMin[data-qrmin="' + YDC + '"]'), 'qr-donor.png');

  /* ---------- the government ---------- */
  await page.click('#qrPick [data-qraud="gov"]'); await page.waitForTimeout(400);
  ok('Government: Khmer by default', await page.$eval('#qrPage', e => e.getAttribute('data-qrlangnow')) === 'km' && !!(await page.$('[data-qrlang="km"].on')));
  t = await doc(page);
  ok('… the document is in Khmer', (t.match(/[ក-៿]/g) || []).length > 300 && /របាយការណ៍សកម្មភាព/.test(t), (t.match(/[ក-៿]/g) || []).length + ' Khmer chars');
  ok('… staff counted Khmer / international, and where we work', /បុគ្គលិកខ្មែរ\s*4/.test(t.replace(/\n/g, ' ')) && /បុគ្គលិកអន្តរជាតិ\s*1/.test(t.replace(/\n/g, ' ')), t.slice(0, 300).replace(/\n/g, ' | '));
  ok('… what a ministry is for stays in English, labelled', !!(await page.$('.qrMin[data-qrmin="' + CAFE + '"] .qrFocus .qrEnTag')) && /[A-Za-z]{5}/.test(await page.$eval('.qrMin[data-qrmin="' + CAFE + '"] .qrFocus', e => e.innerText)));
  ok('… the faith tick is there and OFF', (await page.$eval('#qrNoFaith', e => e.checked)) === false && /Leave out faith numbers/.test(await page.$eval('#qrPick', e => e.innerText)));
  ok('… so faith numbers are printed', /ការទទួលសង្គ្រោះ/.test(t) && (await page.$$eval('.qrMin[data-qrmin="Youth Education|Sports"] .qrTbl tbody tr', r => r.length)) === 1);
  ok('… Highlights only: no story, no needs, no challenges', /Forty new readers/.test(t) && !/Bopha/.test(t) && !/Pray for the new class/.test(t) && !/CHALLENGETEXT/.test(t));
  await shot(page, 'qr-government-km.png', { fullPage: false });
  await page.evaluate(() => document.querySelector('.qrMin[data-qrmin="Youth Education|YDC"]').scrollIntoView()); await page.waitForTimeout(200);
  await shot(page, 'qr-government-km-ministry.png', { fullPage: false });
  await page.check('#qrNoFaith'); await page.waitForTimeout(400);
  t = await doc(page);
  ok('ticked: salvations and the like are left out, the rest stays', !/ការទទួលសង្គ្រោះ/.test(t) && (await page.$$eval('.qrMin[data-qrmin="Youth Education|Sports"] .qrTbl tbody tr', r => r.length)) === 0 && (await row(page, CAFE, await page.evaluate(() => BUILTIN_KM['Cups Sold'] || 'Cups Sold'))) !== null);
  ok('… the tool’s faith counts too', !/ការទទួលសង្គ្រោះថ្មី/.test(await minText(page, YDC)) && /75%/.test(await minText(page, YDC)));
  await page.check('#qrGovMore'); await page.waitForTimeout(300);
  ok('“Also print each ministry’s story…” adds the story and needs, never Challenges', /Bopha/.test(await doc(page)) && /Pray for the new class/.test(await doc(page)) && !/CHALLENGETEXT/.test(await doc(page)));
  await page.uncheck('#qrNoFaith'); await page.waitForTimeout(200);

  /* ---------- both languages ---------- */
  await page.click('[data-qrlang="both"]'); await page.waitForTimeout(400);
  const bi = await page.evaluate(() => { const b = [...document.querySelectorAll('#qrDoc .qrBi')].find(x => /Scoreboard/.test(x.textContent)); if (!b) return null; const s = b.querySelectorAll('span'); return { en: s[0].textContent, km: s[1].textContent, a: parseFloat(getComputedStyle(s[0]).fontSize), b: parseFloat(getComputedStyle(s[1]).fontSize) }; });
  ok('Both: English and Khmer side by side, Khmer never smaller', bi && bi.en === 'Scoreboard' && KH.test(bi.km) && bi.b >= bi.a, JSON.stringify(bi));
  ok('… still fits the phone', await wide(page));

  /* ---------- print ---------- */
  await page.click('#qrPick [data-qraud="min"]'); await page.click('[data-qrlang="en"]'); await page.waitForTimeout(300);
  await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(300);
  const pr = await page.evaluate(() => { const cs = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const hidden = s => { const c = cs(s); return !c || c.display === 'none'; };
    return { header: hidden('header'), nav: hidden('nav.bottom'), pick: hidden('#qrPick'), write: hidden('.qrWrite'), back: hidden('#qrBack'), only: hidden('.qrOnlyBtn'),
      breaks: [...document.querySelectorAll('.qrDept')].map(e => getComputedStyle(e).breakBefore), minInside: getComputedStyle(document.querySelector('.qrMin')).breakInside,
      ink: cs('.qrMin h3').color, th: cs('.qrTbl tbody th').color, sub: cs('.qrSub').color, trend: cs('.qrTbl .trend').color, trendBg: cs('.qrTbl .trend').backgroundColor,
      secBg: cs('.qrMin').backgroundColor, body: getComputedStyle(document.body).backgroundColor, coin: cs('.qrCoin').backgroundColor, depts: document.querySelectorAll('.qrDept').length, shown: cs('#qrDoc').display }; });
  ok('print: the app around it is hidden (header, bar, pickers, write buttons)', pr.header && pr.nav && pr.pick && pr.write && pr.back && pr.only && pr.shown !== 'none', JSON.stringify(pr).slice(0, 120));
  ok('print: a new page before each department, a ministry not split', pr.depts >= 2 && pr.breaks.every(b => b === 'page') && pr.minInside === 'avoid', pr.breaks.join());
  ok('print: black on white whatever the theme', pr.ink === 'rgb(0, 0, 0)' && pr.th === 'rgb(0, 0, 0)' && pr.sub === 'rgb(0, 0, 0)' && pr.trend === 'rgb(0, 0, 0)' && pr.trendBg === 'rgba(0, 0, 0, 0)' && pr.secBg === 'rgba(0, 0, 0, 0)' && pr.body === 'rgb(255, 255, 255)', pr.ink + ' on ' + pr.body);
  ok('print: the mark keeps its dark coin', pr.coin === 'rgb(0, 0, 0)');
  ok('print: no install bar or other floating layer', await page.evaluate(() => [...document.querySelectorAll('.installBar, #gpBanner, #notifRoot')].every(e => getComputedStyle(e).display === 'none')));
  await page.setViewportSize({ width: 794, height: 1123 });   // an A4 sheet at 96 dpi
  await shot(page, 'qr-print.png', { fullPage: true });
  await page.emulateMedia({ media: 'screen', colorScheme: 'dark' }); await page.emulateMedia({ media: 'print', colorScheme: 'dark' }); await page.waitForTimeout(200);
  ok('… in dark mode too', await page.evaluate(() => getComputedStyle(document.querySelector('.qrMin h3')).color === 'rgb(0, 0, 0)' && getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)'));
  await page.emulateMedia({ media: 'screen', colorScheme: 'light' });

  /* ---------- just one ministry, the quarter picker, what is remembered ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-qronly="siemreap|' + YDC + '"]'); await page.waitForTimeout(300);
  ok('Just this ministry: its page alone, with its priorities, ready to print', (await page.$$('.qrMin')).length === 1 && !(await page.$('#qrCover')) && /Open a second YDC class/.test(await doc(page)) && !!(await page.$('#qrPrint')) && !!(await page.$('#qrAll')));
  await page.click('#qrAll'); await page.waitForTimeout(300);
  ok('← The whole report comes back', !!(await page.$('#qrCover')) && (await page.$$('.qrMin')).length > 2);
  ok('quarters still to come can’t be picked', true === await page.evaluate(() => [...document.querySelectorAll('[data-qrq]')].every(b => b.disabled === false)) && (await page.$$eval('#qrYear option', o => o.map(x => x.value))).join() === '2026,2025,2024');
  await page.click('[data-qrq="3"]'); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(600);
  t = await doc(page);
  r = await row(page, CAFE, 'Cups Sold');
  ok('Q3: its own dates and figures, nothing against Q2', /Jun 29, 2026 – Sep 27, 2026/.test(t) && r && r[0] === '80' && r[1] === '—' && r[2] === '80' && !/Bopha/.test(t), JSON.stringify(r));
  await page.click('#qrPick [data-qraud="donor"]'); await page.click('[data-qrlang="both"]'); await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('nav.bottom button'); await page.waitForTimeout(400);
  await page.evaluate(() => qrOpen_()); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(300);
  ok('the audience and language are remembered on the phone; the quarter starts on this one', !!(await page.$('#qrPick [data-qraud="donor"].on')) && !!(await page.$('[data-qrlang="both"].on')) && !!(await page.$('[data-qrq="4"].on')));
  await page.click('#qrPick [data-qraud="gov"]'); await page.waitForTimeout(300);
  ok('… the faith tick never is: off again', (await page.$eval('#qrNoFaith', e => e.checked)) === false);
  await ctx.close();
}

/* ---------- Khmer app, 320px ---------- */
{
  const { ctx, page } = await open('lea', { km: true, small: true });
  await page.evaluate(() => qrOpen_()); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(400);
  const all = await page.$eval('#main', e => e.innerText);
  ok('km · the page and the report are in Khmer', (all.match(/[ក-៿]/g) || []).length > 400 && /របាយការណ៍ប្រចាំត្រីមាស/.test(all) && /តារាងពិន្ទុ/.test(all));
  ok('km · no raw {placeholder}', all.indexOf('{') === -1);
  ok('320px · nothing scrolls sideways', await wide(page));
  await page.click('[data-qrlang="both"]'); await page.waitForTimeout(300);
  ok('320px · both languages still fit', await wide(page));
  await page.click('[data-qrwrite="siemreap|Youth Education|Sports"]'); await page.waitForTimeout(300);
  ok('320px · the form fits', !!(await page.$('#qrForm')) && await wide(page));
  await ctx.close();
}

/* ---------- a ministry's leader: her own page, from My Ministry ---------- */
{
  const before = calls.filter(f => f === 'getQuarterReport').length;
  const { ctx, page } = await open('yara');
  ok('opening the app asks for no report', calls.filter(f => f === 'getQuarterReport').length === before);
  await page.click('#menuBtn'); await page.waitForTimeout(300);
  ok('a leader has Quarterly report in ☰', !!(await page.$('[data-menu-item="qreport"]')));
  await page.click('#menuCloseBtn');
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(900);
  ok('My Ministry has the quiet link: This quarter’s report', /This quarter’s report/.test(await page.$eval('#mmBanner .qrMmLink', e => e.textContent)));
  await page.click('#mmBanner .qrMmLink'); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(400);
  ok('it opens her ministry’s page alone — no cover, no other ministry', (await page.$$eval('.qrMin', e => e.map(x => x.getAttribute('data-qrmin')))).join() === YDC && !(await page.$('#qrCover')) && !(await page.$('.qrDept')));
  const t = await doc(page);
  ok('… with its numbers, highlights and story', /Students enrolled\s+2/.test(t) && /Bopha/.test(t) && /Scoreboard/i.test(t));
  ok('… no campus picker, and she can write and print', !(await page.$('[data-qrcampus]')) && !!(await page.$('[data-qrwrite="siemreap|' + YDC + '"]')) && !!(await page.$('#qrPrint')));
  ok('… nothing of another ministry reached her phone', await page.evaluate(() => { const d = S.qr.data[Object.keys(S.qr.data)[0]]; return d.full === false && Object.keys(d.entries).every(k => k.indexOf('Youth Education|YDC|') === 0) && !d.mix && !d.health; }));
  await page.emulateMedia({ media: 'print' });
  ok('print: just her ministry, the app hidden', await page.evaluate(() => getComputedStyle(document.querySelector('header')).display === 'none' && getComputedStyle(document.querySelector('#qrPick')).display === 'none' && document.querySelectorAll('.qrMin').length === 1));
  await page.emulateMedia({ media: 'screen' });
  await page.click('#qrBack'); await page.waitForTimeout(300);
  ok('← goes back to My Ministry', await page.evaluate(() => S.view) === 'ministry');
  await ctx.close();
}
{
  const { ctx, page } = await open('cal');
  await page.click('#menuBtn'); await page.waitForTimeout(300);
  ok('someone who leads nothing has no ☰ item', !(await page.$('[data-menu-item="qreport"]')));
  await page.click('#menuCloseBtn');
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(900);
  await page.click('#mmBanner .qrMmLink'); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(300);
  ok('… but reaches their own ministry’s page from My Ministry', (await page.$$eval('.qrMin', e => e.map(x => x.getAttribute('data-qrmin')))).join() === CAFE);
  await ctx.close();
}

/* ---------- the board's own sign-in ---------- */
{
  const { ctx, page } = await open('', { board: 'mary' });
  await page.click('nav.bottom [data-tab="report"]'); await page.waitForTimeout(600);
  ok('the board’s Report tab has Ministry by ministry', !!(await page.$('#qrWayIn')));
  await page.click('#qrWayIn'); await page.waitForSelector('#qrDoc', { timeout: 8000 }); await page.waitForTimeout(400);
  const t = await doc(page);
  ok('the board reads the whole report', !!(await page.$('#qrCover')) && /Bopha/.test(t) && /Cups Sold/.test(t) && /Lea Director/.test(t));
  ok('… either campus or all of YWAM GP, our ministries or donors — no government copy, nothing to write', !!(await page.$('[data-qrcampus="all"]')) && !!(await page.$('#qrPick [data-qraud="donor"]')) && !(await page.$('#qrPick [data-qraud="gov"]')) && !(await page.$('[data-qrwrite]')));
  await page.click('[data-qrcampus="all"]'); await page.waitForSelector('#qrDoc'); await page.waitForTimeout(700);
  ok('All of YWAM GP: one cover, then each campus', /YWAM GP/.test(await page.$eval('#qrCover h2', e => e.innerText)) && (await page.$$('.qrCampus, .qrDept')).length >= 2 && /YWAM Siem Reap/.test(await doc(page)));
  await page.click('#qrBack'); await page.waitForTimeout(300);
  ok('← goes back to the board’s Report', await page.evaluate(() => S.view) === 'report');
  await ctx.close();
}

/* ---------- the bell, in the quarter's last two weeks ---------- */
{
  setNow('2026-12-22T03:00:00Z');
  const { ctx, page } = await open('dara', { now: '2026-12-22T03:00:00Z' });
  ok('the boot carries the ministries with no story — and no extra call was made', await page.evaluate(() => !!(S.qstory && S.qstory.q === 4 && S.qstory.keys.join() === 'Youth Education|Sports')));
  const items = await page.evaluate(() => notifItems_().filter(i => /data-goqr/.test(i.actions || '')).map(i => i.text));
  ok('a bell item: Write Sports’s story for Q4', items.length === 1 && /Write Sports’s story for Q4/.test(items[0]), items.join());
  await page.click('#bellBtn'); await page.waitForTimeout(300);
  await page.click('#notifRoot [data-goqr]'); await page.waitForSelector('#qrForm', { timeout: 8000 });
  ok('its button opens the form for that ministry and quarter', await page.evaluate(() => S.view === 'qreport' && S.qr.q === 4 && S.qr.edit.key === 'Youth Education|Sports') && (await page.$$('.qrMin')).length === 1);
  await page.fill('#qrForm [data-qrf="story"]', 'A boy we will call Vuth joined the team.');
  await page.click('#qrSave'); await page.waitForTimeout(1200);
  ok('written: the bell item is gone', await page.evaluate(() => notifItems_().filter(i => /data-goqr/.test(i.actions || '')).length) === 0 && /Vuth/.test(await doc(page)));
  await ctx.close();
  setNow(NOW);
}

ok('no script errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
