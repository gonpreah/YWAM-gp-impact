/* Tests on the page (teams/17-tests.js): the Tests page from About me; the fivefold gifts answered and
   scored; a couple check-up started with a partner and a counsellor, answered by both, results seen by the
   two and the counsellor and nobody else; Khmer statements. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('tests-ui');
const OUT = tmpDir('tests-ui-out');
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
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe',
  role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'st1', name: 'Mark Hill', username: 'mark', email: 'm@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', mentorId: 'st2', mentorStatus: 'approved' }),
  mk({ id: 'st2', name: 'Ann Lee', username: 'ann', email: 'a@e.com', dept: 'Campus Leadership', ministry: 'Community Service' }),
  mk({ id: 'st3', name: 'Bo Chan', username: 'bo', email: 'b@e.com', dept: 'Campus Leadership', ministry: 'Youth Education' }),
  mk({ id: 'st4', name: 'Cy Ros', username: 'cy', email: 'c@e.com', dept: 'Campus Leadership', ministry: 'Skills Training' }),
  mk({ id: 'st5', name: 'Di Sok', username: 'di', email: 'd@e.com', dept: 'Community Service', ministry: 'Cafe' })
];
mem.board = [{ id: 'bd1', name: 'Mary Board', role: 'President', username: 'mary', pinSalt: 'bd1', pinHash: H('4321', 'bd1'), active: true }];
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
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.board) localStorage.setItem('gp-board', JSON.stringify({ user: a.board, pin: '4321' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km, board: opts.board || '' });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user || opts.board) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);
const goTests = async (page) => { await page.evaluate(() => { S.tests.mc = null; testsOpen_('home'); }); await page.waitForTimeout(900); };

/* ---------- 1. the Tests page and the fivefold gifts ---------- */
{
  const { ctx, page } = await open('mark');
  ok('Tests is in ☰ (and a quick app), no longer a tile on My Home', !(await page.$('#testsTile')) && !!(await page.evaluate(() => { S.menuOpen = true; renderMenu(); return !!document.querySelector('#menuRoot [data-menu-item="tests"]'); })));
  await page.click('#menuRoot [data-menu-item="tests"]'); await page.waitForTimeout(900);
  const txt = await main(page);
  ok('the Tests page lists personality, strengths, fivefold gifts, language and the couple check-up',
    /Personality/.test(txt) && /Strengths/.test(txt) && /Fivefold gifts/.test(txt) && /Language level test/.test(txt) && /Couple check-up/.test(txt));
  ok('… and says they are our own, not the official assessments', /not the official MBTI®, PREPARE\/ENRICH or APEST/.test(txt));
  await page.click('#testApest'); await page.waitForTimeout(400);
  ok('the fivefold test opens on Ephesians 4 and 30 statements', /Ephesians 4:11/.test(await main(page)) && (await page.$$('#apestTest .testQ')).length === 30);
  ok('See my gifts waits until every statement is answered', await page.$eval('#apSubmit', (b) => b.disabled));
  const gifts = await page.evaluate(() => APEST_QS.map((q) => q[0]));
  for (let i = 0; i < 30; i++) await page.click('[data-apq="' + i + '|' + (gifts[i] === 'e' ? 5 : gifts[i] === 'a' ? 4 : 2) + '"]');
  ok('the answers are kept on the phone as you go', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('gp-apest-draft') || '{}')).length === 30));
  await page.click('#apSubmit'); await page.waitForTimeout(1200);
  const res = await main(page);
  ok('the results lead with Evangelist, then Apostle', /Your strongest gift[\s\S]*Evangelist[\s\S]*Your second gift[\s\S]*Apostle/.test(res), res.slice(0, 160));
  ok('… with all five as bars', (await page.$$('#apBars .apBar')).length === 5);
  ok('… saved on the server, scored there', ((mem.staff.find((s) => s.id === 'st1').apest || {}).top || [])[0] === 'e');
  await page.click('#apShare'); await page.waitForTimeout(900);
  ok('turning sharing off is saved', mem.staff.find((s) => s.id === 'st1').apest.share === false);
  await page.screenshot({ path: OUT + '/apest.png', fullPage: true });

  /* ---------- 2. starting a couple check-up ---------- */
  await goTests(page);
  await page.click('#mcStartNew'); await page.waitForTimeout(400);
  ok('Start waits until a partner is picked', await page.$eval('#mcCreate', (b) => b.disabled));
  await page.fill('[data-ppickq="mcPartner"]', 'Ann'); await page.waitForTimeout(200);
  await page.click('[data-ppickit="mcPartner|st2"]'); await page.waitForTimeout(300);
  await page.click('[data-mcstage="engaged"]'); await page.waitForTimeout(200);
  await page.fill('[data-ppickq="mcCounsel"]', 'Bo'); await page.waitForTimeout(200);
  await page.click('[data-ppickit="mcCounsel|st3"]'); await page.waitForTimeout(300);
  await page.click('#mcCreate'); await page.waitForTimeout(1200);
  ok('it goes straight to Mark’s own answers, area by area', !!(await page.$('#mcAns')) && (await page.$$('#mcAns .testQ')).length === 40 && /Talking and listening/.test(await main(page)));
  for (let i = 0; i < 40; i++) await page.click('[data-mcq="' + i + '|4"]');
  await page.click('#mcSubmit'); await page.waitForTimeout(1200);
  ok('back on Tests: waiting for Ann', /Waiting for Ann to answer/.test(await main(page)));
  ok('the server holds it with Bo as counsellor', (mem.mcheck || []).length === 1 && mem.mcheck[0].counselor === 'st3' && !!mem.mcheck[0].answers.st1);
  await ctx.close();
}

