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
const ctxK = {}; vm.runInNewContext(fs.readFileSync(REPO + '/public/km.js', 'utf8'), ctxK);
const KM = Object.assign({}, ctxK.PENDING_KM || {}, ctxK.REVIEWED_KM || {});
const all = V.cats.reduce((a, c) => a.concat(c.words.map(w => ({ c, w }))), []);
ok('the script and three levels, forty-odd lists, a thousand-odd words', V.levels.length === 4 && V.levels[0].id === 0 && V.cats.length >= 47 && all.length >= 1200, V.cats.length + ' lists, ' + all.length + ' words');
ok('the script: 33 consonants, the vowels, the independent vowels — letter first', V.cats.filter(c => c.level === 0).every(c => c.script) && V.cats.find(c => c.id === 'consonants').words.length === 33 && V.cats.find(c => c.id === 'vowels').words.length >= 20 && V.cats.find(c => c.id === 'consonants').words[0][1] === 'ក');
ok('every word has English and Khmer script', all.every(x => x.w[0] && /[ក-៿]/.test(x.w[1])));
const tlOk = x => x.w[3] && /^[a-z0-9âêôŏŭəɨɑ' -]+$/i.test(x.w[3].replace(/\s*\/.*$/, '').replace(/[?!.,…]/g, ''));
ok('every Khmer word has a reading in Latin letters, for those who cannot read the script yet', all.filter(x => !x.c.script).every(tlOk), JSON.stringify(all.filter(x => !x.c.script && !tlOk(x)).slice(0, 3).map(x => x.w)));
ok('… I is khnhom, white is poa sor, how many ponman', all.some(x => x.w[1] === 'ខ្ញុំ' && x.w[3] === 'khnhom') && all.some(x => x.w[1] === 'ពណ៌ស' && x.w[3] === 'poa sor') && all.some(x => /^ប៉ុន្មាន/.test(x.w[1]) && /^ponman/.test(x.w[3])));
ok('the ABCs: 26 big letters and 26 small, each said in Khmer, for those learning English', V.cats.filter(c => c.en).length === 2 && V.cats.find(c => c.id === 'abc').words.length === 26 && V.cats.find(c => c.id === 'abc').words[0][0] === 'A' && /[ក-៿]/.test(V.cats.find(c => c.id === 'abc').words[0][1]) && V.cats.find(c => c.id === 'abclower').words.map(w => w[0]).join('') === 'abcdefghijklmnopqrstuvwxyz');
ok('every list has a level, a name and at least four words; no list repeats an English word', V.cats.every(c => [0, 1, 2, 3].includes(c.level) && c.name && c.words.length >= 4 && new Set(c.words.map(w => w[0])).size === c.words.length));
ok('the book\'s order: numbers first after the script, the Faith lists last; Numbers has 1 to 10 and 0', V.cats.find(c => !c.script).id === 'numbers' && V.cats[V.cats.length - 1].id === 'bible' && V.cats.find(c => c.id === 'numbers').words[0][1] === 'មួយ' && V.cats.find(c => c.id === 'numbers').words.some(w => w[0] === '0' && w[1] === 'សូន្យ'));
{ const F = V.cats.filter(c => /^Faith — /.test(c.name)), B = V.cats.find(c => c.id === 'bible');
  ok('Faith (Oct 2026): four lists under Deeper talk — the book\'s Christian words, church life, God & the Bible, the books of the Bible', F.length === 4 && F.every(c => c.level === 3) && F.map(c => c.id).join(',') === 'christian,church,godbible,bible' && F.find(c => c.id === 'christian').words.length === 81, F.map(c => c.id + ':' + c.words.length).join(' '));
  ok('all 66 books in order — 39 Old Testament then 27 New, Genesis first, Revelation last, each Khmer', B.words.length === 66 && B.words.slice(0, 39).every(w => w[2] === 'Old Testament') && B.words.slice(39).every(w => w[2] === 'New Testament') && B.words[0][0] === 'Genesis' && B.words[38][0] === 'Malachi' && B.words[39][0] === 'Matthew' && B.words[65][0] === 'Revelation' && B.words.every(w => /[ក-៿]/.test(w[1]) && w[3]));
  ok('every Faith list name and tip has Khmer', F.every(c => /[ក-៿]/.test(KM[c.name] || '') && (!c.tip || /[ក-៿]/.test(KM[c.tip] || '')))); }

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
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text()) && !/functions\/audio/.test((m.location() || {}).url || '')) errors.push('CONSOLE ' + m.text()); });
  await page.route('**fonts.g**', r => r.abort());
  await page.route('**/api', r => { const b = r.request().postDataJSON() || {}; let out = { ok: true };
    if (b.fn === 'getMyBoot') out = BOOT; else if (b.fn === 'getData') out = BOOT.base; else if (b.fn === 'getMyMinistry') out = BOOT.ministry; else if (b.fn === 'getMySmartGoals') out = { ok: true, smartGoals: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) }); });
  await page.addInitScript(km => { localStorage.setItem('gp-staff', JSON.stringify({ user: 'sreilea', pin: '1234' })); if (km) localStorage.setItem('gp-lang', 'km');
    /* a phone with a Khmer and an English voice, that remembers what it was asked to say */
    window.__spoken = []; Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'km-KH', name: 'Khmer', localService: true }, { lang: 'en-US', name: 'Samantha', localService: true }], cancel() {}, speak(u) { window.__spoken.push([u.text, u.lang]); } } });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: function (t) { this.text = t; } }); }, !!km);
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
  ok('it opens: the book named, 0% known, a daily mix that fills itself, the script and three levels with their lists counted', /KBC vocabulary book/.test(home) && /0 of \d+ words known/.test(home) && /Daily mix/.test(home) && (await page.$$eval('[data-khlevel]', b => b.length)) === 4 && /The script/.test(home) && /Level 1 · Essentials/.test(home) && /Level 3 · Deeper talk/.test(home), home.slice(0, 300));
  ok('… and "I\'m learning Khmer / English", Khmer on', !!(await page.$('[data-khlearn="km"].on')));
  ok('the game: Kiri says hi, 0 day streak, 0 XP as a Seed, the daily goal ring at 0 / 30, the week’s dots, badges all locked', /Hi, I’m Kiri!/.test(home) && /🔥 0/.test(home) && /🌱 0/.test(home) && /Seed/.test(home) && /0 \/ 30 XP today/.test(home) && (await page.$$eval('.khDot', d => d.length)) === 7 && (await page.$$eval('.khBadge', b => b.length)) === 12 && (await page.$$eval('.khBadge.on', b => b.length)) === 0 && /Badges · 0 \/ 12/i.test(home), [/Hi, I’m Kiri!/, /🔥 0/, /🌱 0/, /Seed/, /0 \/ 30 XP today/, /Badges · 0 \/ 12/].map(r => r.test(home)).join() + ' ' + home.slice(0, 400).replace(/\n/g, '|'));
  ok('… sounds on, and the switch turns them off and remembers', (await page.$eval('#khSound', e => e.textContent)) === '🔈' && (await page.click('#khSound'), await page.waitForTimeout(200), (await page.$eval('#khSound', e => e.textContent)) === '🔇' && await page.evaluate(() => JSON.parse(localStorage.getItem('gp-kh-game')).sound === false)));
  await page.click('#khSound'); await page.waitForTimeout(200);
  /* the script: letter first, the sound the answer */
  await page.click('[data-khlevel="0"]'); await page.waitForTimeout(300);
  await page.click('[data-khcat="consonants"]'); await page.waitForTimeout(300);
  await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300);
  ok('Consonants: the letter up first, 1 / 33, and 🔊', !!(await page.$('#khFlip .khKm')) && /1 \/ 33/.test(await main(page)) && !!(await page.$('.khSay.big')));
  await page.click('.khSay.big'); await page.waitForTimeout(100);
  const said = await page.evaluate(() => window.__spoken);
  ok('🔊 says the letter with the Khmer voice', said.length === 1 && /^[\u1780-\u17FF]$/.test(said[0][0]) && said[0][1] === 'km-KH', JSON.stringify(said));
  await page.click('#khBack'); await page.waitForTimeout(200); await page.click('#khBack'); await page.waitForTimeout(200); await page.click('#khBack'); await page.waitForTimeout(300);
  await page.click('[data-khlevel="1"]'); await page.waitForTimeout(300);
  const lvl = await main(page);
  ok('Level 1: its lists, each with its word count — Numbers, Time, Important verbs …', /Numbers/.test(lvl) && /Important verbs/.test(lvl) && /\d+ words/.test(lvl) && (await page.$$eval('[data-khcat]', b => b.length)) === V.cats.filter(c => c.level === 1).length);
  await page.click('[data-khcat="colors"]'); await page.waitForTimeout(300);
  const cat = await main(page);
  ok('… the Khmer words carry their reading in Latin letters, and "Hide readings" takes them away', (await page.$$eval('.khRow .khTl', r => r.length)) === 11 && /poa sor/.test(cat) && (await page.$eval('#khTl', e => e.textContent)) === 'Hide readings');
  await page.click('#khTl'); await page.waitForTimeout(250);
  ok('… hidden: no readings, "Show readings", remembered on the phone', (await page.$$eval('.khRow .khTl', r => r.length)) === 0 && (await page.$eval('#khTl', e => e.textContent)) === 'Show readings' && await page.evaluate(() => localStorage.getItem('gp-kh-notl') === '1'));
  await page.click('#khTl'); await page.waitForTimeout(250);
  ok('a list: Flashcards, Quiz, Match, and all its words in both languages, each with 🔊', /Flashcards/.test(cat) && /Quiz/.test(cat) && /Match/.test(cat) && /White/.test(cat) && /ពណ៌ស/.test(cat) && (await page.$$eval('.khRow', r => r.length)) === 11 && (await page.$$eval('.khRow .khSay', b => b.length)) === 11);
  await page.click('.khRow .khSay'); await page.waitForTimeout(100);
  ok('… 🔊 on a row says the Khmer', (await page.evaluate(() => window.__spoken.slice(-1)[0])).join() === 'ពណ៌ស,km-KH');
  /* flashcards */
  await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300);
  ok('Flashcards: English up, 1 / 11, the answers hidden until you flip', /1 \/ 11/.test(await main(page)) && !!(await page.$('#khFlip .khEn')) && !!(await page.$('.khAnswer.hide')));
  await page.click('#khFlip'); await page.waitForTimeout(300);
  ok('… tap: the Khmer with its reading, and Got it / Still learning', !!(await page.$('#khFlip.flipped .khKm')) && !!(await page.$('#khFlip.flipped .khTl')) && !(await page.$('.khAnswer.hide')));
  const first = await page.$eval('#khFlip .khKm', e => e.textContent);
  await page.click('#khYes'); await page.waitForTimeout(60);
  ok('Got it: confetti from the card', !!(await page.$('.confettiWrap')));
  ok('… +5 XP pops out of it and is kept for today', !!(await page.$('.khXpPop')) && /\+5 XP/.test(await page.$eval('.khXpPop', e => e.textContent)) && await page.evaluate(() => { const G = JSON.parse(localStorage.getItem('gp-kh-game')); return G.xp === 5 && Object.values(G.days)[0] === 5; }));
  ok('… and Kiri bounces', !!(await page.$('.khKiri.happy')));
  await page.waitForTimeout(300);
  ok('… moves on and is remembered on this phone', /2 \/ 11/.test(await main(page)) && await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('gp-kh-progress'))).some(p => p.b === 1)));
  for (let i = 0; i < 2; i++) { await page.click('#khFlip'); await page.waitForTimeout(80); await page.click('#khYes'); await page.waitForTimeout(150); }
  ok('three right in a row: 🔥 3 in a row', /🔥 3 in a row/.test(await main(page)), (await main(page)).slice(0, 80));
  for (let i = 0; i < 2; i++) { await page.click('#khFlip'); await page.waitForTimeout(80); await page.click('#khYes'); await page.waitForTimeout(150); }
  ok('five in a row: ×2 — double XP from here', /×2/.test(await main(page)) && /\+10 XP/.test(await page.$$eval('.khXpPop', p => p[p.length - 1].textContent)));
  await page.click('#khFlip'); await page.waitForTimeout(80); await page.click('#khNo'); await page.waitForTimeout(150);
  ok('a miss: Kiri wobbles, the combo is gone', !!(await page.$('.khKiri.sad')) && !/×2/.test(await main(page)));
  for (let i = 0; i < 5; i++) { await page.click('#khFlip'); await page.waitForTimeout(80); await page.click(i % 2 ? '#khNo' : '#khYes'); await page.waitForTimeout(120); }
  const sum = await main(page);
  ok('at the end: a trophy, the XP earned counting up with its bonus, the goal ring', !!(await page.$('.khTrophy')) && /\+\d+ XP/.test(sum) && /set finished/.test(sum) && !!(await page.$('.khSummary .khRing')) && (await page.waitForTimeout(800), /\+5[05] XP/.test(await main(page))), (await main(page)).slice(0, 200));
  ok('… the daily goal reached, said so, and First steps earned', /Daily goal reached/.test(await main(page)) && await page.evaluate(() => { const G = JSON.parse(localStorage.getItem('gp-kh-game')); return Object.values(G.days)[0] >= 30 && !!G.badges.first; }));
  if (false) {
  }
  ok('at the end: a cheer, a score, the best streak, Again and Done', /Nice one|Great work|Keep going|Perfect/.test(sum) && /\d+%/.test(sum) && /right, \d+ still learning/.test(sum) && /🔥 \d+ in a row/.test(sum) && !!(await page.$('#khAgain')) && !!(await page.$('#khDone')), sum.slice(0, 160));
  ok('… and a shower of confetti whatever the score', !!(await page.$('.confettiWrap')));
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
  ok('Match: twelve tiles, six pairs, a clock; the Khmer tiles with their reading', (await page.$$eval('[data-khtile]', b => b.length)) === 12 && /6 pairs left/.test(await main(page)) && !!(await page.$('#khClock')) && (await page.$$eval('.khTile .khTl', r => r.length)) === 6);
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
  ok('all six: Done! 🧩, the time, kept as your best', /Done! 🧩/.test(await main(page)) && /seconds/.test(await main(page)) && await page.evaluate(() => JSON.parse(localStorage.getItem('gp-kh-best') || '{}').colors > 0));
  await page.click('#khDone'); await page.waitForTimeout(300);
  await page.click('#khBack'); await page.waitForTimeout(200); await page.click('#khBack'); await page.waitForTimeout(300);
  await page.click('[data-khlevel="2"]'); await page.waitForTimeout(300);
  await page.click('[data-khcat="shapes"]'); await page.waitForTimeout(300);
  for (let round = 0; round < 2; round++) { await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300); for (let i = 0; i < 6; i++) { await page.click('#khFlip'); await page.waitForTimeout(60); await page.click('#khYes'); await page.waitForTimeout(120); } await page.waitForTimeout(300); if (round === 0) { await page.click('#khDone'); await page.waitForTimeout(300); } }
  const perfect = await main(page);
  ok('Shapes twice through without a miss: Perfect!, 🏆 the whole list known', /Perfect! 🎉/.test(perfect) && /You know this whole list/.test(perfect) && /🔥 6 in a row/.test(perfect), perfect.slice(0, 160));
  await page.click('#khDone'); await page.waitForTimeout(300);
  ok('… the list says every word is known, with three crowns', /6 words · 6 known/.test(await main(page)) && (await page.$$eval('.khRow.known', r => r.length)) === 6 && (await page.$$eval('h2 .khCrowns span.on', c => c.length)) === 3);
  ok('… List master earned, and the list-mastered bonus', await page.evaluate(() => !!JSON.parse(localStorage.getItem('gp-kh-game')).badges.list));
  await page.click('#khBack'); await page.waitForTimeout(200); await page.click('#khBack'); await page.waitForTimeout(400);
  const home2 = await main(page);
  ok('back home: what you know counted, and a daily mix to practise', /[1-9]\d* of \d+ words known/.test(home2) && !!(await page.$('#khDaily')), home2.slice(0, 200));
  ok('… the day streak is 1 with today’s dot ticked, a rank bar towards Sprout, crowns counted on the level, badges earned in colour', /🔥 1/.test(home2) && !!(await page.$('.khDot.today.hit')) && /XP to (Sprout|Leaf|Tree)/.test(home2) && /♛ [1-9]/.test(home2) && (await page.$$eval('.khBadge.on', b => b.length)) >= 2 && /Goal done for today/.test(home2), home2.slice(0, 400));
  ok('… and a Lightning round once you know some words', !!(await page.$('#khLightning')));
  /* Lightning: 60 seconds (shortened here) of quiz over the words you know, round and round */
  await page.evaluate(() => { S.khLightMs = 2500; }); await page.click('#khLightning'); await page.waitForTimeout(300);
  ok('Lightning: a question, the clock counting down, 0 right', !!(await page.$('.khAsk')) && !!(await page.$('#khLightLeft')) && /⚡ 0 right/.test(await main(page)));
  for (let i = 0; i < 3; i++) { const ri = await page.evaluate(() => S.kh.q.options.indexOf(S.kh.q.w)); await page.click('[data-khopt="' + ri + '"]'); await page.waitForTimeout(450); }
  ok('… three right, straight on to the next', /⚡ 3 right/.test(await main(page)), (await main(page)).slice(0, 60));
  await page.waitForTimeout(2200);
  ok('… Time! with the score and its XP', /Time! ⚡/.test(await main(page)) && /3 right/.test(await main(page)) && !!(await page.$('#khXpUp')));
  await page.click('#khDone'); await page.waitForTimeout(300);
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
  /* learning English: the cards ask in Khmer and answer in English, read aloud in English */
  await page.click('[data-khlearn="en"]'); await page.waitForTimeout(300);
  ok('"I\'m learning English": the page becomes Learn English, kept on the phone', /រៀនភាសាអង់គ្លេស/.test(await main(page)) && await page.evaluate(() => localStorage.getItem('gp-kh-front') === 'km'));
  await page.click('[data-khlevel="1"]'); await page.waitForTimeout(300); await page.click('[data-khcat="colors"]'); await page.waitForTimeout(300); await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300);
  ok('… a card shows the Khmer first and flips to English', !!(await page.$('#khFlip .khKm')));
  await page.click('#khFlip'); await page.waitForTimeout(200);
  ok('… the English side, read aloud with the English voice', !!(await page.$('#khFlip .khEn')) && (await page.$eval('.khSay.big', e => e.dataset.khsay)).indexOf('en|') === 0);
  await page.click('.khSay.big'); await page.waitForTimeout(100);
  ok('… 🔊 says the English', (await page.evaluate(() => window.__spoken.slice(-1)[0]))[1] === 'en-US');
  await ctx.close();
}
{
  /* recorded audio: the site's own MP3 of a word plays first; where there is none, the phone's voice */
  const { ctx, page } = await open();
  const asked = [];
  await page.route('**/.netlify/functions/audio**', r => { const u = new URL(r.request().url()); asked.push(u.searchParams.get('lang') + '|' + u.searchParams.get('say'));
    if (u.searchParams.get('say') === 'ពណ៌ស') r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(400) }); else r.fulfill({ status: 404, body: 'Not found' }); });
  await page.evaluate(() => { S.khAudio.test = true; khOpen_(); }); await page.waitForTimeout(1000);
  await page.click('[data-khlevel="1"]'); await page.waitForTimeout(300); await page.click('[data-khcat="colors"]'); await page.waitForTimeout(300);
  await page.click('.khRow .khSay'); await page.waitForTimeout(400);
  ok('🔊 asks the site for the word\'s recording and plays it, not the phone\'s voice', asked[0] === 'km|ពណ៌ស' && await page.evaluate(() => S.khLastAudio && S.khLastAudio.indexOf('say=') > 0 && window.__spoken.length === 0), asked.join());
  await page.$$eval('.khRow .khSay', b => b[1].click()); await page.waitForTimeout(400);
  ok('… a word with no recording falls back to the phone\'s Khmer voice', asked.length === 2 && (await page.evaluate(() => window.__spoken.length === 1 && window.__spoken[0][1] === 'km-KH')));
  await page.$$eval('.khRow .khSay', b => b[1].click()); await page.waitForTimeout(300);
  ok('… and is not asked for again', asked.length === 2 && (await page.evaluate(() => window.__spoken.length === 2)));
  await ctx.close();
}
{
  /* learning English: the ABCs in the place of the Khmer script */
  const { ctx, page } = await open();
  await page.evaluate(() => khOpen_()); await page.waitForTimeout(1000);
  ok('learning Khmer: the script lists, no ABCs', (await page.$$eval('[data-khlevel="0"]', b => b.map(x => x.innerText).join())).indexOf('The script') > -1 && !/ABC/.test(await main(page)));
  await page.click('[data-khlearn="en"]'); await page.waitForTimeout(300);
  ok('learning English: level 0 is The ABCs', (await page.$$eval('[data-khlevel="0"]', b => b.map(x => x.innerText).join())).indexOf('The ABCs') > -1);
  await page.click('[data-khlevel="0"]'); await page.waitForTimeout(300);
  const abc = await main(page);
  ok('… The ABCs and Small letters, and not the Khmer consonants', /The ABCs/.test(abc) && /Small letters/.test(abc) && !/Consonants/.test(abc) && (await page.$$eval('[data-khcat]', b => b.length)) === 2);
  await page.click('[data-khcat="abc"]'); await page.waitForTimeout(300);
  ok('… 26 letters, each with its Khmer saying and 🔊 in English', (await page.$$eval('.khRow', r => r.length)) === 26 && (await page.$eval('.khRow .khSay', e => e.dataset.khsay)) === 'en|A');
  await page.click('[data-khmode="cards"]'); await page.waitForTimeout(300);
  ok('… a card shows a letter first, 1 / 26', !!(await page.$('#khFlip .khEn')) && /1 \/ 26/.test(await main(page)) && /^[A-Z]$/.test(await page.$eval('#khFlip .khEn', e => e.textContent)));
  await page.click('.khSay.big'); await page.waitForTimeout(100);
  ok('… 🔊 says the letter in English', /^[A-Z],en-US$/.test((await page.evaluate(() => window.__spoken.slice(-1)[0])).join()));
  await ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
