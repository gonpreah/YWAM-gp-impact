/* The finance tool (api.js — getFinance, finSave, finSetCash, finMatchName, finDelete,
   finFile, finAheadSave).

   Only the Finances office (Skills Training → Finances, or an admin) saves reports.
   Campus Leadership sees the dashboard: the P&L and the burn rate in full, the staff
   debt as totals and, since Oct 2026, who owes and how much — but not the office's matching
   or the ageing PDF. Anyone
   else sees nothing. Reports are checked for shape; a P&L can carry several months; a
   newer report replaces the month and drops the old PDF; an older ageing report only
   fills the history. Names on an ageing report are matched to staff (a couple counts
   to the first of them on staff), the office can fix a match and it is remembered, and
   each department's Staff Debt ($) follows. All names and figures here are made up. */
import { tmpDir } from './env.mjs';
import { REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('finance');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const stores={};
export function getStore(o){
  const name=(typeof o==='string') ? o : o.name;
  const mem=stores[name]||(stores[name]=new Map());
  return {
    get: async (k,opt)=>{ if(!mem.has(k)) return null; const v=mem.get(k); return (opt&&opt.type==='text') ? v : JSON.parse(v); },
    set: async (k,v)=>{ mem.set(k, String(v)); },
    setJSON: async (k,v)=>{ mem.set(k, JSON.stringify(v)); },
    delete: async (k)=>{ mem.delete(k); },
    list: ()=>({ [Symbol.asyncIterator]: async function*(){ yield { blobs: [...mem.keys()].map(key=>({key})), directories: [] }; } })
  };
}
export const __stores=stores;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__stores['gp-data'] || (blobs.getStore({ name: 'gp-data' }), blobs.__stores['gp-data']);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  withPin({ id: 'st_fin', name: 'Bopha Keo', username: 'bopha', campus: 'poipet', dept: 'Skills Training', ministry: 'Finances', active: true }),
  withPin({ id: 'st_fin2', name: 'Lina Ros', username: 'lina', campus: 'poipet', dept: 'Skills Training', ministry: 'Kitchen', ministries: ['Skills Training|Finances'], active: true }),
  withPin({ id: 'st_cd', name: 'Mark Hill', username: 'mark', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_dl', name: 'Sophea Lim', username: 'sophea', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Community Service', active: true }),
  withPin({ id: 'st_dara', name: 'Dara Sok', username: 'dara', campus: 'poipet', dept: 'Community Service', ministry: 'Cafe', active: true }),
  withPin({ id: 'st_vanna', name: 'Vanna Chan', username: 'vanna', campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', active: true }),
  withPin({ id: 'st_pich', name: 'Srey Pich', username: 'pich', campus: 'poipet', dept: 'Youth Education', ministry: 'Kids Club', active: true }),
  withPin({ id: 'st_sr', name: 'Tom Ray', username: 'tom', campus: 'siemreap', dept: 'Campus Leadership', ministry: 'Campus Director', active: true }),
  withPin({ id: 'st_admin', name: 'Ada Min', username: 'ada', campus: 'poipet', dept: 'Campus Leadership', ministry: 'Campus Director', active: true, isAdmin: true })
]);
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return await res.json();
}
const doc = () => JSON.parse(mem.get('finance:poipet') || '{}');
const entries = () => JSON.parse(mem.get('entries') || '[]');
const debtEntry = (dept) => entries().filter((r) => r.campus === 'poipet' && r.dept === 'Campus Leadership' && r.ministry === dept && r.metric === 'Staff Debt ($)').slice(-1)[0];
const pdf = (name) => ({ name, base64: Buffer.from('%PDF-1.4 made-up report ' + name).toString('base64') });

const PL = { months: { '2026-09': { cash: 12000.5, lines: [
  { sec: 'inc', code: '41000', name: 'Donation (Income)', parent: '', amt: 1000 },
  { sec: 'inc', code: '45000', name: 'Training', parent: '', amt: null },
  { sec: 'inc', code: '45100', name: 'Lecture Contribution', parent: '45000', amt: 500 },
  { sec: 'oth', code: '49000', name: 'Interest income', parent: '', amt: 2.5 },
  { sec: 'exp', code: '50300', name: 'Rent /Lease', parent: '', amt: 1200 },
  { sec: 'exp', code: '50500', name: 'Food', parent: '', amt: 800.25 }
] } } };

