/* Learn Khmer (Oct 2026, Andrew: "incorporate the KBC vocab book — fun and easy, like Quizlet, by
   categories and difficulties"): ☰ → Learn Khmer; three levels with their lists; a list's flashcards,
   quiz and match; what you know kept on the phone and the daily mix made from it; the words themselves. */
import { PUBLIC, CHROMIUM, REPO } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const f = path.join(PUBLIC, u);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(0, r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };

/* the words themselves */
console.log('=== the book ===');
const ctx0 = {}; vm.runInNewContext(fs.readFileSync(REPO + '/public/khmer-vocab.js', 'utf8'), ctx0);
const V = ctx0.GP_KHMER_VOCAB;
const all = V.cats.reduce((a, c) => a.concat(c.words.map(w => ({ c, w }))), []);
ok('three levels, forty-odd lists, a thousand-odd words', V.levels.length === 3 && V.cats.length >= 40 && all.length >= 1000, V.cats.length + ' lists, ' + all.length + ' words');
ok('every word has English and Khmer script', all.every(x => x.w[0] && /[ក-៿]/.test(x.w[1])));
ok('every list has a level, a name and at least four words; no list repeats an English word', V.cats.every(c => [1, 2, 3].includes(c.level) && c.name && c.words.length >= 4 && new Set(c.words.map(w => w[0])).size === c.words.length));
ok('the book\'s order: numbers first, Christian words last; Numbers has 1 to 10 and 0', V.cats[0].id === 'numbers' && V.cats[V.cats.length - 1].id === 'christian' && V.cats[0].words[0][1] === 'មួយ' && V.cats[0].words.some(w => w[0] === '0' && w[1] === 'សូន្យ'));

const ME = { id: 'st1', name: 'Sreilea Chan', username: 'sreilea', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', photo: '', mentorId: '', staffType: 'ministry', country: 'Cambodia' };
const BOOT = { ok: true, staff: ME, profile: { phone: '', joined: '', debt: false, mentorStatus: '' }, roster: [ME], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
  trips: { ok: true, trips: [], totals: {}, reasons: { work: ['Trip'], personal: ['Family'] }, hasMentor: false }, tripRequests: [], ministry: { ok: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', entries: [], daily: {}, prev: {}, pins: [] },
  base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [], roster: [ME] }, smartGoals: [], oneOnOnes: [], broadcasts: [] };
const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(km) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.route('**/api', r => { const b = r.request().postDataJSON() || {}; let out = { ok: true };
    if (b.fn === 'getMyBoot') out = BOOT; else if (b.fn === 'getData') out = BOOT.base; else if (b.fn === 'getMyMinistry') out = BOOT.ministry; else if (b.fn === 'getMySmartGoals') out = { ok: true, smartGoals: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) }); });
  await page.addInitScript(km => { localStorage.setItem('gp-staff', JSON.stringify({ user: 'sreilea', pin: '1234' })); if (km) localStorage.setItem('gp-lang', 'km'); }, !!km);
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const main = p => p.$eval('#main', e => e.innerText);

