/* Today on My Home, search from the header, and the app’s own “are you sure?” (teams/19-ux.js). Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('ux-ui');
const OUT = tmpDir('ux-ui-out');
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
  mk({ id: 'st1', name: 'Mark Hill', username: 'mark', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', mentorId: 'st2', mentorStatus: 'approved' }),
  mk({ id: 'st2', name: 'Ann Lee', username: 'ann', email: 'a@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st3', name: 'Bo Chan', username: 'bo', email: 'b@e.com', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'st4', name: 'Cy Ros', username: 'cy', email: 'c@e.com', dept: 'Campus Leadership', ministry: 'Skills Training' }),
  mk({ id: 'st5', name: 'Di Sok', username: 'di', email: 'd@e.com', dept: 'Community Service', ministry: 'Cafe' })
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }];
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
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.board) localStorage.setItem('gp-board', JSON.stringify({ user: a.board, pin: '4321' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km, board: opts.board || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user || opts.board) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
mem.staff[0].isAdmin = true;
const KH = /[ក-៿]/;
const pp = new Date(Date.now() + 7 * 3600e3), today = pp.toISOString().slice(0, 10), dow = pp.getUTCDay();
const g = await call('getGpTasks', ['mark', '1234']);
const inbox = g.lists.find((l) => l.scope === 'personal');
await call('saveGpTask', ['mark', '1234', { listId: inbox.id, title: 'Call the plumber', due: today, assignees: ['st1'] }]);
await call('libSetMonth', ['mark', '1234', 'atomic-habits', 'Atomic Habits', 'Our habits month']);
let dialogs = 0;
const ask = (page) => page.addInitScript(() => localStorage.setItem('gp-ask-test', '1'));

/* ---------- 1. Today ---------- */
{
  const { ctx, page } = await open('mark');
  page.on('dialog', () => { dialogs++; });
  const rows = await page.$$eval('#today .todayRow', (rs) => rs.map((r) => r.innerText.replace(/\s+/g, ' ')));
  ok('My Home has Today on the first screen, above the summary card', rows.length >= 3 && await page.evaluate(() => { const t = document.getElementById('today'), a = document.getElementById('homeHabits'); return !!t && !!a && t.getBoundingClientRect().top < innerHeight * 0.6 && t.getBoundingClientRect().top < a.getBoundingClientRect().top; }), rows.join(' | '));
  ok('… a task due today', rows.some((r) => /1 task is due today or overdue/.test(r)));
  ok('… today’s habits and the month’s book, as gentler rows', rows.some((r) => /habits left today/.test(r)) && rows.some((r) => /This month’s book: Atomic Habits/.test(r)) && (await page.$$('#today .todayRow.soft')).length === 2);
  ok('… the weekly check-in from its day on (on Tuesday its own card)', dow === 2 ? !!(await page.$('#tueCheckin')) && !rows.some((r) => /check-in is due/.test(r)) : (dow === 1 ? !rows.some((r) => /check-in is due/.test(r)) : rows.some((r) => /check-in is due/.test(r))));
  ok('… and the number counts what is firmly waiting, not the gentle rows', Number(await page.$eval('#today .todayN', (e) => e.innerText)) === rows.length - 2);
  await page.screenshot({ path: OUT + '/today.png' });
  await page.click('[data-todaygo="tasks"]'); await page.waitForTimeout(900);
  ok('tapping the task row opens GP Tasks', await page.evaluate(() => S.view === 'tasks') && /Call the plumber/.test(await main(page)));
  await ctx.close();
}