console.log('=== who may ===');
let r = await call('finSave', ['dara', '1234', 'pl', PL, pdf('pl.pdf')]);
ok('ordinary staff can’t save a report', !r.ok && r.err === 'not_authorized');
r = await call('finSave', ['sophea', '1234', 'pl', PL, pdf('pl.pdf')]);
ok('nor can Campus Leadership — it’s the office’s', !r.ok && r.err === 'not_authorized');
r = await call('getFinance', ['dara', '1234']);
ok('ordinary staff see nothing', !r.ok && r.err === 'not_authorized' && !r.pl);
r = await call('getFinance', ['bopha', 'wrong']);
ok('a wrong PIN sees nothing', !r.ok && !r.pl);

console.log('=== the P&L ===');
r = await call('finSave', ['bopha', '1234', 'pl', PL, pdf('PL-Sep.pdf')]);
ok('the office saves a month', r.ok && r.canEdit && r.pl['2026-09'].lines.length === 6 && r.pl['2026-09'].cash === 12000.5);
ok('… with its PDF kept', r.pl['2026-09'].fileName === 'PL-Sep.pdf' && !!mem.get('finfile:' + r.pl['2026-09'].fileId));
const plFile = r.pl['2026-09'].fileId;
r = await call('finSave', ['lina', '1234', 'pl', { months: { '2026-08': PL.months['2026-09'] } }, null]);
ok('someone with Finances as another ministry can too', r.ok && !!r.pl['2026-08'] && !r.pl['2026-08'].fileId);
r = await call('getFinance', ['sophea', '1234']);
ok('Campus Leadership sees the P&L', r.ok && !r.canEdit && r.pl['2026-09'].lines[4].amt === 1200 && r.pl['2026-09'].by === 'Bopha Keo');
r = await call('getFinance', ['tom', '1234']);
ok('another campus’s leadership sees their own campus, not this one', r.ok && r.campus === 'siemreap' && !Object.keys(r.pl).length);
r = await call('getFinance', ['ada', '1234', 'siemreap']);
ok('an admin can look at either campus', r.ok && r.campus === 'siemreap');

const bad = async (label, data) => { const x = await call('finSave', ['bopha', '1234', 'pl', data, null]); ok(label, !x.ok, x.err); };
await bad('a line in no section is refused', { months: { '2026-07': { lines: [{ sec: 'nope', name: 'x', amt: 1 }] } } });
await bad('an amount that isn’t a number is refused', { months: { '2026-07': { lines: [{ sec: 'inc', name: 'x', amt: 'lots' }] } } });
await bad('a silly amount is refused', { months: { '2026-07': { lines: [{ sec: 'inc', name: 'x', amt: 5e12 }] } } });
await bad('a month that isn’t one is refused', { months: { '2026-13': { lines: [{ sec: 'inc', name: 'x', amt: 1 }] } } });
await bad('no lines at all is refused', { months: { '2026-07': { lines: [] } } });
await bad('too many lines is refused', { months: { '2026-07': { lines: Array.from({ length: 201 }, () => ({ sec: 'inc', name: 'x', amt: 1 })) } } });
ok('nothing was saved by any of those', !doc().pl['2026-07']);

r = await call('finSave', ['bopha', '1234', 'pl', { months: { '2026-09': { lines: PL.months['2026-09'].lines.slice(0, 2) } } }, pdf('PL-Sep-v2.pdf')]);
ok('a month uploaded again replaces it, and keeps the cash entered before', r.ok && r.pl['2026-09'].lines.length === 2 && r.pl['2026-09'].cash === 12000.5 && r.pl['2026-09'].fileName === 'PL-Sep-v2.pdf');
ok('… and the old PDF goes', !mem.get('finfile:' + plFile));
r = await call('finSetCash', ['bopha', '1234', '2026-09', 9000]);
ok('the cash at the month’s end can be changed on its own', r.ok && r.pl['2026-09'].cash === 9000);
r = await call('finSetCash', ['sophea', '1234', '2026-09', 1]);
ok('… by the office only', !r.ok && doc().pl['2026-09'].cash === 9000);

