/* GP Tasks in the browser (Oct 2026): a ministry's list, adding with Enter, a day, a time and a person; ticking off; the bell; asking another ministry and the request taken on; My Ministry's Tasks tab; Campus Leadership's view, its saved filter, and a board card that becomes a ministry's task. Real api.js, fake store. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('gp-tasks-week-ui');
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
/* ---- GP Tasks (Nov 2026, Andrew): a light / dark button, and the Inbox's This week — every list's tasks for the week,
   day by day, so overlaps show. ---- */
const T = () => (mem.gpTasks || { tasks: [] }).tasks;
const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
const today = day(0), dow = new Date(today + 'T00:00:00Z').getUTCDay(), sunday = day(6 - ((dow + 6) % 7));
let g = await call('getGpTasks', ['cora', '1234']);
await call('getGpTasks', ['kanha', '1234']);
const inbox = g.lists.find(l => l.scope === 'personal' && l.ownerId === 'c1'), cafe = g.lists.find(l => l.scope === 'ministry' && l.ministry === 'Cafe');
await call('saveGpTask', ['cora', '1234', { listId: inbox.id, title: 'Plan the outreach', due: today, time: '09:00' }]);
await call('saveGpTask', ['cora', '1234', { listId: cafe.id, title: 'Clean the till', due: today, time: '09:00' }]);
await call('saveGpTask', ['cora', '1234', { listId: cafe.id, title: 'Order the beans', due: sunday }]);
await call('saveGpTask', ['cora', '1234', { listId: cafe.id, title: 'Next week thing', due: day(7 + 6 - ((dow + 6) % 7)) }]);
await call('saveGpTask', ['kanha', '1234', { listId: cafe.id, title: 'Given to Cora', due: today, assignees: ['c1'] }]);
await call('saveGpTask', ['cora', '1234', { listId: cafe.id, title: 'Already done', due: today }]);
const doneId = T().find(x => x.title === 'Already done').id;
await call('saveGpTask', ['cora', '1234', { id: doneId, done: true }]);

{
  const { ctx, page } = await open('cora', { q: '?view=tasks' });
  await page.waitForSelector('#gtInboxSeg', { timeout: 8000 });
  ok('the Inbox has Inbox | This week, with how many this week', /This week · 4/.test(await page.$eval('#gtInboxSeg', e => e.innerText)), await page.$eval('#gtInboxSeg', e => e.innerText));
  await page.click('[data-gptweek="1"]'); await page.waitForTimeout(300);
  const wk = await page.$eval('#gtWeek', e => e.innerText);
  ok('This week: every list’s tasks, not next week’s, not the done one', /Plan the outreach/.test(wk) && /Clean the till/.test(wk) && /Order the beans/.test(wk) && /Given to Cora/.test(wk) && !/Next week thing/.test(wk) && !/Already done/.test(wk), wk.slice(0, 300));
  ok('… day by day: today, and Sunday', !!(await page.$('#gtWeek [data-gptweekday="' + today + '"]')) && !!(await page.$('#gtWeek [data-gptweekday="' + sunday + '"]')) && (await page.$$('#gtWeek [data-gptweekday]')).length >= 7 - ((dow + 6) % 7));
  ok('… a busy day says how many', new RegExp((today === sunday ? 4 : 3) + ' tasks', 'i').test(await page.$eval('#gtWeek [data-gptweekday="' + today + '"]', e => e.innerText)));
  ok('… each says which list it is in', /Cafe/.test(wk));
  ok('… two at 9:00 are marked as the same time', (await page.$$('#gtWeek .gtClash')).length === 2);
  ok('… nothing to drag here', !(await page.$('#gtWeek [data-gptgrip]')));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/tasks-week.png' });
  await page.click('#gtWeek [data-gptdone]'); await page.waitForTimeout(800);
  ok('ticking one off there works', T().filter(x => x.done).length === 2);
  await page.click('[data-gptweek="0"]'); await page.waitForTimeout(300);
  ok('back to the Inbox', !(await page.$('#gtWeek')) && /Plan the outreach|Given to Cora/.test(await main(page)));
  ok('a light / dark button on GP Tasks', !!(await page.$('.ctRow [data-gptheme]')));
  await page.click('.ctRow [data-gptheme]'); await page.waitForTimeout(300);
  ok('Auto → Light', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light' && localStorage.getItem('gp-theme') === 'light'));
  await page.click('.ctRow [data-gptheme]'); await page.waitForTimeout(300);
  ok('Light → Dark, and it says so', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark') && /Dark/.test(await page.$eval('#msg', e => e.textContent)));
  await page.click('.ctRow [data-gptheme]'); await page.waitForTimeout(300);
  ok('Dark → Auto (follows the phone)', await page.evaluate(() => !document.documentElement.hasAttribute('data-theme') && !localStorage.getItem('gp-theme')));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.addInitScript(() => { localStorage.setItem('gp-staff', JSON.stringify({ user: 'cora', pin: '1234' })); });
  await page.goto(BASE + '/tasks.html', { waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(600);
  ok('the GP Tasks app has it in its header', !!(await page.$('header [data-gptheme]')));
  await page.click('header [data-gptheme]'); await page.waitForTimeout(300);
  ok('… and it works there', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light'));
  await page.click('nav.bottom [data-tab="calendar"]'); await page.waitForTimeout(500);
  await page.click('header [data-gptheme]'); await page.waitForTimeout(300);
  ok('… on the Calendar as well', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'));
  await ctx.close();
}
/* ---- the Portal, an app of its own, with its own icon ---- */
{
  const man = JSON.parse(fs.readFileSync(PUBLIC + '/portal-manifest.json', 'utf8')), ph = fs.readFileSync(PUBLIC + '/portal.html', 'utf8');
  ok('the Portal’s manifest and Home Screen icon are its own (an open door)', man.icons.every(i => /^portal-/.test(i.src)) && man.icons.some(i => i.purpose === 'maskable') &&
    man.icons.every(i => fs.existsSync(PUBLIC + '/' + i.src)) && /apple-touch-icon" sizes="180x180" href="portal-180.png"/.test(ph));
  ok('… and its staff side offers to install it', ph.indexOf('return installCardHtml_(true)+h;') > -1);
  mem.staff.find(s => s.id === 'c1').portalStaff = true;
  const { ctx, page } = await open('cora');
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('☰ → Applications: The Portal on your phone', !!(await page.$('[data-menu-item="portalapp"]')));
  await page.click('[data-menu-item="portalapp"]'); await page.waitForTimeout(300);
  ok('… a sheet with its icon, the link and the steps', !!(await page.$('#portalAppSheet img[src="portal-180.png"]')) && /portal\.html$/.test(await page.$eval('#portalAppUrl', e => e.textContent)) && (await page.$$('#portalAppSheet .gtGetSteps li')).length === 3);
  await page.click('#portalAppScrim', { position: { x: 10, y: 10 } }); await page.waitForTimeout(200);
  ok('… and it closes', !(await page.$('#portalAppSheet')));
  await ctx.close();
  const k = await open('kanha'); await k.page.click('#menuBtn'); await k.page.waitForTimeout(250);
  ok('not for someone without the portal', !(await k.page.$('[data-menu-item="portalapp"]')));
  await k.ctx.close();
}
ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