console.log('=== the page ===');
{
  const { ctx, page } = await open();
  await page.click('#menuBtn'); await page.waitForTimeout(250);
  ok('☰ has Learn Khmer under Language', !!(await page.$('[data-menu-item="khmer"]')));
  await page.click('[data-menu-item="khmer"]'); await page.waitForTimeout(1200);
  const home = await main(page);
  ok('it opens: the book named, 0% known, a daily mix that fills itself, three levels with their lists counted', /KBC vocabulary book/.test(home) && /0 of \d+ words known/.test(home) && /Daily mix/.test(home) && (await page.$$eval('[data-khlevel]', b => b.length)) === 3 && /Level 1 · Essentials/.test(home) && /Level 3 · Deeper talk/.test(home), home.slice(0, 300));
  await page.click('[data-khlevel="1"]'); await page.waitForTimeout(300);
  const lvl = await main(page);
  ok('Level 1: its lists, each with its word count — Numbers, Time, Important verbs …', /Numbers/.test(lvl) && /Important verbs/.test(lvl) && /\d+ words/.test(lvl) && (await page.$$eval('[data-khcat]', b => b.length)) === V.cats.filter(c => c.level === 1).length);
  await page.click('[data-khcat="colors"]'); await page.waitForTimeout(300);
  const cat = await main(page);
  ok('a list: Flashcards, Quiz, Match, and all its words in both languages', /Flashcards/.test(cat) && /Quiz/.test(cat) && /Match/.test(cat) && /White/.test(cat) && /ពណ៌ស/.test(cat) && (await page.$$eval('.khRow', r => r.length)) === 11);
  /* flashcards */
  await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300);
  ok('Flashcards: English up, 1 / 11, the answers hidden until you flip', /1 \/ 11/.test(await main(page)) && !!(await page.$('#khFlip .khEn')) && !!(await page.$('.khAnswer.hide')));
  await page.click('#khFlip'); await page.waitForTimeout(300);
  ok('… tap: the Khmer, and Got it / Still learning', !!(await page.$('#khFlip.flipped .khKm')) && !(await page.$('.khAnswer.hide')));
  const first = await page.$eval('#khFlip .khKm', e => e.textContent);
  await page.click('#khYes'); await page.waitForTimeout(300);
  ok('Got it moves on and is remembered on this phone', /2 \/ 11/.test(await main(page)) && await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('gp-kh-progress'))).some(p => p.b === 1)));
  for (let i = 0; i < 10; i++) { await page.click('#khFlip'); await page.waitForTimeout(80); await page.click(i % 2 ? '#khNo' : '#khYes'); await page.waitForTimeout(120); }
  const sum = await main(page);
  ok('at the end: a score, Again and Done', /\d+%/.test(sum) && /right, \d+ still learning/.test(sum) && !!(await page.$('#khAgain')) && !!(await page.$('#khDone')), sum.slice(0, 120));
  await page.click('#khDone'); await page.waitForTimeout(300);
  /* quiz */
  await page.click('[data-khmode="quiz"]'); await page.waitForTimeout(300);
  ok('Quiz: a word and four choices', !!(await page.$('.khAsk')) && (await page.$$eval('[data-khopt]', b => b.length)) === 4);
  const rightIdx = await page.evaluate(() => S.kh.q.options.indexOf(S.kh.q.w));
  await page.click('[data-khopt="' + rightIdx + '"]'); await page.waitForTimeout(150);
  ok('… the right one goes green', !!(await page.$('.khOpt.right')));
  await page.waitForTimeout(700);
  const wrongIdx = await page.evaluate(() => S.kh.q.options.findIndex(w => w !== S.kh.q.w));
  await page.click('[data-khopt="' + wrongIdx + '"]'); await page.waitForTimeout(150);
  ok('… a wrong one goes red and the right one green', !!(await page.$('.khOpt.wrong')) && !!(await page.$('.khOpt.right')));
  await page.waitForTimeout(1300);
  ok('… and the quiz moves on', /3 \/ 11/.test(await main(page)));
  await page.click('#khBack'); await page.waitForTimeout(300);
  /* match */
  await page.click('[data-khmode="match"]'); await page.waitForTimeout(300);
  ok('Match: twelve tiles, six pairs, a clock', (await page.$$eval('[data-khtile]', b => b.length)) === 12 && /6 pairs left/.test(await main(page)) && !!(await page.$('#khClock')));
  const tiles = await page.evaluate(() => S.kh.tiles.map(t => t.id + t.side));
  const a = tiles.indexOf('0en'), b = tiles.indexOf('0km'), c = tiles.findIndex(t => t[0] === '1');
  await page.click('[data-khtile="' + a + '"]'); await page.waitForTimeout(100);
  await page.click('[data-khtile="' + c + '"]'); await page.waitForTimeout(150);
  ok('a wrong pair shakes and stays', !!(await page.$('.khTile.shake')) && /6 pairs left/.test(await main(page)));
  await page.click('[data-khtile="' + a + '"]'); await page.waitForTimeout(100);
  await page.click('[data-khtile="' + b + '"]'); await page.waitForTimeout(300);
  ok('a right pair goes', /5 pairs left/.test(await main(page)) && (await page.$$eval('.khTile.gone', b => b.length)) === 2);
  for (let id = 1; id < 6; id++) { await page.click('[data-khtile="' + tiles.indexOf(id + 'en') + '"]'); await page.waitForTimeout(60); await page.click('[data-khtile="' + tiles.indexOf(id + 'km') + '"]'); await page.waitForTimeout(120); }
  await page.waitForTimeout(400);
  ok('all six: the time, kept as your best', /seconds/.test(await main(page)) && await page.evaluate(() => JSON.parse(localStorage.getItem('gp-kh-best') || '{}').colors > 0));
  await page.click('#khDone'); await page.waitForTimeout(300);
  await page.click('#khBack'); await page.waitForTimeout(200); await page.click('#khBack'); await page.waitForTimeout(400);
  const home2 = await main(page);
  ok('back home: what you know counted, and a daily mix to practise', /[1-9]\d* of \d+ words known/.test(home2) && !!(await page.$('#khDaily')), home2.slice(0, 200));
  await page.click('#khDaily'); await page.waitForTimeout(300);
  ok('the daily mix is flashcards of the words due', !!(await page.$('#khFlip')) && /1 \/ \d+/.test(await main(page)));
  await page.screenshot({ path: process.env.SHOT_KH || '/dev/null' }).catch(() => {});
  ok('fits a phone', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
{
  const { ctx, page } = await open(true);
  await page.evaluate(() => khOpen_()); await page.waitForTimeout(1200);
  ok('in Khmer: the page is in Khmer too', /រៀនភាសាខ្មែរ/.test(await main(page)) && /កម្រិត 1/.test(await main(page)));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