console.log('=== the burn rate ===');
const twelve = (v) => Array.from({ length: 12 }, (_, i) => (i < 9 ? v : null));
const BURN = { year: 2026, sections: [
  { title: 'Campus and New house related expenses', kind: 'campusExp', rows: [{ label: 'Rent', kind: 'item', vals: twelve(3000) }, { label: 'TOTAL', kind: 'total', vals: twelve(3000) }] },
  { title: 'Campus and New house related Income', kind: 'campusInc', rows: [{ label: 'Teams', kind: 'item', vals: twelve(2500) }, { label: 'TOTAL', kind: 'total', vals: twelve(2500) }] },
  { title: 'REAL TOTAL EXPENSE WHOLE ORGANISATION', kind: 'orgExp', rows: [{ label: 'TOTAL', kind: 'total', vals: twelve(9000) }] }
] };
r = await call('finSave', ['bopha', '1234', 'burn', BURN, pdf('Burn-2026.pdf')]);
ok('the office saves a year’s burn rate', r.ok && r.burn['2026'].sections.length === 3 && r.burn['2026'].sections[0].rows[0].vals[0] === 3000 && r.burn['2026'].sections[0].rows[0].vals[11] === null);
const burnFile = r.burn['2026'].fileId;
r = await call('finSave', ['bopha', '1234', 'burn', { year: 1990, sections: BURN.sections }, null]);
ok('a year out of range is refused', !r.ok && r.err === 'bad_year');
r = await call('finSave', ['bopha', '1234', 'burn', { year: 2026, sections: [{ title: 'x', kind: 'campusExp', rows: [{ label: 'Rent', vals: [1, 2] }] }] }, null]);
ok('a row without twelve months is refused', !r.ok && doc().burn['2026'].sections.length === 3);

console.log('=== staff debt ===');
const DEBT = { asOf: '2026-10-02', cols: ['1 Month', '2 Month', '3 Month', 'Over 3 Months'], rows: [
  { name: 'Dara Sok', vals: [20, 10, 0, 0], total: 30 },
  { name: 'Vanna & Srey Pich', vals: [50, 50, 0, 0], total: 100 },
  { name: 'Someone Gone', vals: [0, 0, 0, 40], total: 40 }
] };
r = await call('finSave', ['bopha', '1234', 'debt', DEBT, pdf('Staff-Debt.pdf')]);
ok('the office saves the ageing report', r.ok && r.debt.total === 170 && r.debt.people === 3 && r.debt.vals[3] === 40);
ok('names are matched to staff — a couple to whichever of them is one person', r.debtRows[0].staffId === 'st_dara' && r.debtRows[1].staffId === 'st_vanna' && r.debtRows[2].staffId === '');
ok('totals by department, and what isn’t matched', r.debt.byDept['Community Service'] === 30 && r.debt.byDept['Youth Education'] === 100 && r.debt.unmatched === 40);
ok('each department’s Staff Debt ($) follows', Number(debtEntry('Community Service').value) === 30 && Number(debtEntry('Youth Education').value) === 100 && Number(debtEntry('Skills Training').value) === 0);
const debtFile = r.debtFile.fileId;
r = await call('getFinance', ['sophea', '1234']);
const leaderJson = JSON.stringify(r);
ok('Campus Leadership sees the totals', r.ok && r.debt.total === 170 && r.debt.byDept['Youth Education'] === 100);
// Oct 2026 (Uriah): "allow the leadership to see the names of the people who owe money and how much"
const owes = (n) => (r.debtPeople || []).find((x) => x.name === n);
ok('… and who owes how much, biggest first, with their department', r.debtPeople.length === 3 && r.debtPeople[0].name === 'Vanna & Srey Pich' && r.debtPeople[0].total === 100 &&
  owes('Dara Sok').total === 30 && owes('Dara Sok').dept === 'Community Service' && owes('Someone Gone').dept === '', JSON.stringify(r.debtPeople));
ok('… but not the office’s matching or the PDF', !r.debtRows && !r.nameMap && !r.debtFile && !/staffId/.test(leaderJson));
r = await call('getFinance', ['dara', '1234']);
ok('ordinary staff still see none of it', !r.ok && r.err === 'not_authorized');
r = await call('finFile', ['sophea', '1234', debtFile]);
ok('… and can’t open the ageing PDF', !r.ok && r.err === 'not_authorized');
r = await call('finFile', ['sophea', '1234', burnFile]);
ok('… but can open the burn rate', r.ok && /^data:application\/pdf;base64,/.test(r.dataUrl));
r = await call('finFile', ['bopha', '1234', debtFile]);
ok('the office can open the ageing PDF', r.ok && r.name === 'Staff-Debt.pdf');
r = await call('finFile', ['tom', '1234', burnFile]);
ok('another campus can’t open this campus’s PDF', !r.ok);
r = await call('finFile', ['dara', '1234', burnFile]);
ok('ordinary staff can’t open any', !r.ok);

