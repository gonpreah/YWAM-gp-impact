/* GPDTS in the browser (Nov 2026, Andrew). My Ministry → GPDTS: the school's own tabs (Dashboard ·
   This school · Lectures · Outreach · Numbers), the pipeline counts and the follow-ups due opening
   the portal, marking students graduated together and as potential staff, a lecture added, the
   Outreach placeholder, and the Numbers tab with no boxes for what counts itself. Then the portal's
   staff side for a DTS staff member: only the DTS tab, "You see: DTS", ＋ Add a contact, Follow-ups
   due, a contact with no account (the link to apply, their details), and logging a contact with
   how. Admin → Portal access: the "Sees" line and changing it. */
import { PUBLIC, tmpDir, CHROMIUM } from './env.mjs';
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
const PORT = 4521;
await new Promise(res => srv.listen(PORT, res));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const TODAY = ymd(new Date()), YDAY = ymd(new Date(Date.now() - 86400000)), INWEEK = ymd(new Date(Date.now() + 14 * 86400000));

const ME = { id: 'st_dee', name: 'Dee Teesse', username: 'dee', campus: 'siemreap', dept: 'Leadership Development', ministry: 'GPDTS', role: '', photo: '', mentorId: '', isAdmin: false, portal: true, ministries: [] };
let SCHOOL = [{ id: 'c_ar', name: 'Arno Here', country: 'Germany', audience: 'international', arrived: TODAY, graduated: '', potentialStaff: '' },
  { id: 'c_ar2', name: 'Bopha Here', country: 'Cambodia', audience: 'khmer', arrived: TODAY, graduated: '', potentialStaff: '' }];
let LECTS = [], OUTS = [], PAST = {};
const marks = [], lectSaves = [], outSaves = [], pastSaves = [], toStaff = [];
const board = () => ({
  ok: true, campus: 'siemreap', ministry: 'GPDTS', today: TODAY, portal: true,
  counts: { lead: { khmer: 2, international: 1 }, contacted: { khmer: 1, international: 0 }, applied: { khmer: 1, international: 0 }, accepted: { khmer: 0, international: 1 }, arrived: { khmer: 1, international: 1 }, graduated: { khmer: 0, international: 0 } },
  due: [{ id: 'c_kh', name: 'Sokha Khmer', audience: 'khmer', nextStep: 'Call her pastor', nextDate: YDAY, column: 'applied' }], dueMore: 0,
  school: SCHOOL, lectures: LECTS, outreaches: OUTS, past: PAST, year: Number(TODAY.slice(0, 4)),
  data: { ok: true, campus: 'siemreap', dept: 'Leadership Development', ministry: 'GPDTS', entries: { 'Students Applied': { '1': 2, '2': 3 }, 'Students Enrolled': { '1': 4, '2': 6, '3': 5 }, 'Healings': { '1': 3 }, 'Salvations': { '2': 2 } }, prev: {}, daily: {} }
});

const b = await chromium.launch({ executablePath: CHROMIUM });
const errs = [];
const page = async (vp) => {
  const p = await b.newPage({ viewport: vp || { width: 400, height: 900 } });
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CONN|ERR_CERT|404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  return p;
};

