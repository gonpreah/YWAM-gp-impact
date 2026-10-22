/* The Calendar in the browser (Oct 2026): ☰ → Calendar, an admin connecting the campus's Google Calendar (the secret address never shown), My Home's Coming up, the day-by-day list. Real api.js, fake store, Google stood in. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('gcal-ui');
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
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', email: 'a@e.com', isAdmin: true }),
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora', email: 'c@e.com' }),
  mk({ id: 'o1', name: 'Ollie Outreach', username: 'ollie', email: 'o@e.com', ministry: 'Outreach Teams' })
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
const ymd = s => s.replace(/-/g, '');
const URL1 = 'https://calendar.google.com/calendar/ical/ywamsr%40example.org/private-abc123/basic.ics';
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:b1', 'DTSTART;VALUE=DATE:' + ymd(day(1)).replace(/^\d{4}/, '2010'), 'RRULE:FREQ=YEARLY', 'SUMMARY:Sokha\'s birthday', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:t1', 'DTSTART;VALUE=DATE:' + ymd(day(2)), 'DTEND;VALUE=DATE:' + ymd(day(5)), 'SUMMARY:Grace Church team staying', 'DESCRIPTION:12 people', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:m1', 'DTSTART;TZID=Asia/Phnom_Penh:' + ymd(day(0)) + 'T150000', 'DTEND;TZID=Asia/Phnom_Penh:' + ymd(day(0)) + 'T160000', 'SUMMARY:Worship night', 'LOCATION:Main hall', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
globalThis.fetch = async (url) => url === URL1 ? { ok: true, status: 200, text: async () => ICS } : { ok: false, status: 404, text: async () => '' };
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(user) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', d => d.accept());
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); }, { u: user });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}
const main = p => p.$eval('#main', e => e.innerText);
{
  const { ctx, page } = await open('cora');
  ok('no calendar connected: My Home shows nothing for it', !(await page.$('#sec-cal')));
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('☰ has GP Calendar/Tasks — one entry for both', !!(await page.$('[data-menu-item="caltasks"]')) && !(await page.$('[data-menu-item="calendar"]')) && !(await page.$('[data-menu-item="tasks"]')));
  const noIcon = await page.$$eval('[data-menu-item]', b => b.filter(x => !/<svg/.test(x.innerHTML) || /undefined/.test(x.textContent)).map(x => x.dataset.menuItem));
  ok('… with its own icon, a calendar with a tick — every ☰ entry has an icon, none says "undefined"', /<svg/.test(await page.$eval('[data-menu-item="caltasks"]', e => e.innerHTML)) && noIcon.length === 0, noIcon.join());
  await page.click('[data-menu-item="caltasks"]'); await page.waitForTimeout(700);
  ok('… it opens the Calendar, with a Tasks tab on top', await page.evaluate(() => S.view === 'calendar') && !!(await page.$('.ctTab.on[data-cttab="calendar"]')) && !!(await page.$('[data-cttab="tasks"]')));
  await page.click('[data-cttab="tasks"]'); await page.waitForTimeout(600);
  ok('… the Tasks tab flips to GP Tasks, and back', await page.evaluate(() => S.view === 'tasks') && !!(await page.$('.ctTab.on[data-cttab="tasks"]')));
  await page.click('[data-cttab="calendar"]'); await page.waitForTimeout(600);
  ok('… and back', await page.evaluate(() => S.view === 'calendar'));
  ok('… which says none is connected yet (and offers no Admin button to non-admins)', /No calendar is connected yet/.test(await main(page)) && !(await page.$('[data-adminsubgo="gcal"]')));
  await ctx.close();
}
{
  const { ctx, page } = await open('ada');
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'home'; render(); }); await page.waitForTimeout(300);
  await page.click('[data-adminsub="gcal"]'); await page.waitForTimeout(700);
  ok('Admin → Google Calendar: how to find the secret address, and where to paste it', /Secret address in iCal format/.test(await main(page)) && !!(await page.$('#gcalUrl')));
  await page.fill('#gcalName', 'Siem Reap events'); await page.fill('#gcalUrl', 'https://example.com/x.ics');
  await page.click('#gcalAdd'); await page.waitForTimeout(600);
  ok('a wrong address is refused', !mem.gcal || !mem.gcal.cals.length);
  await page.fill('#gcalUrl', URL1); await page.click('#gcalAdd'); await page.waitForTimeout(800);
  ok('connected — the name shows, the address never does', mem.gcal.cals.length === 1 && /Siem Reap events/.test(await main(page)) && !(await page.content()).replace(/<input[^>]*id="gcalUrl"[^>]*>/, '').includes('private-abc123'));
  await page.click('[data-gcalcolor="' + mem.gcal.cals[0].id + '"][data-color="pink"]'); await page.waitForTimeout(600);
  ok('the admin picks its colour from the palette', mem.gcal.cals[0].color === 'pink' && !!(await page.$('.calSwatch.on.cal-pink')));
  /* kinds of events: each with a colour and the words that mark it */
  const kindNames = await page.$$eval('[data-kindname]', i => i.map(x => x.value));
  ok('Kinds of events: Events, Birthdays & anniversaries, Schools, Teams, Guests & speakers — each with its words and a palette', kindNames.join('|') === 'Events|Birthdays & anniversaries|Schools|Teams|Guests & speakers' && (await page.$eval('[data-kindkeys="team"]', e => e.value)) === 'team' && !!(await page.$('[data-kindcolor="team"][data-color="lavender"].on')), kindNames.join('|'));
  await page.click('[data-kindcolor="team"][data-color="sky"]'); await page.waitForTimeout(600);
  ok('… the admin picks Teams a colour (sky)', (mem.gcal.kinds || []).find(k => k.id === 'team').color === 'sky' && !!(await page.$('[data-kindcolor="team"][data-color="sky"].on')));
  await page.fill('[data-kindkeys="team"]', 'team, church'); await page.press('[data-kindkeys="team"]', 'Tab'); await page.waitForTimeout(600);
  ok('… and the words that mark it', (mem.gcal.kinds || []).find(k => k.id === 'team').keywords.join() === 'team,church');
  await page.click('#gcKindAdd'); await page.waitForTimeout(600);
  ok('＋ Add a kind adds one to name', (mem.gcal.kinds || []).length === 6 && (await page.$$eval('[data-kindname]', i => i.length)) === 6);
  await page.click('[data-kindrm="' + mem.gcal.kinds[5].id + '"]'); await page.waitForTimeout(600);
  ok('… and Remove takes it away again (the first, Events, has no Remove)', (mem.gcal.kinds || []).length === 5 && !(await page.$('[data-kindrm="event"]')));
  await ctx.close();
}
{
  const { ctx, page } = await open('cora');
  await page.waitForSelector('#sec-cal', { timeout: 5000 }).catch(() => {});
  const home = await page.$eval('#sec-cal + .card', e => e.innerText).catch(() => '');
  ok('My Home: 📅 Coming up, the next days', /Worship night/.test(home) && /Sokha's birthday|Sokha’s birthday/.test(home) && /today/i.test(home), home.slice(0, 200));
  await page.click('#goCalendar'); await page.waitForTimeout(800);
  const txt = await main(page);
  ok('the Calendar like Google\'s: month chips, week rows with their number, title bars across the days, today marked — then the days from today on', !!(await page.$('.gcGrid')) && !!(await page.$('.gcMonth.on')) && (await page.$$eval('.gcWk', w => w.length)) === 6 && (await page.$$eval('.gcCell', c => c.length)) === 42 && !!(await page.$('.gcCell.today.sel .gcNum')) && (await page.$$eval('.gcBar', d => d.length)) >= 3 && /Worship night/.test(txt) && /3:00/.test(txt) && /All day/.test(txt) && /Grace Church team staying/.test(txt) && /until/.test(txt), txt.slice(0, 400));
  ok('… the stay spans its days as one bar, in its kind\'s colour (Teams: sky), the birthday in green, the worship night in the calendar\'s pink', !!(await page.$('.gcBar.cal-sky[title="Grace Church team staying"]')) && !!(await page.$('.gcBar.cal-green[title="Sokha\'s birthday"]')) && !!(await page.$('.gcBar.cal-pink[title="Worship night"]')) && (await page.$$eval('.gcBar[title="Grace Church team staying"]', b => b.length)) === 1 && /Grace Church/.test(await page.$eval('.gcBar.cal-sky[title="Grace Church team staying"]', e => e.style.width)) === false);
  await page.click('.gcBar[title="Worship night"]'); await page.waitForTimeout(300);
  ok('tapping a bar opens that thing under the month', /Main hall/.test(await main(page)) && !!(await page.$('.calEv.open')));
  await page.click('.gcMonth:not(.on)'); await page.waitForTimeout(700);
  ok('a month chip jumps to that month', await page.evaluate(() => S.calMonth && S.calMonth !== new Date().toISOString().slice(0, 7)));
  await page.click('#calToday'); await page.waitForTimeout(700);
  await page.click('.gcCell[data-calday="' + day(2) + '"]'); await page.waitForTimeout(300);
  const fromD2 = await page.$eval('.calList', e => e.innerText).catch(() => '');
  ok('tapping a day lists from that day: the team\'s stay, not the worship night before it', /Grace Church/.test(fromD2) && !/Worship night/.test(fromD2) && !!(await page.$('.gcCell.sel[data-calday="' + day(2) + '"]')), fromD2.slice(0, 200));
  ok('… and never the secret address', !(await page.content()).includes('private-abc123'));
  await page.click('.calEv:has-text("Grace Church")'); await page.waitForTimeout(300);
  ok('tapping an event shows its details', /12 people/.test(await main(page)));
  /* the kinds: a filter inside the calendar's chip, not a row of its own */
  const calId = mem.gcal.cals[0].id;
  ok('the calendar\'s chip has a ▾ for its kinds — no separate row of chips', !!(await page.$('[data-calkindsfor="' + calId + '"]')) && !(await page.$('.gcKinds')) && !(await page.$('[data-calkind]')));
  await page.click('[data-calkindsfor="' + calId + '"]'); await page.waitForTimeout(300);
  ok('▾ opens its kinds: Events, Birthdays & anniversaries, Schools, Teams, Guests & speakers, all ticked', (await page.$$eval('.gcKindPick [data-calkind]', b => b.map(x => x.dataset.calkind))).join() === [ 'event', 'bday', 'school', 'team', 'guest' ].map(k => calId + '|' + k).join() && (await page.$$eval('.gcKindPick .gcLayer.on', b => b.length)) === 5 && /What to show from Siem Reap events/.test(await main(page)));
  await page.click('.gcKindPick [data-calkind="' + calId + '|team"]'); await page.waitForTimeout(400);
  ok('Teams off: the stay leaves the grid, the birthday stays; the ▾ says 4/5', !(await page.$('.gcBar[title="Grace Church team staying"]')) && !!(await page.$('.gcBar[title="Sokha\'s birthday"]')) && /4\/5/.test(await page.$eval('[data-calkindsfor="' + calId + '"]', e => e.textContent)) && !!(await page.$('.gcKindPick')));
  await page.click('[data-calkindall="' + calId + '"]'); await page.waitForTimeout(400);
  ok('All kinds: back, and the row says what kind it is', !!(await page.$('.gcBar[title="Grace Church team staying"]')) && /Siem Reap events · Teams/.test(await main(page)) && !(await page.$('[data-calkindall]')));
  await page.click('[data-calkindsfor="' + calId + '"]'); await page.waitForTimeout(300);
  ok('▾ again closes it', !(await page.$('.gcKindPick')));
  /* the ticked list of what shows, like Google Calendar's */
  ok('chips to tick each calendar on or off: Siem Reap events', !!(await page.$('.gcLayer.on[data-callayer]')) && /Siem Reap events/.test(await page.$eval('.gcLayers', e => e.innerText)));
  await page.click('.gcLayer:has-text("Siem Reap events")'); await page.waitForTimeout(300);
  ok('off: its events leave the grid and the list', !/Grace Church/.test(await main(page)) && !(await page.$('.gcBar.cal-pink')) && /Everything is switched off|Nothing on the calendar/.test(await main(page)));
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(600);
  await page.evaluate(() => { S.view = 'calendar'; S.cal = null; render(); }); await page.waitForTimeout(900);
  ok('… and that is remembered on this phone', !(await page.$('.gcLayer.on[data-callayer]:has-text("Siem Reap events")')));
  await page.click('.gcLayer:has-text("Siem Reap events")'); await page.waitForTimeout(400);
  ok('on again: back', /Grace Church/.test(await main(page)));
  await page.click('#calNext'); await page.waitForTimeout(800);
  ok('›: the next month, and Today to come back', !!(await page.$('#calToday')) && !(await page.$('.gcCell.today')));
  ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
/* the Outreach Teams list in GP Tasks: the teams arriving, from the calendar */
{
  const { ctx, page } = await open('ollie');
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(900);
  const teamsL = (mem.gpTasks.lists || []).find(l => l.scope === 'ministry' && l.ministry === 'Outreach Teams');
  ok('Ollie has the Outreach Teams list', !!teamsL && !!(await page.$('.gtTab[data-gptlist="' + teamsL.id + '"]')));
  await page.click('.gtTab[data-gptlist="' + teamsL.id + '"]'); await page.waitForTimeout(1200);
  const strip = await page.$eval('.gtTeams', e => e.innerText).catch(() => '');
  ok('… with the teams arriving from the calendar at the top: the Grace Church team, when it arrives, how long it stays', /Teams arriving/.test(strip) && /Grace Church team staying/.test(strip) && /arrives/.test(strip) && /3 days/.test(strip), strip.slice(0, 200));
  await page.click('[data-gtteamday="' + day(2) + '"]'); await page.waitForTimeout(900);
  ok('tapping a team opens the calendar on its day', await page.evaluate(() => S.view === 'calendar') && !!(await page.$('.gcCell.sel[data-calday="' + day(2) + '"]')));
  await ctx.close();
}
{
  const { ctx, page } = await open('cora');
  await page.evaluate(() => gptOpenPage_('week')); await page.waitForTimeout(900);
  ok('the Cafe\'s list has no such strip', !(await page.$('.gtTeams')));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
