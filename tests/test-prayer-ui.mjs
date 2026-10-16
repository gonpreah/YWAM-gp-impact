/* Prayer requests (Oct 2026): shared with your campus, all of YWAM GP, or only your
   mentor — and seen by exactly those; "I prayed" is a count, never names; only the
   person who asked marks it answered; the asker or an admin deletes.
   Real api.js, fake store. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('pr-ui');
const OUT = tmpDir('pr-ui-out');
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
  mk({ id: 'st1', name: 'Uriah Lyford', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'st2', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com', mentorId: 'st3', mentorStatus: 'approved' }),
  mk({ id: 'st3', name: 'Dara Sok', username: 'dara', email: 'd@e.com' }),
  mk({ id: 'st4', name: 'Pich Poipet', username: 'pich', email: 'p@e.com', campus: 'poipet' })
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
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
  await page.addInitScript(a => { if (a.u) localStorage.setItem('gp-staff', JSON.stringify({ user: a.u, pin: '1234' })); if (a.km) localStorage.setItem('gp-lang', 'km'); }, { u: user, km: !!opts.km });
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);



const call = async (fn, args) => {
  const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return (await r.json().catch(() => null)) || {};
};
const texts = async (u) => ((await call('getPrayers', [u, '1234'])).prayers || []).map((p) => p.text);

/* ---------- 1. who sees what ---------- */
{
  await call('savePrayer', ['kanha', '1234', { text: 'For my visa renewal', scope: 'campus' }]);
  await call('savePrayer', ['kanha', '1234', { text: 'For the DTS outreach', scope: 'all' }]);
  await call('savePrayer', ['kanha', '1234', { text: 'A hard season at home', scope: 'mentor' }]);
  ok('the asker sees all three', (await texts('kanha')).length === 3);
  const d = await texts('dara');
  ok('their mentor (same campus) sees all three', d.length === 3);
  const u = await texts('uriah');
  ok('someone else on the campus sees the campus one and the all-of-YWAM-GP one, not the mentor-only one', u.length === 2 && !u.includes('A hard season at home'));
  const p = await texts('pich');
  ok('someone on the other campus sees only the all-of-YWAM-GP one', p.length === 1 && p[0] === 'For the DTS outreach');
  let r = await call('savePrayer', ['pich', '1234', { text: 'x', scope: 'mentor' }]);
  ok('only-my-mentor needs a mentor who accepted', r.ok === false && r.err === 'no_mentor');
  const id = (await call('getPrayers', ['pich', '1234'])).prayers[0].id;
  r = await call('prayedFor', ['pich', '1234', id, true]);
  await call('prayedFor', ['uriah', '1234', id, true]);
  r = await call('getPrayers', ['kanha', '1234']);
  const mine = r.prayers.find((x) => x.id === id);
  ok('"I prayed" is a count — the asker sees how many, never who', mine.prayedN === 2 && !JSON.stringify(mine).includes('st4') && !JSON.stringify(mine).includes('Pich'));
  const hidden = (await call('getPrayers', ['kanha', '1234'])).prayers.find((x) => x.scope === 'mentor').id;
  r = await call('prayedFor', ['pich', '1234', hidden, true]);
  ok('nobody can pray-tap (or find) a request they cannot see', r.ok === false);
  r = await call('answerPrayer', ['dara', '1234', id, 'yes']);
  ok('only the asker marks it answered', r.ok === false);
  r = await call('answerPrayer', ['kanha', '1234', id, 'They all got their visas!']);
  ok('… and they do, with a line of thanks', r.ok && r.prayers.find((x) => x.id === id).answered && /visas/.test(r.prayers.find((x) => x.id === id).answerNote));
  r = await call('deletePrayer', ['dara', '1234', hidden]);
  ok('someone else cannot delete it', r.ok === false);
  r = await call('deletePrayer', ['uriah', '1234', (await call('getPrayers', ['uriah', '1234'])).prayers[0].id]);
  ok('an admin can', r.ok);
  for (let i = 0; i < 5; i++) await call('savePrayer', ['dara', '1234', { text: 'r' + i, scope: 'campus' }]);
  r = await call('savePrayer', ['dara', '1234', { text: 'one more', scope: 'campus' }]);
  ok('five a day at most', r.ok === false && r.err === 'too_many');
  ok('the roster carries nothing of it', !/visa|outreach/.test(JSON.stringify(await call('teamRoster', ['dara', '1234']))));
}

/* ---------- 2. the page ---------- */
{
  const { ctx, page } = await open('pich');
  await page.click('#menuBtn'); await page.waitForTimeout(200);
  await page.click('[data-menu-item="prayer"]'); await page.waitForTimeout(900);
  let txt = await main(page);
  const seen = ((await call('getPrayers', ['pich', '1234'])).prayers || []);
  ok('☰ → Prayer: ask for prayer, and the requests Pich can see, open and answered', /Ask for prayer/i.test(txt) &&
    new RegExp('Praying · ' + seen.filter((x) => !x.answered).length).test(txt) && new RegExp('Answered · ' + seen.filter((x) => x.answered).length).test(txt));
  await page.fill('#prText', 'Rain for the rice fields');
  await page.click('#prSend'); await page.waitForTimeout(800);
  ok('sharing a request', (mem.prayers || []).some((r) => r.text === 'Rain for the rice fields' && r.campus === 'poipet' && r.scope === 'campus') && /Rain for the rice fields/.test(await main(page)));
  await page.screenshot({ path: OUT + '/prayer.png', fullPage: true });
  await ctx.close();
  const k = await open('kanha');
  await k.page.evaluate(() => { S.view = 'prayer'; S.pr = null; render(); }); await k.page.waitForTimeout(900);
  ok('another campus\'s request is not on Kanha\'s page', !/Rain for the rice fields/.test(await main(k.page)));
  const otherId = (mem.prayers || []).find((r) => r.staffId === 'st3').id;
  await k.page.click('[data-prpray="' + otherId + '"]'); await k.page.waitForTimeout(600);
  ok('tapping Pray counts you', (mem.prayers.find((r) => r.id === otherId).prayed || []).includes('st2') && /I prayed · 1/.test(await main(k.page)));
  const mineId = mem.prayers.find((r) => r.staffId === 'st2' && !r.answered).id;
  await k.page.click('[data-pranswer="' + mineId + '"]'); await k.page.waitForTimeout(200);
  await k.page.fill('#prNote', 'Thank you all'); await k.page.click('#prAnsSave'); await k.page.waitForTimeout(700);
  ok('marking your own answered', !!mem.prayers.find((r) => r.id === mineId).answered);
  await k.ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
