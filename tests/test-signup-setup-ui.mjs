/* Signing up is Google and a name; the rest is asked step by step once an admin says yes (Nov 2026, Andrew:
   "when you make a new account, make it simple, just … your Gmail and … your name. And then once … it's been
   approved by the admin, then it'll go over the steps … what ministry are you in and what kind of campus staff are
   you and did you fill out your staff contract"). The real api.js, with Google's tokeninfo stood in. */
import { REPO, PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TMP = tmpDir('signup-setup-ui');
const OUT = tmpDir('signup-setup-ui-out');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
delete process.env.GP_GOOGLE_REDIRECT;
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus', country: 'Cambodia', surveyToken: 'tok_' + o.id }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'ad', name: 'Uriah Admin', username: 'uriah', email: 'u@e.com', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true }),
  mk({ id: 'mo', name: 'Mo Mentor', username: 'mo', email: 'mo@e.com' }),
  mk({ id: 'pp', name: 'Pi Poipet', username: 'pi', email: 'pi@e.com', campus: 'poipet' })
];
/* Google's tokeninfo and userinfo, stood in: the token names the account */
const ACCOUNTS = { 'tok-new': { email: 'new.person@gmail.com', sub: 'g-new', name: 'Nara New' } };
globalThis.fetch = async (url, opts) => {
  const u = String(url), auth = (opts && opts.headers && opts.headers.Authorization) || '';
  const tok = auth ? auth.replace(/^Bearer /, '') : decodeURIComponent((u.split('access_token=')[1] || '').split('&')[0]);
  const a = ACCOUNTS[tok];
  if (u.indexOf('tokeninfo') > -1) return a ? { ok: true, json: async () => ({ aud: 'cid.apps.googleusercontent.com', email: a.email, email_verified: 'true', expires_in: '3500', sub: a.sub }) } : { ok: false, json: async () => ({}) };
  if (u.indexOf('userinfo') > -1) return { ok: true, json: async () => ({ name: a ? a.name : 'Someone' }) };
  return { ok: false, json: async () => ({}) };
};
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
const FAKE_GSI = `window.google={accounts:{oauth2:{initTokenClient:function(o){return{requestAccessToken:function(){
  setTimeout(function(){ o.callback({access_token:'tok-new'}); },30); }};}}}};`;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const call = async (fn, args) => (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json();
const nara = () => mem.staff.find(x => x.email === 'new.person@gmail.com');

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GSI }));
await page.route('**fonts.g**', r => r.abort());

/* ---------- 1. making the account: Google, then the name — nothing else ---------- */
await page.goto(BASE + '/teams.html?reg=1', { waitUntil: 'load' });
await page.waitForSelector('#googleSignup', { timeout: 15000 });
ok('Create my profile is one button: Sign up with Google — no campus, ministry, mentor or other boxes',
  !(await page.$('#r_campus')) && !(await page.$('#r_dept')) && !(await page.$('#r_mentor')) && !(await page.$('#r_type')) && !(await page.$('#r_country')) && !(await page.$('#r_name')));
ok('… and says why', /Just your Google account and your name/.test(await page.$eval('#regSub', e => e.textContent)));
ok('… with a way for someone with no Google account', !!(await page.$('#regPinWay')));
await page.click('#googleSignup'); await page.waitForSelector('#regGoogle', { timeout: 8000 });
ok('after Google, straight to the name — not the “do you already have a profile?” choice', !(await page.$('#gglNew')) && /new\.person@gmail\.com/.test(await page.$eval('#regGoogle', e => e.textContent)));
const boxes = await page.$$eval('#main input:not([type=hidden])', es => es.map(e => e.id));
ok('… the name filled in from Google, the only box on the page', (await page.$eval('#r_name', e => e.value)) === 'Nara New' && boxes.join() === 'r_name', JSON.stringify([await page.$eval('#r_name', e => e.value), boxes]));
await page.screenshot({ path: OUT + '/1-name.png' });
await page.fill('#r_name', 'Nara Newton');
await page.click('#regBtn'); await page.waitForSelector('#setup', { timeout: 15000 }); await page.waitForTimeout(400);
const n0 = nara();
ok('the account is made, waiting for an admin, with its setup still to do', n0 && n0.active === false && n0.awaiting === true && n0.setupTodo === true && n0.name === 'Nara Newton' && n0.google && n0.google.sub === 'g-new' && !n0.campus && !n0.dept, JSON.stringify(n0 && { a: n0.active, s: n0.setupTodo, c: n0.campus }));
ok('… and they are signed in at once: the phone keeps the session', JSON.parse(await page.evaluate(() => localStorage.getItem('gp-staff'))).user === n0.username);