/* ---------- the GP app ---------- */
const p = await page();
await p.route('**/.netlify/functions/api', r => {
  const q = JSON.parse(r.request().postData() || '{}');
  let o = { ok: true };
  if (q.fn === 'getMyBoot') o = { ok: true, staff: ME, profile: { email: 'x@example.com' }, roster: [ME], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [],
    ministry: { ok: true, campus: 'siemreap', dept: 'Leadership Development', ministry: 'GPDTS', entries: { 'Students Applied': { '1': 2 } }, prev: {}, daily: {} },
    trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [], base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [], roster: [] } };
  else if (q.fn === 'dtsBoard') o = board();
  else if (q.fn === 'dtsMark') {
    marks.push(q.args.slice(2));
    const [ids, m] = q.args.slice(2);
    SCHOOL = SCHOOL.map(x => ids.includes(x.id) ? { ...x, graduated: m.graduated !== undefined ? m.graduated : x.graduated, potentialStaff: m.potentialStaff !== undefined ? (m.potentialStaff ? TODAY : '') : x.potentialStaff } : x);
    o = { ...board(), changed: ids.length };
  } else if (q.fn === 'dtsToStaff') { toStaff.push(q.args[2]); SCHOOL = SCHOOL.map(x => q.args[2].includes(x.id) ? { ...x, staffCand: { id: 'cd_st', stage: 'new', hired: false } } : x); o = { ...board(), moved: 1 }; }
  else if (q.fn === 'dtsSaveOutreach') { outSaves.push(q.args[2]); OUTS = [{ ...q.args[2], id: 'ot1' }]; o = { ok: true, outreaches: OUTS, id: 'ot1' }; }
  else if (q.fn === 'dtsSavePast') { pastSaves.push(q.args.slice(2)); PAST = { [q.args[2]]: { values: q.args[3], notes: q.args[4] } }; o = { ok: true, past: PAST }; }
  else if (q.fn === 'dtsSaveLecture') { lectSaves.push(q.args[2]); LECTS = [{ ...q.args[2], id: 'lc1' }]; o = { ok: true, lectures: LECTS, id: 'lc1' }; }
  else if (q.fn === 'teamRoster') o = [ME];
  else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
});
await p.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'dee', pin: '1234' })));
await p.goto(`http://localhost:${PORT}/teams.html`); await p.waitForSelector('nav.bottom button', { timeout: 15000 });
await p.waitForTimeout(600);
await p.click('nav.bottom [data-tab="ministry"]'); await p.waitForTimeout(800);
const tabs = await p.$$eval('.mmTabs .gtTab', b => b.map(x => x.getAttribute('data-mmtab')));
ok('GPDTS has its own tabs: Dashboard, This school, Lectures, Outreach, Tasks, OKRs — no Numbers tab', JSON.stringify(tabs) === '["dtsdash","dtsclass","dtslect","dtsout","tasks","okr"]', JSON.stringify(tabs));
ok('it opens on the Dashboard: where everyone is', !!(await p.$('#dtsPipe')) && /Reaching out/.test(await p.$eval('#dtsPipe', e => e.textContent)));
ok('each step says Khmer and international', (await p.$eval('[data-dtscol="lead"]', e => e.textContent)).includes('2 Khmer · 1 intl'));
ok('the follow-up due opens that record in the portal', (await p.getAttribute('[data-dtsdue="c_kh"]', 'href')) === 'portal.html?open=c_kh' && /Call her pastor/.test(await p.$eval('#dtsDue', e => e.textContent)));
ok('a way into the DTS list in the portal', (await p.getAttribute('#dtsOpenPortal', 'href')) === 'portal.html?what=dts');
ok('the school by year: student tiles (applied summed, enrolled the most at once)', (await p.$eval('[data-dtsm="Students Applied"] .mmTileNum', e => e.textContent)) === '5' && (await p.$eval('[data-dtsm="Students Enrolled"] .mmTileNum', e => e.textContent)) === '6');
ok('and what God did beside them, with where it came from', (await p.$eval('[data-dtsm="Healings"] .mmTileNum', e => e.textContent)) === '3' && /Lectures 0 · Outreach 0/.test(await p.$eval('[data-dtsm="Healings"]', e => e.textContent)));
await p.click('#dtsPastAdd'); await p.waitForTimeout(200);
const LASTY = Number(TODAY.slice(0, 4)) - 1;
await p.fill('#dp_year', String(LASTY)); await p.fill('[data-dpv="Students Applied"]', '14'); await p.fill('[data-dpv="Salvations"]', '7'); await p.fill('#dp_notes', 'Thailand');
await p.click('#dtsPastSave'); await p.waitForTimeout(400);
ok('Add a past year: its totals are saved', pastSaves.length === 1 && pastSaves[0][0] === LASTY && String(pastSaves[0][1]['Students Applied']) === '14' && pastSaves[0][2] === 'Thailand', JSON.stringify(pastSaves));
ok('it opens on that year, with a chip for it', (await p.$eval('[data-dtsyear="' + LASTY + '"]', e => e.classList.contains('on'))) && (await p.$eval('[data-dtsm="Salvations"] .mmTileNum', e => e.textContent)) === '7');
ok('and a year-by-year table', !!(await p.$('#dtsYears')) && (await p.$$eval('#dtsYears thead th', h => h.length)) === 3);

