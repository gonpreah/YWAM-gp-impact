/* Getting back in, in the browser (Nov 2026, Uriah: "I can't see the full email in the account on my admin dashboard …
   I don't want people getting logged out and stuck"):
     - Admin → a person shows the whole email on its own line (wrapping, no cut-off at 320px) with Copy, and how they
       sign in; Edit profile has an Email box that saves through adminUpdateStaff;
     - Sign-in link: Make a sign-in link → a teams.html?signin=… link to copy or share;
     - opening that link signs them in (the token leaves the address, the phone keeps the device token), then asks
       them to connect Google with a "Not now" way through; a used or bad link lands on the sign-in screen saying so,
       and the sign-in screen says to ask an admin. */
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const PORT = 4637;
await new Promise(r => server.listen(PORT, r));
const BASE = 'http://localhost:' + PORT;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const base = { campus: 'siemreap', photo: '', mentorId: '', isAdmin: false, leads: [], active: true, ministries: [] };
const ADMIN = { ...base, id: 'st_admin', name: 'Ada Admin', username: 'ada', dept: 'Campus Leadership', ministry: 'Campus Director', role: '', isAdmin: true, staffType: 'campus', google: true, signIn: 'google' };
const LONG = 'a.very.long.email.address.for.fran.friend@example-ministry-of-the-base.org';
const FRAN = { ...base, id: 'st_fran', name: 'Fran Friend', username: 'fran', dept: 'Community Service', ministry: 'Cafe', role: '', staffType: 'ministry', email: LONG, google: false, signIn: 'pin', kind: 'staff' };
const TOK = 'b'.repeat(48), DEV = 'c'.repeat(48);
const bootOf = (me, extra) => ({ ok: true, staff: me, profile: { email: me.email || '' }, roster: [ADMIN, FRAN], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [], ministry: null,
  personal: { ok: true, entries: {} }, trips: { ok: true, trips: [], totals: {}, reasons: { work: [], personal: [] }, hasMentor: false }, tripRequests: [],
  base: { leader: false, entries: {}, okrs: [], survey: [], metricOverrides: [] }, ...(extra || {}) });

const browser = await chromium.launch({ executablePath: CHROMIUM });
const errors = [];
async function open(api, init) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 760 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  const sent = [];
  await ctx.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.google={accounts:{oauth2:{initTokenClient:function(){return{requestAccessToken:function(){}};}}}};' }));
  await ctx.route('**/.netlify/functions/api', r => {
    const b = JSON.parse(r.request().postData() || '{}'); sent.push(b);
    let out = api(b);
    if (out === undefined) out = b.fn === 'getData' ? { entries: {}, okrs: [], survey: [] } : b.fn === 'teamRoster' ? [] : /^getMy/.test(b.fn) ? { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] } : { ok: true };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  if (init) await page.addInitScript(init);
  return { ctx, page, sent };
}

