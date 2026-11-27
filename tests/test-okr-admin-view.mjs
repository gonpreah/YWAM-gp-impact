/* An admin's view of every department's rocks (it was: every department's OKRs).

   The Rocks tab opens on the ministry's own rocks, to change as anyone in the ministry can. An admin
   also gets "Every department's rocks" below — both campuses, grouped by campus and department,
   folded until opened (a whole base's rocks open at once would bury the page) — and can change any
   of them or add one for any campus and department. A non-admin gets none of that section.
   Until Nov 2026 this file tested the same view over OKR objectives, with their editor; the
   objectives became rocks (teams/28-rocks.js) and the editor is gone. The API is stood in here;
   tests/test-rocks.mjs holds the server's side (an admin may write any rock). Names are made up. */
import { PUBLIC, CHROMIUM } from './env.mjs';
import { testNow, pinClock, weekOf, quarterOf, weekYearOf } from './clock.mjs';
const NOW = testNow();
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((q, r) => {
  let p = q.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
});
await new Promise(res => srv.listen(0, res));
const BASE = 'http://localhost:' + srv.address().port;

const WK = weekOf(NOW), Q = quarterOf(WK) + 1, Y = weekYearOf(NOW);   // the app's quarter (13-week blocks) of the week year
const rock = (id, campus, dept, ministry, title, status) => ({ id, campus, dept, ministry, owner: '', year: Y, q: Q, title, status, note: '', by: 'st_x', at: '', updated: '' });
const ROCKS = () => [
  rock('k1', 'poipet', 'Community Service', 'Outreach Teams', 'My own ministry’s rock', 'on'),
  rock('k2', 'poipet', 'Youth Education', 'Sports', 'A different department’s rock', 'off'),
  rock('k3', 'siemreap', 'Skills Training', '', 'The other campus’s rock', 'on')
];
const ADMIN = { id: 'st_admin', name: 'Ada Admin', username: 'ada', campus: 'poipet', dept: 'Community Service', ministry: 'Outreach Teams', role: '', photo: '', mentorId: '', isAdmin: true };
const STAFF = { id: 'st_staff', name: 'Dara Sok', username: 'dara', campus: 'poipet', dept: 'Community Service', ministry: 'Outreach Teams', role: '', photo: '', mentorId: '', isAdmin: false, leads: ['Community Service|Outreach Teams'] };   // Rocks are for those who lead (Nov 2026); a member has none on the ministry page

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : '')); }
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
async function open(who) {
  const p = await browser.newPage({ viewport: { width: 400, height: 900 } });
  await pinClock(p, NOW);
  const errs = [], saves = []; let rocks = ROCKS();
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CONN/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}');
    let o = { ok: true };
    if (q.fn === 'getMyBoot') o = { ok: true, staff: who, profile: { email: 'x@example.com' }, roster: [who], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
      trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [], ministry: null, rocks: rocks,
      base: { leader: false, entries: { poipet: {} }, okrs: [], survey: [], roster: [] } };
    else if (q.fn === 'teamRoster') o = [who];
    else if (q.fn === 'saveRock') { const x = q.args[2]; saves.push(x);
      if (x.id) rocks = rocks.map(k => k.id === x.id ? Object.assign({}, k, { title: x.title, status: x.status, note: x.note }) : k);
      else rocks = rocks.concat([rock('new' + saves.length, x.campus, x.dept, x.ministry || '', x.title, 'on')]);
      o = { ok: true, saved: x.id || 'new' + saves.length, rocks: rocks }; }
    else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  await p.addInitScript((u) => localStorage.setItem('gp-staff', JSON.stringify({ user: u, pin: '1234' })), who.username);
  await p.goto(BASE + '/teams.html'); await p.waitForSelector('nav.bottom button', { timeout: 15000 });
  await p.waitForTimeout(700);
  await p.click('nav.bottom [data-tab="ministry"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { S.mmTab = 'okr'; render(); });   // the Rocks tab (its key is still 'okr')
  await p.waitForTimeout(500);
  return { p, errs, saves };
}
const text = (p) => p.$eval('#main', e => e.innerText);