await p.click('[data-mmtab="dtsclass"]'); await p.waitForTimeout(300);
ok('This school lists who is here', (await p.$$('[data-dtsstu]')).length === 2);
await p.check('#dtsSelAll'); await p.waitForTimeout(250);
ok('select all → one Graduated button for both', /Graduated \(2\)/.test(await p.$eval('#dtsMarkGrad', e => e.textContent)));
await p.click('#dtsMarkGrad'); await p.waitForTimeout(500);
ok('it marks them graduated together, today', marks.length === 1 && marks[0][0].length === 2 && marks[0][1].graduated === TODAY, JSON.stringify(marks));
ok('and shows it', (await p.$$('.dtsStu.grad')).length === 2);
await p.click('[data-dtsstaff="c_ar"]'); await p.waitForTimeout(400);
ok('⭐ marks potential staff', marks.length === 2 && marks[1][1].potentialStaff === true && await p.$eval('[data-dtsstaff="c_ar"]', e => e.classList.contains('on')));
ok('a graduate marked potential staff can start their staff application', !!(await p.$('[data-dtstostaff="c_ar"]')) && !(await p.$('[data-dtstostaff="c_ar2"]')));
p.once('dialog', d => d.accept());
await p.click('[data-dtstostaff="c_ar"]'); await p.waitForTimeout(400);
ok('it starts it, and the row says where it is', toStaff.length === 1 && toStaff[0][0] === 'c_ar' && /Staff application · New inquiry/.test(await p.$eval('[data-dtspipe="c_ar"]', e => e.textContent)));

await p.click('[data-mmtab="dtslect"]'); await p.waitForTimeout(300);
ok('Lectures: nothing planned, and the budget to come', /No lectures planned yet/.test(await p.$eval('#dtsLectList', e => e.textContent)) && !!(await p.$('#dtsBudget')));
await p.click('#dtsLectAdd'); await p.waitForTimeout(200);
await p.fill('#dl_date', INWEEK); await p.fill('#dl_topic', 'The Father heart of God'); await p.fill('#dl_speaker', 'A Speaker'); await p.check('#dl_confirmed');
await p.fill('[data-dlf="gospel"]', '20'); await p.fill('[data-dlf="healings"]', '1');
await p.click('#dtsLectSave'); await p.waitForTimeout(400);
ok('a lecture is saved with its day, topic, speaker, confirmed and what God did', lectSaves.length === 1 && lectSaves[0].date === INWEEK && lectSaves[0].topic === 'The Father heart of God' && lectSaves[0].confirmed === true && String(lectSaves[0].fruit.gospel) === '20' && String(lectSaves[0].fruit.healings) === '1', JSON.stringify(lectSaves));
ok('and listed under Coming up', /The Father heart of God/.test(await p.$eval('#dtsLectList', e => e.textContent)));

