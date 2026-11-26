/* The school tool on the page (YDC, Nov 2026, Uriah), against the real api.js: the leader sets up a
   location, a class and the fee; a teacher adds a student and takes their photo with the phone's
   camera (a file here), takes the roll — once online, once with no connection (kept on the phone, sent
   later) — types a paper test's scores, records a payment and sees the receipt; the dashboard adds it
   up, and YDC's numbers have filled in by themselves. Every name is made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('school-ui');
const OUT = tmpDir('school-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Youth Education', ministry: 'YDC', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id },
  o, { pinSalt: o.id, pinHash: H('1234', o.id), google: { sub: 'g' + o.id } });
mem.staff = [
  mk({ id: 'st1', name: 'Lina Leader', username: 'lina', email: 'l@e.com', leads: ['Youth Education|YDC'] }),
  mk({ id: 'st2', name: 'Tom Teacher', username: 'tom', email: 't@e.com' }),
  mk({ id: 'st3', name: 'Cal Fay', username: 'cal', email: 'c@e.com', dept: 'Community Service', ministry: 'Cafe' }),
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
let offline = false;
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    if (offline) { req.socket.destroy(); return; }
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
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_|Failed to load/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { S.view = 'ministry'; render(); window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const KEY = 'siemreap:Youth Education|YDC';
const doc = () => mem['school:' + KEY] || {};
const ent = m => (mem.entries || []).filter(r => r.ministry === 'YDC' && r.metric === m);
const txt = p => p.$eval('#main', e => e.innerText);
const wait = (p, ms) => p.waitForTimeout(ms || 900);
const noSideways = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/* 1. the leader sets the school up */
{
  const { ctx, page } = await open('lina');
  const tabs = await page.$$eval('.mmTabs .gtTab', b => b.map(x => x.textContent));
  ok('YDC’s tabs: Today · Students · Tests · Payments · Dashboard · Tasks · Rocks — no Scoreboard tab (every number counts itself)', tabs.join() === 'Today,Students,Tests,Payments,Dashboard,Tasks,Rocks', tabs.join());
  ok('with no classes yet, Today says to set up', !!(await page.$('#schNoClass')) && !!(await page.$('#schSetupGo')));
  await page.click('#schSetupGo'); await wait(page, 400);
  await page.click('#schAddLoc'); await wait(page, 300);
  await page.fill('#scf_name', 'Village Hall'); await page.click('#schFormSave'); await wait(page);
  ok('a location is added and Back brings the set-up again', /Village Hall/.test(await txt(page)) && !!(await page.$('#schSetup')) && doc().locations.length === 1);
  await page.click('#schAddClass'); await wait(page, 300);
  await page.fill('#scf_name', 'Level 1');
  await page.fill('[data-ppickq="sct"]', 'Tom'); await wait(page, 200);
  await page.click('[data-ppickit="sct|st2"]'); await wait(page, 300);
  await page.click('[data-scday="1"]'); await page.click('[data-scday="3"]'); await page.fill('#scf_time', '16:00');
  await page.click('#schFormSave'); await wait(page);
  const c = (doc().classes || [])[0];
  ok('a class with its teacher (picked from the people picker), days and time', c && c.teacherId === 'st2' && c.days.join() === '1,3' && c.time === '16:00');
  await page.fill('#scs_fee', '5'); await page.fill('#scs_pass', '60'); await page.click('#schSaveSettings'); await wait(page);
  ok('the fee and the pass mark are saved', doc().settings && doc().settings.fee.amount === 5 && doc().settings.passMark === 60);
  ok('the set-up page fits a phone', await noSideways(page));
  await page.screenshot({ path: OUT + '/setup.png', fullPage: true });
  await ctx.close();
}
/* 2. a teacher adds students, takes a photo, the roll, a test, a payment */
{
  const { ctx, page } = await open('tom');
  await page.click('[data-mmtab="scstu"]'); await wait(page, 400);
  ok('a teacher gets no Set up button', !(await page.$('#schSetupGo')));
  for (const [kh, en, sex] of [['សុខា', 'Sokha Test', 'f'], ['', 'Dara Test', 'm'], ['', 'Bopha Test', 'f']]) {
    await page.click('[data-mmtab="scstu"]'); await wait(page, 300);
    await page.click('#schAddStu'); await wait(page, 300);
    if (kh) await page.fill('#scf_kh', kh);
    await page.fill('#scf_en', en); await page.selectOption('#scf_sex', sex);
    await page.fill('#scf_start', await page.evaluate(() => schAddDays_(schToday_(), -30)));
    await page.fill('#scf_guardian', 'Parent ' + en); await page.fill('#scf_guardianPhone', '012 000 111');
    if (en === 'Bopha Test') await page.selectOption('#scf_feemode', 'free');
    await page.click('#schFormSave'); await wait(page);
  }
  ok('three students added; a new one opens on their page', (doc().students || []).length === 3 && !!(await page.$('#schStu')));
  // the photo, from the phone's camera (a file here)
  ok('the photo button asks for the camera', await page.$eval('#schPhotoIn', e => e.getAttribute('capture') === 'environment' && e.accept === 'image/*'));
  await page.click('[data-mmtab="scstu"]'); await wait(page, 300);
  const sokha = doc().students.find(s => s.en === 'Sokha Test');
  await page.click('[data-scstu="' + sokha.id + '"]'); await wait(page, 400);
  await page.setInputFiles('#schPhotoIn', path.join(PUBLIC, 'icon-512.png')); await wait(page, 1800);
  ok('the photo is shrunk and kept in its own blob, a thumb for the grid', !!mem['schphoto:' + KEY + ':' + sokha.id] && !!(mem['schthumbs:' + KEY] || {})[sokha.id] &&
    mem['schphoto:' + KEY + ':' + sokha.id].data.length < 400 * 1024 && doc().students.find(s => s.id === sokha.id).hasPhoto === true);
  ok('… and shows on their page', !!(await page.$('#schStu .schStuPhoto')));
  await page.click('[data-scfaith="salv"]'); await wait(page);
  ok('a faith tick saves with today’s date and counts a salvation', !!doc().students.find(s => s.id === sokha.id).faith.salv && ent('Salvations').reduce((a, r) => a + r.value, 0) === 1);
  await page.screenshot({ path: OUT + '/student.png', fullPage: true });
  // the roll
  await page.click('[data-mmtab="sctoday"]'); await wait(page, 500);
  ok('Today: the class, everyone here to start', (await page.$$('#schRoll [data-scmark]')).length === 3 && (await page.$$('#schRoll .schFace.m-p')).length === 3);
  const dara = doc().students.find(s => s.en === 'Dara Test'), bopha = doc().students.find(s => s.en === 'Bopha Test');
  await page.click('[data-scmark="' + dara.id + '"]'); await wait(page, 150);
  await page.click('[data-scmark="' + bopha.id + '"]'); await page.click('[data-scmark="' + bopha.id + '"]'); await wait(page, 150);
  ok('a tap: absent, a second: late', /1 here · 1 absent · 1 late/.test(await page.$eval('#schRollCount', e => e.innerText)));
  await page.click('#schRollSave'); await wait(page);
  const rolls = Object.values((mem['schoolRoll:' + KEY] || {}).rolls || {});
  ok('the roll is saved', rolls.length === 1 && rolls[0].marks[dara.id] === 'a' && rolls[0].marks[bopha.id] === 'l');
  ok('Days with Classes and Youth Enrolled count themselves', ent('Days with Classes').some(r => r.value === 1 && r.by === 'tool:school') && ent('Youth Enrolled').some(r => r.value === 3));
  await page.screenshot({ path: OUT + '/roll.png', fullPage: true });
  // yesterday's roll with no connection
  const yest = await page.evaluate(() => schAddDays_(schToday_(), -1));
  await page.fill('#schRollDate', yest); await page.dispatchEvent('#schRollDate', 'change'); await wait(page, 300);
  ok('another day starts with everyone here again', (await page.$$('#schRoll .schFace.m-p')).length === 3);
  await page.click('[data-scmark="' + sokha.id + '"]'); await wait(page, 150);
  offline = true; await ctx.setOffline(true);
  await page.click('#schRollSave'); await wait(page, 600);
  ok('no connection: the roll is kept on this phone, and says so', /will send when online/i.test(await page.$eval('#msg', e => e.innerText)) && !!(await page.$('#schPending')) && Object.keys(mem['schoolRoll:' + KEY].rolls).length === 1);
  offline = false; await ctx.setOffline(false);
  await page.evaluate(() => gpQueueFlush()); await wait(page, 1500);
  ok('back online, it is sent', Object.keys(mem['schoolRoll:' + KEY].rolls).length === 2 && !(await page.$('#schPending')));
  await page.evaluate(() => { gpQueuePut_(schQueueKey_(S.schRoll.classId, S.schRoll.date), 'schoolRoll', [S.auth.user, S.auth.pin, schScope_(), S.schRoll.classId, S.schRoll.date, S.schRoll.marks]); gpQueueFlush(); }); await wait(page, 1500);
  ok('sending it again changes nothing (one roll a class a day)', Object.keys(mem['schoolRoll:' + KEY].rolls).length === 2);
  // a test
  await page.click('[data-mmtab="sctest"]'); await wait(page, 400);
  await page.click('#schAddTest'); await wait(page, 300);
  await page.fill('#scf_subject', 'Maths'); await page.fill('#scf_outOf', '20'); await page.dispatchEvent('#scf_outOf', 'change'); await wait(page, 300);
  await page.fill('#scsc_' + sokha.id, '18'); await page.fill('#scsc_' + dara.id, '9');
  await page.click('#schFormSave'); await wait(page);
  const test = (doc().tests || [])[0];
  ok('the paper test’s scores are typed in; blank is absent', test && test.scores[sokha.id] === 18 && test.scores[dara.id] === 9 && !(bopha.id in test.scores));
  ok('Tests Held and Passing Rate count themselves (1 of 2 at 60%)', ent('Tests Held').some(r => r.value === 1) && ent('Passing Rate (%)').some(r => r.value === 50));
  ok('the list shows the average and who passed', /avg 68% · 1 of 2 passed/.test(await page.$eval('#schTests', e => e.innerText)));
  await page.click('[data-scedit="test|' + test.id + '"]'); await wait(page, 400);
  await page.setInputFiles('#schPaperIn', path.join(PUBLIC, 'icon-512.png')); await wait(page, 1800);
  ok('a photo of the marked papers is kept with the test', (doc().tests[0].papers || []).length === 1 && !!(await page.$('.schPaper img')));
  await page.click('#schFormCancel'); await wait(page, 300);
  // a payment
  await page.click('[data-mmtab="scpay"]'); await wait(page, 400);
  const owesText = await page.$eval('#schPay', e => e.innerText);
  ok('who still owes this month: the two paying ones, not the sponsored one', (await page.$$('#schOwes [data-scowe]')).length === 2 && !/Bopha Test/.test(owesText) && /\$10/.test(await page.$eval('#schOwedTotal', e => e.innerText)));
  await page.click('#schOwes [data-scpayfor="' + sokha.id + '"]'); await wait(page, 300);
  ok('Record fills in what they owe', (await page.$eval('#scf_amount', e => e.value)) === '5');
  await page.selectOption('#scf_method', 'aba'); await page.click('#schFormSave'); await wait(page);
  ok('the payment opens its receipt', !!(await page.$('#schReceipt')) && /\$5/.test(await page.$eval('#schReceipt', e => e.innerText)) && /ABA/.test(await page.$eval('#schReceipt', e => e.innerText)));
  await page.screenshot({ path: OUT + '/receipt.png', fullPage: true });
  await page.click('#schBack'); await wait(page, 300);
  ok('… and Sokha no longer owes', (await page.$$('#schOwes [data-scowe]')).length === 1 && /\$5/.test(await page.$eval('#schMonthTotal', e => e.innerText)));
  // the report card
  await page.click('[data-mmtab="scstu"]'); await wait(page, 300);
  await page.click('[data-scstu="' + sokha.id + '"]'); await wait(page, 400);
  await page.click('[data-screport="' + sokha.id + '"]'); await wait(page, 400);
  ok('the report card: attendance and the test', /Maths/.test(await page.$eval('#schReport', e => e.innerText)) && /90%/.test(await page.$eval('#schReport', e => e.innerText)) && !!(await page.$('#schPrint')));
  await page.evaluate(() => { window.print = () => { window.__printed = document.body.classList.contains('schPrintOn'); }; });
  await page.click('#schPrint'); await wait(page, 200);
  ok('Print prints the report card alone', await page.evaluate(() => window.__printed === true));
  // events and the dashboard
  await page.click('[data-mmtab="scdash"]'); await wait(page, 400);
  await page.click('#schAddEvent'); await wait(page, 300);
  await page.fill('#scf_title', 'Christmas party'); await page.click('#schFormSave'); await wait(page);
  ok('a party counts in Parties Thrown', ent('Parties Thrown').some(r => r.value === 1));
  const dash = await txt(page);
  ok('the dashboard: students, by location, attendance, owed, fruit', (await page.$eval('#schDashStudents', e => e.innerText)) === '3' && /Village Hall/.test(dash) && /%/.test(await page.$eval('#schDashAtt', e => e.innerText)) && !!(await page.$('#schFruit')) && !!(await page.$('#schFollow')));
  ok('nothing scrolls sideways', await noSideways(page));
  await page.screenshot({ path: OUT + '/dash.png', fullPage: true });
  await ctx.close();
}
/* 3. Khmer, and someone outside YDC */
{
  const { ctx, page } = await open('tom', { km: true });
  ok('in Khmer the tabs are Khmer', /[ក-៿]/.test(await page.$eval('.mmTabs', e => e.innerText)));
  await page.click('[data-mmtab="scstu"]'); await wait(page, 400);
  ok('a student’s Khmer name shows first in Khmer', /សុខា/.test(await page.$eval('#schStudents', e => e.innerText)));
  ok('fits a phone in Khmer', await noSideways(page));
  await ctx.close();
}
{
  const { ctx, page } = await open('cal');
  const can = await page.evaluate(() => (mmOptions_() || []).some(o => o.min === 'YDC'));
  ok('someone outside YDC has no way to it', !can);
  const r = await page.evaluate(() => new Promise(res => run('schoolBoard', [S.auth.user, S.auth.pin, { dept: 'Youth Education', ministry: 'YDC' }], res, () => res(null))));
  ok('… and the server says no', r && r.ok === false && !r.data);
  await ctx.close();
}
ok('no script errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
