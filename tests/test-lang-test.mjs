/* The language level test (Oct 2026, Andrew: "a language test … to check and gauge where we are all at"):
   each person saves their own results (Khmer and English, ten kept, cleaned), their boot carries
   them back, and only their campus's leadership, HR and admins see everyone's latest — nothing
   about it on the public roster or a teammate's profile. Against the real api.js. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('lang-test');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
};}
export const __mem=mem;`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
mem.staff = [
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora' }),
  mk({ id: 'c2', name: 'Kanha Cafe', username: 'kanha' }),
  mk({ id: 'hr', name: 'Hope HR', username: 'hope', hr: true }),
  mk({ id: 'l1', name: 'Uriah Lead', username: 'uriah', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', isAdmin: true, campus: 'poipet' }),
  mk({ id: 'pp', name: 'Poipet Person', username: 'pp', campus: 'poipet' }),
  mk({ id: 'gone', name: 'Gone Away', username: 'gone', active: false, archived: { at: '2026-01-01' } })
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
const as = (u) => [u, '1234'];
const day = n => new Date(Date.now() + 7 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const R = (o) => Object.assign({ level: 'elementary', pct: 58, speak: 3, words: { right: 10, of: 15 }, sentences: { right: 5, of: 8 } }, o);

console.log('=== saving my own ===');
let r = await call('saveLangLevel', [...as('cora'), 'km', R()]);
ok('Cora saves her Khmer level; the answer is her own latest and history', r.ok && r.lang.latest.km.level === 'elementary' && r.lang.history.km.length === 1 && !r.lang.latest.en);
r = await call('saveLangLevel', [...as('cora'), 'km', R({ level: 'intermediate', pct: 70, script: { right: 6, of: 8 }, scriptLevel: 'reads' })]);
ok('a second test is added, newest last, the reading part kept beside it', r.ok && r.lang.latest.km.level === 'intermediate' && r.lang.latest.km.scriptLevel === 'reads' && r.lang.history.km.map(x => x.level).join() === 'elementary,intermediate');
r = await call('saveLangLevel', [...as('cora'), 'en', R({ level: 'confident', pct: 95 })]);
ok('English is kept apart from Khmer', r.ok && r.lang.latest.en.level === 'confident' && r.lang.latest.km.level === 'intermediate');
r = await call('saveLangLevel', [...as('cora'), 'fr', R()]);
ok('only Khmer or English', r.ok === false && r.err === 'lang');
r = await call('saveLangLevel', [...as('cora'), 'km', R({ level: 'genius' })]);
ok('a level that isn\'t one of the five is refused', r.ok === false && r.err === 'result');
r = await call('saveLangLevel', [...as('cora'), 'km', R({ pct: 900, speak: 99, words: { right: 50, of: 15 }, script: { right: 3, of: 8 }, scriptLevel: 'wizard', extra: 'x' })]);
const last = r.lang.latest.km;
ok('numbers are kept in range, a made-up reading level and extra fields dropped', r.ok && last.pct === 100 && last.speak === 6 && last.words.right === 15 && !last.scriptLevel && !last.script && !('extra' in last));
r = await call('saveLangLevel', ['cora', '9999', 'km', R()]);
ok('a wrong PIN saves nothing', r.ok === false);
for (let i = 0; i < 12; i++) await call('saveLangLevel', [...as('kanha'), 'km', R({ pct: i })]);
r = await call('getMyBoot', as('kanha'));
ok('ten kept; my boot carries my own latest and history', r.staff.langLevel.history.km.length === 10 && r.staff.langLevel.latest.km.pct === 11 && r.staff.seeLangLevels === false);

console.log('=== who sees everyone ===');
r = await call('getLangLevels', [...as('kanha'), 'siemreap']);
ok('ordinary staff can\'t see everyone\'s levels', r.ok === false && r.err === 'not_authorized');
r = await call('getLangLevels', [...as('uriah'), 'poipet']);
const cora = r.people && r.people.find(p => p.id === 'c1');
ok('Campus Leadership sees their own campus (not another, even when asked), active staff only', r.ok && r.campus === 'siemreap' && r.people.length === 4 && !r.people.some(p => p.id === 'pp' || p.id === 'gone'));
ok('… each person\'s latest Khmer and English, nothing more', cora && cora.km.pct === 100 && cora.en.level === 'confident' && Object.keys(cora).sort().join() === 'en,id,km,name', JSON.stringify(cora));
ok('… "not taken" as nothing', r.people.find(p => p.id === 'hr').km === null && r.people.find(p => p.id === 'hr').en === null);
r = await call('getMyBoot', as('uriah'));
ok('leadership\'s boot says they may look', r.staff.seeLangLevels === true);
r = await call('getLangLevels', [...as('hope'), 'siemreap']);
ok('HR sees them too', r.ok && r.people.length === 4);
r = await call('getLangLevels', [...as('ada'), 'siemreap']);
ok('an admin may look at another campus', r.ok && r.campus === 'siemreap' && r.people.some(p => p.id === 'c1'));
r = await call('getLangLevels', [...as('ada'), '']);
ok('… and opens on their own', r.ok && r.campus === 'poipet' && r.people.some(p => p.id === 'pp'));

console.log('=== nowhere else ===');
r = await call('teamRoster', []);
ok('the public roster carries none of it', r.ok !== false && !JSON.stringify(r).includes('langTests') && !JSON.stringify(r).includes('intermediate'));
r = await call('staffProfile', [...as('kanha'), 'c1']);
ok('a teammate\'s profile carries none of it', !JSON.stringify(r).includes('langTests') && !JSON.stringify(r).includes('langLevel'));
r = await call('getMyBoot', as('kanha'));
ok('nor does anyone else\'s boot roster', !JSON.stringify(r.roster || []).includes('langTests') && !JSON.stringify(r.roster || []).includes('intermediate'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
