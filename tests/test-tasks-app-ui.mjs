/* GP Tasks as an app of its own, in the browser (Nov 2026, Andrew), against the real api.js:
     - tasks.html opens on Tasks with one call (getTasksBoot — not getMyBoot, not a second call for the
       tasks), a two-tab bar (Tasks · Calendar), no My Home back links and no Calendar | Tasks switch;
     - its kept copy is its own (the main app's is left alone);
     - a task added here is in the main app's tasks (same server, same data);
     - it remembers the tab: reopened on the Calendar, the month comes with the boot;
     - ☰ has the way to the main app and Log out; logging out shows its own sign-in screen;
     - opened in a browser, a card says how to put it on the Home Screen ("Not now" hides it);
     - the main app keeps its GP Tasks page, with a line that explains the app and gives its link;
     - back from Google's page (which only returns to teams.html), someone who left from the tasks app
       goes on to it, token and all. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('tasks-app-ui');
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
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id, google: { sub: 'g-' + o.id } }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [mk({ id: 'c1', name: 'Cora Cafe', username: 'cora', email: 'c@e.com' }), mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' })];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const sent = [];
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const body = JSON.parse(b || '{}'); sent.push({ fn: body.fn, args: body.args, from: req.headers.referer || '' });
    if (body.fn === 'staffLoginGoogle') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, err: 'google' })); return; }   // no Google here
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
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, timezoneId: 'Asia/Phnom_Penh' });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('dialog', d => d.accept());
await page.route('**fonts.g**', r => r.abort());
await page.addInitScript(() => { if (!localStorage.getItem('gp-test-started')) { localStorage.setItem('gp-test-started', '1'); localStorage.setItem('gp-staff', JSON.stringify({ user: 'cora', pin: '1234' })); } });
const fns = (from) => sent.slice(from).map(x => x.fn);

/* ---------- 1. tasks.html opens on Tasks, with one call ---------- */
let mark = sent.length;
await page.goto(BASE + '/tasks.html', { waitUntil: 'load' });
await page.waitForSelector('nav.bottom button', { timeout: 15000 });
await page.waitForSelector('.gtBar', { timeout: 8000 });
await page.waitForTimeout(600);
const opened = fns(mark).filter(f => f !== 'markSeen' && f !== 'savePhotoThumb');
ok('it opens with one call, getTasksBoot — not the main app’s boot, and no second call for the tasks', JSON.stringify(opened) === '["getTasksBoot"]', opened.join(','));
const nav = await page.$$eval('nav.bottom [data-tab]', bs => bs.map(b => b.getAttribute('data-tab') + (b.classList.contains('on') ? '*' : '')));
ok('a two-tab bar: Tasks (open) and Calendar', JSON.stringify(nav) === '["tasks*","calendar"]', nav.join(','));
ok('no “← My Home”, no Calendar | Tasks switch, no bell', !(await page.$('#gptBack')) && !(await page.$('.ctSeg')) && !(await page.$('#bellBtn')));
ok('the Inbox is there', /Inbox/.test(await page.$eval('.gtBar', e => e.innerText)));
ok('its title and header say GP Tasks', (await page.title()) === 'GP Tasks' && /GP TASKS/.test(await page.$eval('.brandEn', e => e.textContent)));
const ls = await page.evaluate(() => ({ mine: !!localStorage.getItem('gp-tasks-boot-cache'), main: !!localStorage.getItem('gp-boot-cache') }));
ok('its kept copy for opening offline is its own; the main app’s is left alone', ls.mine && !ls.main, JSON.stringify(ls));

/* ---------- 2. the install card ---------- */
ok('opened in a browser, a card says how to put it on the Home Screen', !!(await page.$('#taInstall')) && /Home Screen/.test(await page.$eval('#taInstall', e => e.innerText)));
await page.click('#taInstallHide'); await page.waitForTimeout(250);
ok('“Not now” hides it on this phone', !(await page.$('#taInstall')) && (await page.evaluate(() => localStorage.getItem('gp-ta-install-hide'))) === '1');

/* ---------- 3. a task added here is the main app's too ---------- */
await page.click('#gtAdd'); await page.waitForTimeout(250);
await page.fill('#gptAddInput', 'Call the printer');
await page.keyboard.press('Enter'); await page.waitForTimeout(800);
ok('a task added here shows in the list', /Call the printer/.test(await page.$eval('#main', e => e.innerText)));
ok('… and is saved on the server, where the main app reads it', ((mem.gpTasks || {}).tasks || []).some(x => x.title === 'Call the printer'));