/* ---------- 2. Search ---------- */
{
  const { ctx, page } = await open('mark', { small: true });
  ok('the header has 🔍 and is still one row at 320px', !!(await page.$('#findBtn')) && await page.$eval('header', (h) => h.getBoundingClientRect().height < 80) && await page.evaluate(() => [...document.querySelectorAll('#hbtns button')].every((b) => b.getBoundingClientRect().right <= innerWidth)));
  await page.click('#findBtn'); await page.waitForSelector('#findBox');
  ok('it opens on the places to go', (await page.$$('#findOut .findRow')).length >= 6 && /Go to/i.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.fill('#findBox', 'holiday'); await page.waitForTimeout(150);
  ok('another word for a page finds it: “holiday” → Leave Request', /Leave Request/.test(await page.$eval('#findOut .findRow', (e) => e.innerText)));
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  ok('Enter opens the first result', await page.evaluate(() => S.view === 'leave' && !document.getElementById('findRoot')));
  await page.click('#findBtn'); await page.fill('#findBox', 'ann'); await page.waitForTimeout(150);
  ok('a name finds the person, with their ministry', /People[\s\S]*Ann Lee[\s\S]*Community Service/i.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.evaluate((n) => [...document.querySelectorAll('#findOut .findRow')].find((r) => r.querySelector('b').textContent === n).click(), 'Ann Lee'); await page.waitForTimeout(900);
  ok('… and opens their page', await page.evaluate(() => S.view === 'team' && S.person && S.person.staff && S.person.staff.name === 'Ann Lee') || /Ann Lee/.test(await main(page)));
  await page.click('#findBtn'); await page.fill('#findBox', 'cafe'); await page.waitForTimeout(150);
  ok('a ministry is found', /Ministries[\s\S]*Cafe/i.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.evaluate((n) => [...document.querySelectorAll('#findOut .findRow')].find((r) => r.querySelector('b').textContent === n).click(), 'Cafe'); await page.waitForTimeout(700);
  ok('… and opens on My Ministry', await page.evaluate(() => S.view === 'ministry' && S.mmBrowseMinistry === 'Cafe'));
  await page.click('#findBtn'); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined', null, { timeout: 15000 });
  await page.fill('#findBox', 'grit'); await page.waitForTimeout(200);
  ok('a book is found once the Library has loaded', /Books[\s\S]*Grit/i.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.evaluate((n) => [...document.querySelectorAll('#findOut .findRow')].find((r) => r.querySelector('b').textContent === n).click(), 'Grit'); await page.waitForTimeout(600);
  ok('… and opens the book', await page.evaluate(() => S.view === 'library' && S.libBook === 'grit'));
  await page.click('#findBtn'); await page.fill('#findBox', 'zzzqqq'); await page.waitForTimeout(150);
  ok('nothing found says so', /Nothing found for “zzzqqq”/.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  ok('Esc closes it', !(await page.$('#findRoot')));
  await ctx.close();
}
{
  const { ctx, page } = await open('di', { km: true });
  await page.click('#findBtn'); await page.waitForSelector('#findBox');
  ok('in Khmer the search page is Khmer', KH.test(await page.$eval('#findBox', (e) => e.placeholder)) && KH.test(await page.$eval('#findOut', (e) => e.innerText)));
  await page.fill('#findBox', 'cafe'); await page.waitForTimeout(150);
  ok('someone who is not an admin finds only their own ministries', (await page.$$('#findOut .findRow')).length >= 1 && !/Ponlork|GPDTS/.test(await page.$eval('#findOut', (e) => e.innerText)));
  await ctx.close();
}
{
  const { ctx, page } = await open('', { board: 'mary' });
  ok('a board member has no search (it would find staff)', !(await page.$('#findBtn')));
  await ctx.close();
}

/* ---------- 3. The app’s own “are you sure?” ---------- */
{
  const b = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' }); await ask(b);
  const page = await b.newPage(); let dlg = 0;
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('dialog', (d) => { dlg++; d.dismiss(); });
  await page.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'mark', pin: '1234' })));
  await page.goto(BASE + '/teams.html'); await page.waitForSelector('nav.bottom button'); await page.waitForTimeout(700);
  await page.evaluate(() => { S.view = 'prayer'; render(); }); await page.waitForTimeout(800);
  await page.fill('#prText', 'Rain for the rice'); await page.click('#prSend'); await page.waitForTimeout(900);
  await page.click('[data-prdel]'); await page.waitForSelector('#askYes');
  ok('deleting asks in the app’s own sheet, not the phone’s box', dlg === 0 && /Delete this request\?/.test(await page.$eval('#askMsg', (e) => e.innerText)) && (mem.prayers || []).length === 1);
  await page.click('#askNo'); await page.waitForTimeout(300);
  ok('Cancel closes it and nothing is deleted', !(await page.$('#askRoot')) && (mem.prayers || []).length === 1);
  await page.click('[data-prdel]'); await page.waitForSelector('#askYes'); await page.click('#askYes'); await page.waitForTimeout(900);
  ok('Yes carries on with what was tapped', !(await page.$('#askRoot')) && (mem.prayers || []).length === 0 && dlg === 0);
  /* a question that needs words */
  await page.evaluate(() => { libOpen_(); }); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined'); await page.waitForTimeout(400);
  await page.click('[data-libbook="grit"]'); await page.waitForTimeout(300);
  await page.click('#libMonthSet'); await page.waitForSelector('#askBox');
  await page.fill('#askBox', 'Keep going'); await page.click('#askYes'); await page.waitForTimeout(1000);
  ok('a question that needs words has a box, and its answer is used', mem.libClub.month.siemreap.bookId === 'grit' && mem.libClub.month.siemreap.note === 'Keep going' && dlg === 0);
  /* a deleted task can be put back */
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForSelector('[data-gptopen]'); await page.waitForTimeout(300);
  await page.click('[data-gptopen] >> text=Call the plumber'); await page.waitForSelector('#gptDelete');
  await page.click('#gptDelete'); await page.waitForSelector('#undoRoot');
  ok('deleting a task: gone from the list at once, with Undo, and not yet deleted', !/Call the plumber/.test(await main(page)) && mem.gpTasks.tasks.some((t) => t.title === 'Call the plumber') && !(await page.$('#askRoot')));
  await page.click('#undoBtn'); await page.waitForTimeout(300);
  ok('Undo puts it back', /Call the plumber/.test(await main(page)) && !(await page.$('#undoRoot')));
  await page.click('[data-gptopen] >> text=Call the plumber'); await page.waitForSelector('#gptDelete'); await page.click('#gptDelete');
  await page.waitForTimeout(6200);
  ok('left alone, it is deleted after a few seconds', !mem.gpTasks.tasks.some((t) => t.title === 'Call the plumber') && !(await page.$('#undoRoot')));
  await b.close();
}
{
  const b = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' }); await ask(b);
  const page = await b.newPage(); page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => { localStorage.setItem('gp-staff', JSON.stringify({ user: 'di', pin: '1234' })); localStorage.setItem('gp-lang', 'km'); });
  await page.goto(BASE + '/teams.html'); await page.waitForSelector('nav.bottom button'); await page.waitForTimeout(700);
  await page.evaluate(() => { S.view = 'prayer'; render(); }); await page.waitForTimeout(800);
  await page.fill('#prText', 'សូមអធិស្ឋាន'); await page.click('#prSend'); await page.waitForTimeout(900);
  await page.click('[data-prdel]'); await page.waitForSelector('#askYes');
  ok('in Khmer the question and both buttons are Khmer', KH.test(await page.$eval('#askMsg', (e) => e.innerText)) && KH.test(await page.$eval('#askYes', (e) => e.innerText)) && KH.test(await page.$eval('#askNo', (e) => e.innerText)));
  await b.close();
}
ok('no browser pop-up was used on My Home', dialogs === 0);
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
