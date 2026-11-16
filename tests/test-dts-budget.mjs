/* GPDTS → Finances → Budget (Nov 2026, Sinin: "our DTS budget from last year … breakdowns of material costs
   and honorariums … and show that we are keeping in track with our expenses"). Against the real api.js: a
   school's budget is saved whole and cleaned (groups, how many, ids, caps), it rides on the board, an
   expense can name one of its lines and no other, removing it leaves the expenses, the Finances office's
   card gets the planned total, and only the DTS team may write it. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('dts-budget');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(k=>({ key:k })) }),
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js']) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
process.env.GP_LEADER_CODE = 'leadercode';
process.env.GP_ADMIN_CODE = 'admincode';
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const withPin = (s) => ({ active: true, campus: 'siemreap', ...s, pinSalt: s.id, pinHash: mkHash('1234', s.id) });
mem.staff = [
  withPin({ id: 'st_dts', name: 'Dee Teesse', username: 'dee', dept: 'Leadership Development', ministry: 'GPDTS' }),
  withPin({ id: 'st_fin', name: 'Fin Office', username: 'fin', dept: 'Skills Training', ministry: 'Finances' }),
  withPin({ id: 'st_cd', name: 'Cee Dee', username: 'ceedee', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  withPin({ id: 'st_cafe', name: 'Cal Fay', username: 'cal', dept: 'Community Service', ministry: 'Cafe' }),
];
async function call(fn, args) {
  const res = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {});
  return { status: res.status, body: await res.json().catch(() => null) };
}
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('ok   ' + name + (extra !== undefined ? '  → ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); }
}
const NOW = new Date().toISOString();
const pnp = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = pnp(Date.now()), Y = Number(TODAY.slice(0, 4)) + 1;
mem['dtsDb:siemreap'] = { schools: [{ id: 'sc1', year: Y, name: 'January DTS', from: Y + '-01-12', to: Y + '-06-20' }], events: [], resp: [], resources: [], teams: [] };
const cand = (o) => ({ campus: 'siemreap', type: 'student', school: 'dts', log: [], archived: null, created: NOW, updated: NOW, portal: { submittedAt: NOW, form: { answers: { phone: 'SECRETPHONE', church: 'SECRETCHURCH' } } }, ...o });
mem.candidates = [
  cand({ id: 'c_us', name: 'Una States', country: 'United States', stage: 'accepted' }),          // A, the portal's spelling
  cand({ id: 'c_de', name: 'Dirk Deutsch', country: 'Germany', stage: 'arrived' }),               // A
  cand({ id: 'c_br', name: 'Bia Brazil', country: 'Brazil', stage: 'practical' }),                // B, getting ready counts as accepted
  cand({ id: 'c_tr', name: 'Tan Turkey', country: 'Turkey', stage: 'accepted' }),                 // B, another spelling of Turkiye
  cand({ id: 'c_kh', name: 'Sokha Khmer', country: 'Cambodia', stage: 'accepted' }),              // C
  cand({ id: 'c_ci', name: 'Ama Coast', country: 'Côte d\'Ivoire', stage: 'accepted' }),         // C, accents and a plain apostrophe
  cand({ id: 'c_xx', name: 'Nora Nowhere', country: 'Atlantis', stage: 'accepted' }),             // not on the list
  cand({ id: 'c_ap', name: 'Ann Applied', country: 'Australia', stage: 'applied' }),              // applied — not counted, but in "if all"
  cand({ id: 'c_gone', name: 'Gus Gone', country: 'Canada', stage: 'accepted', archived: { at: NOW, reason: 'withdrew' } }),   // withdrew: not counted
];


const BUD = {
  students: 23, staff: 8,
  income: [{ id: 'bi1', name: 'From the previous DTS', amount: 500 }, { id: 'bi1', name: 'Donations', amount: 0 }, { name: '', amount: 9 }],
  lines: [
    { id: 'm1', group: 'materials', name: 'Whiteboard markers', each: 1, per: 'student' },
    { id: 's1', group: 'students', name: 'T-shirts', each: 7, per: 'people', count: 99 },
    { id: 'h1', group: 'honoraria', code: '60207', name: 'Outside speaker honorarium', each: 200, per: '', count: 4 },
    { id: 'x1', group: 'nonsense', name: 'Somewhere else', each: -5, per: 'weird', count: 2 },
    { id: 'm1', group: 'materials', name: 'Same id twice', each: 2, per: '', count: 3 },
    { name: '', each: 9, count: 9 },
  ],
};
let r = await call('dtsFinBudgetSave', ['cal', '1234', 'sc1', BUD]);
ok('someone outside GPDTS cannot write the budget', !r.body.ok);
r = await call('dtsFinBudgetSave', ['dee', '1234', 'nope', BUD]);
ok('a school that is not there is refused', !r.body.ok && r.body.err === 'no_school', r.body.err);
r = await call('dtsFinBudgetSave', ['dee', '1234', 'sc1', 'junk']);
ok('a budget that is not a budget is refused', !r.body.ok && r.body.err === 'bad_budget', r.body.err);
r = await call('dtsFinBudgetSave', ['dee', '1234', 'sc1', BUD]);
ok('the DTS team saves a school’s budget', r.body.ok === true && r.body.budgets && r.body.budgets.sc1, JSON.stringify(r.body.err));
const b = r.body.budgets.sc1;
ok('a line without a name is dropped, the rest kept in order', b.lines.length === 5 && b.lines.map(l => l.name).join('|') === 'Whiteboard markers|T-shirts|Outside speaker honorarium|Somewhere else|Same id twice', b.lines.map(l => l.name).join('|'));
ok('a line counted per student or per person keeps no number of its own', b.lines[0].count === 0 && b.lines[1].count === 0 && b.lines[1].per === 'people');
ok('an unknown group is Other, an unknown "how many" is a number, a negative amount is 0', b.lines[3].group === 'other' && b.lines[3].per === '' && b.lines[3].each === 0 && b.lines[3].count === 2, JSON.stringify(b.lines[3]));
ok('an id used twice is given a new one', b.lines[4].id !== 'm1' && b.lines[4].id && b.lines[0].id === 'm1');
ok('the code stays', b.lines[2].code === '60207');
ok('other income: names kept, an empty one dropped, ids unique', b.income.length === 2 && b.income[0].amount === 500 && b.income[1].id !== 'bi1', JSON.stringify(b.income));
ok('who made it and when', b.by === 'st_dts' && !!b.at);

r = await call('dtsBoard', ['dee', '1234']);
ok('the board carries the budgets', r.body.finBudgets && r.body.finBudgets.sc1 && r.body.finBudgets.sc1.lines.length === 5);

const exp = (o) => ({ schoolId: 'sc1', phase: 'lecture', kind: 'expense', date: TODAY, category: 'supplies', memo: 'Markers', who: 'st_dts', amount: 12.5, ...o });
r = await call('dtsFinSave', ['dee', '1234', exp({ lineId: 'm1' })]);
ok('an expense can name a line of its school’s budget', r.body.ok && r.body.fin[0].lineId === 'm1', JSON.stringify(r.body.err));
const e1 = r.body.fin[0].id;
r = await call('dtsFinSave', ['dee', '1234', exp({ lineId: 'not-a-line' })]);
ok('… and no line that is not in it', !r.body.ok && r.body.err === 'bad_line', r.body.err);
r = await call('dtsFinSave', ['dee', '1234', exp({ memo: 'Coffee', lineId: '' })]);
ok('an expense may be on no line', r.body.ok && r.body.fin.some(e => e.memo === 'Coffee' && e.lineId === ''));
r = await call('dtsFinSave', ['dee', '1234', exp({ id: e1, lineId: 'h1', memo: 'Speaker' })]);
ok('an expense can be moved to another line', r.body.ok && r.body.fin.find(e => e.id === e1).lineId === 'h1');

/* the Finances office's card: the plan beside what was spent */
r = await call('getFinance', ['fin', '1234']);
const sc = r.body && r.body.dtsFees && r.body.dtsFees.schools.find(s => s.id === 'sc1');
// planned: 1×23 + 7×31 + 200×4 + 0×2 + 2×3 = 23 + 217 + 800 + 0 + 6 = 1046
ok('the Finances office sees the planned spending beside what was spent', sc && sc.money.lecture.planned === 1046 && sc.money.lecture.spent === 25, JSON.stringify(sc && sc.money));

/* the budget lives beside the entries: writing one never loses the other */
ok('the entries and the budget sit in one blob, both kept', Array.isArray(mem['dtsFin:siemreap'].entries) && mem['dtsFin:siemreap'].entries.length === 2 && mem['dtsFin:siemreap'].budgets.sc1);

r = await call('dtsFinBudgetSave', ['dee', '1234', 'sc1', null]);
ok('the budget can be removed', r.body.ok && !r.body.budgets.sc1);
r = await call('dtsBoard', ['dee', '1234']);
ok('… and its expenses stay, with their line id', r.body.fin.length === 2 && r.body.fin.some(e => e.lineId === 'h1'));

/* the caps */
const many = { students: 9999, staff: -3, lines: Array.from({ length: 200 }, (_, i) => ({ name: 'L' + i, each: 1e9, count: 1e9 })), income: [] };
r = await call('dtsFinBudgetSave', ['dee', '1234', 'sc1', many]);
const m = r.body.budgets.sc1;
ok('at most 150 lines, amounts and counts capped, people never negative', m.lines.length === 150 && m.lines[0].each === 100000 && m.lines[0].count === 10000 && m.students === 500 && m.staff === 0, JSON.stringify([m.lines.length, m.lines[0], m.students, m.staff]));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
