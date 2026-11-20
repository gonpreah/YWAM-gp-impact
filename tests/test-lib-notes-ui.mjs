/* The Library's highlights and notes on the page (18-library-plus.js, Nov 2026, Andrew): tap a paragraph in the reader,
   highlight it, write a note, share it with the campus or the mentor, ask for prayer; others see it on the Library's home
   and the book's page, like it, comment and pray; a phone notification's link opens the note. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('libnotes-ui');
const OUT = tmpDir('libnotes-ui-out');
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
  await page.goto(BASE + '/teams.html' + (opts.q || ''), { waitUntil: 'load' });
  if (user || opts.board) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);
mem.staff.find((s) => s.id === 'st5').mentorId = 'st2'; mem.staff.find((s) => s.id === 'st5').mentorStatus = 'approved';
const lib = async (page) => { await page.evaluate(() => libOpen_()); await page.waitForFunction(() => typeof GP_LIBRARY !== 'undefined', null, { timeout: 15000 }); await page.waitForTimeout(500); };
const rec = (id) => mem.staff.find((s) => s.id === id);

const B = 'atomic-habits';
const reader = async (page, step) => {
  await lib(page);
  await page.evaluate(([b, s]) => { S.libBook = b; S.libStep = null; render(); libGo_(s); }, [B, step]);
  await page.waitForSelector('#libReader [data-lnp="1"]', { timeout: 8000 }); await page.waitForTimeout(300);
};
const rows = () => mem.libHl || [];

/* ---------- 1. Di highlights and writes in the reader ---------- */
{
  const { ctx, page } = await open('di');
  await reader(page, 1);
  ok('every paragraph of the page can be tapped', (await page.$$('#libReader .lnPara')).length >= 2);
  /* sentences, not the whole paragraph (Nov 2026, Andrew: "highlight specific sentences") */
  const sents = await page.$$eval('#libReader [data-lnp="0"] .lnS', els => Array.from(new Set(els.map(e => e.getAttribute('data-lns')))).length);
  ok('each paragraph is cut into sentences you can tap', sents >= 3, String(sents));
  await page.click('#libReader [data-lnp="0"] .lnS[data-lns="0"]'); await page.waitForTimeout(200);
  ok('a tap on a sentence brings up the bar: four colours and Note, that sentence picked', !!(await page.$('#lnBar')) && (await page.$$('#lnBar [data-lncolor]')).length === 4 && !!(await page.$('#lnNoteBtn')) &&
    await page.$$eval('#libReader [data-lnp="0"] .lnS', els => els.filter(e => e.classList.contains('lnSelS')).map(e => e.getAttribute('data-lns')).join()) === '0');
  await page.click('#libReader [data-lnp="0"] .lnS[data-lns="1"]'); await page.waitForTimeout(200);
  ok('a tap on the next sentence takes it in too', await page.$$eval('#libReader [data-lnp="0"] .lnS.lnSelS', els => Array.from(new Set(els.map(e => e.getAttribute('data-lns')))).join()) === '0,1');
  await page.click('#lnBar [data-lncolor="yellow"]'); await page.waitForTimeout(700);
  const hl = await page.$$eval('#libReader [data-lnp="0"] .lnS', els => els.map(e => e.getAttribute('data-lns') + (e.classList.contains('lnHl-yellow') ? 'Y' : '')));
  ok('yellow: saved, private, just those two sentences, drawn in yellow', rows().length === 1 && rows()[0].color === 'yellow' && rows()[0].vis === 'private' && rows()[0].staffId === 'st5' && rows()[0].step === 1 && rows()[0].p === 0 &&
    rows()[0].s === 0 && rows()[0].e === 1 && hl.filter(x => /^[01]Y$/.test(x)).length >= 2 && !hl.some(x => /^[2-9]Y$/.test(x)) && !(await page.$eval('#libReader [data-lnp="0"]', e => e.classList.contains('lnHl'))), JSON.stringify([rows()[0], hl]));
  const para = await page.$eval('#libReader [data-lnp="0"]', e => e.textContent);
  ok('… the quote is those sentences’ words, not the whole paragraph', rows()[0].quote.length > 10 && rows()[0].quote.length < para.length - 5 && !/📝|💬/.test(rows()[0].quote), rows()[0].quote);
  await page.click('#libReader [data-lnp="0"] .lnS[data-lns="2"]'); await page.waitForTimeout(200);
  await page.click('#lnBar [data-lncolor="green"]'); await page.waitForTimeout(700);
  ok('another sentence in the same paragraph is a highlight of its own', rows().length === 2 && rows().some(r => r.s === 2 && r.e === 2 && r.color === 'green') && rows().some(r => r.s === 0 && r.color === 'yellow'));
  await page.click('#libReader [data-lnp="0"] .lnS[data-lns="1"]'); await page.waitForTimeout(200);
  ok('tapping a sentence I marked picks what I marked, its colour ticked', await page.$$eval('#libReader [data-lnp="0"] .lnS.lnSelS', els => Array.from(new Set(els.map(e => e.getAttribute('data-lns')))).join()) === '0,1' && /✓/.test(await page.$eval('#lnBar [data-lncolor="yellow"]', e => e.textContent)));
  await page.click('#lnBar [data-lncolor="yellow"]'); await page.waitForTimeout(700);
  ok('… the same colour again takes it off; the green one stays', rows().length === 1 && rows()[0].s === 2 && rows()[0].color === 'green');
  ok('… and once a colour is picked the pick is let go (the bar closes)', !(await page.$('#lnBar')));
  await page.click('#libReader [data-lnp="1"]'); await page.waitForTimeout(200);
  await page.click('#lnNoteBtn'); await page.waitForTimeout(200);
  ok('Note opens a sheet: the words, who sees it, ask for prayer', !!(await page.$('#lnSheet #lnText')) && (await page.$$('#lnSheet [data-lnvis]')).length === 3 && await page.$eval('#lnPray', e => e.disabled));
  await page.fill('#lnText', 'This reminded me to start small with my Khmer study.');
  await page.click('[data-lnvis="campus"]'); await page.waitForTimeout(150);
  ok('… text kept when the choice redraws it, and prayer can be asked now', (await page.inputValue('#lnText')) === 'This reminded me to start small with my Khmer study.' && !(await page.$eval('#lnPray', e => e.disabled)));
  await page.check('#lnPray');
  await page.click('#lnSave'); await page.waitForTimeout(900);
  const shared = rows().find(r => r.p === 1);
  ok('shared with the campus, asking for prayer — a real prayer request', shared && shared.vis === 'campus' && shared.prayerId && (mem.prayers || []).some(p => p.id === shared.prayerId && p.lib && p.lib.bookId === B && p.scope === 'campus'), JSON.stringify(shared));
  ok('… said so, the sheet closed, 📝 on the paragraph', /Shared with your campus/.test(await page.$eval('#msg', e => e.textContent)) && !(await page.$('#lnSheet')) && /📝/.test(await page.$eval('#libReader [data-lnp="1"]', e => e.textContent)));
  await page.click('#libReader [data-lnp="2"]'); await page.waitForTimeout(150); await page.click('#lnNoteBtn'); await page.waitForTimeout(150);
  await page.fill('#lnText', 'Pray I keep going when it is hard.');
  await page.click('[data-lnvis="mentor"]'); await page.waitForTimeout(100); await page.check('#lnPray'); await page.click('#lnSave'); await page.waitForTimeout(900);
  ok('a note just for my mentor', rows().some(r => r.p === 2 && r.vis === 'mentor' && r.prayerId));
  ok('on my own note: how many are praying and how many liked it — no buttons to do it myself', await page.evaluate(() => { const r = document.getElementById('lnRoot'); return !r.querySelector('[data-lnpray],[data-lnlike]'); }));
  await page.click('#libClose'); await page.waitForTimeout(400);
  const bk = await page.$eval('#lnBook', e => e.innerText);
  ok('the book’s page lists mine: three', /Mine · 3/i.test(bk) && /start small with my Khmer/.test(bk), bk.slice(0, 200));
  if (process.env.GP_SHOT) await page.screenshot({ path: process.env.GP_SHOT + '/notes-book.png', fullPage: true });
  await ctx.close();
}