await p.click('[data-mmtab="dtsout"]'); await p.waitForTimeout(250);
ok('Outreach: nothing yet, and a way to add a team', !!(await p.$('#dtsOutList')) && !!(await p.$('#dtsOutAdd')) && !!(await p.$('#dtsOutBudget')));
await p.click('#dtsOutAdd'); await p.waitForTimeout(200);
await p.fill('#do_place', 'Mondulkiri'); await p.fill('#do_from', TODAY); await p.fill('#do_leaders', 'Lee');
await p.click('#dtsOutAddRep'); await p.waitForTimeout(200);
await p.fill('[data-dor="0|gospel"]', '30'); await p.fill('[data-dor="0|baptisms"]', '4');
await p.click('#dtsOutSave'); await p.waitForTimeout(500);
ok('an outreach is saved with its report', outSaves.length === 1 && outSaves[0].place === 'Mondulkiri' && outSaves[0].reports.length === 1 && String(outSaves[0].reports[0].fruit.gospel) === '30' && String(outSaves[0].reports[0].fruit.baptisms) === '4', JSON.stringify(outSaves));
ok('and listed with its numbers', /Mondulkiri/.test(await p.$eval('#dtsOutList', e => e.textContent)) && /📣 30/.test(await p.$eval('#dtsOutList', e => e.textContent)));
ok('no page errors in the GP app', errs.length === 0, errs.slice(0, 3).join(' | '));
await p.close();

/* ---------- the portal, as a DTS staff member ---------- */
const STAFF = [{ id: 'st_dee', name: 'Dee Teesse', username: 'dee', campus: 'siemreap', isAdmin: false, portalAdmin: false, portalStaff: false, role: 'portal-staff' }];
const base = { campus: 'siemreap', school: 'dts', type: 'student', messenger: 'whatsapp', assignedTo: '', log: [], archived: null, steps: [], docKinds: [], reference: { status: 'none' }, updated: '2026-11-01T10:00:00Z' };
let CANDS = [
  { ...base, id: 'c_kh', name: 'Sokha Khmer', stage: 'applied', status: 'pending', audience: 'khmer', country: 'Cambodia', email: 'sokha@example.org', phone: '+855 12 000 000', nextStep: 'Call her pastor', nextDate: YDAY, hasAccount: true, staffId: 'ap1', portal: { submittedAt: '2026-11-01T10:00:00Z' } },
  { ...base, id: 'c_lead', name: 'Lena Lead', stage: 'contacted', status: 'in_review', audience: 'international', country: 'Norway', email: 'lena@example.org', phone: '', nextStep: '', nextDate: '', hasAccount: false, staffId: '', portal: null, source: 'A church', calls: [] },
];
const saves = [], callsLogged = [];
const pp = await page({ width: 1200, height: 900 });
await pp.route('**/.netlify/functions/api', r => {
  const q = JSON.parse(r.request().postData() || '{}');
  let o = { ok: true };
  if (q.fn === 'portalBoot') o = { ok: true, role: 'portal-staff', me: STAFF[0], applicants: CANDS, staff: STAFF, scope: ['student:dts'], gpdts: true, stages: ['new', 'contacted', 'applied', 'interview', 'accepted', 'practical', 'arrived'], teamStages: ['new', 'applied', 'call1', 'docs', 'call2', 'practical', 'arrived'], types: ['student', 'staff', 'volunteer', 'team'], schools: ['dts', 'dbs', 'bcs', 'sms'] };
  else if (q.fn === 'portalAuthConfig') o = { ok: true, google: false };
  else if (q.fn === 'hrSaveCandidate') {
    saves.push(q.args[2]);
    const c = { ...base, ...q.args[2], id: q.args[2].id || 'c_new', status: 'draft', audience: q.args[2].country === 'Cambodia' ? 'khmer' : 'international', hasAccount: false, portal: null, calls: [] };
    CANDS = CANDS.filter(x => x.id !== c.id).concat([c]); o = { ok: true, candidate: c };
  } else if (q.fn === 'hrCandidateCall') {
    callsLogged.push(q.args[3]);
    CANDS = CANDS.map(x => x.id === q.args[2] ? { ...x, calls: (x.calls || []).concat([{ ...q.args[3], id: 'cl1', by: 'st_dee', at: '2026-11-11T01:00:00Z' }]) } : x);
    o = { ok: true, candidate: CANDS.find(x => x.id === q.args[2]) };
  }
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
});
await pp.addInitScript(() => localStorage.setItem('gp-portal', JSON.stringify({ user: 'dee', pin: '1234' })));
await pp.goto(`http://localhost:${PORT}/portal.html?what=dts`);
await pp.waitForSelector('[data-whatfilter]', { timeout: 15000 });
const whats = await pp.$$eval('[data-whatfilter]', b => b.map(x => x.getAttribute('data-whatfilter')));
ok('a DTS staff member gets only the DTS tab', JSON.stringify(whats) === '["dts"]', JSON.stringify(whats));
ok('and is told what they see', /You see: DTS/.test(await pp.$eval('.panelHead .sub', e => e.textContent)));
ok('a button back to GPDTS on My Ministry', (await pp.getAttribute('#toGpdts', 'href')) === 'teams.html?view=gpdts');
ok('the next step shows under a name, late ones marked', /Call her pastor/.test(await pp.$eval('[data-open="c_kh"]', e => e.textContent)) && !!(await pp.$('[data-open="c_kh"] .nextStep.late')));
await pp.click('[data-filter="due"]'); await pp.waitForTimeout(250);
ok('Follow-ups due lists only who is due', JSON.stringify(await pp.$$eval('[data-open]', b => b.map(x => x.getAttribute('data-open')))) === '["c_kh"]');
await pp.click('[data-filter=""]'); await pp.waitForTimeout(200);