/* ---------- 2. the setup steps, in the app, before any approval ---------- */
const step = () => page.$eval('#setup', e => e.getAttribute('data-sustep'));
ok('signed in, the app opens on “Set up my profile”, welcoming them by name', (await step()) === 'hello' && /Welcome to YWAM GP, Nara!/.test(await page.$eval('#setup', e => e.innerText)) && /Then an admin says yes/.test(await page.$eval('#setup', e => e.innerText)));
ok('… nothing else: no bottom bar, no menu, bell or search — only the language', await page.$eval('#bottomNav', e => e.classList.contains('hidden') && !e.children.length) && !(await page.$('#menuBtn')) && !(await page.$('#bellBtn')) && !(await page.$('#findBtn')) && !!(await page.$('#langBtn')));
await page.screenshot({ path: OUT + '/3-hello.png' });
await page.click('#suNext');
ok('step 1: which campus', (await step()) === 'campus' && /Step 1 of 6/.test(await page.$eval('#setup', e => e.innerText)));
await page.click('#suNext'); await page.waitForTimeout(150);
ok('… Next without a campus says so and stays', (await step()) === 'campus');
await page.click('[data-sucampus="siemreap"]'); await page.waitForTimeout(200);
ok('a tap on a campus goes straight on to the ministry', (await step()) === 'ministry');
await page.selectOption('#su_dept', 'Community Service'); await page.waitForTimeout(100);
ok('… the department fills the ministries', (await page.$$eval('#su_ministry option', os => os.map(o => o.value))).includes('Cafe'));
await page.selectOption('#su_ministry', 'Cafe'); await page.fill('#su_role', 'Barista');
await page.screenshot({ path: OUT + '/4-ministry.png' });
await page.click('#suNext');
ok('step 3: what kind of staff, three choices', (await step()) === 'kind' && (await page.$$('[data-sukind]')).length === 3);
await page.click('#suBack');
ok('Back keeps what was picked', (await step()) === 'ministry' && (await page.$eval('#su_dept', e => e.value)) === 'Community Service' && (await page.$eval('#su_ministry', e => e.value)) === 'Cafe' && (await page.$eval('#su_role', e => e.value)) === 'Barista');
await page.click('#suNext'); await page.click('[data-sukind="ministry"]'); await page.waitForTimeout(150);
ok('a tap on a kind goes on to the country', (await step()) === 'country');
await page.selectOption('#su_country', 'Cambodia'); await page.click('#suNext');
ok('step 5: a mentor, this campus’s people first — not the other campus’s in that group, not themselves', (await step()) === 'mentor' &&
  (await page.$$eval('#su_mentor optgroup:first-of-type option', os => os.map(o => o.textContent).join())).indexOf('Mo Mentor') > -1 &&
  (await page.$$eval('#su_mentor optgroup:first-of-type option', os => os.map(o => o.textContent).join())).indexOf('Pi Poipet') === -1 &&
  (await page.$$eval('#su_mentor option', os => os.map(o => o.textContent).join())).indexOf('Nara') === -1);
await page.selectOption('#su_mentor', 'mo'); await page.click('#suNext');
ok('… still no bottom bar on a later step', await page.$eval('#bottomNav', e => !e.children.length));
ok('step 6: the staff contract', (await step()) === 'papers' && /Have you signed your staff contract with HR\?/.test(await page.$eval('#setup', e => e.innerText)));
await page.click('[data-sucontract="no"]'); await page.waitForTimeout(150);
ok('“Not yet” says HR will fill it out with them', /tell HR you’re new/.test(await page.$eval('#suContractNo', e => e.innerText)));
ok('nothing is saved before the last step', nara().setupTodo === true && !nara().campus);
await page.screenshot({ path: OUT + '/5-papers.png' });
await page.click('#suNext'); await page.waitForSelector('#awaiting', { timeout: 8000 }); await page.waitForTimeout(300);
const n1 = nara();
ok('Finish saves it all at once — still waiting for the admin', n1.campus === 'siemreap' && n1.dept === 'Community Service' && n1.ministry === 'Cafe' && n1.role === 'Barista' && n1.staffType === 'ministry' && n1.country === 'Cambodia' && n1.mentorId === 'mo' && n1.mentorStatus === 'pending' && !('setupTodo' in n1) && n1.active === false && n1.awaiting === true,
  JSON.stringify({ c: n1.campus, d: n1.dept, m: n1.ministry, k: n1.staffType, s: n1.setupTodo }));
const wait = await page.$eval('#awaiting', e => e.innerText);
ok('… then the waiting page: thank you, what they answered, the rest once an admin says yes', /Thank you, Nara!/.test(wait) && /once they say yes, the whole app opens up/.test(wait) && /Siem Reap/.test(wait) && /Cafe/.test(wait) && /Mo Mentor/.test(wait), wait.replace(/\s+/g, ' '));
ok('… still nothing else to open', await page.$eval('#bottomNav', e => !e.children.length) && !(await page.$('#menuBtn')));
await page.screenshot({ path: OUT + '/6-waiting.png' });
await page.click('#awaitEdit'); await page.waitForTimeout(200);
ok('Change my answers goes back to the steps, with the answers in', (await step()) === 'campus' && await page.$eval('[data-sucampus="siemreap"]', e => e.classList.contains('on')));
await page.click('#suBack'); await page.waitForSelector('#awaiting');
ok('… and Back from there returns to the waiting page', !!(await page.$('#awaiting')));
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#awaiting', { timeout: 15000 });
ok('opened again before approval: straight to the waiting page', !(await page.$('#setup')) && /Waiting for an admin/.test(await page.$eval('#awaiting', e => e.innerText)));
ok('nothing in the app works for them yet (the server says no)', !(await call('getMyLogs', [n1.username, JSON.parse(await page.evaluate(() => localStorage.getItem('gp-staff'))).pin])).ok);

