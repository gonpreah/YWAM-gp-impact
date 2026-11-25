/* The leadership meeting, in the browser — against the real api.js (Nov 2026, Uriah).

   Campus Leadership → Board → Meeting: set up a scorecard number (typed, and one linked to a ministry's
   metric), a rock, a headline; run a whole meeting start to end — the clock, one part a screen, who is here,
   drop an off-track number to Issues, tick and carry to-dos, rank the issues 1-2-3, identify / discuss /
   solve one (the decision lands on its card, a to-do lands in GP Tasks), messages, ratings, End — and find
   it under Past meetings. A second leader's phone shows the same part. The meeting day is a setting, and the
   schedule tab follows it. Khmer, and a 320px phone. Every name is made up. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('lead-meeting-ui');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: '', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id, google: { sub: 'g-' + o.id }, leads: [], ministries: [] }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st_d', name: 'Dee Director', username: 'dee', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st_o', name: 'Oli Overseer', username: 'oli', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st_c', name: 'Cafe Cam', username: 'cam', dept: 'Community Service', ministry: 'Cafe' }),
];
const call = async (fn, args) => (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json();
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = new Date(today + 'T12:00:00Z').getUTCDay();
/* the board as the team left it: two issues waiting, a project with last week's to-dos */
const D = ['dee', '1234'];
await call('saveLeadCard', D.concat([{ title: 'Water pump keeps failing', type: 'agenda', col: 'agenda', notes: 'Third time this month' }]));
await call('saveLeadCard', D.concat([{ title: 'Who covers reception in January', type: 'agenda', col: 'agenda' }]));
const proj = (await call('saveLeadCard', D.concat([{ title: 'Staff retreat', type: 'project', col: 'doing' }]))).saved.id;
await call('saveLeadTask', D.concat([proj, { text: 'Book the venue', owner: 'st_o', due: today }]));
await call('saveLeadTask', D.concat([proj, { text: 'Send the invite', owner: 'st_d', due: addDays(today, -1) }]));
const g0 = await call('getLeadMeeting', D);
mem.entries = [{ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', metric: 'Cups Sold', week: g0.weeks[1].week, year: g0.weeks[1].year, value: 180 }];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const sent = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}'); sent.push(body.fn);
    const r = await api.default({ method: 'POST', json: async () => body, headers: new Map() }, {});
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json' }); res.end(await r.text()); return;
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
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: opts.width || 390, height: opts.height || 860 }, timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(o => { sessionStorage.setItem('gp-lw-tab', o.tab); if (!localStorage.getItem('gp-test-started')) { localStorage.setItem('gp-test-started', '1'); localStorage.setItem('gp-staff', JSON.stringify({ user: o.user, pin: '1234' })); if (o.lang) localStorage.setItem('gp-lang', o.lang); } }, { user, tab: opts.tab || 'board', lang: opts.lang || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.click('nav.bottom [data-tab="ministry"]');
  await page.waitForSelector('[data-leadtab], #lbMeetGo', { timeout: 10000 });
  return { ctx, page };
}
const txt = (page, sel) => page.$eval(sel, e => e.innerText);
const wait = (page, ms) => page.waitForTimeout(ms || 450);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

console.log('=== the way in ===');
const { ctx, page } = await open('dee', { tab: 'base' });
await page.waitForSelector('#lbMeetGo', { timeout: 8000 });
ok('the Overview has a way in: the next meeting and who leads, beside the tiles that were there', /Next meeting/.test(await txt(page, '#lbMeetGo')) && /Nobody is down to lead yet/.test(await txt(page, '#lbMeetGo')) && !!(await page.$('#lbOkrTile')) && !!(await page.$('#lbBoardTile')));
let mark = sent.length;
await page.click('#lbMeetGo'); await page.waitForSelector('#lmStart', { timeout: 8000 });
ok('it opens Board → Meeting, the first of four tabs — the board one tap away', (await page.$$eval('[data-leadtab]', b => b.map(x => x.getAttribute('data-leadtab')).join())) === 'meet,board,tues,notes' && !!(await page.$('[data-leadtab="meet"].on')));
ok('one call loads it', sent.slice(mark).filter(f => f === 'getLeadMeeting').length === 1 && sent.slice(mark).filter(f => /Lead/.test(f)).length === 1, sent.slice(mark).join());
ok('the head says when, how long, and has Start', /90 minutes/.test(await txt(page, '.lmHead')) && /Start the meeting/.test(await txt(page, '#lmStart')));
ok('a folded guide: how the meeting works, the seven parts, rules of thumb', !(await page.$eval('#lmGuide', e => e.open)) && (await page.$$eval('#lmGuide .lmParts li', l => l.length)) === 7 && (await page.$$eval('#lmGuide .lmRules li', l => l.length)) >= 6);
ok('the fine print: not affiliated with EOS Worldwide', /not affiliated with or endorsed by EOS Worldwide/.test(await txt(page, '#lmFine')));
ok('it is called a leadership meeting — no “L10” or “EOS” as its name', !/\bL10\b|EOS[- ]style/.test(await txt(page, '#leadMeet')));

console.log('=== the meeting day is a setting ===');
await page.click('#lmSetOpen'); await page.waitForSelector('#lmSettings');
ok('settings: the day (Tuesday to start) and seven boxes of minutes', (await page.$eval('#lmSetDay', e => e.value)) === '2' && (await page.$$('[data-lmsetmin]')).length === 7 && (await page.$eval('[data-lmsetmin="issues"]', e => e.value)) === '60');
const other = (dow + 3) % 7 === 2 ? (dow + 4) % 7 : (dow + 3) % 7, DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
await page.selectOption('#lmSetDay', String(other)); await page.fill('[data-lmsetmin="issues"]', '50');
await page.click('#lmSetSave'); await wait(page, 700);
ok('saved: the head and the schedule tab now carry that weekday', new RegExp(DAYS[other]).test(await txt(page, '.lmNextLine')) && new RegExp(DAYS[other]).test(await txt(page, '[data-leadtab="tues"]')) && /80 minutes/.test(await txt(page, '.lmHead')), await txt(page, '.lmNextLine'));
await page.click('[data-leadtab="tues"]'); await wait(page);
const tueHeads = await page.$$eval('.leadTueDate', l => l.map(x => x.textContent));
ok('the next eight dates on the schedule are that weekday', tueHeads.length === 8 && tueHeads.every(x => x.indexOf(DAYS[other]) === 0), tueHeads[0]);
/* back to today, so today's meeting has someone down to lead */
await page.click('[data-leadtab="meet"]'); await wait(page);
await page.click('#lmSetOpen'); await page.selectOption('#lmSetDay', String(dow)); await page.fill('[data-lmsetmin="issues"]', '60'); await page.click('#lmSetSave'); await wait(page, 700);
await call('saveLeadTuesday', D.concat([{ date: today, facilitator: { id: 'st_o' }, topics: ['Christmas outreach plan'] }]));
await page.click('#lmPlanWho').catch(() => {}); await wait(page);
await page.evaluate(() => { S.lead = null; S.meet = null; S.leadTab = 'meet'; render(); }); await page.waitForSelector('#lmStart'); await wait(page);
ok('with a facilitator on the schedule the head says who leads', /Led by Oli Overseer/.test(await txt(page, '.lmHead')));

console.log('=== an issue from anywhere, in one line ===');
await page.fill('#lmIssueText', 'Kitchen budget is over');
await page.evaluate(() => render());
ok('typing survives a redraw', (await page.$eval('#lmIssueText', e => e.value)) === 'Kitchen budget is over');
await page.press('#lmIssueText', 'Enter'); await wait(page, 700);
ok('Enter adds it to the board’s first column', mem['leadBoard:siemreap'].cards.some(c => c.title === 'Kitchen budget is over' && c.col === 'agenda') && /3 on the issues list/.test(await txt(page, '.lmQuick')) && (await page.$eval('#lmIssueText', e => e.value)) === '');

console.log('=== the scorecard ===');
await page.click('#lmScoreAdd'); await page.waitForSelector('#lmScoreForm');
await page.fill('[data-lmsf="name"]', '1-on-1s held');
await page.fill('[data-ppickq="lmso"]', 'Oli'); await wait(page, 200); await page.click('[data-ppickit="lmso|st_o"]'); await wait(page, 200);
ok('picking the owner keeps what was typed', (await page.$eval('[data-lmsf="name"]', e => e.value)) === '1-on-1s held');
await page.fill('[data-lmsf="goal"]', '10'); await page.click('#lmScoreSave'); await wait(page, 700);
const s1 = mem['leadMeet:siemreap'].score[0];
ok('a number typed each week is saved with its owner and goal', s1 && s1.name === '1-on-1s held' && s1.owner === 'st_o' && s1.goal === 10 && s1.src === 'manual' && /Oli/.test(await txt(page, '.lmScoreRow')) && /Goal ≥ 10/.test(await txt(page, '.lmScoreRow')));
ok('thirteen weeks, the newest first', (await page.$$('.lmScoreRow .lmWk')).length === 13 && /This week/.test(await txt(page, '.lmScoreRow .lmWk')));
const lastKey = g0.weeks[1].key;
await page.fill(`[data-lmval="${s1.id}|${lastKey}"]`, '6'); await page.press(`[data-lmval="${s1.id}|${lastKey}"]`, 'Tab'); await wait(page, 700);
const cellCls = await page.$eval(`[data-lmval="${s1.id}|${lastKey}"]`, e => e.closest('.lmWk').className + ' ' + e.closest('.lmWk').querySelector('.lmMark').textContent);
ok('last week’s 6 against a goal of 10 is off track — a ✗, not only a colour', /\boff\b/.test(cellCls) && /✗/.test(cellCls) && mem['leadMeet:siemreap'].score[0].vals[lastKey] === 6, cellCls);
await page.click('#lmScoreAdd'); await page.fill('[data-lmsf="name"]', 'Cups sold'); await page.fill('[data-lmsf="goal"]', '150');
await page.click('[data-lmsrc="metric"]'); await wait(page, 200);
await page.selectOption('[data-lmsf="dept"]', 'Community Service'); await wait(page, 200);
await page.selectOption('[data-lmsf="ministry"]', 'Cafe'); await wait(page, 200);
await page.selectOption('[data-lmsf="metric"]', 'Cups Sold');
ok('… the name typed before picking the link is still there', (await page.$eval('[data-lmsf="name"]', e => e.value)) === 'Cups sold');
await page.click('#lmScoreSave'); await wait(page, 700);
const row2 = await page.$$eval('.lmScoreRow', r => r[1].innerText);
ok('a number linked to a ministry’s metric fills itself: 180 last week, on track ✓, nothing to type', /Cafe › Cups Sold/.test(row2) && /180/.test(row2) && /✓/.test(row2) && (await page.$$eval('.lmScoreRow', r => r[1].querySelectorAll('input').length)) === 0, row2.replace(/\n/g, ' '));

console.log('=== rocks ===');
await page.click('[data-lmsec="rocks"]'); await wait(page);
await page.click('#lmRockAdd'); await page.fill('[data-lmrf="title"]', 'The new dorm is open');
await page.fill('[data-ppickq="lmro"]', 'Oli'); await wait(page, 200); await page.click('[data-ppickit="lmro|st_o"]'); await wait(page, 200);
await page.fill('[data-lmrf="note"]', 'Roof first'); await page.click('#lmRockSave'); await wait(page, 700);
await page.click('#lmRockAdd'); await page.fill('[data-lmrf="title"]', 'One staff retreat'); await page.click('#lmRockSave'); await wait(page, 700);
const groups = await page.$$eval('[data-lmrockowner]', g => g.map(x => x.getAttribute('data-lmrockowner') + ':' + x.querySelectorAll('.lmRock').length));
ok('this quarter’s rocks by person — the team’s first', groups.join() === 'team:1,st_o:1' && /The whole team/.test(await txt(page, '[data-lmrockowner="team"]')) && /Oli Overseer/.test(await txt(page, '[data-lmrockowner="st_o"]')), groups.join());
await page.click('[data-lmrq="next"]'); await wait(page);
ok('next quarter’s can be written ahead (none yet)', /No rocks for Q/.test(await txt(page, '#lmRocks')) && !!(await page.$('#lmRockAdd')));
await page.click('[data-lmrq="now"]'); await wait(page);

console.log('=== headlines ===');
await page.click('[data-lmsec="headlines"]'); await wait(page);
await page.fill('#lmHlText', 'Three students baptised on Sunday'); await page.click('#lmHlAdd'); await wait(page, 700);
await page.click('[data-lmhk="hard"]'); await page.fill('#lmHlText', 'A staff member’s father is in hospital'); await page.press('#lmHlText', 'Enter'); await wait(page, 700);
ok('good and hard news, one line each, with who added it', (await page.$$('#lmHeads .lmLine')).length === 2 && !!(await page.$('#lmHeads .lmLine.hard')) && /Dee/.test(await txt(page, '#lmHeads .lmLine')));

console.log('=== to-dos are the board’s tasks ===');
await page.click('[data-lmsec="todos"]'); await wait(page);
ok('last week’s two, none done yet', /0 of 2 done/.test(await txt(page, '#lmTodoPct')) && (await page.$$('#lmTodos .lmTodo')).length === 2);

console.log('=== running the meeting ===');
await page.click('#lmStart'); await page.waitForSelector('#lmRun'); await wait(page, 1300);
ok('Start: part 1 of 7, the Check-in, led by the day’s facilitator', (await page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'checkin' && /Part 1 of 7/i.test(await txt(page, '.lmStep')) && /Led by Oli Overseer/.test(await txt(page, '.lmLedBy')));
const clock = await txt(page, '#lmPartClock');
ok('two clocks: this part against its minutes, the meeting against 90', /^0:0\d \/ 5:00$/.test(clock) && /\/ 90:00$/.test(await txt(page, '#lmTotalClock')), clock);
await wait(page, 1200);
ok('… and they tick without a redraw', (await txt(page, '#lmPartClock')) !== clock);
ok('coaching on the screen: what to do, and what not to', /good news/.test(await txt(page, '.lmDo')) && /only for arriving/.test(await txt(page, '.lmDont')));
ok('the setup pages step aside while it runs', !(await page.$('#lmStart')) && !(await page.$('.lmSecs')));
await page.click('[data-lmhere="st_o"]'); await wait(page, 900);
ok('who is here: tap a name', /2 here/.test(await txt(page, '#lmCheckin')) && mem['leadMeet:siemreap'].run.present.join() === 'st_d,st_o');
/* over time turns amber and never blocks */
mem['leadMeet:siemreap'].run.partAt = new Date(Date.now() - 6 * 60000).toISOString();
await page.click('#lmRefresh'); await wait(page, 1500);
ok('over time the clock turns amber — and Next still works', await page.$eval('#lmPartClock', e => e.classList.contains('over')) && !(await page.$eval('#lmTotalClock', e => e.classList.contains('over'))));
await page.click('#lmNext'); await wait(page, 800);
ok('Next: the Scorecard — last week’s numbers, on or off track', (await page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'score' && /Off track/.test(await txt(page, '.lmScoreRow')) && /On track/.test(await page.$$eval('.lmScoreRow', r => r[1].innerText)));
ok('… “no discussion here”', /No explaining and no fixing here/.test(await txt(page, '.lmDont')));
ok('only the off-track number has “Drop it to Issues”', (await page.$$('[data-lmscoredrop]')).length === 1);
await page.click('[data-lmscoredrop]'); await wait(page, 800);
ok('… and it lands on the issues list', mem['leadBoard:siemreap'].cards.some(c => c.title === 'Scorecard: 1-on-1s held' && c.col === 'agenda'));

console.log('=== a second leader’s phone ===');
const two = await open('oli');
await two.page.click('[data-leadtab="meet"]'); await two.page.waitForSelector('#lmRun', { timeout: 8000 });
ok('Oli’s phone opens on the same part', (await two.page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'score');
await page.click('#lmNext'); await wait(page, 800);
await two.page.click('#lmRefresh'); await two.page.waitForFunction(() => document.querySelector('#lmRun').getAttribute('data-lmpartnow') === 'rocks', null, { timeout: 6000 }).catch(() => {});
ok('… and after “Check again”, the part Dee moved on to', (await two.page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'rocks');

console.log('=== rocks, headlines, to-dos ===');
await two.page.click('[data-lmrockst$="|off"]:not([data-lmrockst^="x"])').catch(() => {});
const rockO = mem['leadMeet:siemreap'].rocks.find(r => r.owner === 'st_o');
await two.page.click(`[data-lmrockst="${rockO.id}|off"]`).catch(() => {}); await wait(two.page, 800);
ok('an owner says off track on their own phone', mem['leadMeet:siemreap'].rocks.find(r => r.id === rockO.id).status === 'off');
await two.ctx.close();
await page.click('#lmRefresh'); await wait(page, 900);
ok('… Dee sees it, with “Drop it to Issues”', !!(await page.$(`[data-lmrockdrop="${rockO.id}"]`)) && !!(await page.$(`[data-lmrockst="${rockO.id}|off"].sel`)));
await page.click('#lmNext'); await wait(page, 800);
ok('Headlines: this week’s two are read', (await page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'headlines' && (await page.$$('#lmHeads .lmLine')).length === 2);
await page.click('#lmNext'); await wait(page, 800);
const tickKey = await page.$$eval('[data-lmtick]', l => l.map(x => x.getAttribute('data-lmtick') + '~' + x.closest('.lmTodo').innerText).find(x => /Book the venue/.test(x)).split('~')[0]);
await page.click(`[data-lmtick="${tickKey}"]`); await wait(page, 800);
ok('To-dos: tick one — 1 of 2 done, 50%, under the 90% aim', /1 of 2 done · 50%/.test(await txt(page, '#lmTodoPct')) && await page.$eval('#lmTodoPct', e => e.classList.contains('off')));
ok('… ticked on the board and in GP Tasks', mem['leadBoard:siemreap'].cards.find(c => c.id === proj).tasks.find(t => t.text === 'Book the venue').done === true && mem.gpTasks.tasks.find(t => t.title === 'Book the venue').done === true);
await page.click('[data-lmcarry]'); await wait(page, 800);
await wait(page, 600);
ok('the other is carried on a week — moved, and still counted as not done', mem['leadBoard:siemreap'].cards.find(c => c.id === proj).tasks.find(t => t.text === 'Send the invite').due > today && /1 of 2 done/.test(await txt(page, '#lmTodoPct')) && mem['leadMeet:siemreap'].run.carried.length === 1);
await page.fill('[data-lmtodoin="todo"]', 'Tell the kitchen about Friday');
await page.fill('[data-ppickq="lmt_todo"]', 'Oli'); await wait(page, 200); await page.click('[data-ppickit="lmt_todo|st_o"]'); await wait(page, 200);
ok('picking who owns a new to-do keeps its words', (await page.$eval('[data-lmtodoin="todo"]', e => e.value)) === 'Tell the kitchen about Friday');
await page.click('[data-lmtodoadd="todo"]'); await wait(page, 900);
const gpNew = mem.gpTasks.tasks.find(t => t.title === 'Tell the kitchen about Friday');
ok('a new to-do goes through the board into that person’s GP Tasks, due in seven days', !!gpNew && gpNew.assignees.join() === 'st_o' && gpNew.due === addDays(today, 7) && !!gpNew.leadId, JSON.stringify(gpNew && { a: gpNew.assignees, due: gpNew.due }));

console.log('=== issues: pick three, then identify, discuss, solve ===');
await page.click('#lmNext'); await wait(page, 800);
const issueTitles = await page.$$eval('.lmIssue .lmIssueTitle', l => l.map(x => x.textContent));
ok('the issues list is the board’s first column', (await page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'issues' && issueTitles.length === 4 && issueTitles.some(x => /Water pump/.test(x)) && issueTitles.some(x => /Scorecard: 1-on-1s held/.test(x)), issueTitles.join(' | '));
ok('today’s topic on the schedule is offered as an issue', /Christmas outreach plan/.test(await txt(page, '[data-lmtopic]')));
const idOf = (re) => page.$$eval('.lmIssue', (l, src) => { const x = l.find(b => new RegExp(src).test(b.textContent)); return x.getAttribute('data-lmrank'); }, re.source);
const pump = await idOf(/Water pump/), recep = await idOf(/reception/), kitchen = await idOf(/Kitchen budget/), scoreI = await idOf(/Scorecard/);
await page.click(`[data-lmrank="${pump}"]`); await page.click(`[data-lmrank="${kitchen}"]`); await page.click(`[data-lmrank="${recep}"]`); await wait(page, 1200);
const ranks = await page.$$eval('.lmIssue.picked', l => l.map(x => x.querySelector('.lmRank').textContent + x.querySelector('.lmIssueTitle').textContent.slice(0, 5)).sort().join());
ok('three fast taps rank them 1-2-3 — all three reach the server, in order', mem['leadMeet:siemreap'].run.top.join() === [pump, kitchen, recep].join() && /^1Water,2Kitch,3Who c$/.test(ranks), ranks);
await page.click(`[data-lmrank="${scoreI}"]`); await wait(page, 500);
ok('a fourth is not taken', (await page.$$('.lmIssue.picked')).length === 3);
await page.click('#lmWork'); await page.waitForSelector('#lmIds'); await wait(page);
ok('working on number 1: the card, and Identify · Discuss · Solve', /Water pump keeps failing/.test(await txt(page, '#lmIds')) && /Third time this month/.test(await txt(page, '#lmIds')) && (await page.$$('#lmIds .lmIdsStep')).length === 3);
await page.fill('#lmIdentify', 'Nobody owns maintenance'); await page.fill('#lmDecision', 'Oli owns maintenance from today.');
await page.fill('[data-lmtodoin="itodo"]', 'Get three quotes for a pump'); await page.click('[data-lmtodoadd="itodo"]'); await wait(page, 900);
ok('a to-do made here is a task on that card — and what was typed above is still there', mem['leadBoard:siemreap'].cards.find(c => c.id === pump).tasks.some(t => t.text === 'Get three quotes for a pump') &&
  (await page.$eval('#lmDecision', e => e.value)) === 'Oli owns maintenance from today.' && (await page.$eval('#lmIdentify', e => e.value)) === 'Nobody owns maintenance' && /Get three quotes/.test(await txt(page, '.lmIssueTodos')));
await page.click('#lmSolve'); await wait(page, 900);
const pumpCard = mem['leadBoard:siemreap'].cards.find(c => c.id === pump);
ok('Solved: the decision is on the card, which is in Done', pumpCard.col === 'done' && /Nobody owns maintenance/.test(pumpCard.notes) && /Oli owns maintenance from today\./.test(pumpCard.notes) && /Third time this month/.test(pumpCard.notes));
ok('… back on the list: it is under “Solved today”, and number 2 is now number 1', /Solved today · 1/.test(await txt(page, '#lmSolved')) && /Work on number 1: Kitchen budget/.test(await txt(page, '#lmWork')) && !(await page.$('#lmIds')));
await page.click('[data-leadtab="board"]'); await wait(page);
ok('the Kanban board shows the same: the pump card in Done', /Water pump/.test(await page.$eval('[data-leadcol="done"]', e => e.textContent)));
await page.click('[data-leadtab="meet"]'); await wait(page);
ok('… and coming back, the meeting is where it was', (await page.$eval('#lmRun', e => e.getAttribute('data-lmpartnow'))) === 'issues');

console.log('=== wrap up, and the record ===');
await page.click('#lmNext'); await wait(page, 800);
ok('Wrap up recaps the two new to-dos', /New to-dos · 2/.test(await txt(page, '#lmNewTodos')) && /Tell the kitchen/.test(await txt(page, '#lmNewTodos')) && /Get three quotes/.test(await txt(page, '#lmNewTodos')));
await page.fill('#lmMsgText', 'Water off Thursday morning'); await page.press('#lmMsgText', 'Enter'); await wait(page, 800);
ok('what to tell our teams', /Water off Thursday morning/.test(await txt(page, '#lmMsgs')));
await page.selectOption('[data-lmrate="st_d"]', '8'); await wait(page, 800);
await page.selectOption('[data-lmrate="st_o"]', '9'); await wait(page, 800);
ok('everyone rates it 1–10; the average shows', /Average 8\.5/.test(await txt(page, '#lmAvg')));
ok('the last screen ends the meeting; there is no Next', !!(await page.$('#lmEnd')) && !(await page.$('#lmNext')));
await page.click('#lmEnd'); await page.waitForSelector('#lmPast', { timeout: 8000 }); await wait(page, 600);
const rec = mem['leadMeet:siemreap'].past[0], pastText = await txt(page, '.lmPastItem');
ok('End: the meeting is over and its record is open under Past meetings', !mem['leadMeet:siemreap'].run && !(await page.$('#lmRun')) && await page.$eval('.lmPastItem', e => e.open));
ok('… led by, who was there, the average, to-dos done, the issue solved, the headlines and the message', /Oli Overseer/.test(pastText) && /Dee, Oli/.test(pastText) && /8\.5/.test(pastText) && /1 of 2 done/.test(pastText) && /Water pump keeps failing/.test(pastText) && /Oli owns maintenance/.test(pastText) && /baptised/.test(pastText) && /Water off Thursday/.test(pastText), pastText.replace(/\n/g, ' ').slice(0, 200));
ok('… the minutes each part took', rec.mins.checkin >= 6 && typeof rec.total === 'number');
ok('the rating trend has its first column', (await page.$$('#lmTrend .lmTrendCol')).length === 1 && /8\.5/.test(await txt(page, '#lmTrend')));
await page.click('[data-lmsec="headlines"]'); await wait(page);
ok('the headlines went with the meeting', /No headlines yet/.test(await txt(page, '#lmHeads')));
ok('Start is back for next week', !!(await page.$('#lmStart')));
ok('no page fits wider than the phone (390px)', !(await overflow(page)));

console.log('=== started by mistake ===');
await page.click('#lmStart'); await page.waitForSelector('#lmRun'); await wait(page);
await page.click('#lmCancel'); await wait(page, 900);
ok('Cancel asks, then drops it with no record', !mem['leadMeet:siemreap'].run && mem['leadMeet:siemreap'].past.length === 1 && !!(await page.$('#lmStart')));
await ctx.close();

console.log('=== someone outside Campus Leadership ===');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 860 } });
  const p = await c.newPage(); p.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p.route('**fonts.g**', r => r.abort());
  await p.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'cam', pin: '1234' })));
  await p.goto(BASE + '/teams.html', { waitUntil: 'load' }); await p.waitForSelector('nav.bottom button', { timeout: 15000 }); await p.waitForTimeout(500);
  await p.click('nav.bottom [data-tab="ministry"]'); await p.waitForTimeout(900);
  ok('sees no Meeting tab and no way in', !(await p.$('[data-leadtab]')) && !(await p.$('#lbMeetGo')) && !(await p.$('#leadMeet')));
  const boot = await call('getMyBoot', ['cam', '1234']);
  ok('… and nothing of it rides on their boot', !/Water pump|leadMeet|baptised|1-on-1s held/.test(JSON.stringify(boot)));
  await c.close();
}