await pp.click('#addLead'); await pp.waitForTimeout(250);
ok('＋ Add a contact opens a short form, on DTS', !!(await pp.$('#leadCard')) && (await pp.$eval('#ld_kind', s => s.value)) === 'dts');
await pp.fill('#ld_name', 'New Person'); await pp.fill('#ld_phone', '+855 99 000 000'); await pp.fill('#ld_email', 'new@example.org');
await pp.fill('#ld_next', 'Message after Sunday'); await pp.fill('#ld_date', INWEEK);
await pp.click('#saveLead'); await pp.waitForTimeout(600);
ok('it saves a DTS contact at New with the next step', saves.length === 1 && saves[0].type === 'student' && saves[0].school === 'dts' && saves[0].stage === 'new' && saves[0].nextDate === INWEEK && saves[0].email === 'new@example.org', JSON.stringify(saves[0]));
ok('and opens them on Contacts, ready to log how you reached them', !!(await pp.$('#callForm')) && !!(await pp.$('[data-callhow="message"].on')));
await pp.click('[data-callhow="call"]'); await pp.fill('#call_text', 'Talked about the next school'); await pp.click('#saveCall'); await pp.waitForTimeout(500);
ok('a logged contact carries how', callsLogged.length === 1 && callsLogged[0].method === 'call' && callsLogged[0].text === 'Talked about the next school', JSON.stringify(callsLogged));
ok('and shows with its icon', /📞/.test(await pp.$eval('#callList', e => e.textContent)));

await pp.click('[data-open="c_lead"]'); await pp.waitForTimeout(400);
await pp.click('[data-ptab="overview"]').catch(() => {}); await pp.waitForTimeout(200);
ok('a contact with no account: the link to the DTS application', /\?apply=dts$/.test(await pp.$eval('#leadLinkBox', e => e.value)) && /lena@example.org/.test(await pp.$eval('#leadBox', e => e.textContent)));
await pp.click('#editLeadBtn'); await pp.waitForTimeout(200);
await pp.fill('#le_phone', '+47 400 00 000'); await pp.click('#saveLeadEdit'); await pp.waitForTimeout(500);
ok('and their details can be corrected', saves.length === 2 && saves[1].id === 'c_lead' && saves[1].phone === '+47 400 00 000', JSON.stringify(saves[1]));
ok('every record has Contacts (not only teams)', !!(await pp.$('[data-ptab="calls"]')));
ok('no page errors in the portal', errs.length === 0, errs.slice(0, 3).join(' | '));
await pp.close();