{
  const { p, errs } = await open(STAFF);
  const t = await text(p);
  ok('a non-admin who leads the ministry sees its rock', t.includes('My own ministry’s rock'), t.slice(0, 200));
  ok('a non-admin gets no cross-department section at all', !(await p.$('#adminRocks')) && !t.includes('Every department’s rocks'));
  ok('and never sees another department’s rock, nor the other campus’s', !t.includes('A different department’s rock') && !t.includes('The other campus’s rock'));
  ok('non-admin: no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await p.close();
}
{
  const { p, errs, saves } = await open(ADMIN);
  let t = await text(p);
  ok('admin sees the cross-department section', !!(await p.$('#adminRocks')) && t.includes('Every department’s rocks'));
  ok('but the other departments’ rocks are folded, not shown yet', !t.includes('A different department’s rock') && !t.includes('The other campus’s rock'));
  const groups = await p.$$eval('[data-accbucket="adminRockAcc"]', e => e.map(x => x.getAttribute('data-acc')));
  ok('a row for every campus and department that has rocks, both campuses', groups.join(' / ') === 'poipet|Community Service / poipet|Youth Education / siemreap|Skills Training', groups.join(' / '));
  ok('each says how many are on track', /0 of 1 on track/.test(await p.$eval('[data-acc="poipet|Youth Education"]', e => e.textContent)));
  await p.click('[data-acc="poipet|Youth Education"]'); await p.waitForTimeout(300);
  t = await text(p);
  ok('opening it reveals the other department’s rock, with the ministry it belongs to', t.includes('A different department’s rock') && /Sports/.test(await p.$eval('[data-rkadmin="poipet|Youth Education"]', e => e.textContent)));
  ok('an admin can change it there: three buttons and Edit', (await p.$$('[data-rkadmin="poipet|Youth Education"] [data-rockst]')).length === 3 && !!(await p.$('[data-rkadmin="poipet|Youth Education"] [data-rockedit="k2"]')));
  await p.click('[data-rockst="k2|on"]'); await p.waitForTimeout(400);
  ok('a tap saves that rock by its id — its place is the server’s to keep', saves.length === 1 && saves[0].id === 'k2' && saves[0].status === 'on' && saves[0].campus === undefined && saves[0].dept === undefined, saves[0]);
  await p.click('[data-rockedit="k2"]'); await p.waitForTimeout(300);
  ok('Edit opens the form in the rock’s place', !!(await p.$('[data-rkadmin="poipet|Youth Education"] #rkForm')) && await p.$eval('[data-rkf="title"]', i => i.value) === 'A different department’s rock');
  await p.fill('[data-rkf="title"]', 'Renamed by an admin');
  await p.click('#rkSave'); await p.waitForTimeout(400);
  ok('… and saves the new title', saves.length === 2 && saves[1].id === 'k2' && saves[1].title === 'Renamed by an admin' && (await text(p)).includes('Renamed by an admin'));
  /* a new rock for any campus and department */
  await p.selectOption('#rkAdmCampus', 'siemreap'); await p.waitForTimeout(300);
  const depts = await p.$$eval('#rkAdmDept option', o => o.map(x => x.value));
  ok('there is a campus and department picker, Campus Leadership included', depts.includes('Skills Training') && depts.includes('Campus Leadership'), depts.join());
  await p.selectOption('#rkAdmDept', 'Skills Training');
  await p.fill('#rkAdmTitle', 'A rock added for Siem Reap');
  await p.evaluate(() => render()); await p.waitForTimeout(100);
  ok('typing already in the box stays put through a redraw', await p.$eval('#rkAdmTitle', i => i.value) === 'A rock added for Siem Reap' && await p.$eval('#rkAdmCampus', s => s.value) === 'siemreap');
  await p.click('#rkAdmAdd'); await p.waitForTimeout(400);
  const last = saves[saves.length - 1];
  ok('and it saves for the campus and department picked, this quarter', saves.length === 3 && last.campus === 'siemreap' && last.dept === 'Skills Training' && last.ministry === '' && last.title === 'A rock added for Siem Reap' && last.year === Y && last.q === Q, last);
  ok('its group opens to show it', (await text(p)).includes('A rock added for Siem Reap'));
  ok('nothing here says OKR, objective or key result', !/OKR|[Oo]bjective|[Kk]ey result/.test(await text(p)));
  ok('admin: no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await p.close();
}
await browser.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
