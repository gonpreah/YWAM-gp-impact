/* The finance tool on the page (teams/09-finance.js). The Finances office uploads the
   three made-up reports as real PDFs (tests/fin-fixtures.mjs), read in the browser by
   pdf.js; each is previewed with its totals checked before it is saved; the cash at the
   month's end goes in with the P&L; an unmatched staff-debt name is matched to someone.
   Then a Campus Director's Finances tab: the month, the year chart (with its tooltip and
   its table), the campus burn rate, staff debt with who owes and how much, biggest first, on the
   page, and the money ahead starting from the cash entered. On a small phone nothing
   scrolls sideways, and both themes render. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { plReport, burnReport, debtReport, makePdf, DEBT_PEOPLE } from './fin-fixtures.mjs';

const TMP = tmpDir('finance-ui');
const OUT = tmpDir('finance-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = (o) => Object.assign({ active: true, campus: 'poipet', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st_fin', name: 'Bopha Keo', username: 'bopha', dept: 'Skills Training', ministry: 'Finances' }),
  mk({ id: 'st_cd', name: 'Mark Hill', username: 'mark', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'st_dara', name: 'Dara Sok', username: 'dara', dept: 'Community Service', ministry: 'Cafe' }),
  mk({ id: 'st_vanna', name: 'Vanna Chan', username: 'vanna', dept: 'Youth Education', ministry: 'Kids Club' }),
  mk({ id: 'st_sop', name: 'Sopheak Long', username: 'sopheak', dept: 'Youth Education', ministry: 'Kids Club' }),
  mk({ id: 'st_rith', name: 'Rith Mao', username: 'rith', dept: 'Skills Training', ministry: 'Kitchen' })
];
const pdfs = { pl: TMP + '/PL-Mar-2026.pdf', burn: TMP + '/Burn-Rate-2026-Mar.pdf', debt: TMP + '/Staff-Debt-March.pdf' };
fs.writeFileSync(pdfs.pl, makePdf(plReport())); fs.writeFileSync(pdfs.burn, makePdf(burnReport())); fs.writeFileSync(pdfs.debt, makePdf(debtReport()));

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
await new Promise((r) => srv.listen(0, r));
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
  const ctx = await browser.newContext(opts.small ? { viewport: { width: 320, height: 700 }, timezoneId: 'Asia/Phnom_Penh', colorScheme: opts.dark ? 'dark' : 'light' }
    : { ...devices['iPhone 13'], timezoneId: 'Asia/Phnom_Penh', colorScheme: opts.dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route('**fonts.g**', (r) => r.abort());
  await page.addInitScript((a) => { localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.lw) sessionStorage.setItem('gp-lw-tab', a.lw); if (a.km) localStorage.setItem('gp-lang', 'km'); },
    { u: user, lw: opts.lw || '', km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { S.view = 'ministry'; render(); window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const txt = (p) => p.$eval('#main', (e) => e.innerText);

/* ---- the Finances office ---- */
{
  const { ctx, page } = await open('bopha');
  ok('the Finances office’s My Ministry opens on its reports', !!(await page.$('[data-fintab="reports"].on')) && !!(await page.$('#finFiles')));
  await page.setInputFiles('#finFiles', [pdfs.pl, pdfs.burn, pdfs.debt]);
  await page.waitForFunction(() => document.querySelectorAll('.finPending').length === 3, null, { timeout: 20000 }).catch(() => {});
  const cards = await page.$$eval('.finPending', (els) => els.map((e) => e.innerText));
  ok('three PDFs read in the page, each known for what it is', cards.length === 3 && cards.some((c) => /Profit and Loss/.test(c)) && cards.some((c) => /Burn rate/.test(c)) && cards.some((c) => /Staff debt/.test(c)), cards.map((c) => c.split('\n')[0]).join(' | '));
  ok('… each checked against its own totals', (await page.$$('.finPending .finCheck.ok')).length === 3, String((await page.$$('.finPending .finCheck.ok')).length));
  const plCard = cards.find((c) => /Profit and Loss/.test(c)) || '';
  ok('the P&L preview: the month and its totals', /Mar 2026/.test(plCard) && /\$8,629\.50/.test(plCard) && /\$8,951\.00/.test(plCard) && /−\$321\.50/.test(plCard));
  ok('the burn rate preview: months in and planned', /3 months in, 9 planned/.test(cards.find((c) => /Burn rate/.test(c)) || ''));
  ok('the ageing preview: the date and how many names', /Apr 2, 2026/.test(cards.find((c) => /Staff debt/.test(c)) || '') && new RegExp('Names\\s*' + DEBT_PEOPLE.length).test(cards.find((c) => /Staff debt/.test(c)) || ''));
  await page.screenshot({ path: OUT + '/office-previews.png', fullPage: true });
  await page.fill('[data-fincash$="|2026-03"]', '15250.75');
  for (let i = 0; i < 3; i++) {
    const b = await page.$('[data-finsave]'); if (!b) break;
    await b.click(); await page.waitForTimeout(1500);
  }
  const doc = mem['finance:poipet'] || {};
  ok('all three saved', !!(doc.pl && doc.pl['2026-03']) && !!(doc.burn && doc.burn['2026']) && !!(doc.debt && doc.debt.asOf === '2026-04-02') && !(await page.$('.finPending')));
  ok('… the cash at the month’s end with the P&L', doc.pl && doc.pl['2026-03'].cash === 15250.75);
  ok('… and each PDF kept', Object.keys(mem).filter((k) => k.startsWith('finfile:')).length === 3);
  const t1 = await txt(page);
  ok('the saved reports are listed', /Mar 2026/.test(t1) && /2026/.test(t1) && /As of Apr 2, 2026/.test(t1));
  ok('one name isn’t on staff and says so', /1 names? aren’t matched/.test(t1) || /names aren’t matched/.test(t1));
  await page.selectOption('[data-finmatch="Someone Gone"]', 'st_rith'); await page.waitForTimeout(1500);
  ok('the office says who they are, and it’s kept', (mem['finance:poipet'].nameMap || {})['Someone Gone'] === 'st_rith' && /Every name is matched/.test(await txt(page)));
  const sd = (dept) => (mem.entries || []).filter((r) => r.campus === 'poipet' && r.dept === 'Campus Leadership' && r.ministry === dept && r.metric === 'Staff Debt ($)').slice(-1)[0];
  ok('each department’s staff debt fills itself in', Number(sd('Youth Education').value) === Math.round(125 + 88.5) && Number(sd('Skills Training').value) === Math.round(97 + 30) && Number(sd('Community Service').value) === 30);
  await page.screenshot({ path: OUT + '/office-saved.png', fullPage: true });
  await page.click('[data-fintab="dash"]'); await page.waitForTimeout(800);
  ok('the office sees what leadership sees, a tab away', !!(await page.$('#finDash .finTiles')) && !!(await page.$('#finYearChart svg')));
  await page.click('[data-fintab="numbers"]'); await page.waitForTimeout(800);
  ok('… and its usual numbers are the third tab', !(await page.$('#finDash')) && !(await page.$('#finReports')));
  await page.click('[data-fintab="reports"]'); await page.waitForTimeout(400);
  await ctx.close();
}

