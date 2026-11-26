/* Intercession on the page (Nov 2026): its My Ministry tabs, recording a Wednesday (the numbers fill themselves
   in), planning the next one from last week's, planning a fast from our template, Numbers asking only for the
   director's score; then someone else on staff: the fast in ☰ and the bell, joining and ticking a day, sending a
   need from the page reached through ☰ → Prayer — and it reaching the team's Requests. Khmer and 320px too. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('icp-ui');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json',
  JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Ina Prayer', username: 'ina', email: 'i@e.com', dept: 'Youth Education', ministry: 'Intercession' }),
  mk({ id: 'st2', name: 'Cal Fay', username: 'cal', email: 'c@e.com', dept: 'Community Service', ministry: 'Cafe' }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com', dept: 'Youth Education', ministry: 'Sports' })
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
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
  page.on('dialog', d => d.accept(opts.answer || ''));
  await page.route('**fonts.g**', r => r.abort());
  await page.addInitScript(a => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}
const ent = metric => (mem.entries || []).find(r => r.ministry === 'Intercession' && r.metric === metric);
const txt = p => p.$eval('#main', e => e.innerText);
const wide = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

{
  const { ctx, page } = await open('ina');
  await page.evaluate(() => { S.view = 'ministry'; render(); }); await page.waitForTimeout(1200);
  const tabs = (await page.$$eval('.mmTabs .gtTab', b => b.map(x => x.textContent))).join();
  ok('Intercession’s tabs: Wednesdays · 21-day fast · Requests · Dashboard · Scorecard · Tasks · Rocks', tabs === 'Wednesdays,21-day fast,Requests,Dashboard,Scorecard,Tasks,Rocks', tabs);
  ok('it opens on Wednesdays, asking about the last one', !!(await page.$('.mmTabs .gtTab.on[data-mmtab="icwed"]')) && !!(await page.$('#icpAskHeld')));
  ok('the next 8 Wednesdays are there', (await page.$$('.icpWed')).length >= 8);
  await page.click('#icpAskHeld [data-icpwed]'); await page.waitForTimeout(400);
  ok('Record it opens the form', !!(await page.$('#icpForm')));
  await page.fill('#icpFocus', 'Families');
  await page.fill('#icpRef', 'Joshua 24:15');
  await page.click('[data-icpmin="Community Service|Cafe"]'); await page.click('[data-icpmin="Youth Education|Sports"]');
  await page.click('[data-icpheld="1"]'); await page.waitForTimeout(300);
  ok('the focus typed survives the redraw', await page.$eval('#icpFocus', e => e.value) === 'Families');
  await page.fill('#icpCame', '14'); await page.fill('#icpHours', '1.5');
  await page.fill('#icpTes', 'Rain for the farms'); await page.click('#icpTesAdd'); await page.waitForTimeout(200);
  await page.click('#icpSave'); await page.waitForTimeout(1500);
  ok('saved: the card says held, with the testimony', !(await page.$('#icpForm')) && /Rain for the farms/.test(await page.$eval('#main', e => e.textContent)) && !(await page.$('#icpAskHeld')));
  ok('the numbers fill themselves in: 1 meeting, 1.5 hours, 2 ministries, 1 testimony',
    ent('Prayer Meetings Held')?.value === 1 && ent('Prayer Hours Covered')?.value === 1.5 && ent('Ministries Covered in Prayer')?.value === 2 && ent('Answered-Prayer Testimonies')?.value === 1);
  /* plan the next one, copying last week's */
  const nextDate = await page.evaluate(() => [...document.querySelectorAll('.icpWed[data-icpwedcard]')].map(e => e.getAttribute('data-icpwedcard')).filter(d => d > S.icp.today)[0]);
  await page.click('.icpWed[data-icpwedcard="' + nextDate + '"] [data-icpwed]'); await page.waitForTimeout(400);   // a Wednesday still to come
  await page.click('#icpCopyLast'); await page.waitForTimeout(400);
  ok('Copy the plan brings last week’s focus and ministries', await page.$eval('#icpFocus', e => e.value) === 'Families' && (await page.$$('#icpForm [data-icpmin].on')).length === 2);
  ok('… and a Wednesday to come asks nothing about how it went', !(await page.$('[data-icpheld]')));
  await page.fill('#icpFocus', 'The nation');
  await page.click('#icpSave'); await page.waitForTimeout(1500);
  ok('the next Wednesday is planned', /The nation/.test(await txt(page)));
  ok('nothing scrolls sideways', await wide(page));
  /* the fast */
  await page.click('[data-mmtab="icfast"]'); await page.waitForTimeout(500);
  await page.click('#fastNew'); await page.waitForTimeout(400);
  await page.fill('#fastTitle', 'January fast');
  await page.fill('#fastStart', await page.evaluate(() => todayStr()));
  await page.dispatchEvent('#fastStart', 'change'); await page.waitForTimeout(300);
  await page.click('#fastTpl'); await page.waitForTimeout(300);
  ok('Fill in our 21 themes fills every day with a focus and a reference', (await page.$$eval('[data-fd$="|focus"]', a => a.filter(x => x.value).length)) === 21 && await page.$eval('[data-fd="0|ref"]', e => e.value) === 'Matthew 6:33');
  await page.click('#fastGAdd'); await page.waitForTimeout(300);
  await page.fill('[data-fg="0|time"]', '06:00'); await page.fill('[data-fg="0|place"]', 'Chapel');
  await page.click('#fastSaveBtn'); await page.waitForTimeout(1500);
  const fasts = (mem['fast:siemreap'] || {}).fasts || [];
  ok('the fast is saved, with its gathering', fasts.length === 1 && fasts[0].title === 'January fast' && fasts[0].plan[0].focus === 'Seeking God first' && fasts[0].gatherings[0].place === 'Chapel');
  ok('the tab shows it running, with counts (nobody yet)', /Day 1 of 21/.test(await txt(page)) && !!(await page.$('[data-fastcounts]')));
  /* Numbers asks for the director's score only */
  await page.click('[data-mmtab="numbers"]'); await page.waitForTimeout(800);
  if (!(await page.$('[data-kpi], [data-kpiweek]'))) { const b = await page.$('#kpiInputBtn'); if (b) { await b.click(); await page.waitForTimeout(500); } }
  const asked = await page.$$eval('[data-kpi], [data-kpiweek]', a => a.map(x => x.getAttribute('data-kpi') || x.getAttribute('data-kpiweek')));
  ok('Numbers asks only for the director’s weekly score', asked.length > 0 && asked.every(m => m === 'Director Weekly Score (1-10)'), asked.join());
  ok('… and says the rest count themselves', /count themselves from the Wednesdays/.test(await txt(page)));
  await page.click('[data-mmtab="icdash"]'); await page.waitForTimeout(500);
  ok('the dashboard: 1 Wednesday held, 14 came, 1.5 hours', /Wednesdays held\s*1/.test(await txt(page)) && /Average attendance\s*14/.test(await txt(page)) && /Prayer hours\s*1\.5/.test(await txt(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('cal');
  ok('someone else on staff: the fast is in ☰', await page.evaluate(() => { S.menuOpen = true; renderMenu(); return !!document.querySelector('[data-menu-item="fast"]'); }));
  ok('… and in the bell', await page.evaluate(() => notifItems_().some(i => /January fast/.test(i.text))));
  await page.click('[data-menu-item="fast"]'); await page.waitForTimeout(1200);
  ok('☰ → the fast opens the intercession page on the fast', await page.evaluate(() => S.view === 'icp') && !!(await page.$('#icpFastCard')) && !(await page.$('#icpForm')));
  ok('the health note and the privacy promise are there', /pregnant or nursing/.test(await txt(page)) && /never who/.test(await txt(page)));
  await page.click('[data-fastjoin="partial"]'); await page.waitForTimeout(1200);
  ok('joined: the kind chosen, the days to tick', /You joined: Partial fast/.test(await txt(page)) && (await page.$$('.fastDay')).length === 21);
  await page.click('.fastDay[data-fasttick="1"]'); await page.waitForTimeout(1200);
  const F = mem['fast:siemreap'].fasts[0];
  ok('today ticked, kept as their own', JSON.stringify(mem['fastJoin:siemreap'][F.id].st2.ticks) === '[1]');
  ok('the bell now says the day’s focus', await page.evaluate(() => { var it = fastNotifItems_(); return it.length === 0; }));   // ticked today: nothing to remind
  await page.fill('#icpNeedText', 'Pray for our new barista');
  await page.click('#icpNeedSend'); await page.waitForTimeout(1200);
  ok('a need sent shows under Needs I sent', /Needs I sent[\s\S]*Pray for our new barista/.test(await txt(page)));
  await page.evaluate(() => { S.view = 'prayer'; S.pr = null; render(); }); await page.waitForTimeout(900);
  ok('☰ → Prayer has the way to Wednesday intercession', !!(await page.$('#prToIcp')));
  await page.click('#prToIcp'); await page.waitForTimeout(1000);
  ok('… which opens it', await page.evaluate(() => S.view === 'icp') && /Wednesday intercession/.test(await txt(page)));
  ok('search finds Wednesday intercession', await page.evaluate(() => gpFindPages_().some(p => p.id === 'intercession') && gpFindPages_().some(p => p.id === 'fast')));
  await ctx.close();
}
{
  const { ctx, page } = await open('ina');
  await page.evaluate(() => { S.view = 'ministry'; S.mmTab = 'icreq'; S.mmTabTouched = true; render(); }); await page.waitForTimeout(1200);
  ok('the need reaches the team’s Requests, with who sent it', /Pray for our new barista/.test(await txt(page)) && /Cal Fay/.test(await txt(page)));
  await page.click('[data-icpneed$="|prayed"]'); await page.waitForTimeout(1200);
  ok('marked prayed', mem['icp:siemreap'].needs[0].status === 'prayed');
  await page.click('[data-mmtab="icfast"]'); await page.waitForTimeout(800);
  ok('the team sees 1 joined, 1 prayed today — and no name', /Joined\s*1/.test(await txt(page)) && /Prayed today\s*1/.test(await txt(page)) && !/Cal Fay/.test(await txt(page)));
  await ctx.close();
}
{
  const { ctx, page } = await open('dara', { km: true, small: true });
  await page.evaluate(() => icpOpen_('fast')); await page.waitForTimeout(1200);
  ok('in Khmer at 320px: the page, the fast, nothing sideways', /ការតមអាហារ/.test(await txt(page)) && await wide(page));
  await ctx.close();
}
ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
