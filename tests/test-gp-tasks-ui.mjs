/* GP Tasks in the browser (Oct 2026): a ministry's list, adding with Enter, a day, a time and a person; ticking off; the bell; asking another ministry and the request taken on; My Ministry's Tasks tab; Campus Leadership's view, its saved filter, and a board card that becomes a ministry's task. Real api.js, fake store. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('gp-tasks-ui');
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
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora', email: 'c@e.com' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha', email: 'k@e.com' }),
  mk({ id: 'h1', name: 'Hana Host', username: 'hana', email: 'h@e.com', dept: 'Skills Training', ministry: 'Hospitality' }),
  mk({ id: 'l1', name: 'Uriah Lead', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director' })
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


const day = n => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
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
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); }, { u: user });
  await page.goto(BASE + '/teams.html' + (opts.q || ''), { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const OUT_SHOT = process.env.SHOTS || TMP;
const main = p => p.$eval('#main', e => e.innerText);
const T = () => (mem.gpTasks || { tasks: [] }).tasks;

/* ---------- Cora: a list for the Cafe, then tasks the Google Tasks way ---------- */
{
  const { ctx, page } = await open('cora');
  ok('My Home\'s card has a GP Tasks row, and Weekly Goals a GP Tasks button', !!(await page.$('#goGpTasks')) && !!(await page.$('#goGpTasksGoals')));
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('… and ☰ has GP Tasks near the top', (await page.$$eval('[data-menu-item]', b => b.map(x => x.dataset.menuItem))).indexOf('tasks') === 1);
  await page.click('[data-menu-item="tasks"]'); await page.waitForTimeout(800);
  ok('it opens GP Tasks like Google Tasks: My Tasks open, + New list, ⋮, and the round ＋ — no For me', await page.evaluate(() => S.view === 'tasks') && /My Tasks/.test(await page.$eval('.gtTab.on', e => e.innerText)) && !(await page.$('[data-gptlist="mine"]')) && !!(await page.$('#gptNewListBtn')) && !!(await page.$('#gtMenuBtn')) && !!(await page.$('.gtFab')));
  const myList = (mem.gpTasks.lists || []).find(l => l.scope === 'personal' && l.ownerId === 'c1');
  ok('My Tasks is made for you on the server', !!myList && myList.title === 'My Tasks');
  ok('the icons are the app\'s line icons, not the ✅ emoji', !!(await page.$('.gtTitle svg')) && !/✅/.test(await main(page)));
  ok('no gap: the page reaches the bottom bar', await page.evaluate(() => document.body.getBoundingClientRect().height >= window.innerHeight - 1));
  await page.click('#gptNewListBtn'); await page.waitForTimeout(200);
  await page.fill('#gptNewTitle', 'Cafe jobs');
  await page.selectOption('#gptNewHome', 'ministry#Community Service|Cafe');
  await page.click('#gptNewSave'); await page.waitForTimeout(700);
  const L = (mem.gpTasks.lists || []).find(l => l.title === 'Cafe jobs');
  ok('a list for the Cafe, its tab open', L && L.scope === 'ministry' && L.ministry === 'Cafe' && !!(await page.$('.gtTab.on[data-gptlist="' + L.id + '"]')));
  /* ＋ → New task: title, then 🕒 and 👤 one tap each */
  await page.click('.gtFab'); await page.waitForTimeout(300);
  ok('＋ opens New task: a title, details ≡, date/time 🕒, assign 👤, Save', !!(await page.$('#gtNew #gptAddInput')) && !!(await page.$('#gtNewNotesBtn')) && !!(await page.$('#gtNewWhenBtn')) && !!(await page.$('#gptAddWho')) && !!(await page.$('#gptAddBtn')));
  const groups = await page.$$eval('#gptAddWho optgroup', g => g.map(x => x.label + ':' + [...x.querySelectorAll('option')].map(o => o.value).join('+')));
  ok('👤 lists the Cafe\'s people first, then everyone else', groups.length === 2 && /^Cafe:/.test(groups[0]) && groups[0].includes('c2') && groups[1].startsWith('Everyone else') && groups[1].includes('h1') && !groups[0].includes('h1'), JSON.stringify(groups));
  await page.fill('#gptAddInput', 'Order milk');
  await page.click('#gtNewWhenBtn'); await page.waitForTimeout(200);
  await page.fill('#gptAddDue', day(1)); await page.fill('#gptAddTime', '09:30');
  await page.click('#gtNewNotesBtn'); await page.waitForTimeout(200);
  await page.fill('#gtNewNotes', 'Two crates');
  await page.selectOption('#gptAddWho', 'c2'); await page.waitForTimeout(200);
  ok('… choosing someone shows their name on 👤', /Kanha/.test(await page.$eval('.gtWho', e => e.innerText)));
  await page.click('#gptAddBtn'); await page.waitForTimeout(700);
  const t1 = T().find(t => t.title === 'Order milk');
  ok('Save: the day, the time, the details and Kanha, in one go', t1 && t1.due === day(1) && t1.time === '09:30' && t1.notes === 'Two crates' && t1.assignees.join() === 'c2' && !(await page.$('#gtNew')), JSON.stringify(t1));
  const row = await page.$eval('[data-gptrow="' + t1.id + '"]', e => e.innerText);
  ok('the row: the title, the details, a date chip and the person', /Order milk/.test(row) && /Two crates/.test(row) && /Tomorrow, 9:30/.test(row) && /Kanha/.test(row), row);
  await page.click('.gtFab'); await page.waitForTimeout(200);
  await page.fill('#gptAddInput', 'Wipe the tables'); await page.press('#gptAddInput', 'Enter'); await page.waitForTimeout(600);
  const t2 = T().find(t => t.title === 'Wipe the tables');
  ok('Enter saves it too', !!t2 && !t2.due && !(await page.$('#gtNew')));
  /* tap a task: change it in the sheet; ← keeps it */
  await page.click('[data-gptopen="' + t2.id + '"]'); await page.waitForTimeout(300);
  ok('a task opens in a sheet: title, ≡ details, 🕒 “Set date and time”, 👤 Assign to…', !!(await page.$('#gtDetail')) && /Set date and time/.test(await page.$eval('#gtDetail', e => e.innerText)) && !!(await page.$('#gtDetail #gptAssignSel')));
  await page.fill('#gtDetail [data-gptd="due"]', day(2)); await page.waitForTimeout(300);
  await page.selectOption('#gtDetail #gptAssignSel', 'c1'); await page.waitForTimeout(200);
  await page.click('#gptClose'); await page.waitForTimeout(700);
  const t2b = T().find(t => t.id === t2.id);
  ok('← keeps what was changed: the day and the person', t2b.due === day(2) && t2b.assignees.join() === 'c1' && !(await page.$('#gtDetail')), JSON.stringify(t2b));
  await page.click('[data-gptdone="' + t2.id + '"]'); await page.waitForTimeout(700);
  ok('the circle ticks it off: done, under Completed (1)', T().find(t => t.id === t2.id).done === true && /Completed \(1\)/.test(await main(page)));
  /* ⋮ */
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  ok('⋮ holds the rest: rename, ask another ministry, delete the list', !!(await page.$('#gtRename')) && !!(await page.$('#gptAskBtn')) && !!(await page.$('#gptListDelete')));
  await page.click('#gtMenuScrim'); await page.waitForTimeout(200);
  await page.click('.gtTab[data-gptlist="' + myList.id + '"]'); await page.waitForTimeout(300);
  await page.click('.gtFab'); await page.waitForTimeout(200);
  ok('＋ on My Tasks: straight into it, no list to choose', !(await page.$('#gtNewList')) && !!(await page.$('#gptAddInput')));
  await page.fill('#gptAddInput', 'Restock cups'); await page.selectOption('#gptAddWho', 'c2');
  await page.click('#gptAddBtn'); await page.waitForTimeout(700);
  const cups = T().find(t => t.title === 'Restock cups');
  ok('… and from your own list it\'s made and given to Kanha in one go', !!cups && cups.listId === myList.id && cups.assignees + '' === 'c2');
  ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: OUT_SHOT + '/gt-list.png' }).catch(() => {});
  await ctx.close();
}
/* ---------- Kanha: told, and it's in My tasks ---------- */
{
  const { ctx, page } = await open('kanha');
  const bell = await page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('Kanha\'s bell: Cora gave you a task', /Cora gave you a task: Order milk/.test(bell), bell);
  ok('… and My Home says 2 open (milk and cups)', /GP Tasks\s*2/.test(await page.$eval('#goGpTasks', e => e.innerText)));
  await page.click('#goGpTasksGoals'); await page.waitForTimeout(800);
  const mt = await main(page);
  ok('My Tasks has what was given to them, each with where it came from: the Cafe\'s list, and Cora\'s own', /Order milk/.test(mt) && /Cafe jobs/.test(mt) && /Restock cups/.test(mt) && /Cora’s list/.test(mt), mt.slice(0, 300));
  /* the Calendar: a task with a day is on it, without any Google Calendar */
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  await page.click('[data-menu-item="calendar"]'); await page.waitForTimeout(900);
  const cal = await main(page);
  ok('the Calendar is a month like Google Calendar\'s, with the task on it', !!(await page.$('.gcGrid')) && !!(await page.$('.gcCell.today')) && /Order milk/.test(cal) && /No calendar is connected yet/.test(cal) && !!(await page.$('.gcDot.cal-task')), cal.slice(0, 300));
  await page.click('[data-caltaskopen]'); await page.waitForTimeout(400);
  ok('tapping it opens the task in GP Tasks, with ← Calendar', await page.evaluate(() => S.view === 'tasks' && !!S.gptOpen) && /Calendar/.test(await page.$eval('#gptBack', e => e.innerText)));
  await ctx.close();
}
/* ---------- Hana: asks the Cafe for help; the Cafe takes it on ---------- */
{
  const { ctx, page } = await open('hana');
  await page.click('#goGpTasks'); await page.waitForTimeout(800);
  ok('Hana doesn\'t see the Cafe\'s list', !/Cafe jobs/.test(await main(page)));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptAskBtn'); await page.waitForTimeout(200);
  await page.selectOption('#gptAskMin', 'Community Service|Cafe');
  await page.fill('#gptAskTitle', 'Coffee for the team arriving Friday');
  await page.fill('#gptAskDue', day(4));
  await page.click('#gptAskSend'); await page.waitForTimeout(700);
  const rq = T().find(t => t.title === 'Coffee for the team arriving Friday');
  ok('Ask another ministry: a request in the Cafe\'s list, from Hospitality', rq && rq.status === 'request' && rq.from.label === 'Hospitality' && rq.listId === (mem.gpTasks.lists.find(l => l.title === 'Cafe jobs') || {}).id);
  ok('… and Hana sees it waiting', /Asked — waiting for Cafe/.test(await main(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('kanha');
  const bell = await page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('the Cafe is told: Hospitality is asking Cafe jobs for help', /Hospitality is asking Cafe jobs for help: Coffee/.test(bell), bell);
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(700);
  await page.click('[data-gptlist="' + mem.gpTasks.lists.find(l => l.title === 'Cafe jobs').id + '"]'); await page.waitForTimeout(400);
  ok('in the Cafe\'s list: the request, with We\'ll do it / Can\'t', /Hana is asking for help/.test(await main(page)) && !!(await page.$('[data-gptaccept]')));
  await page.click('[data-gptaccept]'); await page.waitForTimeout(700);
  ok('We\'ll do it: it\'s one of their tasks now', T().find(t => t.title === 'Coffee for the team arriving Friday').status === 'open' && !(await page.$('[data-gptaccept]')));
  await ctx.close();
}
/* ---------- Kanha in My Ministry: the Cafe's Tasks tab ---------- */
{
  const { ctx, page } = await open('kanha');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(600);
  ok('My Ministry: no Numbers / Tasks switch on top; Ministry Tasks folded under the ministry', !(await page.$('[data-mmtab="ministry"], [data-mmtab="tasks"]')) && !!(await page.$('#mmBanner + #mtFold, #mmBanner ~ #mtFold')) && !(await page.$('#mtFold .gptBar')));
  ok('… and the ministry\'s own page still shows below (the Cafe: its tool and numbers)', !!(await page.$('[data-cafeview], .wkStrip, #kpiInputBtn, .mmTile')));
  await page.click('#mtToggle'); await page.waitForTimeout(900);
  const fold = await page.$eval('#mtFold', e => e.innerText);
  ok('opened: the Cafe\'s list only — not My Tasks or any other', /Cafe jobs/.test(fold) && /Order milk/.test(fold) && !/My Tasks/.test(fold) && !(await page.$('#gptBack')));
  await page.click('#mtFold #gptNewListBtn'); await page.waitForTimeout(200);
  ok('＋ New list inside the ministry: just a name — it is the Cafe\'s', !!(await page.$('#gptNewTitle')) && !(await page.$('#gptNewHome')) && /For Cafe/.test(await page.$eval('#gptNewListSheet', e => e.innerText)));
  await page.click('#gptNewCancel'); await page.waitForTimeout(200);
  await page.click('#mtToggle'); await page.waitForTimeout(300);
  await ctx.close();
}
/* ---------- Uriah: everything, the filter, and a board card for the Cafe ---------- */
{
  const { ctx, page } = await open('uriah');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(800);
  ok('Campus Leadership has a Tasks tab with the others', !!(await page.$('.lwSeg [data-lwtab="tasks"]')));
  await page.click('.lwSeg [data-lwtab="tasks"]'); await page.waitForTimeout(900);
  ok('… every list on the campus', /Cafe jobs/.test(await main(page)) && !!(await page.$('#gtMenuBtn')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  await page.uncheck('[data-gptf="Community Service|Cafe"]');
  await page.click('#gptFilterSave'); await page.waitForTimeout(700);
  ok('unticking the Cafe and saving: kept as the default, and the Cafe\'s list is hidden', JSON.stringify(mem.staff.find(s => s.id === 'l1').taskFilter) === JSON.stringify({ keys: [] }) && !(await page.$('.gtTab:has-text("Cafe jobs")')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  await page.click('#gptFilterAll'); await page.waitForTimeout(700);
  ok('Show everything brings it back', !mem.staff.find(s => s.id === 'l1').taskFilter && !!(await page.$('.gtTab:has-text("Cafe jobs")')));
  await page.click('.lwSeg [data-lwtab="board"]'); await page.waitForTimeout(800);
  await page.click('#leadNew'); await page.waitForTimeout(300);
  await page.fill('#leadForm [data-lf="title"]', 'Fix the cafe sign');
  await page.selectOption('#leadForm [data-lf="taskMin"]', 'Community Service|Cafe'); await page.waitForTimeout(300);
  ok('a card for a ministry: the Cafe\'s people offered first to give it to', (await page.$$eval('#leadForm [data-lf="owner"] option', o => o.map(x => x.value))).slice(1, 3).sort().join() === 'c1,c2');
  await page.selectOption('#leadForm [data-lf="owner"]', 'c2');
  await page.click('#leadSave'); await page.waitForTimeout(900);
  const ct = T().find(t => t.title === 'Fix the cafe sign');
  ok('saved: it is a task in the Cafe\'s list, given to Kanha, from Campus Leadership', ct && ct.assignees.join() === 'c2' && ct.from.label === 'Campus Leadership' && !!ct.cardId);
  await ctx.close();
}
{
  const { ctx, page } = await open('kanha', { small: true });
  const bell = await page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('Kanha\'s bell: Campus Leadership gave you a task', /Campus Leadership gave you a task: Fix the cafe sign/.test(bell), bell);
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(800);
  ok('GP Tasks fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await ctx.close();
}
{
  const { ctx, page } = await open('cora', { q: '?view=tasks' });
  ok('a phone notification\'s link opens GP Tasks', await page.evaluate(() => S.view === 'tasks'));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