/* ---------- the portal: Add to the GP app, and the person on staff now ---------- */
{
  const STAFF2 = [{ id: 'st_hr', name: 'Hana HR', username: 'hana', campus: 'siemreap', isAdmin: false, portalAdmin: true, portalStaff: true, role: 'portal-admin' }];
  const base2 = { campus: 'siemreap', school: '', type: 'staff', messenger: 'whatsapp', assignedTo: '', log: [], archived: null, steps: [], docKinds: [], reference: { status: 'none' }, updated: '2026-11-01T10:00:00Z' };
  let C2 = [{ ...base2, id: 'cd_st', name: 'Arno Here', stage: 'accepted', status: 'accepted', audience: 'international', country: 'Germany', email: 'arno@example.org', phone: '+49 1', hasAccount: true, staffId: 'ap_arno', portal: { submittedAt: '2026-11-01T10:00:00Z' }, fromDts: 'c_ar' }];
  const adds = [];
  const ph = await page({ width: 1200, height: 900 });
  await ph.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}');
    let o = { ok: true };
    if (q.fn === 'portalBoot') o = { ok: true, role: 'portal-admin', me: STAFF2[0], applicants: C2, staff: STAFF2, scope: null, stages: ['new', 'contacted', 'applied', 'interview', 'accepted', 'practical', 'arrived'], teamStages: [], types: ['student', 'staff', 'volunteer', 'team'], schools: ['dts'] };
    else if (q.fn === 'portalAuthConfig') o = { ok: true, google: false };
    else if (q.fn === 'portalGpAdd') { adds.push(q.args.slice(2)); C2 = C2.map(c => ({ ...c, hired: { at: '2026-11-11T02:00:00Z' }, stage: 'arrived' })); o = { ok: true, candidate: C2[0], signIn: 'google' }; }
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  await ph.addInitScript(() => localStorage.setItem('gp-portal', JSON.stringify({ user: 'hana', pin: '1234' })));
  await ph.goto(`http://localhost:${PORT}/portal.html?what=staff`);
  await ph.waitForSelector('[data-open="cd_st"]', { timeout: 15000 });
  await ph.click('[data-open="cd_st"]'); await ph.waitForTimeout(400);
  ok('an accepted staff application has Add to the GP app, saying they keep their sign-in', !!(await ph.$('#gpAddBox')) && /no username or PIN/.test(await ph.$eval('#gpAddBox', e => e.textContent)));
  ok('it says they came from GPDTS', !!(await ph.$('#fromDts')));
  await ph.selectOption('#ga_dept', 'Leadership Development'); await ph.waitForTimeout(250);
  await ph.selectOption('#ga_min', 'GPDTS');
  ph.once('dialog', d => d.accept());
  await ph.click('#gpAddBtn'); await ph.waitForTimeout(600);
  ok('Add to the GP app sends where they will serve', adds.length === 1 && adds[0][0] === 'cd_st' && adds[0][1].dept === 'Leadership Development' && adds[0][1].ministry === 'GPDTS', JSON.stringify(adds));
  ok('then the record says they are in the GP app', !!(await ph.$('#gpAdded')));
  await ph.close();

  const pn = await page();
  await pn.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}');
    const o = q.fn === 'portalBoot' ? { ok: false, err: 'staff_now', name: 'Arno Here' } : q.fn === 'portalAuthConfig' ? { ok: true, google: false } : { ok: false };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  await pn.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('gp-portal', JSON.stringify({ user: 'arno@example.org', pin: 'ab'.repeat(24) })); } });
  await pn.goto(`http://localhost:${PORT}/portal.html`);
  await pn.waitForSelector('#staffNow', { timeout: 15000 });
  ok('someone now on staff sees “Welcome to the YWAM GP staff” in the portal', /Welcome to the YWAM GP staff/.test(await pn.$eval('#staffNow', e => e.textContent)));
  await Promise.all([pn.waitForURL(/teams\.html/, { timeout: 10000 }).catch(() => {}), pn.click('#openGpApp')]);
  ok('Open the GP app carries the same sign-in over', /teams\.html/.test(pn.url()) && JSON.parse(await pn.evaluate(() => localStorage.getItem('gp-staff')) || '{}').user === 'arno@example.org');
  await pn.close();
}

