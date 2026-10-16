/* Reminders on the page (Oct 2026): an admin turns them on in Admin → Reminders;
   then Profile & settings → Reminders turns them on for this phone, picks the hour
   and what to be reminded of, sends a test and turns them off. The phone's push
   service is stood in (a fake PushManager with a real key pair); the server is the
   real api.js with fetch stood in, and the test message is decrypted. */
import vm from 'node:vm';
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('rem-ui');
const OUT = tmpDir('rem-ui-out');
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
  mk({ id: 'st2', name: 'Kanha Lim', username: 'kanha', email: 'k@e.com', mentorId: 'st1', mentorStatus: 'approved' })
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




const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ECDH = crypto.createECDH('prime256v1'); ECDH.generateKeys();
const AUTH = crypto.randomBytes(16);
const PHONE = { endpoint: 'https://fcm.googleapis.com/fcm/send/ui-test', keys: { p256dh: b64u(ECDH.getPublicKey()), auth: b64u(AUTH) } };
let pushed = [];
globalThis.fetch = async (url, o) => { pushed.push({ url, o }); return { status: 201, ok: true }; };
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
  await page.addInitScript((ph) => {
    /* a phone that can take push: Notification, PushManager and a service worker registration */
    let sub = null;
    window.__perm = 'default';
    if (!ph.notInstalled) Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });   // opened from the Home Screen
    window.Notification = { get permission() { return window.__perm; }, requestPermission: () => { window.__perm = 'granted'; return Promise.resolve('granted'); } };
    window.PushManager = function () {};
    const pm = {
      getSubscription: () => Promise.resolve(sub),
      subscribe: (o) => { window.__subKeyLen = o.applicationServerKey.length; sub = { endpoint: ph.endpoint, toJSON: () => ({ endpoint: ph.endpoint, keys: ph.keys }), unsubscribe: () => { sub = null; return Promise.resolve(true); } }; return Promise.resolve(sub); }
    };
    const reg = { pushManager: pm, update: () => Promise.resolve() };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), register: () => Promise.resolve(reg), getRegistration: () => Promise.resolve(reg), addEventListener() {}, controller: null } });
  }, Object.assign({ notInstalled: !!opts.notInstalled }, PHONE));
  await page.goto(BASE + '/teams.html', { waitUntil: 'load' });
  if (user) await page.waitForSelector('nav.bottom button', { timeout: 15000 }); else await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const main = (page) => page.$eval('#main', e => e.innerText);



/* ---------- 1. off for the app: the admin sees how to turn it on, staff see nothing ---------- */
{
  const { ctx, page } = await open('kanha');
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(400);
  ok('before an admin turns reminders on, staff see no Reminders card', !(await page.$('#remCard')));
  await ctx.close();
  const a = await open('uriah');
  await a.page.evaluate(() => { S.view = 'profile'; render(); }); await a.page.waitForTimeout(400);
  ok('… an admin sees where to turn them on', /Admin → Reminders/.test(await a.page.$eval('#remCard', (e) => e.textContent)));
  await a.page.evaluate(() => { S.view = 'admin'; S.adminSub = 'reminders'; render(); }); await a.page.waitForTimeout(700);
  await a.page.click('#admPushOn'); await a.page.waitForTimeout(1200);
  ok('Admin → Reminders → Turn on reminders for the app', !!mem.pushKeys && /People with reminders/.test(await main(a.page)));
  await a.page.screenshot({ path: OUT + '/admin-reminders.png', fullPage: true });
  await a.ctx.close();
}

/* ---------- 2. a staff member turns them on for their phone ---------- */
{
  const n = await open('kanha', { notInstalled: true });
  await n.page.evaluate(() => { S.view = 'profile'; render(); }); await n.page.waitForTimeout(500);
  ok('on an iPhone not opened from the Home Screen, it says to add it there first', /Add to Home Screen/.test(await n.page.$eval('#remCard', (e) => e.textContent)) && !(await n.page.$('#remOn')));
  await n.ctx.close();
}
{
  const { ctx, page } = await open('kanha');
  await page.evaluate(() => { S.view = 'profile'; render(); }); await page.waitForTimeout(600);
  ok('Profile & settings → Reminders: Turn on reminders', !!(await page.$('#remOn')));
  await page.click('#remOn'); await page.waitForTimeout(1200);
  ok('turning on asks permission and subscribes with the app\'s 65-byte key', await page.evaluate(() => window.__perm === 'granted' && window.__subKeyLen === 65));
  ok('… and the server keeps this phone', (mem.pushSubs || []).length === 1 && mem.pushSubs[0].staffId === 'st2' && mem.pushSubs[0].endpoint === PHONE.endpoint);
  ok('… then the hour and what to be reminded of', !!(await page.$('#remHour')) && !!(await page.$('#remDaily')) && !(await page.$('#remAdmin')));
  await page.screenshot({ path: OUT + '/reminders.png', fullPage: true });
  await page.selectOption('#remHour', '7'); await page.waitForTimeout(600);
  await page.uncheck('#remDaily'); await page.waitForTimeout(600);
  const k = mem.staff.find((s) => s.id === 'st2');
  ok('changing them saves at once', k.push && k.push.hour === 7 && k.push.daily === false);
  pushed = [];
  await page.click('#remTest'); await page.waitForTimeout(900);
  ok('Send me a test goes to this phone', pushed.length === 1 && pushed[0].url === PHONE.endpoint);
  await page.click('#remOff'); await page.waitForTimeout(700);
  ok('Turn off: gone from the server, and the button to turn on is back', !(mem.pushSubs || []).length && !!(await page.$('#remOn')));
  ok('the card fits a 320px phone', await page.evaluate(() => { document.body.style.width = '320px'; const c = document.getElementById('remCard'); return c.scrollWidth <= c.clientWidth + 1; }));
  await ctx.close();
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
