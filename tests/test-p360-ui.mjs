/* 360 reviews on the page (teams/10-review360.js): starting one with quick picks and a board member;
   reviewers answering (one from a board login, one saying not this time); closing it; the results;
   an action plan from a growth area and the quarter's review; shared read-only with the mentor. Made-up people. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('p360-ui');
const OUT = tmpDir('p360-ui-out');
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



const call = async (fn, args) => {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return (await r.json().catch(() => null)) || {};
};

const p3 = () => (mem.p360 || []);
const go = async (page) => { await page.evaluate(() => { S.view = 'p360'; S.p3Sub = 'home'; S.p3 = null; render(); }); await page.waitForTimeout(900); };

/* ---------- 1. starting one ---------- */
{
  const { ctx, page } = await open('mark');
  ok('My Home has a 360 reviews tile', /360 reviews/.test(await page.$eval('#p3Tile', (e) => e.innerText)));
  await page.click('#p3Tile'); await page.waitForTimeout(900);
  ok('the page says plainly how it stays anonymous', /How it stays anonymous/i.test(await main(page)) && /never who/.test(await main(page)));
  await page.click('#p3New'); await page.waitForTimeout(400);
  ok('starting one: under three picked, it says how many more', /Pick 3 more/.test(await page.$eval('#p3Send', (e) => e.innerText)) && await page.$eval('#p3Send', (e) => e.disabled));
  await page.click('[data-p3pick="clt"]'); await page.waitForTimeout(300);
  ok('a quick pick adds the campus leadership team', (await page.$$('.p3Chip')).length === 3);
  await page.fill('#p3Search', 'mary'); await page.waitForTimeout(400);
  ok('… and the board can be searched for too', /Mary Board/.test(await page.$eval('.p3PeopleList', (e) => e.innerText)));
  await page.click('[data-p3add="bd1"]'); await page.waitForTimeout(300);
  await page.fill('#p3NoteIn', 'I want to grow — please be honest.');
  await page.screenshot({ path: OUT + '/p360-new.png', fullPage: true });
  await page.click('#p3Send'); await page.waitForTimeout(1200);
  ok('sent: four asked, the note with it', p3().length === 1 && p3()[0].reviewers.length === 4 && p3()[0].note === 'I want to grow — please be honest.');
  ok('the review opens: 0 of 4 answered, never who', /0 of 4 answered/.test(await main(page)) && /never see who has answered/.test(await main(page)));
  await page.click('#p3SelfOpen'); await page.waitForTimeout(300);
  for (const k of ['faith', 'vision', 'care', 'comms', 'team', 'reliable', 'humble', 'decide', 'culture']) await page.click(`[data-p3rate="${k}|4"]`);
  await page.fill('#p3t_keep', 'Teaching'); await page.click('#p3SelfSave'); await page.waitForTimeout(900);
  ok('their own answers, about themselves', p3()[0].self && p3()[0].self.ratings.comms === 4 && /Done/.test(await main(page)));
  await ctx.close();
}

/* ---------- 2. answering ---------- */
const answer = async (user, opts, scores, keep, start) => {
  const { ctx, page } = await open(opts && opts.board ? '' : user, opts);
  await go(page);
  const n = (await page.$$('[data-p3answer]')).length;
  await page.click('[data-p3answer]'); await page.waitForTimeout(300);
  Object.entries(scores).forEach(() => {});
  for (const [k, v] of Object.entries(scores)) await page.click(`[data-p3rate="${k}|${v === null ? '' : v}"]`);
  if (keep) await page.fill('#p3t_keep', keep);
  if (start) await page.fill('#p3t_start', start);
  if (user === 'ann') await page.screenshot({ path: OUT + '/p360-answer.png', fullPage: true });
  await page.click('#p3AnsSend'); await page.waitForTimeout(1200);
  const left = (await page.$$('[data-p3answer]')).length;
  await ctx.close();
  return { n, left };
};
let a = await answer('ann', null, { faith: 5, vision: 4, care: 5, comms: 2, team: 4, reliable: 3, humble: 4, decide: 4, culture: 5 }, 'Prays with us', 'Answering emails');
ok('someone asked sees it, answers, and it is gone from their list', a.n === 1 && a.left === 0 && p3()[0].answers.length === 1);
ok('… kept with nothing that says it was them', !JSON.stringify(p3()[0].answers).includes('st2') && p3()[0].done.join() === 'st2');
a = await answer('bo', null, { faith: 4, vision: 3, care: 4, comms: 2, team: 3, reliable: 3, humble: 3, decide: 3, culture: null }, 'Clear vision', 'Delegating');
a = await answer('', { board: 'mary' }, { faith: 5, vision: 4, care: 4, comms: 3, team: 4, reliable: 2, humble: 4, decide: 4, culture: null }, 'Faithful', '');
ok('a board member answers from their own board login', p3()[0].answers.length === 3 && p3()[0].done.includes('bd1'));
{
  const { ctx, page } = await open('cy');
  ok('My Home tells someone asked that one is waiting', /1 waiting for your feedback/.test(await page.$eval('#p3Tile', (e) => e.innerText)));
  await go(page); await page.click('[data-p3decline]'); await page.waitForTimeout(900);
  ok('… and they can say not this time', !(await page.$('[data-p3answer]')) && (p3()[0].declined || []).includes('st4'));
  await ctx.close();
}