/* ---------- the GP app: Continue with Google, and the step off PINs ---------- */
{
  const pl = await page();
  await pl.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}');
    const o = q.fn === 'portalAuthConfig' ? { ok: true, google: 'cid.apps.googleusercontent.com' } : q.fn === 'teamRoster' ? [] : { ok: true };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  await pl.goto(`http://localhost:${PORT}/teams.html`);
  await pl.waitForSelector('#googleLogin', { timeout: 15000 });
  ok('with Google on, the sign-in screen is Continue with Google — no PIN boxes', /Continue with Google/.test(await pl.$eval('#googleLogin', e => e.textContent)) && !(await pl.$('#li_user')));
  await pl.click('#showPinLogin'); await pl.waitForTimeout(250);
  ok('the username and PIN are only behind “first time with Google”', !!(await pl.$('#li_user')) && (await pl.getAttribute('#li_pin', 'maxlength')) === '200' && !!(await pl.$('#hidePinLogin')));
  await pl.click('#hidePinLogin'); await pl.waitForTimeout(250);
  await pl.click('#toReg'); await pl.waitForTimeout(300);
  ok('sign-up offers Sign up with Google', !!(await pl.$('#googleSignup')));
  await pl.close();

  const pg = await page();
  const ME2 = { ...ME, google: false, signIn: 'pin' };
  await pg.route('**/.netlify/functions/api', r => {
    const q = JSON.parse(r.request().postData() || '{}');
    let o = { ok: true };
    if (q.fn === 'getMyBoot') o = { ok: true, googleId: 'cid.apps.googleusercontent.com', staff: ME2, profile: { email: 'dee@example.org' }, roster: [ME2], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [], ministry: null, trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [], base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [], roster: [] } };
    else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  });
  await pg.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'dee', pin: '1234' })));
  await pg.goto(`http://localhost:${PORT}/teams.html`);
  await pg.waitForSelector('#gglStep', { timeout: 15000 });
  ok('signed in with a PIN, the first thing is “From now on, sign in with Google”', /From now on, sign in with Google/.test(await pg.$eval('#gglStep', e => e.textContent)) && !!(await pg.$('#gglStepGo')) && /dee@example.org/.test(await pg.$eval('#gglStep', e => e.textContent)));
  ok('there is no “Not now” — only connect, or log out', !(await pg.$('#gglStepLater')) && !!(await pg.$('#gglStepOut')));
  await pg.click('nav.bottom [data-tab="team"]').catch(() => {}); await pg.waitForTimeout(300);
  ok('nothing else opens until Google is connected', !!(await pg.$('#gglStep')));
  await pg.evaluate(() => { S.me.google = true; S.me.signIn = 'pin'; S.view = 'profile'; render(); }); await pg.waitForTimeout(300);
  ok('once connected, Profile & settings says they sign in with Google', /With Google/.test(await pg.$eval('#signInCard', e => e.textContent)));
  await pg.close();
}

