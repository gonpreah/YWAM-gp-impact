/* GPDTS lecture fees (Nov 2026, Andrew: "for our finance team and the DTS team to get more clarity and
   collaboration in setting clear and accountable budget and finances … the lecture phase is a fixed price,
   different by country A, B and C"). Against the real api.js: each student's category from their country
   (spelled the portal's way or another), the prices on the board, a school's total counted from the
   accepted students only, and the same total on the Finances office's dashboard — for the office and
   Campus Leadership, not for anyone else, and with nothing from the application in it. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('dts-fees');
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

/* the list itself */
const tax = fs.readFileSync(REPO + '/public/taxonomy.js', 'utf8');
const COUNTRIES = eval('(' + tax.match(/var COUNTRIES = (\[[\s\S]*?\]);/)[1] + ')');
const src = fs.readFileSync(REPO + '/netlify/functions/api.js', 'utf8');
const listed = ['A', 'B', 'C'].flatMap(c => src.match(new RegExp(c + ": '([^']+)'"))[1].split('|'));
ok('Andrew’s A/B/C list is in, each country once (Croatia and Cyprus were in it twice)', listed.length === 241 && new Set(listed).size === listed.length, String(listed.length));

const r = await call('dtsBoard', ['dee', '1234']);
ok('the board answers', r.body && r.body.ok === true, JSON.stringify(r.body && r.body.err));
const B = r.body;
ok('it carries the prices: A $2,000, B $1,500, C $620', JSON.stringify(B.fees) === JSON.stringify({ A: 2000, B: 1500, C: 620 }));
const cat = {}; (B.students || []).forEach(x => { cat[x.id] = x.feeCat; });
ok('each student has their country’s category — the portal’s spelling, another spelling, accents', cat.c_us === 'A' && cat.c_de === 'A' && cat.c_br === 'B' && cat.c_tr === 'B' && cat.c_kh === 'C' && cat.c_ci === 'C', JSON.stringify(cat));
ok('a country not on the list has none', cat.c_xx === '');

/* every country the portal offers has a category, so nobody picking from the list lands on "not known" */
const missing = [];
for (const c of COUNTRIES) {
  mem.candidates.push(cand({ id: 'tmp', name: 'T', country: c, stage: 'accepted' }));
  const b = (await call('dtsBoard', ['dee', '1234'])).body;
  const x = (b.students || []).find(s => s.id === 'tmp');
  if (!x || !x.feeCat) missing.push(c);
  mem.candidates.pop();
}
ok('every country in the portal’s list is A, B or C', missing.length === 0, missing.join(', '));

/* the Finances office's dashboard */
const F = (await call('getFinance', ['fin', '1234'])).body;
ok('the Finances office’s dashboard carries the GPDTS lecture phase', F && F.ok && F.dtsFees && F.dtsFees.schools.length === 1, JSON.stringify(F && F.dtsFees));
const S1 = F.dtsFees.schools[0], f = S1.fees;
ok('counted from the accepted students only: A 2, B 2, C 2, 1 not known', f.A === 2 && f.B === 2 && f.C === 2 && f.unknown === 1, JSON.stringify(f));
ok('the total: 2 × $2,000 + 2 × $1,500 + 2 × $620 = $8,240', f.total === 8240, String(f.total));
ok('one more applied — what it comes to if they are accepted too', f.applying === 1 && f.ifAll === 10240, JSON.stringify(f));
ok('who is counted: name, country and category — nothing else from the application', S1.students.length === 7 && S1.students.every(x => Object.keys(x).sort().join() === 'cat,column,country,name') &&
  !JSON.stringify(F.dtsFees).includes('SECRET') && !S1.students.some(x => x.name === 'Gus Gone' || x.name === 'Ann Applied'));
const C = (await call('getFinance', ['ceedee', '1234'])).body;
ok('Campus Leadership sees the same on their Finances tab', C && C.ok && C.dtsFees && C.dtsFees.schools[0].fees.total === 8240);
const X = (await call('getFinance', ['cal', '1234'])).body;
ok('anyone else gets no finance page at all', X && X.ok === false && !X.dtsFees);

/* the total follows the portal */
mem.candidates.find(c => c.id === 'c_ap').stage = 'accepted';
const F2 = (await call('getFinance', ['fin', '1234'])).body;
ok('when the applicant is accepted the total moves by itself (+$2,000, Australia is A)', F2.dtsFees.schools[0].fees.total === 10240 && F2.dtsFees.schools[0].fees.A === 3);
mem.candidates.find(c => c.id === 'c_xx').country = 'USA';
const F3 = (await call('getFinance', ['fin', '1234'])).body;
ok('and fixing a country in the portal counts that student', F3.dtsFees.schools[0].fees.unknown === 0 && F3.dtsFees.schools[0].fees.total === 12240);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