/* ---- a Campus Director ---- */
{
  const { ctx, page } = await open('mark', { lw: 'money' });
  ok('Campus Leadership has a Finances tab on their own row', !!(await page.$('[data-lwtab="money"].on')) && !!(await page.$('#finDash')));
  const t = await txt(page);
  ok('the month: came in, went out, net, cash in the bank', /Base finances · Mar 2026/.test(t) && /\$8,630/.test(t) && /\$8,951/.test(t) && /−\$322/.test(t) && /\$15,251/.test(t), t.slice(0, 400).replace(/\n/g, ' / '));
  ok('the year chart: two series, a bar for every month in', (await page.$$('#finYearChart .finBar.in')).length === 3 && (await page.$$('#finYearChart .finBar.out')).length === 3 && (await page.$$('#finYearChart .finLegend span')).length === 2);
  ok('… with a table twin', (await page.$$eval('#finYearChart .finTable tbody tr', (r) => r.length)) === 3);
  const hit = await page.$$('#finYearChart .finHit');
  await hit[2].hover(); await page.waitForTimeout(200);
  ok('… and a tooltip on each month: every series and the net', await page.evaluate(() => { const t = document.getElementById('finTip'); return !!t && t.style.display === 'block' && /Mar 2026/.test(t.innerText) && /\$8,630/.test(t.innerText) && /\$8,951/.test(t.innerText); }));
  ok('months before the P&L come from the burn rate, and say so', /from the burn rate/i.test(t) && await page.evaluate(() => { const d = JSON.parse(document.querySelectorAll('#finYearChart .finHit')[0].getAttribute('data-fintip')); return /burn rate/.test(d.t) && d.r[0].v === '$10,000'; }));
  ok('where it went, biggest first', /Where it went in Mar 2026/.test(t) && (await page.$$eval('#finDash .finBars', (b) => b[0].innerText)).indexOf('Rent /Lease') === 0);
  ok('the campus and new house: cost, contributions, how much covered', /\$4,475/.test(t) && /\$3,500/.test(t) && /78%/.test(t), (t.match(/The campus and new house[\s\S]{0,300}/) || [''])[0].replace(/\n/g, ' / '));
  ok('… the plan months drawn lighter', (await page.$$('#finBurnChart .finBar.planned')).length === 18);
  ok('staff debt: the total and how old', /Owed by staff/.test(t) && new RegExp('\\$' + Math.round(DEBT_PEOPLE.reduce((a, [, v]) => a + v.reduce((x, y) => x + y, 0), 0))).test(t) && (await page.$$('#finDebt .finStack i')).length === 4);
  const owes = await page.$$eval('#finDebt .finOwes', (r) => r.map((x) => x.innerText.replace(/\n/g, ' / ')));
  ok('… by department, and who owes how much, biggest first', /Youth Education/.test(t) && owes.length === DEBT_PEOPLE.length && /^Vanna & Srey Pich/.test(owes[0]) && /\$125\.00/.test(owes[0]) && owes.some((x) => /Dara Sok/.test(x) && /Community Service/.test(x) && /\$30\.00/.test(x)), owes.join(' | '));
  ok('… and how old the oldest of it is', owes.some((x) => /Sopheak Long/.test(x) && /oldest: Over 3 Months/.test(x)));
  ok('the money ahead starts from the cash in the bank', /Starts from the cash in the bank at the end of Mar 2026: \$15,251/.test(t));
  const ahead = await page.$$('[data-finahead$="|exp"]');
  await ahead[0].fill('20000'); await page.waitForTimeout(200);
  ok('… and runs short when spending outruns it', /runs short/.test(await page.$eval('#leadMoney .lmSum', (e) => e.innerText)));
  await page.click('#finAheadSave'); await page.waitForTimeout(1200);
  ok('… saved for Campus Leadership', Object.values((mem['finProj:poipet'] || {}).months || {}).some((m) => m.exp === 20000));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: OUT + '/leader-finances.png', fullPage: true });
  await (await page.$('#finDebt')).screenshot({ path: OUT + '/leader-debt.png' });
  await page.click('[data-lwtab="base"]'); await page.waitForTimeout(1000);
  ok('the Overview’s money-ahead tile opens the Finances tab', /short in/.test(await page.$eval('[data-lwtab="money"].mmTile', (e) => e.innerText)));
  await page.click('.mmTile[data-lwtab="money"]'); await page.waitForTimeout(600);
  ok('… like that', !!(await page.$('#finDash')));
  await ctx.close();
}
/* a small phone, and dark */
for (const dark of [false, true]) {
  const { ctx, page } = await open('mark', { lw: 'money', small: true, dark });
  ok((dark ? 'dark' : 'light') + ': nothing scrolls sideways on a small phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok((dark ? 'dark' : 'light') + ': the bars wear the chart colours', await page.evaluate(() => { const b = document.querySelector('#finYearChart .finBar.in'); return !!b && getComputedStyle(b).fill !== 'rgb(0, 0, 0)'; }));
  await page.screenshot({ path: OUT + '/leader-small-' + (dark ? 'dark' : 'light') + '.png', fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await open('mark', { lw: 'money', small: true, km: true });
  ok('in Khmer at 320px the Finances tab fits too', await page.evaluate(() => document.documentElement.scrollWidth <= 321) && !!(await page.$('#finDash .finTiles')));
  await page.screenshot({ path: OUT + '/leader-small-km.png', fullPage: true });
  await ctx.close();
}
/* someone who isn't leadership or the office never gets the tab */
{
  const { ctx, page } = await open('dara', { lw: 'money' });
  ok('ordinary staff have no Finances tab', !(await page.$('[data-lwtab="money"]')) && !(await page.$('#finDash')));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close(); srv.close();
console.log('screenshots in ' + OUT);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