/* ---------- 2. Bo (same campus) sees it, likes it, comments, prays ---------- */
{
  const { ctx, page } = await open('bo');
  await lib(page);
  const feed = await page.$eval('#lnFeed', e => e.innerText).catch(() => '');
  ok('the Library’s home: what encouraged us — Di’s note, not the mentor one', /Di/.test(feed) && /start small with my Khmer/.test(feed) && !/keep going when it is hard/.test(feed), feed.slice(0, 160));
  await page.click('#lnFeed [data-lnfeed]'); await page.waitForSelector('#lnSheet .lnCard.full', { timeout: 6000 });
  ok('a tap opens the book with the note as a conversation', await page.evaluate(b => S.libBook === b, B) && /start small/.test(await page.$eval('#lnSheet', e => e.innerText)));
  await page.click('#lnSheet [data-lnlike]'); await page.waitForTimeout(700);
  ok('❤️ counts', rows().find(r => r.p === 1).likes.includes('st3') && /❤️ 1/.test(await page.$eval('#lnSheet [data-lnlike]', e => e.textContent)));
  await page.fill('#lnCmtText', 'Same here — let’s practise together!');
  await page.click('#lnCmtSend'); await page.waitForTimeout(800);
  ok('a comment, under the note, with my name', rows().find(r => r.p === 1).comments.length === 1 && /let’s practise together/.test(await page.$eval('#lnCmts', e => e.innerText)) && (await page.inputValue('#lnCmtText')) === '');
  await page.click('#lnSheet [data-lnpray]'); await page.waitForTimeout(700);
  const pid = rows().find(r => r.p === 1).prayerId;
  ok('🙏 I prayed — the same count as the Prayer page', mem.prayers.find(p => p.id === pid).prayed.includes('st3') && /I prayed · 1/.test(await page.$eval('#lnSheet [data-lnpray]', e => e.textContent)));
  ok('Bo cannot edit or delete Di’s note', !(await page.$('#lnSheet [data-lnedit]')) && !(await page.$('#lnSheet [data-lndel]')));
  await page.click('#lnSheetX'); await page.waitForTimeout(200);
  ok('the book’s page has it under the campus', /From YWAM Siem Reap|From Siem Reap/.test(await page.$eval('#lnBook', e => e.innerText)) || /start small/.test(await page.$eval('#lnBook', e => e.innerText)));
  await page.evaluate(() => { S.view = 'prayer'; render(); }); await page.waitForTimeout(900);
  ok('the Prayer page shows it, from the book', /From “Atomic Habits”/.test(await main(page)));
  await page.click('[data-prlib]'); await page.waitForSelector('#lnSheet .lnCard.full', { timeout: 6000 });
  ok('… and “From …” opens the note', await page.evaluate(() => S.view === 'library' && S.ln.sheet === 'thread'));
  await ctx.close();
}

