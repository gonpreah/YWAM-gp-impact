/* portal.html → ☰ → Import applications, in the browser (Nov 2026). A made-up
   CSV in the shape of the base's GP DTS Application Google Form sheet (bilingual
   headings, a Khmer + English answer for sex, "គ្មាន/No", phone numbers that lost
   their leading 0, a heading-less column): every column is matched to the right
   DTS question, the guardian's relationship is kept as a note, the preview names
   each person, Import sends cleaned rows to portalImportApplications, and the
   result opens the record — which shows the imported note and the leftovers.
   The API is mocked; every person is made up. */
import { REPO, PUBLIC, CHROMIUM } from './env.mjs';
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const FORMS = (await import(REPO + '/netlify/functions/portal-forms-default.js')).default;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(4497, r));
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}

const H = ['Timestamp', 'នាមខ្លួន\nFirst Name', 'នាមត្រកូល\nLast Name', 'នាមត្រកូល&នាមខ្លួនជាអក្សរឡាតាំង (Khmer only)', 'ភេទ \nSex',
  'ថ្ងៃខែឆ្នាំកំណើត (ខែ/ថ្ងៃទី/ឆ្នាំ) \nDate of birth (M/D/Y)', 'ភូមិ \nStreet Address', 'ស្រុក/ក្រុង \nCity', 'ខេត្ត \nState', 'លេខទូរស័ព្ទ\nPhone Number',
  'អ៊ីមែល (បើមាន) \nEmail ', 'ស្ថានភាពគ្រួសារ \nMarital Status', "ឈ្មោះអាណាព្យាបាល \nParent or Guardian's Name", 'លេខទូរស័ព្ទអាណាព្យាបាល \nPhone Number ',
  'តើគាត់ត្រូវជាអ្វីនិងអ្នក? \nWhat is their relationship to you?', "ឈ្មោះ មិត្តភក្តិ \nFriend's Name", "លេខទូរស័ព្ទ មិត្តភក្តិ \nFriend's Phone Number",
  ' ហេតុអ្វីបានជាអ្នកចង់រៀនDTS? \nWhy do you want to study DTS',
  'តម្លៃសិក្សា​គឺ ៦២០ដុល្លា តើអ្នកមានលិទ្ធភាពគ្រប់គ្រាន់ក្នុងការបង់ថ្លៃសិក្សាដែរឬទេ?\nThe price for a DTS lecture is $2000 USD. Do you have the funds to cover this cost?',
  'Favourite colour', ''];
const R1 = ['2026/06/30 7:40:00 PM GMT+7', 'Dara', 'Example', 'EXAMPLE DARA', 'ប្រុស Male', '2007-05-14', 'Village', 'Town', 'Province', '12345678',
  'dara@example.org', 'នៅ​លីវ Single', 'Mum Example', '87654321', 'ម្តាយ', 'Friend Example', '011223344', 'To grow, "really" grow,\nand serve', 'គ្មាន/No', 'Blue', 'stray'];
const R2 = ['2026/09/10 11:20:00 AM GMT+7', '', 'សុខា', 'SOKHA SAMPLE', 'ស្រី Female', '21/3/2007', 'V2', 'T2', 'P2', '077 000 111', '', 'នៅ​លីវ Single', 'Dad Sample', '099887766',
  'ប៉ា', '', '', 'Because', 'មាន/Yes', '', ''];
const q = (v) => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
const CSV = '﻿' + [H, R1, R2].map(r => r.map(q).join(',')).join('\r\n') + '\r\n';