r = await call('finMatchName', ['bopha', '1234', 'Someone Gone', 'st_dara']);
ok('the office can say who a name is', r.ok && r.debtRows[2].staffId === 'st_dara' && r.debt.byDept['Community Service'] === 70 && r.debt.unmatched === 0);
ok('… and the department’s Staff Debt ($) follows', Number(debtEntry('Community Service').value) === 70);
r = await call('finMatchName', ['bopha', '1234', 'Someone Gone', 'st_sr']);
ok('only someone on this campus', !r.ok && r.err === 'bad_person');
r = await call('finMatchName', ['sophea', '1234', 'Someone Gone', 'st_dara']);
ok('only the office matches names', !r.ok);

const NEXT = { asOf: '2026-11-02', cols: DEBT.cols, rows: [{ name: 'Someone Gone', vals: [0, 0, 0, 25], total: 25 }, { name: 'Dara Sok', vals: [5, 0, 0, 0], total: 5 }] };
r = await call('finSave', ['bopha', '1234', 'debt', NEXT, pdf('Staff-Debt-Nov.pdf')]);
ok('next month, the name is remembered', r.ok && r.debtRows[0].staffId === 'st_dara' && r.debt.total === 30);
ok('… the old PDF goes, and the history keeps both months', !mem.get('finfile:' + debtFile) && r.debtHist.length === 2 && r.debtHist[0].total === 170 && r.debtHist[1].total === 30);
r = await call('finSave', ['bopha', '1234', 'debt', { asOf: '2026-08-01', cols: DEBT.cols, rows: [{ name: 'Dara Sok', vals: [9, 0, 0, 0], total: 9 }] }, pdf('old.pdf')]);
ok('an older report only fills the history', r.ok && r.debt.asOf === '2026-11-02' && r.debtHist.length === 3 && r.debtHist[0].asOf === '2026-08-01');
ok('… and its PDF isn’t kept', !Object.keys(Object.fromEntries(mem)).some((k) => k.startsWith('finfile:') && JSON.parse(mem.get(k)).name === 'old.pdf'));
r = await call('finSave', ['bopha', '1234', 'debt', { asOf: 'soon', cols: DEBT.cols, rows: [] }, null]);
ok('an ageing report needs its date', !r.ok && r.err === 'bad_date');
r = await call('finSave', ['bopha', '1234', 'debt', { asOf: '2026-11-03', cols: DEBT.cols, rows: [{ name: 'X', vals: [1], total: 'a lot' }] }, null]);
ok('… and real amounts', !r.ok && r.err === 'bad_amount');
r = await call('finSave', ['bopha', '1234', 'pl', PL, { name: 'big.pdf', base64: 'A'.repeat(6 * 1024 * 1024) }]);
ok('a PDF that is too big is refused, and nothing changes', !r.ok && r.err === 'too_large' && doc().pl['2026-09'].lines.length === 2);

console.log('=== the money ahead ===');
r = await call('finAheadSave', ['sophea', '1234', { '2026-10': { inc: 5000, exp: 6000.4 }, 'nope': { inc: 1 } }]);
ok('Campus Leadership saves the months ahead, signed in', r.ok && r.ahead.months['2026-10'].exp === 6000 && !r.ahead.months.nope);
r = await call('finAheadSave', ['dara', '1234', { '2026-10': { inc: 1 } }]);
ok('ordinary staff can’t', !r.ok && JSON.parse(mem.get('finProj:poipet')).months['2026-10'].inc === 5000);
r = await call('finProjGet', ['leadercode', 'poipet']);
ok('the same months the leadership code always saw', r.ok && r.months['2026-10'].inc === 5000);

console.log('=== taking a report out ===');
r = await call('finDelete', ['sophea', '1234', 'burn', 2026]);
ok('only the office takes one out', !r.ok && !!doc().burn['2026']);
r = await call('finDelete', ['bopha', '1234', 'burn', 2026]);
ok('the office takes a year’s burn rate out, PDF and all', r.ok && !r.burn['2026'] && !mem.get('finfile:' + burnFile));
r = await call('finDelete', ['bopha', '1234', 'pl', '2026-08']);
ok('… or a month', r.ok && !r.pl['2026-08'] && !!r.pl['2026-09']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
