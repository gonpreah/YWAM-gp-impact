/* Drive the entry states end to end: the front door (index.html hands over to My
   YWAM GP's own), a guest (the app's guest mode), the old dashboard's links (Base —
   the dashboard is gone), signed in, and the Teams page's logo/loader. */
/* Paths and the browser binary come from tests/env.mjs so this runs from a clone
   rather than from one machine's scratch directory. */
import { PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = PUBLIC;
const OUT = tmpDir('out') + '/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const P = 'poipet', S = 'siemreap';
const e = { [P]: {}, [S]: {} };
const put = (c, d, m, k, w) => { e[c][d + '|' + m + '|' + k] = w; };
put(P, 'Leadership Development', 'DTS', 'Students Enrolled', { 1: 20, 2: 22 });
put(P, 'Leadership Development', 'DTS', 'Students Graduated', { 3: 21 });
put(P, 'Community Service', 'GP Education', 'Schools', { 1: 2 });
put(P, 'Community Service', 'GP Education', 'Students Enrolled', { 1: 80, 2: 85 });
put(P, 'Youth Education', 'YDC', 'Youth Enrolled', { 1: 40, 2: 44 });
put(P, 'Community Service', 'Outreach Teams', 'Teams Hosted', { 1: 1, 2: 2 });
put(P, 'Community Service', 'Outreach Teams', 'Volunteers Mobilized', { 1: 8, 2: 15 });
put(P, 'Community Service', 'Outreach Teams', 'Community Service Hours', { 1: 6, 2: 10 });
put(P, 'Community Service', 'Outreach Teams', 'Salvations', { 1: 3, 2: 5 });
put(P, 'Community Service', 'Outreach Teams', 'People Served', { 1: 120, 2: 200 });
put(P, 'Leadership Development', 'Church Partnerships', 'Partner Churches Supported', { 1: 4, 3: 5 });
put(P, 'Leadership Development', 'Church Partnerships', 'Churches Being Led', { 1: 2, 3: 3 });
put(P, 'Campus Leadership', 'Campus Director', 'Total Staff', { 1: 12 });
put(S, 'Campus Leadership', 'Campus Director', 'Total Staff', { 1: 9 });
put(S, 'Youth Education', 'YDC', 'Youth Enrolled', { 1: 60 });

const ME = { id: 'st1', name: 'Sokha Chan', username: 'sokha', campus: S, dept: 'Community Service', ministry: 'Outreach Teams', photo: '' };
const DATA = {
  leader: false, entries: e, okrs: [],
  survey: [{ campus: P, week: 2, device: 'x', lonely: 3, clarity: 8, growth: 7, porn: false, oneOnOne: true, exercise: true, quietTime: true, debt: false, sharedFaith: true, sabbath: true }]
};

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
// Port 0: let the OS pick, so this never collides with another suite running.
await new Promise(r => server.listen(0, r));
const BASE = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 430, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', err => errors.push('PAGEERROR ' + err));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION_RESET|ERR_FAILED|fonts\.googleapis/.test(m.text())) errors.push('console: ' + m.text()); });
  // Every other browser test in this suite blocks the real Google Fonts request
  // rather than let it hit the network — this one didn't, so whatever error
  // code that request happens to fail with in a given environment (a reset here,
  // a cert error there) could slip past the console filter above.
  await page.route('**fonts.g**', route => route.abort());
  await page.route('**/.netlify/functions/api', route => {
    const body = JSON.parse(route.request().postData() || '{}');
    let out = DATA;
    if (body.fn === 'getMyBoot') out = { ok: true, staff: ME, profile: {}, roster: [ME],
      logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
      trips: { ok: true, trips: [], totals: {}, reasons: { work: ['a'], personal: ['b'] }, hasMentor: false },
      tripRequests: [], ministry: null, base: DATA };
    else     if (body.fn === 'teamRoster') out = [ME];
    else if (body.fn === 'staffLogin') out = { ok: true, staff: ME, profile: {} };
    else if (/^getMy/.test(body.fn)) out = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  return page;
}

/* ---- 1. the front door: index.html is only the old address now (Oct 2026, one page) —
   it hands over to My YWAM GP, whose own log-in screen is the door: create a profile,
   log in, or look around ---- */
let page = await newPage();
await page.goto(BASE + '/index.html', { waitUntil: 'commit' });
await page.waitForURL(/teams\.html$/, { timeout: 8000 });
await page.waitForSelector('#loginBtn', { timeout: 8000 });
console.log('1. FRONT DOOR');
console.log('   index.html hands over to teams.html: ' + /teams\.html$/.test(page.url()));
console.log('   log in, create a profile and look around are all here: ' + await page.evaluate(() =>
  !!document.querySelector('#loginBtn') && /profile/i.test(document.querySelector('#main').innerText) && !!document.querySelector('[data-guestgo], #lookAround, #guestBtn, .guestLink, button')));
console.log('   dashboard leaked behind it: ' + await page.evaluate(() => !!document.querySelector('.hero')));
await page.screenshot({ path: OUT + 'gate.png', fullPage: true });
await page.close();

/* ---- 2. a guest (from either flag) goes to My YWAM GP's guest mode ---- */
page = await newPage();
await page.addInitScript(() => { localStorage.setItem('gp-app-guest', '1'); });
await page.goto(BASE + '/index.html', { waitUntil: 'commit' });
await page.waitForURL(/teams\.html\?guest=1/, { timeout: 8000 });
await page.waitForSelector('nav.bottom button', { timeout: 12000 });
console.log('\n2a. a returning guest goes to the app\'s guest mode: ' + /teams\.html\?guest=1/.test(page.url()) +
  ' · tabs: ' + (await page.$$eval('nav.bottom button', b => b.map(x => x.textContent.trim()))).join(' | '));
await page.close();
page = await newPage();
await page.addInitScript(() => { sessionStorage.setItem('gp-guest', '1'); });
await page.goto(BASE + '/index.html', { waitUntil: 'commit' });
await page.waitForURL(/teams\.html\?guest=1/, { timeout: 8000 });
console.log('   … and so does one from before the move (gp-guest): ' + /teams\.html\?guest=1/.test(page.url()));
await page.close();
/* The old dashboard, asked for on purpose (gp-skip-teams from its old button, or
   ?view=dashboard): it is gone (Oct 2026 — numbers are recorded on My Ministry), so
   the link lands on Base, which shows the same figures. Not signed in: as a guest. */
page = await newPage();
await page.addInitScript(() => { sessionStorage.setItem('gp-skip-teams', '1'); });
await page.goto(BASE + '/index.html', { waitUntil: 'commit' });
await page.waitForURL(/teams\.html\?view=base/, { timeout: 8000 });
await page.waitForSelector('#main .hero', { timeout: 8000 });
console.log('\n2. THE OLD DASHBOARD LINK');
console.log('   lands on Base, as a guest: ' + await page.evaluate(() => S.view === 'base' && S.guest));
console.log('   no Log Numbers tab anywhere: ' + await page.evaluate(() => !document.querySelector('[data-view="log"]')));
await page.screenshot({ path: OUT + 'guest-dash.png', fullPage: true });
await page.close();

/* ---- 3. signed in, the old dashboard link: Base, on their own campus ---- */
page = await newPage();
await page.addInitScript(() => {
  localStorage.setItem('gp-staff', JSON.stringify({ user: 'sokha', pin: '1234' }));
  localStorage.setItem('gp-staff-card', JSON.stringify({ name: 'Sokha Chan', photo: '', ministry: 'Outreach Teams', campus: 'siemreap' }));
});
await page.goto(BASE + '/index.html?view=dashboard', { waitUntil: 'networkidle' });
await page.waitForSelector('#main .hero', { timeout: 8000 });
await page.waitForTimeout(800);
console.log('\n3. SIGNED IN');
console.log('   the old dashboard link opens Base: ' + await page.evaluate(() => S.view === 'base' && !S.guest));
console.log('   tabs: ' + (await page.$$eval('nav.bottom button', b => b.map(x => x.textContent.trim()))).join(' | '));
await page.close();

/* ---- 4. teams page: real logo, spinning boot coin ---- */
page = await newPage();
let bootSeen = false;
// drop newPage()'s handler first, so this slower one is unambiguously the one used
await page.unroute('**/.netlify/functions/api');
await page.route('**/.netlify/functions/api', async route => {
  const body = JSON.parse(route.request().postData() || '{}');
  // the boot call is what a remembered session makes, so hold THAT to see the loader
  if (body.fn === 'getMyBoot' || body.fn === 'staffLogin') await new Promise(r => setTimeout(r, 1500));
  let out = DATA;
  if (body.fn === 'getMyBoot') out = { ok: true, staff: ME, profile: {}, roster: [ME],
    logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
    trips: { ok: true, trips: [], totals: {}, reasons: { work: ['a'], personal: ['b'] }, hasMentor: false },
    tripRequests: [], ministry: null, base: DATA };
  else if (body.fn === 'teamRoster') out = [ME];
  else if (body.fn === 'staffLogin') out = { ok: true, staff: ME, profile: {} };
  else if (/^getMy/.test(body.fn)) out = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
});
await page.addInitScript(() => {
  localStorage.setItem('gp-staff', JSON.stringify({ user: 'sokha', pin: '1234' }));
});
await page.goto(BASE + '/teams.html', { waitUntil: 'commit' });
await page.waitForSelector('.loadingBox', { timeout: 5000 }).then(() => { bootSeen = true; }).catch(() => {});
console.log('\n4. TEAMS PAGE');
console.log('   "Impact Loading" coin shown while waiting: ' + bootSeen);
if (bootSeen) {
  // The coin is written by JS once logo.js is in, so it carries no id of its own.
  console.log('   boot logo is the real PNG: ' + await page.$eval('.loadCoin img', i => i.src.startsWith('data:image/png') && i.naturalWidth > 0));
  console.log('   loader text: ' + await page.$eval('.loadText', x => x.textContent.trim()));
  await page.screenshot({ path: OUT + 'teams-loading.png' });
}
console.log('   header logo is the real PNG: ' + await page.$eval('#brandLogo', i => i.src.startsWith('data:image/png') && i.naturalWidth > 0));
console.log('   ptr coin logo set: ' + await page.$eval('#ptrLogo', i => i.src.startsWith('data:image/png')));
await page.waitForSelector('nav.bottom button', { timeout: 12000 });
await page.waitForTimeout(700);
console.log('   signed-in home rendered, tabs: ' + (await page.$$eval('nav.bottom button', b => b.map(x => x.textContent.trim()))).join(' | '));
await page.screenshot({ path: OUT + 'teams-home.png', fullPage: true });

/* ---- 5. teams?reg=1 opens the create form ---- */
const p5 = await newPage();
await p5.goto(BASE + '/teams.html?reg=1', { waitUntil: 'networkidle' });
await p5.waitForTimeout(700);
console.log('\n5. ?reg=1 opens create form: ' + await p5.evaluate(() => !!document.querySelector('#r_user')));
console.log('   heading: ' + await p5.$eval('h2', x => x.textContent.trim()));
await p5.screenshot({ path: OUT + 'teams-reg.png', fullPage: true });

console.log('\nERRORS: ' + (errors.length ? '\n' + errors.join('\n') : 'none'));
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
