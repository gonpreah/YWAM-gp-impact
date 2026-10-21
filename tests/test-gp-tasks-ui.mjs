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

const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
/* ---------- Cora: the Cafe's own list (made for it), then tasks the Google Tasks way ---------- */
{
  let g = await call('getGpTasks', ['cora', '1234']);
  const cafeL = g.lists.find(l => l.scope === 'ministry' && l.ministry === 'Cafe');
  ok('the Cafe has its designated list, named after it, the first time one of its people opens GP Tasks', !!cafeL && cafeL.title === 'Cafe' && cafeL.canEdit);
  await call('saveGpTaskList', ['cora', '1234', { id: cafeL.id, title: 'Cafe jobs' }]);
  const { ctx, page } = await open('cora');
  ok('My Home\'s card has a GP Tasks row, and Weekly Goals a GP Tasks button', !!(await page.$('#goGpTasks')) && !!(await page.$('#goGpTasksGoals')));
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('… and ☰ has GP Calendar/Tasks near the top', (await page.$$eval('[data-menu-item]', b => b.map(x => x.dataset.menuItem))).indexOf('caltasks') === 1);
  await page.click('[data-menu-item="caltasks"]'); await page.waitForTimeout(800);
  await page.click('[data-cttab="tasks"]'); await page.waitForTimeout(800);
  ok('it opens GP Tasks like Google Tasks: the Inbox open, + New list, ⋮, and the round ＋ — no For me', await page.evaluate(() => S.view === 'tasks') && /Inbox/.test(await page.$eval('.gtTab.on', e => e.innerText)) && !(await page.$('[data-gptlist="mine"]')) && !!(await page.$('#gptNewListBtn')) && !!(await page.$('#gtMenuBtn')) && !!(await page.$('.gtFab')));
  const myList = (mem.gpTasks.lists || []).find(l => l.scope === 'personal' && l.ownerId === 'c1');
  ok('the Inbox is made for you on the server', !!myList && myList.title === 'Inbox');
  ok('the icons are the app\'s line icons, not the ✅ emoji', !!(await page.$('.ctTab.on svg')) && !/✅/.test(await main(page)));
  ok('no gap: the page reaches the bottom bar', await page.evaluate(() => document.body.getBoundingClientRect().height >= window.innerHeight - 1));
  ok('the tabs say which is which: a tray on the Inbox, people on the Cafe\'s', !!(await page.$('.gtTab[data-gptlist="' + myList.id + '"] .gtKind')) && !!(await page.$('.gtTab[data-gptlist="' + cafeL.id + '"] .gtKind')));
  await page.click('#gptNewListBtn'); await page.waitForTimeout(200);
  ok('＋ New list: a name only — it is always your own, no choosing a ministry', !!(await page.$('#gptNewTitle')) && !(await page.$('#gptNewHome')) && /only you see it/.test(await page.$eval('#gptNewListSheet', e => e.innerText)));
  await page.fill('#gptNewTitle', 'Reading'); await page.click('#gptNewSave'); await page.waitForTimeout(700);
  const rd = (mem.gpTasks.lists || []).find(l => l.title === 'Reading');
  ok('… made as a personal list, its tab open', rd && rd.scope === 'personal' && rd.ownerId === 'c1' && !!(await page.$('.gtTab.on[data-gptlist="' + rd.id + '"]')));
  await page.click('.gtTab[data-gptlist="' + cafeL.id + '"]'); await page.waitForTimeout(300);
  const L = cafeL;
  ok('the Cafe\'s list, open: it says it is the ministry\'s', !!(await page.$('.gtTab.on[data-gptlist="' + L.id + '"]')) && /the ministry’s list/.test(await page.$eval('.gtListHead', e => e.innerText)));
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
  /* subtasks: in the sheet, Enter adds one; they show under the row and tick there */
  await page.click('[data-gptopen="' + t1.id + '"]'); await page.waitForTimeout(300);
  await page.fill('#gptSubNew', 'Call the dairy'); await page.press('#gptSubNew', 'Enter'); await page.waitForTimeout(200);
  await page.fill('#gptSubNew', 'Pay the invoice'); await page.press('#gptSubNew', 'Enter'); await page.waitForTimeout(200);
  ok('subtasks typed into the sheet, Enter after each', (await page.$$eval('#gtDetail [data-gptdsubtext]', i => i.map(x => x.value))).join('|') === 'Call the dairy|Pay the invoice');
  await page.click('#gptClose'); await page.waitForTimeout(700);
  const t1s = T().find(t => t.id === t1.id);
  ok('… saved with the task', t1s.subs.length === 2 && t1s.subs[0].text === 'Call the dairy' && !t1s.subs[0].done);
  ok('… and listed under its row', (await page.$$eval('[data-gptitem="' + t1.id + '"] .gtSub', s => s.length)) === 2);
  await page.click('[data-gptsubtick="' + t1.id + '|' + t1s.subs[0].id + '"]'); await page.waitForTimeout(600);
  ok('ticking a subtask in the list saves it', T().find(t => t.id === t1.id).subs[0].done === true);
  /* drag: Wipe the tables above Order milk, by the grip */
  const drag = async (from, to, dx, dy) => { const a = await (await page.$(from)).boundingBox(), b = await (await page.$(to)).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(a.x + a.width / 2 + 2, a.y + a.height / 2 + 2);
    await page.mouse.move(b.x + b.width / 2 + (dx || 0), b.y + b.height / 2 + (dy || 0), { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(700); };
  await drag('[data-gptgrip="' + t2.id + '"]', '[data-gptitem="' + t1.id + '"]', 0, -10);
  ok('dragging a task by its grip puts it where you let go — and the list keeps that order', (await page.$$eval('[data-gptorder] .gtItem', i => i.map(x => x.dataset.gptitem))).join() === t2.id + ',' + t1.id && T().find(t => t.id === t2.id).order < T().find(t => t.id === t1.id).order);
  /* drag a tab: Cafe jobs before My Tasks — your own order of the lists */
  await drag('.gtTab[data-gptlist="' + L.id + '"]', '.gtTab[data-gptlist="' + myList.id + '"]', -20, 0);
  ok('dragging a tab changes their order, kept for you', (await page.$$eval('.gtTab[data-gptlist]', b => b.map(x => x.dataset.gptlist))).slice(0, 2).join() === L.id + ',' + myList.id && (mem.staff.find(s => s.id === 'c1').taskListOrder || [])[0] === L.id);
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
  ok('⋮ holds the rest: rename, colour, ask another ministry, delete the list', !!(await page.$('#gtRename')) && !!(await page.$('#gtColor')) && !!(await page.$('#gptAskBtn')) && !!(await page.$('#gptListDelete')));
  await page.click('#gtColor'); await page.waitForTimeout(200);
  await page.click('[data-gtcolor="pink"]'); await page.waitForTimeout(600);
  ok('the list\'s colour on the calendar, picked from the palette', (mem.gpTasks.lists || []).find(l => l.id === L.id).color === 'pink');
  await page.click('.gtTab[data-gptlist="' + myList.id + '"]'); await page.waitForTimeout(300);
  await page.click('.gtFab'); await page.waitForTimeout(200);
  ok('＋ on the Inbox: straight into it, no list to choose', !(await page.$('#gtNewList')) && !!(await page.$('#gptAddInput')));
  await page.fill('#gptAddInput', 'Restock cups'); await page.selectOption('#gptAddWho', 'c2');
  await page.click('#gptAddBtn'); await page.waitForTimeout(700);
  const cups = T().find(t => t.title === 'Restock cups');
  ok('… and from your own list it\'s made and given to Kanha in one go', !!cups && cups.listId === myList.id && cups.assignees + '' === 'c2');
  await drag('[data-gptgrip="' + cups.id + '"]', '.gtTab[data-gptlist="' + L.id + '"]', 0, 0);
  ok('dropping a task on another list\'s tab moves it there', T().find(t => t.id === cups.id).listId === L.id);
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
  const mt = await page.$eval('.gtList', e => e.innerText);
  ok('Kanha\'s Inbox: what she was given, each with where it is from', /Inbox/.test(mt) && /Order milk/.test(mt) && /Restock cups/.test(mt) && /Cafe jobs/.test(mt) && /drag a task onto one of your lists/.test(mt), mt.slice(0, 300));
  ok('… with a red number on the Inbox tab, and on My Home\'s row', (await page.$eval('.gtTab.on .gtBadge', e => e.innerText)) === '2' && await page.evaluate(() => S.gpTaskInfo.inbox === 2));
  /* filing: a list of her own, then Order milk dragged onto it — it leaves the Inbox, stays in the Cafe's list */
  await page.click('#gptNewListBtn'); await page.waitForTimeout(200);
  await page.fill('#gptNewTitle', 'This week'); await page.click('#gptNewSave'); await page.waitForTimeout(700);
  const tw = (mem.gpTasks.lists || []).find(l => l.title === 'This week');
  const kInbox = (mem.gpTasks.lists || []).find(l => l.scope === 'personal' && l.ownerId === 'c2' && l.title === 'Inbox');
  await page.click('.gtTab[data-gptlist="' + kInbox.id + '"]'); await page.waitForTimeout(300);
  const milk = T().find(t => t.title === 'Order milk');
  const dragK = async (from, to) => { const a = await (await page.$(from)).boundingBox(), b = await (await page.$(to)).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(a.x + a.width / 2 + 2, a.y + a.height / 2 + 2);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800); };
  await dragK('[data-gptgrip="' + milk.id + '"]', '.gtTab[data-gptlist="' + tw.id + '"]');
  const milk2 = T().find(t => t.id === milk.id);
  ok('dragging a given task onto her own list files it there — for her only; it stays in the Cafe\'s list', milk2.listId === milk.listId && milk2.filed.c2 && milk2.filed.c2.list === tw.id && !/Order milk/.test(await page.$eval('.gtList', e => e.innerText)));
  ok('… and the red number drops to 1', (await page.$eval('.gtTab[data-gptlist="' + kInbox.id + '"] .gtBadge', e => e.innerText)) === '1');
  await page.click('.gtTab[data-gptlist="' + tw.id + '"]'); await page.waitForTimeout(300);
  ok('… and This week shows it, with where it is from', /Order milk/.test(await page.$eval('.gtList', e => e.innerText)) && /Cafe jobs/.test(await page.$eval('.gtList', e => e.innerText)));
  /* the Calendar: a task with a day is on it, without any Google Calendar */
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  await page.click('[data-menu-item="caltasks"]'); await page.waitForTimeout(900);
  const cal = await main(page);
  ok('the Calendar is a month like Google Calendar\'s, with the task on it as a bar in its list\'s colour', !!(await page.$('.gcGrid')) && !!(await page.$('.gcCell.today')) && /Order milk/.test(cal) && /No calendar is connected yet/.test(cal) && !!(await page.$('.gcBar.cal-pink[title="Order milk"]')) && !!(await page.$('.gcLayer.on[data-callayer="task"]')), cal.slice(0, 300));
  await page.click('.gcLayer[data-callayer="task"]'); await page.waitForTimeout(300);
  ok('GP Tasks can be ticked off the calendar', !/Order milk/.test(await main(page)));
  await page.click('.gcLayer[data-callayer="task"]'); await page.waitForTimeout(300);
  await page.click('[data-caltaskopen]'); await page.waitForTimeout(400);
  ok('tapping it opens the task in GP Tasks — the Calendar a tab away', await page.evaluate(() => S.view === 'tasks' && !!S.gptOpen) && !!(await page.$('[data-cttab="calendar"]')));
  await ctx.close();
}
/* ---------- Hana: asks the Cafe for help; the Cafe takes it on ---------- */
{
  const { ctx, page } = await open('hana');
  await page.click('#goGpTasks'); await page.waitForTimeout(800);
  ok('Hana doesn\'t see the Cafe\'s list', !/Cafe jobs/.test(await main(page)));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptAskBtn'); await page.waitForTimeout(200);
  ok('which ministry: by department, or search', !!(await page.$('#gptAskFind')) && (await page.$$eval('.gtPickDept', d => d.length)) >= 2 && !!(await page.$('[data-gptaskmin="Community Service|Cafe"]')));
  await page.fill('#gptAskFind', 'caf'); await page.waitForTimeout(200);
  ok('… typing narrows it to the Cafe', (await page.$$eval('[data-gptaskmin]', b => b.map(x => x.dataset.gptaskmin))).join() === 'Community Service|Cafe');
  await page.click('[data-gptaskmin="Community Service|Cafe"]'); await page.waitForTimeout(300);
  ok('… chosen, with Change', /Cafe/.test(await page.$eval('#gptAskChange', e => e.innerText)));
  await page.fill('#gptAskTitle', 'Coffee for the team arriving Friday');
  await page.fill('#gptAskDue', day(4));
  await page.click('#gptAskSend'); await page.waitForTimeout(700);
  const rq = T().find(t => t.title === 'Coffee for the team arriving Friday');
  ok('Ask another ministry: a request in the Cafe\'s list, from Hospitality', rq && rq.status === 'request' && rq.from.label === 'Hospitality' && rq.listId === (mem.gpTasks.lists.find(l => l.title === 'Cafe jobs') || {}).id);
  ok('… and Hana sees it waiting in her Inbox, marked as the Cafe\'s', /Asked — waiting for Cafe/.test(await main(page)) && /Inbox/.test(await page.$eval('.gtTab.on', e => e.innerText)) && !(await page.$('.gtTab:has-text("Cafe jobs")')), JSON.stringify({ on: await page.$eval('.gtTab.on', e => e.innerText).catch(() => '-'), tabs: await page.$$eval('.gtTab', b => b.map(x => x.innerText)), txt: (await main(page)).slice(0, 200) }));
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
  const mp = await main(page);
  ok('Ministry Tasks opens the ministry\'s own GP Tasks page — the same page as your own, with just the Cafe\'s list', await page.evaluate(() => S.view === 'tasks' && S.gptPageScope && S.gptPageScope.min === 'Cafe') && /GP Tasks · Cafe/.test(mp) && /Cafe jobs/.test(mp) && /Order milk/.test(mp) && !/Inbox/.test(mp) && !!(await page.$('.gtFab')) && !!(await page.$('#gtMenuBtn')), mp.slice(0, 200));
  ok('… no ＋ New list there (a ministry has its one list), and ← My Ministry', !(await page.$('#gptNewListBtn')) && /My Ministry/.test(await page.$eval('#gptBack', e => e.innerText)));
  await page.click('#gptBack'); await page.waitForTimeout(500);
  ok('… back on My Ministry', await page.evaluate(() => S.view === 'ministry'));
  await ctx.close();
}
/* ---------- Uriah: everything, the filter, and a board card for the Cafe ---------- */
{
  const { ctx, page } = await open('uriah');
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(800);
  ok('Campus Leadership has no Ministry Tasks tab — the Board is the place', !!(await page.$('.lwSeg [data-lwtab="board"]')) && !(await page.$('.lwSeg [data-lwtab="tasks"]')));
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(900);
  ok('GP Tasks for leadership: only their own lists by default — not every ministry\'s', !(await page.$('.gtTab:has-text("Cafe jobs")')) && !(await page.$('.gtTab:has-text("Hospitality")')) && !!(await page.$('.gtTab:has-text("Leadership team")')) && !!(await page.$('#gtMenuBtn')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  ok('⋮ → Which lists to show: the ministries, none ticked', (await page.$$eval('[data-gptf]', c => c.filter(x => x.checked).length)) === 0);
  await page.check('[data-gptf="Community Service|Cafe"]');
  await page.click('#gptFilterSave'); await page.waitForTimeout(700);
  ok('ticking the Cafe and saving: kept as the default, and the Cafe\'s list shows — Hospitality still not', (mem.staff.find(s => s.id === 'l1').taskFilter || { keys: [] }).keys.join() === 'Community Service|Cafe' && !!(await page.$('.gtTab:has-text("Cafe jobs")')) && !(await page.$('.gtTab:has-text("Hospitality")')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  await page.click('#gptFilterAll'); await page.waitForTimeout(700);
  ok('Show everything: every ministry\'s list', !!(await page.$('.gtTab:has-text("Hospitality")')) && !!(await page.$('.gtTab:has-text("Cafe jobs")')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  await page.click('#gptFilterNone'); await page.waitForTimeout(700);
  ok('Only mine: back to their own', !(await page.$('.gtTab:has-text("Cafe jobs")')) && !!(await page.$('.gtTab:has-text("Leadership team")')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  await page.click('#gptFilterBtn'); await page.waitForTimeout(300);
  await page.click('#gptFilterAll'); await page.waitForTimeout(700);
  await page.click('nav.bottom [data-tab="ministry"]'); await page.waitForTimeout(800);
  await page.click('.lwSeg [data-lwtab="board"]'); await page.waitForTimeout(800);
  await page.click('#leadNew'); await page.waitForTimeout(300);
  await page.fill('#leadForm [data-lf="title"]', 'Fix the cafe sign');
  ok('a card is for a department, not a ministry', (await page.$$eval('#leadForm [data-lf="taskMin"] option', o => o.map(x => x.value))).every(v => !v || /\|$/.test(v)) && /A task for which department/.test(await page.$eval('#leadForm', e => e.textContent)));
  await page.selectOption('#leadForm [data-lf="taskMin"]', 'Community Service|'); await page.waitForTimeout(300);
  ok('… the department\'s people offered first to give it to', (await page.$$eval('#leadForm [data-lf="owner"] option', o => o.map(x => x.value))).slice(1, 3).sort().join() === 'c1,c2');
  await page.selectOption('#leadForm [data-lf="owner"]', 'c2');
  await page.click('#leadSave'); await page.waitForTimeout(900);
  const ct = T().find(t => t.title === 'Fix the cafe sign');
  const ctL = ct && (mem.gpTasks.lists || []).find(l => l.id === ct.listId);
  ok('saved: it is a task in the department\'s list, given to Kanha, from Campus Leadership', ct && ct.assignees.join() === 'c2' && ct.from.label === 'Campus Leadership' && !!ct.cardId && ctL && ctL.scope === 'dept' && ctL.title === 'Community Service');
  /* a task inside a board card → the Leadership team's GP Tasks list, and the owner's My Tasks */
  await call('saveLeadTask', ['uriah', '1234', ct.cardId, { text: 'Find 5 fun activities for the staff offsite', owner: 'l1', due: day(6) }]);
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(900);
  const lead = (mem.gpTasks.lists || []).find(l => l.title === 'Leadership team');
  ok('GP Tasks has a Leadership team list', !!lead && lead.scope === 'dept' && lead.dept === 'Campus Leadership' && !!(await page.$('.gtTab[data-gptlist="' + lead.id + '"]')));
  await page.click('.gtTab[data-gptlist="' + lead.id + '"]'); await page.waitForTimeout(400);
  const myT = await page.$eval('.gtList', e => e.innerText);
  ok('… the board task is there, given to Uriah, with its day', /Find 5 fun activities/.test(myT) && /Uriah/.test(myT) && new RegExp(new Date(day(6) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric' })).test(myT), myT.slice(0, 300));
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