/* ---------- Admin → Portal access: Sees ---------- */
const ADM = { id: 'st_admin', name: 'Admin Person', username: 'admin', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', isAdmin: true, role: '', photo: '', mentorId: '' };
let LIST = [{ ...ADM, active: true, portal: true, portalSees: null, portalScope: null },
  { id: 'st_dee', name: 'Dee Teesse', username: 'dee', campus: 'siemreap', dept: 'Leadership Development', ministry: 'GPDTS', active: true, portal: true, portalSees: ['student:dts'], portalScope: null },
  { id: 'st_cal', name: 'Cal Fay', username: 'cal', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, portal: false, portalSees: [], portalScope: null },
  { id: 'st_new', name: 'Nia New', username: 'nia', campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: false, portal: false, portalSees: [], portalScope: null }];
const dels = [];
const upd = [];
const pa = await page();
await pa.route('**/.netlify/functions/api', r => {
  const q = JSON.parse(r.request().postData() || '{}');
  let o = { ok: true };
  if (q.fn === 'getMyBoot') o = { ok: true, staff: ADM, profile: {}, roster: [ADM], logs: [], habits: null, mentees: [], mentorRequests: [], goals: [], checkins: [], ministry: null, trips: { ok: true, trips: [], totals: {}, ptoCap: 30 }, tripRequests: [], oneOnOnes: [], base: { leader: false, entries: { siemreap: {} }, okrs: [], survey: [], roster: [] } };
  else if (q.fn === 'adminListStaff') o = { ok: true, staff: LIST };
  else if (q.fn === 'adminUpdateStaff') {
    upd.push(q.args[3]);
    const sc = q.args[3].portalScope;
    LIST = LIST.map(x => x.id === q.args[2] ? { ...x, portalScope: sc === null ? null : sc === 'all' ? ['all'] : sc, portalSees: sc === 'all' ? null : sc === null ? x.portalSees : sc, portal: true } : x);
    o = { ok: true, staff: LIST.find(x => x.id === q.args[2]) };
  } else if (q.fn === 'adminDeleteStaff') { dels.push(q.args[2]); LIST = LIST.filter(x => x.id !== q.args[2]); o = { ok: true }; }
  else if (/^getMy/.test(q.fn)) o = { ok: true, logs: [], goals: [], checkins: [], mentees: [], requests: [] };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
});
await pa.addInitScript(() => localStorage.setItem('gp-staff', JSON.stringify({ user: 'admin', pin: '1234' })));
await pa.goto(`http://localhost:${PORT}/teams.html`); await pa.waitForSelector('nav.bottom button', { timeout: 15000 });
await pa.waitForTimeout(500);
await pa.evaluate(() => { S.view = 'admin'; S.adminSub = 'portal'; S.adminStaff = null; render(); });
await pa.waitForSelector('[data-portalsees="st_dee"]', { timeout: 8000 }).catch(() => {});
ok('Admin → Portal access says what a school’s staff member sees, and why', /Sees: DTS/.test(await pa.$eval('[data-portalsees="st_dee"]', e => e.textContent).catch(() => '')) && /from their ministry/.test(await pa.$eval('[data-portalsees="st_dee"]', e => e.textContent).catch(() => '')));
await pa.click('[data-portalscopeopen="st_dee"]'); await pa.waitForTimeout(200);
await pa.click('[data-portalscope="st_dee|student:dbs"]'); await pa.waitForTimeout(400);
ok('adding DBS sends DTS and DBS', upd.length === 1 && JSON.stringify(upd[0].portalScope) === '["student:dts","student:dbs"]', JSON.stringify(upd));
ok('and it now says set by an admin', /set by an admin/.test(await pa.$eval('[data-portalsees="st_dee"]', e => e.textContent)));
await pa.click('[data-portalscope="st_dee|auto"]'); await pa.waitForTimeout(400);
ok('“From their ministry” clears it', upd.length === 2 && upd[1].portalScope === null);
ok('someone with no portal can be given it here', !!(await pa.$('[data-portalscopeopen="st_cal"]')));
await pa.evaluate(() => { S.adminSub = 'approvals'; render(); }); await pa.waitForTimeout(300);
ok('a new account waits in Approvals with Approve and Decline', !!(await pa.$('[data-adminapprove="st_new"]')) && !!(await pa.$('[data-admindecline="st_new"]')));
pa.once('dialog', d => d.accept());
await pa.click('[data-admindecline="st_new"]'); await pa.waitForTimeout(400);
ok('Decline removes it', dels.length === 1 && dels[0] === 'st_new' && !(await pa.$('[data-adminapprove="st_new"]')));
ok('no page errors in Admin', errs.length === 0, errs.slice(0, 3).join(' | '));

await b.close(); srv.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