/* ---------- 3. the results, the plan, the quarter ---------- */
{
  const { ctx, page } = await open('mark');
  await go(page); await page.click('[data-p3open]'); await page.waitForTimeout(900);
  ok('open: 3 of 4 answered, and no results yet', /3 of 4 answered/.test(await main(page)) && !(await page.$('.p3Row')));
  await page.click('#p3Close'); await page.waitForTimeout(1200);
  let txt = await main(page);
  ok('closed: every area, others against yours', (await page.$$('.p3Row')).length === 9 && (await page.$$('.p3Fill')).length === 8 && (await page.$$('.p3Self')).length === 9);
  ok('… an area too few rated shows a dash', /Across cultures\s*—/.test(txt));
  ok('… strengths and what to grow in', /Strengths/.test(txt) && /To grow in[\s\S]*Communication/.test(txt));
  ok('… where they see themselves differently', /Where you see yourself differently[\s\S]*Communication/i.test(txt));
  ok('… and the comments in their words', /Prays with us/.test(txt) && /Faithful/.test(txt) && /Delegating/.test(txt));
  await page.screenshot({ path: OUT + '/p360-results.png', fullPage: true });
  await page.click('#p3ActAdd'); await page.waitForTimeout(300);
  await page.click('[data-p3area="comms"]'); await page.waitForTimeout(200);
  await page.fill('#p3ActWhat', 'Answer emails within two days'); await page.fill('#p3ActMeasure', 'Inbox under 20 on Fridays');
  await page.selectOption('#p3ActBy', { index: 2 });
  await page.click('#p3ActSave'); await page.waitForTimeout(1000);
  const plan = p3()[0].plan;
  ok('an action from a growth area: what, how I’ll know, by when', plan.actions.length === 1 && plan.actions[0].area === 'comms' && /^\d{4}-Q[1-4]$/.test(plan.actions[0].by));
  ok('… and this quarter’s review is there to fill in', !!(await page.$('#p3RevSave')));
  await page.click('[data-p3st$="|ontrack"]'); await page.fill('[data-p3stnote]', 'Most weeks'); await page.fill('#p3Refl', 'A good start.');
  await page.click('#p3RevSave'); await page.waitForTimeout(1000);
  const rv = Object.values(p3()[0].plan.reviews)[0];
  ok('the quarter’s review is saved', rv && Object.values(rv.items)[0].status === 'ontrack' && rv.reflection === 'A good start.' && /On track — Most weeks/.test(await main(page)));
  await page.screenshot({ path: OUT + '/p360-plan.png', fullPage: true });
  await page.click('#p3ShareOpen'); await page.waitForTimeout(300);
  await page.check('[data-p3share="st2"]'); await page.click('#p3ShareSave'); await page.waitForTimeout(900);
  ok('shared with their mentor', p3()[0].sharedWith.join() === 'st2' && /Ann Lee/.test(await main(page)));
  ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
{
  const { ctx, page } = await open('ann');
  await go(page);
  ok('their mentor finds it under Shared with you', /Shared with you[\s\S]*Mark Hill/.test(await main(page)));
  await page.click('[data-p3open]'); await page.waitForTimeout(900);
  const txt = await main(page);
  ok('… and sees the results and the plan, read-only', /shared with you — read-only/.test(txt) && (await page.$$('.p3Row')).length === 9 && /Answer emails within two days/.test(txt) && !(await page.$('#p3ActAdd')) && !(await page.$('#p3Delete')) && !(await page.$('#p3RevSave')));
  await ctx.close();
}
{
  const sm = await open('di', { small: true });
  await sm.page.evaluate(() => { S.view = 'p360'; S.p3Sub = 'new'; S.p3Draft = null; S.p3 = null; render(); }); await sm.page.waitForTimeout(900);
  await sm.page.evaluate(() => { S.p3Sub = 'new'; render(); }); await sm.page.waitForTimeout(300);
  ok('starting one fits a 320px phone', await sm.page.evaluate(() => document.documentElement.scrollWidth <= 321));
  await sm.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
