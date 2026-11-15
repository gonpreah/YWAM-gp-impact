/* Signing in with Google, made smoother (Nov 2026, Andrew: "a few people having trouble logging into the app
   with the Google account"). In the browser, with Google's script stood in:
     - a Google account no profile has → a choice, not a new sign-up: connect it to the profile they have (one
       PIN sign-in, then it is joined with no second trip to Google), another Google account, or a new profile;
     - Google's window can't open → the button comes back and a help box says what to do, with the PIN
       (sign-in screen) or "continue for now" (the connect step, for today);
     - opened inside Messenger / another app's browser → it says Google won't sign in there, with Open in
       Chrome on Android and Copy the link;
     - Google's page-and-back way (when the site has it on): an iPhone Home Screen app goes to Google's page,
       and coming back signs in with the token from the address — only with the state it left. */
import { PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  → ' + extra : '')); }
}
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, res) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const PORT = 4531;
await new Promise(res => srv.listen(PORT, res));
const BASE = `http://localhost:${PORT}`;
const CID = 'cid.apps.googleusercontent.com';
const ME = { id: 'st_dee', name: 'Dee Teesse', username: 'dee', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: '', photo: '', mentorId: '', isAdmin: false, ministries: [] };
const TOKEN48 = 'a'.repeat(48);
/* Google's script, stood in: window.__ggl decides what the pop-up does — 'ok' answers with a token,
   'blocked' fails to open, 'nothing' never comes back */
const FAKE_GSI = `window.google={accounts:{oauth2:{initTokenClient:function(o){return{requestAccessToken:function(){
  window.__gglAsked=(window.__gglAsked||0)+1; var m=window.__ggl||'ok';
  if(m==='ok') setTimeout(function(){ o.callback({access_token:'tok-abc'}); },30);
  else if(m==='blocked') setTimeout(function(){ o.error_callback({type:'popup_failed_to_open'}); },30);
}};}}}};`;

const b = await chromium.launch({ executablePath: CHROMIUM });
const errs = [];
async function page(opts, api) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, ...(opts || {}) });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  const sent = [];
  await p.route('https://accounts.google.com/gsi/client', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GSI }));
  await p.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}'); sent.push(q);
    const o = api(q) || (q.fn === 'teamRoster' ? [] : { ok: true });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  return { ctx, p, sent };
}
const boot = (staff) => ({ ok: true, googleId: CID, staff, profile: { email: 'dee@example.org' }, roster: [staff], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [], ministry: null,
  trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [], base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [], roster: [] } });