/* ---------- 1. Admin → a person ---------- */
{
  let saved = null;
  const { ctx, page, sent } = await open(b => {
    if (b.fn === 'getMyBoot') return bootOf(ADMIN);
    if (b.fn === 'adminListStaff') return { ok: true, staff: [ADMIN, FRAN] };
    if (b.fn === 'adminSignInLink') return { ok: true, token: TOK, exp: new Date(Date.now() + 72 * 3600e3).toISOString() };
    if (b.fn === 'adminUpdateStaff') { saved = b.args[3]; return { ok: true, staff: { ...FRAN, email: saved.email } }; }
  }, () => localStorage.setItem('gp-staff', JSON.stringify({ user: 'ada', pin: '1234' })));
  await page.goto(BASE + '/teams.html'); await page.waitForSelector('nav.bottom button', { timeout: 15000 }); await page.waitForTimeout(500);
  await page.evaluate(() => { S.view = 'admin'; S.adminSub = 'person'; S.adminPersonId = 'st_fran'; render(); });
  await page.waitForSelector('#admEmail', { timeout: 5000 });
  const em = await page.$eval('#admEmail', e => ({ text: e.textContent, r: e.getBoundingClientRect().right, w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
  ok('the person page shows the whole email, on its own line', em.text.indexOf(LONG) > -1, em.text);
  ok('… inside the screen at 320px, with no sideways scroll', em.r <= em.w + 1 && em.sw <= em.w + 1, JSON.stringify(em));
  ok('… with Copy beside it', !!(await page.$('[data-admincopy="' + LONG + '"]')));
  ok('… and how they sign in', /username and PIN — not on Google yet/.test(await page.textContent('#admSignIn')));

  await page.click('[data-adminsignlink="st_fran"]'); await page.waitForSelector('#admSignLinkUrl', { timeout: 5000 });
  const url = await page.$eval('#admSignLinkUrl', e => e.value);
  ok('Make a sign-in link gives a teams.html?signin= link', url === BASE + '/teams.html?signin=' + TOK, url);
  ok('… asked for this person', sent.some(x => x.fn === 'adminSignInLink' && x.args[2] === 'st_fran'));
  ok('… with Copy the link, and how long it works', !!(await page.$('#admSignLinkCopy')) && /Works once, until/.test(await page.textContent('#admSignLinkBox')));

  await page.click('[data-adminedit="st_fran"]'); await page.waitForSelector('#adm_email');
  ok('Edit profile has an Email box with their email', (await page.$eval('#adm_email', e => e.value)) === LONG);
  await page.fill('#adm_email', 'fran.friend@gmail.com');
  await page.click('[data-adminsave="st_fran"]'); await page.waitForTimeout(400);
  ok('… which saves through adminUpdateStaff', saved && saved.email === 'fran.friend@gmail.com');
  await ctx.close();
}

/* ---------- 2. opening the link ---------- */
{
  const { ctx, page, sent } = await open(b => {
    if (b.fn === 'staffUseSignInLink') return b.args[0] === TOK ? { ok: true, user: 'fran', token: DEV, viaLink: true, staff: FRAN, profile: { email: LONG } } : { ok: false, err: 'link' };
    if (b.fn === 'getMyBoot') return bootOf(FRAN, { googleId: 'cid.apps.googleusercontent.com' });
  });
  await page.goto(BASE + '/teams.html?signin=' + TOK);
  await page.waitForSelector('#gglStep', { timeout: 15000 });
  ok('the link signs them in', sent.some(x => x.fn === 'staffUseSignInLink' && x.args[0] === TOK) && sent.some(x => x.fn === 'getMyBoot' && x.args[1] === DEV));
  ok('… the token leaves the address', !/signin=/.test(page.url()), page.url());
  ok('… the phone keeps the device token, so they stay signed in', JSON.parse(await page.evaluate(() => localStorage.getItem('gp-staff'))).pin === DEV);
  ok('… then it asks them to connect Google, with a way through for now', !!(await page.$('#gglStepGo')) && !!(await page.$('#gglStepLater')));
  await page.click('#gglStepLater'); await page.waitForTimeout(300);
  ok('Not now opens the app', !(await page.$('#gglStep')) && !!(await page.$('nav.bottom button')));
  await ctx.close();
}
{
  const { ctx, page } = await open(b => {
    if (b.fn === 'staffUseSignInLink') return { ok: false, err: 'link' };
    if (b.fn === 'portalAuthConfig') return { ok: true, google: '' };
  });
  await page.goto(BASE + '/teams.html?signin=' + 'd'.repeat(48));
  await page.waitForSelector('#li_user', { timeout: 15000 }); await page.waitForTimeout(300);
  ok('a used or bad link lands on the sign-in screen, saying so', /already used, or isn’t right/.test(await page.textContent('body')));
  ok('the sign-in screen says to ask an admin for a link', /send you a link that signs you straight in/.test(await page.textContent('#loginStuck')));
  ok('… and the token is gone from the address', !/signin=/.test(page.url()));
  await ctx.close();
}

ok('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