/* ---------- 3. Ann answers; both see the results; the counsellor too; nobody else ---------- */
{
  const { ctx, page } = await open('ann');
  await goTests(page);
  ok('Ann sees it is her turn', /Your turn — answer the 40 statements/.test(await main(page)));
  await page.click('[data-mcans]'); await page.waitForTimeout(500);
  for (let i = 0; i < 40; i++) await page.click('[data-mcq="' + i + '|' + (i < 4 ? 1 : 5) + '"]');
  await page.click('#mcSubmit'); await page.waitForTimeout(1300);
  const r = await main(page);
  ok('once both have answered, the results open', !!(await page.$('#mcRes')) && /Mark & Ann/.test(r), r.slice(0, 120));
  ok('… with strengths and things to talk about counted', /Strengths/.test(r) && /To talk about/.test(r));
  ok('… the area where they differ opens with its talk-it-over question', await page.$eval('[data-mcarea="comm"]', (d) => d.open && /Talk together/.test(d.innerText)));
  await page.screenshot({ path: OUT + '/couple.png', fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await open('bo');
  await goTests(page);
  ok('Bo, the counsellor, sees “You are their counsellor” and the results', /You are their counsellor/.test(await main(page)) && !!(await page.$('[data-mcres]')));
  await page.click('[data-mcres]'); await page.waitForTimeout(500);
  ok('… and can read them, without the couple’s own controls', !!(await page.$('#mcRes')) && !(await page.$('#mcDelete')));
  await ctx.close();
}
{
  const { ctx, page } = await open('di');
  await goTests(page);
  ok('anyone else sees no check-up at all', !(await page.$('.mcRow')));
  await ctx.close();
}

/* ---------- 4. in Khmer ---------- */
{
  const { ctx, page } = await open('di', { km: true });
  await page.evaluate(() => { testsOpen_('apest'); }); await page.waitForTimeout(400);
  ok('in Khmer the statements are Khmer', /ខ្ញុំចូលចិត្តចាប់ផ្តើមរឿងថ្មីមួយ/.test(await main(page)));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