/* ---------- 1. a Google account no profile has: connect it to the one they have ---------- */
{
  let linked = false;
  const { ctx, p, sent } = await page({}, q => {
    if (q.fn === 'portalAuthConfig') return { ok: true, google: CID };
    if (q.fn === 'staffLoginGoogle') return { ok: false, err: 'new', email: 'dee.personal@gmail.com', name: 'Dee T' };
    if (q.fn === 'staffLogin') return { ok: true, user: 'dee', staff: { ...ME, google: false, signIn: 'pin' }, profile: { email: 'dee@example.org' } };
    if (q.fn === 'staffLinkGoogle') { linked = true; return { ok: true, token: TOKEN48, email: 'dee.personal@gmail.com' }; }
    if (q.fn === 'getMyBoot') return boot({ ...ME, google: linked, signIn: linked ? 'google' : 'pin' });
  });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#googleLogin', { timeout: 15000 });
  await p.click('#googleLogin'); await p.waitForSelector('#gglNew', { timeout: 5000 });
  ok('a Google account no profile has opens a choice — not the sign-up form', /No profile uses dee\.personal@gmail\.com yet/.test(await p.$eval('#gglNew', e => e.textContent)) && !(await p.$('#r_name')) &&
    !!(await p.$('#gglHaveProfile')) && !!(await p.$('#gglOtherAccount')) && !!(await p.$('#gglImNew')));
  ok('… and says what to do with a forgotten PIN', /Ask an admin to reset your PIN/.test(await p.$eval('#gglNew', e => e.textContent)));
  await p.click('#gglHaveProfile'); await p.waitForTimeout(200);
  ok('“I have a profile” opens the PIN form, saying the Google account will be joined to it', !!(await p.$('#li_user')) && /dee\.personal@gmail\.com is then connected to your profile/.test(await p.$eval('#gglJoin', e => e.textContent)));
  await p.fill('#li_user', 'dee'); await p.fill('#li_pin', '1234'); await p.click('#loginBtn');
  await p.waitForSelector('nav.bottom button', { timeout: 15000 }); await p.waitForTimeout(500);
  const ln = sent.find(x => x.fn === 'staffLinkGoogle');
  ok('signed in once, the Google account is joined with the sign-in already made — no second trip to Google', ln && JSON.stringify(ln.args) === '["dee","1234","tok-abc"]' && await p.evaluate(() => window.__gglAsked) === 1);
  ok('… so the connect step never shows, and the phone keeps the Google sign-in', !(await p.$('#gglStep')) && JSON.parse(await p.evaluate(() => localStorage.getItem('gp-staff'))).pin === TOKEN48);
  await ctx.close();
}
/* ---------- 2. the other two choices ---------- */
{
  const { ctx, p } = await page({}, q => {
    if (q.fn === 'portalAuthConfig') return { ok: true, google: CID };
    if (q.fn === 'staffLoginGoogle') return { ok: false, err: 'new', email: 'new.person@gmail.com', name: 'New Person' };
  });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#googleLogin', { timeout: 15000 });
  await p.click('#googleLogin'); await p.waitForSelector('#gglNew');
  await p.click('#gglOtherAccount'); await p.waitForTimeout(400);
  ok('“Use a different Google account” goes back to Google', await p.evaluate(() => window.__gglAsked) === 2 && !!(await p.$('#gglNew')));
  await p.click('#gglImNew'); await p.waitForTimeout(300);
  ok('“I’m new” opens the sign-up with Google’s name and email', await p.evaluate(() => S.regMode === true && S.regGoogle && S.regGoogle.email === 'new.person@gmail.com' && S.regGoogle.token === 'tok-abc'));
  await ctx.close();
}
/* ---------- 3. Google's window can't open ---------- */
{
  const { ctx, p } = await page({}, q => { if (q.fn === 'portalAuthConfig') return { ok: true, google: CID }; });
  await p.addInitScript(() => { window.__ggl = 'blocked'; });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#googleLogin', { timeout: 15000 });
  await p.click('#googleLogin'); await p.waitForSelector('#gglHelp', { timeout: 5000 });
  ok('the button comes back (not stuck on “Opening Google…”) and a help box says what happened', !(await p.$eval('#googleLogin', e => e.disabled)) && /stopped the Google window from opening/.test(await p.$eval('#gglHelp', e => e.textContent)));
  ok('… with what to try: again, allow pop-ups, the right Google account', /allow them for this page/.test(await p.$eval('#gglHelp', e => e.textContent)) && /the email on your profile/.test(await p.$eval('#gglHelp', e => e.textContent)));
  ok('no “try another way” while the site hasn’t turned Google’s page-and-back on', !(await p.$('#gglRedirect')));
  await p.click('#gglUsePin'); await p.waitForTimeout(200);
  ok('“Use my username and PIN” opens the PIN form', !!(await p.$('#li_user')));
  await ctx.close();
}
/* ---------- 4. the connect step when Google won't open: continue for today ---------- */
{
  const { ctx, p } = await page({}, q => { if (q.fn === 'getMyBoot') return boot({ ...ME, google: false, signIn: 'pin' }); });
  await p.addInitScript(() => { window.__ggl = 'blocked'; localStorage.setItem('gp-staff', JSON.stringify({ user: 'dee', pin: '1234' })); });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#gglStep', { timeout: 15000 });
  ok('before anything goes wrong, the connect step has no way past it', !(await p.$('#gglSkip')));
  await p.click('#gglStepGo'); await p.waitForSelector('#gglHelp', { timeout: 5000 });
  ok('when Google won’t open, the step offers to continue for now', !!(await p.$('#gglSkip')));
  await p.click('#gglSkip'); await p.waitForTimeout(400);
  ok('… which lets them into the app for today, and asks again another day', !(await p.$('#gglStep')) && !!(await p.$('nav.bottom button')) && (await p.evaluate(() => localStorage.getItem('gp-ggl-skip'))) === (await p.evaluate(() => new Date().toDateString())));
  await ctx.close();
}
/* ---------- 5. opened inside Messenger ---------- */
{
  const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A515F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/440.0.0.31.105;]';
  const { ctx, p } = await page({ userAgent: UA }, q => { if (q.fn === 'portalAuthConfig') return { ok: true, google: CID }; });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#googleLogin', { timeout: 15000 }); await p.waitForTimeout(200);
  ok('inside Messenger it says so before they try — Google won’t sign in from inside other apps', /inside Facebook or Messenger/.test(await p.$eval('#gglHelp', e => e.textContent)));
  const href = await p.getAttribute('#gglOpenChrome', 'href');
  ok('… with Open in Chrome on Android, to this page', /^intent:\/\/localhost:\d+\/teams\.html#Intent;scheme=https;package=com\.android\.chrome;end$/.test(href || ''), href);
  ok('… and Copy the link', !!(await p.$('#gglCopyLink')));
  await ctx.close();
  const ok2 = await page({ userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36' }, q => { if (q.fn === 'portalAuthConfig') return { ok: true, google: CID }; });
  await ok2.p.goto(BASE + '/teams.html'); await ok2.p.waitForSelector('#googleLogin', { timeout: 15000 }); await ok2.p.waitForTimeout(200);
  ok('in Chrome itself there is no warning', !(await ok2.p.$('#gglHelp')));
  await ok2.ctx.close();
}
/* ---------- 6. Google's page and back (the site has it on) ---------- */
{
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
  const { ctx, p } = await page({ userAgent: IOS }, q => { if (q.fn === 'portalAuthConfig') return { ok: true, google: CID, redirect: true }; });
  let went = '';
  await p.route('https://accounts.google.com/o/oauth2/**', r => { went = r.request().url(); r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Google</p>' }); });
  await p.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('#googleLogin', { timeout: 15000 });
  ok('an iPhone Home Screen app sees no “inside another app” warning', !(await p.$('#gglHelp')));
  await p.click('#googleLogin'); await p.waitForTimeout(600);
  const u = went ? new URL(went) : null;
  ok('an iPhone Home Screen app goes to Google’s page instead of a pop-up', u && u.searchParams.get('client_id') === CID && u.searchParams.get('response_type') === 'token' &&
    u.searchParams.get('redirect_uri') === BASE + '/teams.html' && /email/.test(u.searchParams.get('scope') || '') && (u.searchParams.get('state') || '').length >= 16, went);
  await ctx.close();
}
{
  let asked = '';
  const { ctx, p, sent } = await page({}, q => {
    if (q.fn === 'portalAuthConfig') return { ok: true, google: CID, redirect: true };
    if (q.fn === 'staffLoginGoogle') { asked = q.args[0]; return { ok: true, user: 'dee', token: TOKEN48, staff: { ...ME, google: true, signIn: 'google' }, profile: {} }; }
    if (q.fn === 'getMyBoot') return boot({ ...ME, google: true, signIn: 'google' });
  });
  await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('gp-ggl-redirect', JSON.stringify({ state: 'abcdef0123456789', mode: 'login', at: Date.now() })); } });
  await p.goto(BASE + '/teams.html#access_token=tok-back&token_type=Bearer&expires_in=3599&state=abcdef0123456789&scope=email');
  await p.waitForSelector('nav.bottom button', { timeout: 15000 }); await p.waitForTimeout(300);
  ok('coming back from Google’s page signs in with the token from the address', asked === 'tok-back');
  ok('… and the token is taken out of the address at once', !/access_token/.test(await p.evaluate(() => location.href)) && !(await p.evaluate(() => localStorage.getItem('gp-ggl-redirect'))));
  await ctx.close();
  const bad = await page({}, q => { if (q.fn === 'portalAuthConfig') return { ok: true, google: CID, redirect: true }; });
  await bad.p.addInitScript(() => { localStorage.setItem('gp-ggl-redirect', JSON.stringify({ state: 'mine', mode: 'login', at: Date.now() })); });
  await bad.p.goto(BASE + '/teams.html#access_token=tok-forged&state=someone-elses');
  await bad.p.waitForSelector('#googleLogin', { timeout: 15000 }); await bad.p.waitForTimeout(300);
  ok('a token with a state we didn’t leave is ignored (and still taken out of the address)', !bad.sent.some(x => x.fn === 'staffLoginGoogle') && !/access_token/.test(await bad.p.evaluate(() => location.href)));
  await bad.ctx.close();
}
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