const ME = { id: 'st_sina', name: 'Sina Sok', username: 'sina', campus: 'siemreap', role: 'portal-admin' };
let CANDS = [];
const IMPORTED = { id: 'cd_imp1', campus: 'siemreap', name: 'Dara Example', type: 'student', school: 'dts', stage: 'applied', status: 'pending', email: 'dara@example.org', phone: '012345678', messenger: '', country: 'Cambodia', source: 'Imported from a spreadsheet',
  assignedTo: '', nextStep: '', nextDate: '', staffId: '', hasAccount: false, refNeeded: false, reference: { status: 'none' }, updated: '2026-11-12T10:00:00Z', log: [], archived: null, audience: 'khmer', needsVisa: false, formKey: 'dts', docKinds: [], steps: [],
  portal: { createdAt: '2026-06-30T12:40:00.000Z', submittedAt: '2026-06-30T12:40:00.000Z', imported: { at: '2026-11-12T10:00:00Z', by: 'st_sina', file: 'dts.csv' },
    form: { answers: { firstName: 'Dara', lastName: 'Example', whyDts: 'To grow' }, extra: [{ label: 'Parent or guardian — how they are related', value: 'ម្តាយ' }, { label: 'Favourite colour', value: 'Blue' }] } } };
const sent = [];
const errors = [];
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
await ctx.route('**fonts.googleapis.com/**', r => r.abort());
await ctx.route('**accounts.google.com/**', r => r.abort());
await ctx.route('**/.netlify/functions/api', r => {
  const b = JSON.parse(r.request().postData() || '{}'); sent.push(b); let out = { ok: false };
  if (b.fn === 'portalBoot') out = { ok: true, role: 'portal-admin', me: ME, applicants: CANDS, scope: null, staff: [ME], stages: ['new', 'contacted', 'applied', 'interview', 'accepted', 'practical', 'arrived'], teamStages: [], types: ['student', 'staff', 'volunteer', 'team'], schools: ['dts', 'dbs', 'bcs', 'sms'], forms: FORMS };
  else if (b.fn === 'portalImportApplications') { CANDS = [IMPORTED]; out = { ok: true, added: [{ id: 'cd_imp1', name: 'Dara Example' }], skipped: [{ row: 2, name: 'SOKHA SAMPLE', why: 'exists', with: 'Sokha Sample' }] }; }
  else if (b.fn === 'portalAuthConfig') out = { ok: true, google: false };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
});
await page.addInitScript(() => localStorage.setItem('gp-portal', JSON.stringify({ user: 'sina', pin: '1234' })));
await page.goto('http://localhost:4497/portal.html');
await page.waitForSelector('#navMenu');
await page.click('#navMenu');
ok('the staff menu has Import applications', !!(await page.$('#toImport')));
await page.click('#toImport');
await page.waitForSelector('#impFile');
ok('the page says what it does and asks for the school (DTS chosen) and a CSV', /Import applications/.test(await page.textContent('main')) && await page.$eval('[data-impschool="dts"]', b => b.classList.contains('on')) && await page.$eval('#imp_country', s => s.value) === 'Cambodia');

await page.setInputFiles('#impFile', { name: 'GP DTS Application 2027.numbers', mimeType: 'application/octet-stream', buffer: Buffer.from('PK') });
await page.waitForTimeout(200);
ok('a Numbers file is turned away with how to make a CSV', !(await page.$('#impMap')) && /CSV/.test(await page.textContent('#msg')));