/* ---------- 3. the reader shows others’ notes; the mentor gets theirs; a link opens a note ---------- */
{
  const { ctx, page } = await open('ann');   // Di's mentor
  await reader(page, 1);
  ok('in the reader: 💬 1 on the paragraph with someone else’s note', /💬 1/.test(await page.$eval('#libReader [data-lnp="1"]', e => e.textContent)) && /💬 1/.test(await page.$eval('#libReader [data-lnp="2"]', e => e.textContent)));
  ok('… my own highlights only: Di’s green is not drawn here', !(await page.$eval('#libReader [data-lnp="0"]', e => e.classList.contains('lnHl') || !!e.querySelector('.lnHlS'))));
  await page.click('#libReader [data-lnp="2"]'); await page.waitForTimeout(200); await page.click('#lnParaBtn'); await page.waitForTimeout(200);
  ok('the mentor sees the note meant for them', /keep going when it is hard/.test(await page.$eval('#lnSheet', e => e.innerText)) && /My mentor/.test(await page.$eval('#lnSheet', e => e.innerText)));
  await ctx.close();
}
{
  const id = rows().find(r => r.p === 1).id;
  const { ctx, page } = await open('di', { q: '?view=library&book=' + B + '&note=' + id });
  await page.waitForSelector('#lnSheet .lnCard.full', { timeout: 10000 });
  ok('a notification’s link opens the note with its comment', /let’s practise together/.test(await page.$eval('#lnSheet', e => e.innerText)));
  await page.click('#lnSheet [data-lnedit]'); await page.waitForTimeout(200);
  ok('Edit opens my note', (await page.inputValue('#lnText')) === 'This reminded me to start small with my Khmer study.');
  await page.click('[data-lnvis="private"]'); await page.waitForTimeout(100);
  ok('making it private takes prayer away', await page.$eval('#lnPray', e => e.disabled && !e.checked));
  await page.click('#lnSave'); await page.waitForTimeout(900);
  const r = rows().find(x => x.id === id);
  ok('… saved private: its comments and prayer request go', r.vis === 'private' && !r.prayerId && r.comments.length === 0 && !(mem.prayers || []).some(p => p.lib && p.lib.noteId === id));
  ok('fits a phone: nothing wider than the screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await ctx.close();
}
{
  const { ctx, page } = await open('', { board: 'mary' });
  ok('a board member has none of it', await page.evaluate(() => !lnOn_()));
  await ctx.close();
}
ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