/* ---------- 3. the admin's Approvals: the email, and the answers once given ---------- */
const appr = await page.evaluate(() => { S.adminStaff = [{ id: 'x', name: 'Nara Newton', username: 'newperson', email: 'new.person@gmail.com', campus: '', dept: '', ministry: '', active: false }]; return adminApprovalsHtml_(); });
ok('Admin → Approvals shows their email, and says when they haven’t answered yet', /new\.person@gmail\.com/.test(appr) && /They choose their campus and ministry/.test(appr) && !/undefined/.test(appr));
await page.evaluate(() => { S.adminStaff = null; });
const ap = await call('adminSetActive', ['uriah', '1234', n1.id, true]);
ok('approving the account switches it on and ends the waiting', ap.ok && nara().active === true && !('awaiting' in nara()));

/* ---------- 4. after the yes: the whole app ---------- */
await page.click('#awaitCheck'); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(800);
ok('Check again opens the app: the bottom bar, My Home, their campus', !(await page.$('#awaiting')) && !(await page.$('#setup')) && await page.evaluate(() => S.view === 'week' && S.me.campus === 'siemreap' && !S.awaiting));
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(600);
ok('… and on every open after', !(await page.$('#setup')) && !(await page.$('#awaiting')));
ok('nothing scrolls sideways', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
await ctx.close();

/* ---------- 5. the server's side ---------- */
{
  const r = await call('staffRegister', [{ name: 'Pat Pin', email: 'pat@e.com', username: 'pat', pin: '4321', campus: 'nowhere' }]);
  const pat = mem.staff.find(x => x.username === 'pat');
  ok('a username + PIN sign-up needs only the name, email, username and PIN; a made-up campus is dropped', r.ok && r.pending && r.awaiting && r.user === 'pat' && pat && pat.campus === '' && pat.setupTodo === true);
  const w = await call('getMyBoot', ['pat', '4321']);
  ok('… waiting, their boot is the waiting page’s few things — no base, logs or goals', w.ok && w.awaiting && w.staff && w.staff.setupTodo && !w.base && !w.logs && !w.goals && Array.isArray(w.roster));
  ok('… and the PIN sign-in lets them in to it', (await call('staffLogin', ['pat', '4321'])).awaiting === true);
  const wrong = await call('getMyBoot', ['pat', '0000']);
  ok('… never with a wrong PIN', !wrong.ok && wrong.err === 'auth');
  pat.active = false; delete pat.awaiting;
  ok('an account an admin switched off is not “waiting”: no way in', (await call('staffLogin', ['pat', '4321'])).err === 'pending' && (await call('getMyBoot', ['pat', '4321'])).err === 'auth' && !(await call('updateProfile', ['pat', '4321', { name: 'x' }])).ok);
  pat.active = true;
  const lg = await call('staffLogin', ['pat', '4321']);
  ok('… their own card says the setup is still to do', lg.ok && lg.staff.setupTodo === true);
  const ros = await call('teamRoster', []);
  ok('… which nobody else’s roster carries', Array.isArray(ros) && !ros.some(x => 'setupTodo' in x));
  const up = await call('updateProfile', ['pat', '4321', { campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', setupDone: true }]);
  ok('updateProfile with setupDone clears it', up.ok && !up.staff.setupTodo && !('setupTodo' in mem.staff.find(x => x.username === 'pat')));
  const old = await call('staffLogin', ['uriah', '1234']);
  ok('an account made before has no setup to do', old.ok && !old.staff.setupTodo);
}

/* ---------- 6. in Khmer ---------- */
{
  Object.assign(mem.staff.find(x => x.username === 'pat'), { setupTodo: true, google: { sub: 'g-pat' } });   // Google connected, so the connect step doesn't come first
  const c2 = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await p2.route('**fonts.g**', r => r.abort());
  await p2.addInitScript(() => { localStorage.setItem('gp-lang', 'km'); localStorage.setItem('gp-staff', JSON.stringify({ user: 'pat', pin: '4321' })); });
  await p2.goto(BASE + '/teams.html', { waitUntil: 'load' }); await p2.waitForSelector('#setup', { timeout: 15000 });
  await p2.click('#suNext'); await p2.waitForTimeout(150);
  ok('the steps are in Khmer', /តើអ្នកនៅបរិវេណណា/.test(await p2.$eval('#setup', e => e.innerText)));
  await c2.close();
}

ok('no page errors', errors.length === 0, errors.join(' | '));
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
