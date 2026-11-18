/* Profile & settings → Install this app (Nov 2026, Uriah: an "install this app" button in
   settings). The bar under the header goes for good once its ✕ is tapped; this card stays
   until the app is installed. Where the browser offers its own install prompt the button opens
   it, and once accepted the card says so; on an iPhone it shows Share → Add to Home Screen;
   opened from the Home Screen it isn't there at all. */
import { PUBLIC, CHROMIUM, tmpDir } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const OUT = tmpDir('install-card-out');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => { const f = path.join(PUBLIC, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f)); }).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
const ME = { id: 'st1', name: 'Dara Pich', username: 'dara', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: '', photo: '', staffType: 'campus', country: 'Cambodia', leads: [], ministries: [] };
const BOOT = { ok: true, staff: ME, profile: {}, roster: [ME], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
  trips: { ok: true, trips: [], totals: {}, reasons: { work: ['x'], personal: ['y'] }, hasMentor: false }, tripRequests: [], ministry: null, base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [] } };
const b = await chromium.launch({ executablePath: CHROMIUM });
const errs = [];
async function open(dev, opts) {
  opts = opts || {};
  const ctx = await b.newContext(dev);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('**/.netlify/functions/api', (r) => { const q = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(q.fn === 'getMyBoot' ? BOOT : { ok: true }) }); });
  await p.addInitScript((o) => {
    localStorage.setItem('gp-staff', JSON.stringify({ user: 'dara', pin: '1234' }));
    if (o.dismissed) localStorage.setItem('gp-install-dismissed', '1');
    if (o.standalone) Object.defineProperty(navigator, 'standalone', { get: () => true });
  }, opts);
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('nav.bottom button'); await p.waitForTimeout(500);
  await p.evaluate(() => { S.view = 'profile'; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(300);
  return { ctx, p };
}

/* Android Chrome: the browser's own install prompt (a stand-in event, as Chrome sends it) */
{
  const { ctx, p } = await open(devices['Pixel 7'], { dismissed: true });
  ok('the top bar was dismissed, and the card is still in Profile & settings', !(await p.$('#gpInstallBar')) && /Install this app/.test(await p.$eval('#profInstall', (e) => e.innerText)));
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    window.__prompted = 0;
    e.prompt = () => { window.__prompted++; return Promise.resolve(); };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/android.png' });
  await p.click('#profInstall'); await p.waitForTimeout(400);
  ok('Android: Install opens the browser’s own install prompt', await p.evaluate(() => window.__prompted === 1));
  ok('… and once it’s accepted, the card says it’s installed', /Installed — open YWAM GP from your Home Screen/.test(await p.$eval('#main', (e) => e.innerText)) && !(await p.$('#profInstall')));
  await ctx.close();
}
/* a browser with no install prompt: the menu's steps */
{
  const { ctx, p } = await open(devices['Pixel 7']);
  await p.click('#profInstall'); await p.waitForTimeout(300);
  ok('no install prompt from the browser: the button shows its menu’s steps', /Install app/.test(await p.$eval('#profInstallHelp', (e) => e.innerText)) && /⋮/.test(await p.$eval('#profInstallHelp', (e) => e.innerText)));
  await ctx.close();
}
/* iPhone */
{
  const { ctx, p } = await open(devices['iPhone 13']);
  await p.click('#profInstall'); await p.waitForTimeout(300);
  const help = await p.$eval('#profInstallHelp', (e) => e.innerText);
  ok('iPhone: Share → Add to Home Screen → Add', /Share/.test(help) && /Add to Home Screen/.test(help) && /“Add”/.test(help), help.replace(/\n/g, ' / '));
  await p.screenshot({ path: OUT + '/iphone.png' });
  await p.click('#profInstall'); await p.waitForTimeout(300);
  ok('… tapping again folds the steps away', !(await p.$('#profInstallHelp')));
  await ctx.close();
}
/* opened from the Home Screen */
{
  const { ctx, p } = await open(devices['iPhone 13'], { standalone: true });
  ok('opened from the Home Screen, there’s no card', !(await p.$('#profInstall')) && /Profile & settings/.test(await p.$eval('#main', (e) => e.innerText)));
  await ctx.close();
}
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