await page.setInputFiles('#impFile', { name: 'dts.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });
await page.waitForSelector('#impMap');
const map = await page.$$eval('[data-impcol]', ss => ss.map(s => s.value));
const want = ['@time', 'q:firstName', 'q:lastName', 'q:khmerName', 'q:gender', 'q:dob', 'q:street', 'q:city', 'q:state', 'q:phone', 'q:email', 'q:marital', 'q:guardianName', 'q:guardianPhone', '@guardianRel', 'q:friendName', 'q:friendPhone', 'q:whyDts', 'q:funds', '@extra', ''];
ok('every column is matched: the form questions, the second "Phone number" to the guardian, the guardian’s relationship as a note, an unknown heading kept as a note, a heading-less column left out', JSON.stringify(map) === JSON.stringify(want), JSON.stringify(map.map((m, i) => m === want[i] ? '' : i + ':' + m).filter(Boolean)));
const pv = await page.textContent('#impPreview');
ok('the preview has both people — the one with no first name by the name in Latin letters — with the day they applied', /2 applications to add/.test(pv) && /Dara Example/.test(pv) && /SOKHA SAMPLE/.test(pv) && /30 Jun 2026/.test(pv), pv.slice(0, 200));

await page.selectOption('[data-impcol="19"]', '');
await page.click('#impGo');
await page.waitForSelector('#impResult');
const call = sent.find(b => b.fn === 'portalImportApplications');
const [opts, rows] = [call.args[2], call.args[3]];
ok('it goes to portalImportApplications with the campus, school, country and file name', opts.campus === 'siemreap' && opts.school === 'dts' && opts.country === 'Cambodia' && opts.file === 'dts.csv');
ok('the timestamp becomes the day they applied (Cambodia time → UTC)', rows[0].submittedAt === '2026-06-30T12:40:00.000Z' && rows[1].submittedAt === '2026-09-10T04:20:00.000Z', rows[0].submittedAt);
ok('bilingual answers become the form’s own options: Male / Female, Single, No / Yes', rows[0].answers.gender === 'Male' && rows[1].answers.gender === 'Female' && rows[0].answers.marital === 'Single' && rows[0].answers.funds === 'No' && rows[1].answers.funds === 'Yes');
ok('phone numbers that lost their leading 0 get it back; ones written out are left as they are', rows[0].phone === '012345678' && rows[0].answers.guardianPhone === '087654321' && rows[1].phone === '077 000 111');
ok('a quoted answer with commas, quotes and a line break comes through whole; dates are kept as written', rows[0].answers.whyDts === 'To grow, "really" grow,\nand serve' && rows[1].answers.dob === '21/3/2007');
ok('the guardian’s relationship rides along as a note; a column set to Leave out does not', rows[0].extra.length === 1 && rows[0].extra[0].value === 'ម្តាយ' && /guardian/.test(rows[0].extra[0].label));
ok('name, email and phone are sent with each row', rows[0].name === 'Dara Example' && rows[0].email === 'dara@example.org' && rows[1].name === 'SOKHA SAMPLE');
const res = await page.textContent('#impResult');
ok('the result says what was added and why a row was not', /1 applications added/.test(res) && /Row 2/.test(res) && /Sokha Sample/.test(res));

await page.click('[data-impopen="cd_imp1"]');
await page.waitForSelector('#impNote');
ok('the record says it was imported and how they can take it over', /Imported from dts\.csv/.test(await page.textContent('#impNote')));
const ansTab = await page.$('[data-ptab="answers"]'); if (ansTab) await ansTab.click();
await page.waitForSelector('#impExtra');
ok('the record shows what the sheet had beyond the form', /Favourite colour/.test(await page.textContent('#impExtra')) && /ម្តាយ/.test(await page.textContent('#impExtra')));

await ctx.close();
const phone = await browser.newContext({ viewport: { width: 360, height: 740 } });
const pp = await phone.newPage();
await phone.route('**fonts.googleapis.com/**', r => r.abort());
await phone.route('**/.netlify/functions/api', r => { const b = JSON.parse(r.request().postData() || '{}'); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.fn === 'portalBoot' ? { ok: true, role: 'portal-admin', me: ME, applicants: [], scope: null, staff: [ME], stages: [], teamStages: [], types: [], schools: [], forms: FORMS } : { ok: true }) }); });
await pp.addInitScript(() => localStorage.setItem('gp-portal', JSON.stringify({ user: 'sina', pin: '1234' })));
await pp.goto('http://localhost:4497/portal.html');
await pp.waitForSelector('#navMenu'); await pp.click('#navMenu'); await pp.click('#toImport');
await pp.setInputFiles('#impFile', { name: 'dts.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') });
await pp.waitForSelector('#impMap');
ok('on a phone the page does not slide sideways', await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await pp.evaluate(() => document.documentElement.scrollWidth));

ok('no page errors', !errors.length, errors.join(' | '));
await browser.close(); server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
