/* Talk it through → tasks, in the browser (Nov 2026): the microphone on GP Tasks, listening, the words sent once, the tasks to check, Add saving only what is ticked, the Calendar, a phone that cannot listen, Khmer, 320px. Real api.js, a stand-in for Claude. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('voice-tasks-ui');
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
import { fakeAnthropic } from './voice-fixtures.mjs';
const C = fakeAnthropic(TMP);
process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
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
const srv = http.createServer(async (req, res) => {
  if (req.url.indexOf('/.netlify/functions/api') === 0) {
    let b = ''; for await (const c of req) b += c;
    const r = await api.default({ method: 'POST', json: async () => JSON.parse(b || '{}'), headers: new Map() }, {});
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
function ok(name, cond, extra) { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); } }
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
  await page.addInitScript(a => {
    localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' }));
    if (a.km) localStorage.setItem('gp-lang', 'km');
    if (a.rec) {   // a phone that can listen: a stand-in SpeechRecognition the test speaks through
      window.SpeechRecognition = function () { var me = this; window.__rec = me; me.start = function () { me.started = true; }; me.stop = function () { me.started = false; if (me.onend) me.onend(); }; };
      window.__say = function (finals, live) { var res = finals.map(function (s) { var r = [{ transcript: s }]; r.isFinal = true; return r; }); if (live) { var r = [{ transcript: live }]; r.isFinal = false; res.push(r); } window.__rec.onresult({ results: res }); };
    } else { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }
  }, { u: user, km: !!opts.km, rec: opts.rec !== false });
  await page.goto(BASE + (opts.path || '/teams.html?view=tasks'), { waitUntil: 'load' });
  await page.waitForSelector('nav.bottom button', { timeout: 15000 });
  await page.waitForSelector('#gtAdd', { timeout: 6000 })
  await page.waitForTimeout(500);
  return { ctx, page };
}
const T = () => (mem.gpTasks || { tasks: [] }).tasks;
const txt = (p, s) => p.$eval(s, e => e.innerText).catch(() => '');
const SHOTS = process.env.SHOTS || '';

C.reply = function (req) {
  const u = req.messages[0].content;
  const L = (u.match(/(L\d+): Cafe/) || [])[1], P = (u.match(/(P\d+): Kanha Cafe/) || [])[1];
  return { note: '', tasks: [
    { title: 'Call the plumber', notes: 'About the kitchen sink', due: day(1), time: '', list: '', people: [], steps: [] },
    { title: 'Meet about the outreach', notes: '', due: day(3), time: '14:00', list: L, people: [P], steps: ['Book the room', 'Print the schedule'] },
    { title: 'Buy flowers', notes: '', due: '', time: '', list: '', people: [], steps: [] }
  ] };
};

/* ---------- a phone that can listen ---------- */
{
  const { ctx, page } = await open('cora');
  ok('GP Tasks has a microphone above the ＋', !!(await page.$('#gvOpen')) && !!(await page.$('#gtAdd')));
  const fab = await page.$eval('#gvOpen', e => e.getBoundingClientRect().bottom), plus = await page.$eval('#gtAdd', e => e.getBoundingClientRect().top);
  ok('… and they don\'t overlap', fab <= plus, fab + ' vs ' + plus);
  await page.click('#gvOpen'); await page.waitForTimeout(200);
  ok('it opens "Talk it through" with a box and Tap to talk', !!(await page.$('#gvSheet')) && !!(await page.$('#gvText')) && /Tap to talk/.test(await txt(page, '#gvMic')));
  ok('and says where the words go', /sent to Claude \(Anthropic\)/.test(await txt(page, '#gvSheet')));
  await page.click('#gvGo'); await page.waitForTimeout(150);
  ok('nothing said → it says so, and Claude isn\'t asked', /Say or type something first/.test(await txt(page, '#gvErr')) && C.calls.length === 0);
  await page.click('#gvMic'); await page.waitForTimeout(150);
  ok('tapping the microphone starts listening', /Listening/.test(await txt(page, '#gvMic')) && await page.evaluate(() => window.__rec.started === true && window.__rec.continuous === true && window.__rec.lang === 'en-US'));
  await page.evaluate(() => window.__say(['tomorrow I need to call the plumber'], 'and ask kanha'));
  ok('what is heard lands in the box as it comes', (await page.$eval('#gvText', e => e.value)) === 'tomorrow I need to call the plumber and ask kanha');
  await page.evaluate(() => window.__say(['tomorrow I need to call the plumber', 'and ask Kanha to meet about the outreach Friday at two'], ''));
  await page.click('#gvMic'); await page.waitForTimeout(150);
  ok('tapping again stops, and the words stay', /Tap to talk/.test(await txt(page, '#gvMic')) && /Friday at two$/.test(await page.$eval('#gvText', e => e.value)));
  await page.fill('#gvText', (await page.$eval('#gvText', e => e.value)) + ' also buy flowers');
  await page.click('#gvGo'); await page.waitForSelector('#gvItems', { timeout: 8000 });
  ok('Make my tasks sends the words once', C.calls.length === 1 && /also buy flowers\n<\/spoken>/.test(C.calls[0].messages[0].content));
  const rows = await page.$$('[data-gvitem]');
  ok('three tasks to check, all ticked', rows.length === 3 && (await page.$$('.gvTick.on')).length === 3 && /Add 3 tasks/.test(await txt(page, '#gvAdd')));
  ok('each with its day and time', (await page.$eval('[data-gvf="0|due"]', e => e.value)) === day(1) && (await page.$eval('[data-gvf="1|due"]', e => e.value)) === day(3) && (await page.$eval('[data-gvf="1|time"]', e => e.value)) === '14:00');
  ok('a task with no day has its time box off', await page.$eval('[data-gvf="2|time"]', e => e.disabled));
  ok('the second is in the Cafe\'s list, for Kanha, with its steps', /Cafe/.test(await page.$eval('[data-gvf="1|listId"]', e => e.selectedOptions[0].textContent)) && /Kanha/.test(await txt(page, '[data-gvitem="1"] .gvWho')) && /Book the room/.test(await txt(page, '[data-gvitem="1"] .gvSteps')));
  ok('nothing is saved yet', T().length === 0);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('the sheet fits the phone', wide <= 1, String(wide));
  if (SHOTS) await page.screenshot({ path: SHOTS + '/voice-preview.png' });
  await page.click('[data-gvon="2"]'); await page.waitForTimeout(120);
  ok('unticking one leaves two to add', /Add 2 tasks/.test(await txt(page, '#gvAdd')) && (await page.$$('.gvItem.off')).length === 1);
  await page.fill('[data-gvf="0|title"]', 'Call the plumber about the sink');
  await page.fill('[data-gvf="0|due"]', day(2));
  await page.click('#gvAdd'); await page.waitForFunction(() => !document.getElementById('gvSheet'), null, { timeout: 8000 });
  const a = T().find(t => t.title === 'Call the plumber about the sink'), b = T().find(t => t.title === 'Meet about the outreach');
  ok('Add saves the two, as changed', T().length === 2 && a && a.due === day(2) && a.notes === 'About the kitchen sink', JSON.stringify(T().map(t => t.title)));
  ok('the meeting has its day, time, Kanha and two steps, in the Cafe\'s list', b && b.due === day(3) && b.time === '14:00' && b.assignees.join() === 'c2' && b.subs.length === 2 && mem.gpTasks.lists.find(l => l.id === b.listId).ministry === 'Cafe');
  ok('the plumber is in her Inbox', mem.gpTasks.lists.find(l => l.id === a.listId).scope === 'personal');
  ok('and the unticked one was not saved', !T().some(t => t.title === 'Buy flowers'));
  await page.waitForTimeout(300);
  ok('the page shows the new task', /Call the plumber about the sink/.test(await txt(page, '#main')));
  await ctx.close();
}
/* ---------- they are on the calendar ---------- */
{
  const { ctx, page } = await open('cora');
  await page.click('[data-cttab="calendar"]'); await page.waitForTimeout(900);
  ok('a task with a day shows on the Calendar', /Call the plumber about the sink|Meet about the outreach/.test(await txt(page, '#main')));
  await ctx.close();
}
/* ---------- a phone that can't listen; when Claude can't answer; Khmer; 320px ---------- */
{
  const { ctx, page } = await open('cora', { rec: false, small: true, km: true });
  await page.click('#gvOpen'); await page.waitForTimeout(200);
  ok('without speech in the browser: no Tap to talk, a hint to use the keyboard\'s microphone', !(await page.$('#gvMic')) && !!(await page.$('#gvKeyHint')));
  const s = await txt(page, '#gvSheet');
  ok('in Khmer the sheet is in Khmer', /[ក-៿]/.test(s) && !/Talk it through|Make my tasks|Cancel|microphone/.test(s), s.slice(0, 200));
  C.reply = 'rate';
  await page.fill('#gvText', 'ទូរស័ព្ទទៅជាងទឹកថ្ងៃស្អែក'); await page.click('#gvGo'); await page.waitForSelector('#gvErr', { timeout: 8000 });
  ok('Claude busy → it says so and keeps the words', (await page.$eval('#gvText', e => e.value)) === 'ទូរស័ព្ទទៅជាងទឹកថ្ងៃស្អែក' && !!(await page.$('#gvGo:not([disabled])')));
  ok('the app\'s language went with the request', /set to Khmer/.test(C.calls[C.calls.length - 1].system));
  C.reply = { tasks: [], note: 'ខ្ញុំមិនបានឮអ្វីដែលត្រូវធ្វើទេ។' };
  await page.click('#gvGo'); await page.waitForSelector('#gvNote', { timeout: 8000 });
  ok('nothing to do → the note, and no Add to tap', /ខ្ញុំមិនបានឮ/.test(await txt(page, '#gvNote')) && await page.$eval('#gvAdd', e => e.disabled));
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('fits 320px', wide <= 1, String(wide));
  await page.click('#gvBack'); await page.waitForTimeout(150);
  ok('Say more goes back to the box with the words', (await page.$eval('#gvText', e => e.value)).length > 5);
  await page.click('#gvClose'); await page.waitForTimeout(150);
  ok('Cancel closes it', !(await page.$('#gvSheet')));
  await ctx.close();
}
/* ---------- the tasks app has it too; off without the key ---------- */
{
  const { ctx, page } = await open('cora', { path: '/tasks.html' });
  ok('GP Tasks, the app of its own, has the microphone', !!(await page.$('#gvOpen')));
  await ctx.close();
  delete process.env.ANTHROPIC_API_KEY;
  const o = await open('cora');
  ok('with no key on the site there is no microphone at all', !(await o.page.$('#gvOpen')) && !!(await o.page.$('#gtAdd')));
  await o.ctx.close();
}
ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
