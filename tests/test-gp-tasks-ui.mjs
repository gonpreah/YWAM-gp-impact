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
const NET = { slow: 0, lose: 0 };
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}');
    if (body.fn === 'saveGpTask' && NET.slow) await new Promise((w) => setTimeout(w, NET.slow));   // a slow connection
    const r = await api.default({ method: 'POST', json: async () => body, headers: new Map() }, {});
    const t = await r.text();
    if (body.fn === 'saveGpTask' && NET.lose > 0) { NET.lose--; res.writeHead(502); res.end('lost'); return; }   // saved, but the answer never reaches the phone
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(t); return;
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
const kInboxId = (mem) => ((mem.gpTasks.lists || []).find(l => l.scope === 'personal' && l.ownerId === 'c2' && l.title === 'Inbox') || {}).id;
/* ---------- Cora: the Cafe's own list (made for it), then tasks the Google Tasks way ---------- */
{
  let g = await call('getGpTasks', ['cora', '1234']);
  const cafeL = g.lists.find(l => l.scope === 'ministry' && l.ministry === 'Cafe');
  ok('the Cafe has its designated list, named after it, the first time one of its people opens GP Tasks', !!cafeL && cafeL.title === 'Cafe' && cafeL.canEdit);
  await call('saveGpTaskList', ['cora', '1234', { id: cafeL.id, title: 'Cafe jobs' }]);
  const { ctx, page } = await open('cora');
  ok('My Home\'s card has a GP Tasks row — and Weekly Goals no button of its own any more', !!(await page.$('#goGpTasks')) && !(await page.$('#goGpTasksGoals')));
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
  /* the row of tabs stays put when you tap one (it used to jump back to the start, or to the front) */
  await page.evaluate(() => { const b = document.querySelector('.gtTabs'); b.scrollLeft = 30; b.dispatchEvent(new Event('scroll')); }); await page.waitForTimeout(100);
  const sl0 = await page.$eval('.gtTabs', e => e.scrollLeft);
  await page.click('.gtTab[data-gptlist="' + rd.id + '"]'); await page.waitForTimeout(400);
  ok('tapping a list that is in view leaves the row where it was', sl0 > 0 && (await page.$eval('.gtTabs', e => e.scrollLeft)) === sl0, sl0 + ' → ' + (await page.$eval('.gtTabs', e => e.scrollLeft)));
  await page.click('.gtTab[data-gptlist="' + myList.id + '"]'); await page.waitForTimeout(400);
  ok('… a tab half off the edge is nudged just into view, no further', (await page.$eval('.gtTabs', e => e.scrollLeft)) < sl0 && (await page.$eval('.gtTab.on', e => e.offsetLeft >= e.parentNode.scrollLeft)));
  await page.click('.gtTab[data-gptlist="' + rd.id + '"]'); await page.waitForTimeout(400);
  /* ⋮ is a half-circle wheel: the items on an arc along the right edge, the middle one grown; spin it */
  await page.click('#gtMenuBtn'); await page.waitForTimeout(400);
  const wheelIts = await page.$$eval('#gtWheel .gtMenuIt', b => b.map(x => ({ id: x.id, on: x.classList.contains('on'), sc: x.style.transform, y: x.getBoundingClientRect().top })));
  ok('⋮ opens as a wheel: every item placed on the arc by a transform alone, one grown in the middle', !!(await page.$('#gtWheel.snap')) && wheelIts.length >= 4 && wheelIts.every(x => /translate3d\(/.test(x.sc) && x.y > 0 && x.y < 700) && wheelIts.filter(x => x.on).length === 1 && /scale\(1\.1/.test(wheelIts.find(x => x.on).sc), JSON.stringify(wheelIts));
  const onBefore = wheelIts.find(x => x.on).id;
  await page.mouse.move(120, 500); await page.mouse.wheel(0, 200); await page.waitForTimeout(60);
  ok('… while it spins there is no eased lag and the glass is paused', !!(await page.$('#gtWheel.spinning')) && !(await page.$('#gtWheel.snap')));
  await page.waitForTimeout(400);
  ok('… and it settles with the glass back', !!(await page.$('#gtWheel.snap')) && !(await page.$('#gtWheel.spinning')));
  const onAfter = await page.$eval('#gtWheel .gtMenuIt.on', e => e.id);
  ok('… spinning it moves which one is grown', onAfter !== onBefore, onBefore + ' → ' + onAfter);
  /* Arrange lists: arrows, for those who won't know they can drag a tab */
  ok('… and it has Arrange lists', !!(await page.$('#gtArrange')));
  await page.click('#gtArrange'); await page.waitForTimeout(300);
  const tabsBefore = await page.$$eval('.gtTab[data-gptlist]', b => b.map(x => x.dataset.gptlist));
  ok('Arrange lists: a sheet with every list and ▲ ▼', (await page.$$eval('#gtArrangeSheet .gtArrRow', r => r.length)) === tabsBefore.length);
  await page.click('[data-gtarr="' + rd.id + '|-1"]'); await page.waitForTimeout(600);
  const tabsAfter = await page.$$eval('.gtTab[data-gptlist]', b => b.map(x => x.dataset.gptlist));
  ok('▲ moves the list one place along the row, saved as your order', tabsAfter.indexOf(rd.id) === tabsBefore.indexOf(rd.id) - 1 && (mem.staff.find(s => s.id === 'c1').taskListOrder || []).join() === tabsAfter.join(), tabsBefore.join() + ' → ' + tabsAfter.join());
  await page.click('#gtArrangeDone'); await page.waitForTimeout(300);
  ok('Done closes it, the list still open', !(await page.$('#gtArrangeSheet')) && !!(await page.$('.gtTab.on[data-gptlist="' + rd.id + '"]')));
  /* slide sideways on the list for the next one */
  const swipe = async (dx, sel) => page.evaluate(([dx, sel]) => { const el = document.querySelector(sel || '.gtList'); const mk = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 420 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(200)], changedTouches: [mk(200)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(200 + dx)], bubbles: true })); }, [dx, sel]);
  await swipe(-160); await page.waitForTimeout(400);
  ok('sliding left on the list opens the next list', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === tabsAfter[tabsAfter.indexOf(rd.id) + 1] && !!(await page.$('.gtList.gtSlideL')));
  await swipe(160); await page.waitForTimeout(400);
  ok('… and sliding right comes back', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === rd.id);
  await swipe(-160, '#main'); await page.waitForTimeout(400);
  ok('sliding anywhere on the page works too, not just on the card', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === tabsAfter[tabsAfter.indexOf(rd.id) + 1]);
  await swipe(160, '.gtTabs'); await page.waitForTimeout(400);
  ok('… but not from the row of tabs, which scrolls sideways itself', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === tabsAfter[tabsAfter.indexOf(rd.id) + 1]);
  await swipe(160, '#main'); await page.waitForTimeout(400);
  const swipeMoves = async (dx, dy, cancel) => page.evaluate(([dx, dy, cancel]) => { const el = document.querySelector('.gtList'); const mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(200, 420)], changedTouches: [mk(200, 420)], bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(200 + dx / 4, 420 + dy / 4)], changedTouches: [mk(200 + dx / 4, 420 + dy / 4)], bubbles: true, cancelable: true }));
    el.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(200 + dx, 420 + dy)], changedTouches: [mk(200 + dx, 420 + dy)], bubbles: true, cancelable: true }));
    el.dispatchEvent(new TouchEvent(cancel ? 'touchcancel' : 'touchend', { touches: [], changedTouches: cancel ? [] : [mk(200 + dx, 420 + dy)], bubbles: true })); }, [dx, dy, cancel]);
  await swipeMoves(-120, 60, false); await page.waitForTimeout(400);
  ok('a slightly slanted slide still counts (the direction is read from the first few pixels)', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === tabsAfter[tabsAfter.indexOf(rd.id) + 1]);
  await swipeMoves(140, 0, true); await page.waitForTimeout(400);
  ok('… and a slide the browser cancels still finishes', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === rd.id);
  await swipeMoves(40, 130, false); await page.waitForTimeout(400);
  ok('… but a mostly up-or-down finger is a scroll, not a slide', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === rd.id);
  /* small ‹ › on the list's head do the same */
  await page.click('#gtNextList'); await page.waitForTimeout(400);
  ok('› on the list\'s head opens the next list', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === tabsAfter[tabsAfter.indexOf(rd.id) + 1]);
  await page.click('#gtPrevList'); await page.waitForTimeout(400);
  ok('‹ comes back', (await page.$eval('.gtTab.on', e => e.dataset.gptlist)) === rd.id);
  ok('… the arrows grey out at the ends', (await page.$eval('#gtPrevList', e => e.disabled)) === (tabsAfter.indexOf(rd.id) === 0) && !(await page.$eval('#gtNextList', e => e.disabled)));
  /* sharing the whole list: ⋮ → Share list with someone… → a people search; Kanha gets it as a tab */
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  ok('⋮ on your own list: Share list with someone…', !!(await page.$('#gtShareList')));
  await page.click('#gtShareList'); await page.waitForTimeout(300);
  await page.fill('[data-ppickq="share"]', 'kan'); await page.waitForTimeout(200);
  await page.click('[data-ppickit="share|c2"]'); await page.waitForTimeout(700);
  ok('adding Kanha shares it with her — a chip with ×, and the server knows', (mem.gpTasks.lists.find(l => l.id === rd.id).members || []).join() === 'c2' && !!(await page.$('[data-ppickrm="share|c2"]')));
  await page.click('#gtShareScrim'); await page.waitForTimeout(200);
  ok('… and the list says who it is shared with', /Shared with Kanha/.test(await page.$eval('.gtListHead', e => e.innerText)));
  await page.click('.gtTab[data-gptlist="' + cafeL.id + '"]'); await page.waitForTimeout(300);
  const L = cafeL;
  ok('the Cafe\'s list, open: it says it is the ministry\'s', !!(await page.$('.gtTab.on[data-gptlist="' + L.id + '"]')) && /the ministry’s list/.test(await page.$eval('.gtListHead', e => e.innerText)));
  /* ＋ → New task: title, then 🕒 and 👤 one tap each */
  await page.click('.gtFab'); await page.waitForTimeout(300);
  /* the keyboard: the sheet sits above it (the watcher sets --kb to what the keyboard covers) */
  await page.evaluate(() => document.documentElement.style.setProperty('--kb', '300px')); await page.waitForTimeout(100);
  const sheetBox = await page.$eval('#gtNew', e => { const r = e.getBoundingClientRect(); return { bottom: Math.round(window.innerHeight - r.bottom), h: r.height }; });
  ok('a sheet lifts above the keyboard by what it covers, and shrinks to fit', sheetBox.bottom === 300 && sheetBox.h <= 664 - 300 - 24, JSON.stringify(sheetBox));
  await page.evaluate(() => document.documentElement.style.setProperty('--kb', '0px')); await page.waitForTimeout(100);
  ok('＋ opens New task: a title, details ≡, date/time 🕒, assign 👤, Save', !!(await page.$('#gtNew #gptAddInput')) && !!(await page.$('#gtNewNotesBtn')) && !!(await page.$('#gtNewWhenBtn')) && !!(await page.$('#gtNewWhoBtn')) && !!(await page.$('#gptAddBtn')));
  await page.click('#gtNewWhoBtn'); await page.waitForTimeout(200);
  const firstList = await page.$$eval('[data-ppicklist="new"] [data-ppickit]', b => b.map(x => x.dataset.ppickit));
  ok('👤 opens a people search: the Cafe\'s own people offered first, nobody else until you type', !!(await page.$('[data-ppickq="new"]')) && firstList.includes('new|c2') && !firstList.includes('new|h1') && /Cafe/.test(await page.$eval('[data-ppicklist="new"] .gtPickDept', e => e.textContent)), JSON.stringify(firstList));
  await page.fill('[data-ppickq="new"]', 'han'); await page.waitForTimeout(200);
  ok('… typing a name finds anyone on the campus', (await page.$$eval('[data-ppicklist="new"] [data-ppickit]', b => b.map(x => x.dataset.ppickit))).join() === 'new|h1');
  await page.fill('[data-ppickq="new"]', ''); await page.waitForTimeout(200);
  await page.fill('#gptAddInput', 'Order milk');
  await page.click('#gtNewWhenBtn'); await page.waitForTimeout(200);
  await page.fill('#gptAddDue', day(1)); await page.fill('#gptAddTime', '09:30');
  await page.click('#gtNewNotesBtn'); await page.waitForTimeout(200);
  await page.fill('#gtNewNotes', 'Two crates');
  await page.click('[data-ppickit="new|c2"]'); await page.waitForTimeout(300);
  ok('… tapping someone shows their name on 👤, as a chip with ×', /Kanha/.test(await page.$eval('.gtWho', e => e.innerText)) && !!(await page.$('[data-ppickrm="new|c2"]')));
  await page.click('#gptAddBtn'); await page.waitForTimeout(700);
  const t1 = T().find(t => t.title === 'Order milk');
  ok('Save: the day, the time, the details and Kanha, in one go', t1 && t1.due === day(1) && t1.time === '09:30' && t1.notes === 'Two crates' && t1.assignees.join() === 'c2' && !(await page.$('#gtNew')), JSON.stringify(t1));
  const row = await page.$eval('[data-gptrow="' + t1.id + '"]', e => e.innerText);
  ok('the row: the title, the details, a date chip and the person', /Order milk/.test(row) && /Two crates/.test(row) && /Tomorrow, 9:30/.test(row) && /Kanha/.test(row), row);
  await page.click('.gtFab'); await page.waitForTimeout(200);
  await page.fill('#gptAddInput', 'Wipe the tables'); await page.press('#gptAddInput', 'Enter'); await page.waitForTimeout(600);
  const t2 = T().find(t => t.title === 'Wipe the tables');
  ok('Enter saves it too', !!t2 && !t2.due && !(await page.$('#gtNew')));
  const nextYear = String(new Date().getFullYear() + 1), ylabels = await page.evaluate((y) => [gptWhen_({ due: y + '-03-05' }), gptDayLabel_(y + '-03-05'), calDayLabel_(y + '-03-05'), gptDayLabel_(new Date().getFullYear() + '-12-30')], nextYear);
  ok('a day next year or beyond shows its year — a chip, a divider, the calendar; this year does not', ylabels.slice(0, 3).every(s => s.indexOf(nextYear) > -1) && ylabels[3].indexOf(String(new Date().getFullYear())) === -1, JSON.stringify(ylabels));
  ok('small dividers by day, like Google Tasks: Tomorrow, then No date', (await page.$$eval('.gtDay', d => d.map(x => x.textContent))).join('|') === 'Tomorrow|No date');
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
  await page.evaluate(() => window.scrollBy(0, 200)); await page.waitForTimeout(200);   // the last row up from under the round ＋
  await drag('[data-gptgrip="' + t2.id + '"]', '[data-gptitem="' + t1.id + '"]', 0, -10);
  ok('… let go under “Tomorrow”, it takes that day', T().find(t => t.id === t2.id).due === day(1) && (await page.$$eval('.gtDay', d => d.map(x => x.textContent))).join('|') === 'Tomorrow');
  ok('dragging a task by its grip puts it where you let go — and the list keeps that order', (await page.$$eval('[data-gptorder] .gtItem', i => i.map(x => x.dataset.gptitem))).join() === t2.id + ',' + t1.id && T().find(t => t.id === t2.id).order < T().find(t => t.id === t1.id).order);
  /* drag a tab: Cafe jobs before My Tasks — your own order of the lists */
  await drag('.gtTab[data-gptlist="' + L.id + '"]', '.gtTab[data-gptlist="' + myList.id + '"]', -20, 0);
  ok('dragging a tab changes their order, kept for you', (await page.$$eval('.gtTab[data-gptlist]', b => b.map(x => x.dataset.gptlist))).slice(0, 2).join() === L.id + ',' + myList.id && (mem.staff.find(s => s.id === 'c1').taskListOrder || [])[0] === L.id);
  /* tap a task: change it in the sheet; ← keeps it */
  await page.click('[data-gptopen="' + t2.id + '"]'); await page.waitForTimeout(300);
  ok('a task opens in a sheet: title, ≡ details, 🕒 its day (tomorrow, from the drag), 👤 a people search', !!(await page.$('#gtDetail')) && (await page.$eval('#gtDetail [data-gptd="due"]', e => e.value)) === day(1) && !!(await page.$('#gtDetail [data-ppickq="det"]')));
  ok('… and says who added it, and when', /Added by you · /.test(await page.$eval('#gtDetail .gtOrigin', e => e.textContent)), await page.$eval('#gtDetail .gtOrigin', e => e.textContent));
  await page.fill('#gtDetail [data-gptd="due"]', day(2)); await page.waitForTimeout(300);
  await page.fill('#gtDetail [data-ppickq="det"]', 'cor'); await page.waitForTimeout(200);
  await page.click('#gtDetail [data-ppickit="det|c1"]'); await page.waitForTimeout(300);
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
  ok('… a small dot in that colour by the list\'s name, on its tab and its head', !!(await page.$('.gtTab.on .calDot.cal-pink')) && !!(await page.$('.gtListHead .calDot.cal-pink')));
  ok('the list\'s colour on the calendar, picked from the palette', (mem.gpTasks.lists || []).find(l => l.id === L.id).color === 'pink');
  await page.click('.gtTab[data-gptlist="' + myList.id + '"]'); await page.waitForTimeout(300);
  await page.click('.gtFab'); await page.waitForTimeout(200);
  ok('＋ on the Inbox: straight into it, no list to choose', !(await page.$('#gtNewList')) && !!(await page.$('#gptAddInput')));
  await page.fill('#gptAddInput', 'Restock cups'); await page.click('#gtNewWhoBtn'); await page.waitForTimeout(200); await page.fill('[data-ppickq="new"]', 'kanha'); await page.waitForTimeout(200); await page.click('[data-ppickit="new|c2"]'); await page.waitForTimeout(300);
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
  await page.click('#goGpTasks'); await page.waitForTimeout(800);
  const mt = await page.$eval('.gtList', e => e.innerText);
  ok('Kanha\'s Inbox: what she was given, each with where it is from', /Inbox/.test(mt) && /Order milk/.test(mt) && /Restock cups/.test(mt) && /Cafe jobs/.test(mt) && /drag a task onto one of your lists/.test(mt), mt.slice(0, 300));
  const shared = (mem.gpTasks.lists || []).find(l => l.title === 'Reading');
  ok('Cora\'s shared list is a tab for Kanha', !!(await page.$('.gtTab[data-gptlist="' + shared.id + '"]')));
  await page.click('.gtTab[data-gptlist="' + shared.id + '"]'); await page.waitForTimeout(400);
  ok('… "Shared by Cora", and she can add to it', /Shared by Cora/.test(await page.$eval('.gtListHead', e => e.innerText)) && !!(await page.$('.gtFab')));
  await page.click('#gtMenuBtn'); await page.waitForTimeout(200);
  ok('… ⋮ for a list shared with you: no Rename, no Delete, no Share', !(await page.$('#gtRename')) && !(await page.$('#gptListDelete')) && !(await page.$('#gtShareList')));
  await page.click('#gtMenuScrim', { position: { x: 16, y: 60 } }); await page.waitForTimeout(200);
  await page.click('.gtTab[data-gptlist="' + kInboxId(mem) + '"]').catch(() => {}); await page.waitForTimeout(300);
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
  ok('My Ministry: one row of tabs with Tasks among them; the Cafe opens on its tool', !!(await page.$('.mmTabs [data-mmtab="tasks"]')) && !!(await page.$('.mmTabs .gtTab.on[data-cafetab="today"]')) && !(await page.$('#mtFold')));
  await page.click('.mmTabs [data-mmtab="tasks"]'); await page.waitForTimeout(900);
  const mp = await main(page);
  ok('the Tasks tab: the Cafe\'s list, right there under the tabs — no Inbox, no New list', await page.evaluate(() => S.view === 'ministry') && /Cafe jobs/.test(mp) && /Order milk/.test(mp) && !/Inbox/.test(mp) && !(await page.$('#gptNewListBtn')) && !!(await page.$('.gtFab')), mp.slice(0, 200));
  await page.click('.mmTabs [data-cafetab="today"]'); await page.waitForTimeout(500);
  ok('… and back to the tool', !!(await page.$('#cafeOpenBtn')));
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
  ok('… the department\'s people offered first to give it to, in a people search', (await page.$$eval('#leadForm [data-ppicklist="lead"] [data-ppickit]', b => b.map(x => x.dataset.ppickit.split('|')[1]))).slice(0, 2).sort().join() === 'c1,c2' && !!(await page.$('#leadForm [data-ppickq="lead"]')));
  await page.fill('#leadForm [data-ppickq="lead"]', 'kan'); await page.waitForTimeout(200);
  await page.click('#leadForm [data-ppickit="lead|c2"]'); await page.waitForTimeout(300);
  ok('… chosen: a chip with ×', !!(await page.$('#leadForm [data-ppickrm="lead|c2"]')));
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
  /* the calendar: his own tasks and his team's, never another ministry's, though he can see every list */
  await page.click('[data-cttab="calendar"]'); await page.waitForTimeout(900);
  const uCal = await main(page);
  ok('Uriah\'s calendar: his board task (the Leadership team\'s list) — not the Cafe\'s "Order milk", another ministry\'s task', /Find 5 fun activities/.test(uCal) && !/Order milk/.test(uCal) && !/Wipe the tables/.test(uCal), uCal.slice(0, 200));
  await page.click('[data-cttab="tasks"]'); await page.waitForTimeout(600);
  ok('… the board task is there, given to Uriah, with its day', /Find 5 fun activities/.test(myT) && /Uriah/.test(myT) && new RegExp(new Date(day(6) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric' })).test(myT), myT.slice(0, 300));
  await ctx.close();
}
{
  const { ctx, page } = await open('kanha', { small: true });
  const bell = await page.evaluate(() => notifItems_().map(i => i.text).join(' | '));
  ok('Kanha\'s bell: Campus Leadership gave you a task', /Campus Leadership gave you a task: Fix the cafe sign/.test(bell), bell);
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(800);
  ok('GP Tasks fits a 320px phone', await page.evaluate(() => document.documentElement.scrollWidth <= 321));
  /* the Cafe's own tasks page: its list, and what its people were given elsewhere, with where it is from */
  await page.evaluate(() => gptOpenMinistry_('Community Service', 'Cafe')); await page.waitForTimeout(900);
  const cafePage = await page.$eval('.gtList', e => e.innerText);
  ok('the Cafe\'s tasks page shows the board\'s task given to Kanha, from the department\'s list, marked with where it is from', /Fix the cafe sign/.test(cafePage) && /Community Service/.test(cafePage) && /Order milk/.test(cafePage), cafePage.slice(0, 200));
  const signT = T().find(t => t.title === 'Fix the cafe sign');
  ok('… without a grip: it is ordered in its own list', !(await page.$('[data-gptgrip="' + signT.id + '"]')) && !!(await page.$('[data-gptgrip]')));
  await page.click('[data-gptopen="' + signT.id + '"]'); await page.waitForTimeout(400);
  ok('opening it says who added it and that it is from a card on the Leadership board', /Added by Uriah · .*from a card on the Leadership board/.test(await page.$eval('#gtDetail .gtOrigin', e => e.textContent)), await page.$eval('#gtDetail .gtOrigin', e => e.textContent));
  await page.click('#gptClose'); await page.waitForTimeout(300);
  await ctx.close();
}
{
  const { ctx, page } = await open('cora', { q: '?view=tasks' });
  ok('a phone notification\'s link opens GP Tasks', await page.evaluate(() => S.view === 'tasks'));
  await ctx.close();
}
{
  /* made once, however many times Save is pressed or sent */
  const { ctx, page } = await open('cora', { q: '?view=tasks' });
  await page.waitForTimeout(500);
  // Oct 2026 (Uriah): "GP Tasks sometimes produces multiple tasks when creating a task"
  NET.slow = 1500;
  await page.click('.gtFab'); await page.waitForTimeout(200);
  await page.fill('#gptAddInput', 'Fill the water filter');
  await page.click('#gptAddBtn'); await page.waitForTimeout(120);
  ok('a slow save: the button says it’s saving and can’t be pressed again', await page.$eval('#gptAddBtn', (b) => b.disabled && /Saving/.test(b.textContent)));
  await page.press('#gptAddInput', 'Enter'); await page.click('#gptAddBtn', { force: true }).catch(() => {}); await page.press('#gptAddInput', 'Enter');
  await page.waitForTimeout(2200);
  ok('… tapping Save and Enter again meanwhile still makes it once', T().filter(t => t.title === 'Fill the water filter').length === 1 && !(await page.$('#gtNew')), String(T().filter(t => t.title === 'Fill the water filter').length));
  NET.slow = 0; NET.lose = 1;
  await page.click('.gtFab'); await page.waitForTimeout(200);
  await page.fill('#gptAddInput', 'Buy gas for the stove');
  await page.click('#gptAddBtn'); await page.waitForTimeout(800);
  ok('an answer lost on the way: the app says so and keeps the task open', !!(await page.$('#gtNew')) && (await page.$eval('#gptAddInput', (e) => e.value)) === 'Buy gas for the stove' && T().filter(t => t.title === 'Buy gas for the stove').length === 1);
  await page.click('#gptAddBtn'); await page.waitForTimeout(800);
  ok('… trying again gets the one already made, not a second', T().filter(t => t.title === 'Buy gas for the stove').length === 1 && !(await page.$('#gtNew')) && (await page.$$('[data-gptrow]')).length > 0, String(T().filter(t => t.title === 'Buy gas for the stove').length));
  await ctx.close();
}
ok('no page errors', errors.filter(e => !/status of 502/.test(e)).length === 0, errors.filter(e => !/status of 502/.test(e)).slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