/* ---------- 4. the Calendar tab, remembered ---------- */
mark = sent.length;
await page.click('nav.bottom [data-tab="calendar"]'); await page.waitForTimeout(700);
ok('the Calendar tab shows the month', !!(await page.$('.gcNav')) && !(await page.$('#calBack')) && !(await page.$('.ctSeg')));
mark = sent.length;
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.gcNav', { timeout: 15000 }); await page.waitForTimeout(600);
const re = sent.slice(mark).filter(x => x.fn !== 'markSeen' && x.fn !== 'savePhotoThumb');
ok('reopened, it opens on the Calendar — the month comes with the boot, no separate call', re.length === 1 && re[0].fn === 'getTasksBoot' && /^\d{4}-\d{2}-\d{2}$/.test(re[0].args[2] || ''), re.map(x => x.fn + '(' + (x.args[2] || '') + ')').join(','));

/* ---------- 5. ☰: the main app, and Log out ---------- */
await page.click('#menuBtn'); await page.waitForTimeout(250);
const items = await page.$$eval('[data-menu-item]', bs => bs.map(b => b.getAttribute('data-menu-item')));
ok('☰ has Tasks, Calendar, the way to the main app and Log out — nothing of the main app’s menu', JSON.stringify(items) === '["tasks","calendar","openapp","applogout"]', items.join(','));
await page.click('[data-menu-item="applogout"]'); await page.waitForTimeout(400);
ok('logging out shows the tasks app’s own sign-in screen', !!(await page.$('#taLoginHead')) && (await page.$eval('#bottomNav', e => e.classList.contains('hidden'))));
ok('… and forgets both kept copies', await page.evaluate(() => !localStorage.getItem('gp-tasks-boot-cache') && !localStorage.getItem('gp-staff')));

/* ---------- 6. the main app: its GP Tasks page, and the way to the app ---------- */
const p2 = await ctx.newPage();
p2.on('pageerror', e => errors.push('PAGEERROR(main) ' + e.message));
await p2.evaluate ? null : null;
await p2.goto(BASE + '/teams.html', { waitUntil: 'load' });
await p2.evaluate(() => { localStorage.setItem('gp-staff', JSON.stringify({ user: 'cora', pin: '1234' })); });
mark = sent.length;
await p2.reload({ waitUntil: 'load' });
await p2.waitForSelector('nav.bottom button', { timeout: 15000 }); await p2.waitForTimeout(500);
ok('the main app is unchanged: it opens with getMyBoot and its own bar', fns(mark).indexOf('getMyBoot') > -1 && fns(mark).indexOf('getTasksBoot') === -1 && (await p2.$$('nav.bottom [data-tab]')).length === 5);
await p2.evaluate(() => { gptOpenPage_('week'); }); await p2.waitForSelector('.gtBar', { timeout: 8000 }); await p2.waitForTimeout(400);
ok('its GP Tasks has the task added in the tasks app', /Call the printer/.test(await p2.$eval('#main', e => e.innerText)));
ok('… and a line about GP Tasks as an app of its own', !!(await p2.$('#gtGetApp')));
await p2.click('#gtGetApp'); await p2.waitForTimeout(250);
const sheet = await p2.$eval('#gtGetAppSheet', e => e.innerText).catch(() => '');
ok('it opens a sheet with the link to tasks.html and the steps', /\/tasks\.html/.test(sheet) && /Add to Home Screen|Install app/.test(sheet), sheet.slice(0, 120));
ok('… with Open GP Tasks pointing there', /\/tasks\.html$/.test(await p2.$eval('#gtGetAppOpen', a => a.href)));
await p2.close();

/* ---------- 7. back from Google's page: on to the tasks app ---------- */
const p3 = await ctx.newPage();
p3.on('pageerror', e => errors.push('PAGEERROR(redirect) ' + e.message));
await p3.goto(BASE + '/tasks.html', { waitUntil: 'load' });
await p3.evaluate(() => { localStorage.removeItem('gp-staff'); localStorage.setItem('gp-ggl-redirect', JSON.stringify({ state: 'st123', mode: 'login', at: Date.now(), app: 'tasks' })); });
mark = sent.length;
await p3.goto(BASE + '/teams.html#access_token=tok-abc&token_type=Bearer&state=st123', { waitUntil: 'load' });
await p3.waitForURL(/\/tasks\.html/, { timeout: 8000 }).catch(() => {});
await p3.waitForTimeout(1200);
const lg = sent.slice(mark).find(x => x.fn === 'staffLoginGoogle');
ok('Google returns to teams.html; someone who left from the tasks app goes on to it', /\/tasks\.html$/.test(p3.url().split('#')[0].split('?')[0]), p3.url());
ok('… and the sign-in carries on there with the token, the address tidied', !!lg && lg.args[0] === 'tok-abc' && /tasks\.html/.test(lg.from) && !/access_token/.test(p3.url()), lg ? lg.from : 'not sent');
await p3.close();

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
