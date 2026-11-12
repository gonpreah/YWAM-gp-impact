/* Photos in lists are the small copy (Nov 2026).

   The roster carried every staff member's full photo (300px, up to ~40 KB each),
   so a boot was mostly photos — about 1.5 MB per open, too big for a phone to keep
   as its offline copy. Now an upload brings a 160px copy too (photoThumb), every
   list sends that, and the full photo goes only to its owner and to a person's
   own page. A photo from before falls back to the full one until its owner's
   phone makes the small copy (savePhotoThumb). */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('photo-thumbs');
fs.mkdirSync(TMP + '/node_modules/@netlify/blobs', { recursive: true });
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/index.js', `
const mem={};
export function getStore(){ return {
  get: async (k)=> (k in mem)?JSON.parse(JSON.stringify(mem[k])):null,
  setJSON: async (k,v)=>{ mem[k]=JSON.parse(JSON.stringify(v)); },
  delete: async (k)=>{ delete mem[k]; },
  list: async ()=>({ blobs: Object.keys(mem).map(function(k){ return { key:k }; }) })
};}
export const __mem=mem;
`);
fs.writeFileSync(TMP + '/node_modules/@netlify/blobs/package.json', JSON.stringify({ name: '@netlify/blobs', version: '0.0.0', type: 'module', main: 'index.js' }));
fs.writeFileSync(TMP + '/package.json', JSON.stringify({ type: 'module' }));
for (const f of ['api.js', 'team-seed.js', 'portal-forms-default.js', 'legal-docs-default.js', 'legal-pdf.js', 'library-audio-lib.js'])
  fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const call = async (fn, ...args) => (await (await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {})).json());
const mkHash = (pin, salt) => crypto.createHash('sha256').update(salt + ':' + String(pin), 'utf8').digest('hex');
const person = (id, name, extra) => Object.assign({ id, name, username: id, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, pinSalt: id, pinHash: mkHash('1234', id) }, extra || {});

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); } };

const BIG = 'data:image/jpeg;base64,' + 'A'.repeat(30000);       // an old full photo, no small copy
mem.staff = [person('sokha', 'Sokha'), person('dara', 'Dara', { photo: BIG })];

/* ---- 1. an upload brings the small copy ---- */
const full = 'B'.repeat(30000), small = 'C'.repeat(6000);
let r = await call('uploadPhoto', 'sokha', '1234', full, 'image/jpeg', small);
ok('an upload with a small copy saves both', r.ok && r.hasThumb && /^data:image\/jpeg;base64,B+$/.test(r.photo));
let boot = await call('getMyBoot', 'sokha', '1234');
const meInRoster = (boot.roster || []).find(x => x.id === 'sokha');
ok('my own record keeps the full photo', boot.staff.photo.length > 30000 && boot.staff.hasThumb === true);
ok('… the roster carries my small copy', meInRoster && meInRoster.photo === 'data:image/jpeg;base64,' + small);
const daraInRoster = boot.roster.find(x => x.id === 'dara');
ok('a photo from before falls back to the full one in the roster', daraInRoster.photo === BIG);
const roster = await call('teamRoster');
ok('the public roster carries the small copy too', ((Array.isArray(roster) ? roster : roster.staff || []).find(x => x.id === 'sokha') || {}).photo === 'data:image/jpeg;base64,' + small);

/* ---- 2. a person's page has their full photo ---- */
const prof = await call('staffProfile', 'dara', '1234', 'sokha');
ok('a person’s page carries the full photo', prof.ok && prof.staff.photo.length > 30000);

/* ---- 3. the owner’s phone makes the small copy for an old photo ---- */
let d = await call('getMyBoot', 'dara', '1234');
ok('an old photo says it has no small copy yet', d.staff.hasThumb === false && d.staff.photo === BIG);
ok('a small copy that isn’t base64 is refused', (await call('savePhotoThumb', 'dara', '1234', '<script>')).err === 'bad_thumb');
ok('a small copy that is too big is refused', (await call('savePhotoThumb', 'dara', '1234', 'D'.repeat(50000))).err === 'bad_thumb');
ok('the wrong PIN is refused', !(await call('savePhotoThumb', 'dara', '9999', 'D'.repeat(4000))).ok);
mem.staff.push(person('vann', 'Vann'));
ok('someone with no photo can’t save a small copy', (await call('savePhotoThumb', 'vann', '1234', 'D'.repeat(4000))).err === 'no_photo');
r = await call('savePhotoThumb', 'dara', '1234', 'E'.repeat(5000));
ok('the owner saves the small copy', r.ok);
boot = await call('getMyBoot', 'sokha', '1234');
ok('… and the roster now carries it', boot.roster.find(x => x.id === 'dara').photo === 'data:image/jpeg;base64,' + 'E'.repeat(5000));
d = await call('getMyBoot', 'dara', '1234');
ok('… while the owner still has the full photo', d.staff.photo === BIG && d.staff.hasThumb === true);

/* ---- 4. a new photo without a small copy never leaves the old face in lists ---- */
await call('uploadPhoto', 'dara', '1234', 'F'.repeat(20000), 'image/jpeg');
boot = await call('getMyBoot', 'sokha', '1234');
ok('a new photo with no small copy replaces the old small one', boot.roster.find(x => x.id === 'dara').photo === 'data:image/jpeg;base64,' + 'F'.repeat(20000));

/* ---- 5. the point of it: the boot is smaller ---- */
mem.staff = [person('sokha', 'Sokha', { photo: 'data:image/jpeg;base64,' + 'P'.repeat(30000) })];
for (let i = 0; i < 40; i++) mem.staff.push(person('p' + i, 'Person ' + i, { photo: 'data:image/jpeg;base64,' + 'P'.repeat(30000) }));
const before = JSON.stringify(await call('getMyBoot', 'sokha', '1234')).length;
mem.staff.forEach(s => { s.photoThumb = 'data:image/jpeg;base64,' + 'T'.repeat(6000); });
const after = JSON.stringify(await call('getMyBoot', 'sokha', '1234')).length;
ok('with small copies, 41 photos’ boot shrinks by over two thirds', after < before / 3, before + ' → ' + after);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