console.log('=== Khmer, and a 320px phone ===');
{
  const k = await open('oli', { width: 320, height: 700, lang: 'km' });
  await k.page.evaluate(() => { try { if (typeof setLang === 'function') setLang('km'); } catch (e) {} });
  await k.page.click('[data-leadtab="meet"]'); await k.page.waitForSelector('#lmStart', { timeout: 8000 }); await wait(k.page);
  const isKm = await k.page.evaluate(() => (document.documentElement.lang || '') + '|' + (typeof S !== 'undefined' && S.lang));
  const count = (s) => ({ km: (s.match(/[ក-៿]/g) || []).length, lat: (s.replace(/YWAM GP|EOS Worldwide|Level 10|OKRs?|GP Tasks|Q\d|[A-Z][a-z]+ [A-Z][a-z]+/g, '').match(/[A-Za-z]/g) || []).length });
  let body = await txt(k.page, '#leadMeet'), n = count(body);
  ok('the Meeting tab is in Khmer', n.km > 200 && n.lat < 40, JSON.stringify(n) + ' ' + isKm);
  ok('… and fits a 320px phone', !(await overflow(k.page)));
  await k.page.evaluate(() => { document.getElementById('lmGuide').open = true; });
  n = count(await txt(k.page, '#lmGuide'));
  ok('the guide is in Khmer too', n.km > 400 && n.lat < 30, JSON.stringify(n));
  for (const sec of ['score', 'rocks', 'headlines', 'todos', 'past']) {
    await k.page.click(`[data-lmsec="${sec}"]`); await wait(k.page, 300);
    if (await overflow(k.page)) { ok('320px: ' + sec + ' fits', false); }
  }
  ok('every setup page fits 320px', !(await overflow(k.page)));
  await k.page.click('[data-lmsec="score"]'); await wait(k.page, 300);
  await k.page.click('#lmScoreAdd'); await wait(k.page, 300); await k.page.click('[data-lmsrc="metric"]'); await wait(k.page, 300);
  ok('… and the scorecard form', !(await overflow(k.page)));
  await k.page.click('#lmScoreCancel'); await wait(k.page, 200);
  await k.page.click('#lmStart'); await k.page.waitForSelector('#lmRun'); await wait(k.page);
  let fits = true, kmParts = true;
  for (let i = 0; i < 7; i++) {
    if (await overflow(k.page)) fits = false;
    const c = count(await txt(k.page, '.lmCoach')); if (c.km < 30 || c.lat > 6) kmParts = false;
    if (i === 5) { const first = await k.page.$('[data-lmrank]'); if (first) { await first.click(); await wait(k.page, 900); await k.page.click('#lmWork'); await k.page.waitForSelector('#lmIds'); await wait(k.page, 300); if (await overflow(k.page)) fits = false; await k.page.click('#lmIssueBack'); await wait(k.page, 700); } }
    if (i < 6) { await k.page.click('#lmNext'); await wait(k.page, 800); }
  }
  ok('all seven parts of a running meeting fit 320px', fits);
  ok('… with their coaching in Khmer', kmParts);
  const touch = await k.page.evaluate(() => [].some.call(document.querySelectorAll('#leadMeet *'), e => getComputedStyle(e).touchAction === 'none'));
  ok('nothing in it blocks scrolling (no touch-action:none)', !touch);
  await k.page.click('#lmCancel'); await wait(k.page, 800);
  await k.ctx.close();
}

console.log('=== a wide screen (an iPad on its side, a projector) ===');
{
  const w = await open('dee', { width: 1180, height: 820 });
  await w.page.click('[data-leadtab="meet"]'); await w.page.waitForSelector('#lmStart', { timeout: 8000 });
  await w.page.click('#lmStart'); await w.page.waitForSelector('#lmRun'); await wait(w.page);
  const size = await w.page.$eval('.lmRunTitle', e => parseFloat(getComputedStyle(e).fontSize));
  ok('the part’s title is big enough to read across a room', size >= 28 && !(await overflow(w.page)), size);
  await w.page.click('#lmCancel'); await wait(w.page, 800);
  await w.ctx.close();
}
ok('no script errors anywhere', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
