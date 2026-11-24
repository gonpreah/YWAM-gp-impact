/* The Library, read together (api.js lib*): the book of the month is Campus Leadership's to choose; the campus feed
   shows only people who chose to share; a note from a book never leaves its owner; recommendations; a reading plan
   from a mentor; the weekly reading reminder's settings. Made-up names. */
import { tmpDir } from './env.mjs';
import { REPO } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('library-club');
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
const P = (o) => ({ campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', active: true, ...o, pinSalt: o.id, pinHash: mkHash('1234', o.id) });
const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
await blobs.getStore({ name: 'gp-data' }).setJSON('staff', [
  P({ id: 's_lead', name: 'Lena Lead', username: 'lena', dept: 'Campus Leadership', ministry: 'Campus Director' }),
  P({ id: 's_dara', name: 'Dara Sok', username: 'dara', mentorId: 's_tom', mentorStatus: 'approved', libRead: { 'atomic-habits': today, 'grit': today } }),
  P({ id: 's_tom', name: 'Tom Reed', username: 'tom', libRead: { 'atomic-habits': today } }),
  P({ id: 's_pp', name: 'Pich Poipet', username: 'pich', campus: 'poipet', libRead: { 'grit': today } }),
  P({ id: 's_old', name: 'Old Hand', username: 'old', active: false })
]);
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
const staffRow = async (id) => (await blobs.getStore({ name: 'gp-data' }).get('staff')).find((s) => s.id === id);

/* ---- the book of the month ---- */
let r = await call('libSetMonth', ['dara', '1234', 'atomic-habits', 'Atomic Habits', '']);
ok('only Campus Leadership (or an admin) chooses the book of the month', !r.ok && r.err === 'not_authorized');
r = await call('libSetMonth', ['lena', '1234', 'Bad Id!', 'x', '']);
ok('a book id that is no id is refused', !r.ok && r.err === 'bad_book');
r = await call('libSetMonth', ['lena', '1234', 'atomic-habits', 'Atomic Habits', 'For our habits month']);
ok('leadership sets it: the campus sees the book, the note and who has read it', r.ok && r.lib.month.bookId === 'atomic-habits' && r.lib.month.note === 'For our habits month' && r.lib.month.readers === 2 && r.lib.month.total === 3, JSON.stringify(r.lib.month));
let boot = await call('getMyBoot', ['dara', '1234']);
ok('… and it is on everyone’s boot, with the title for My Home', !!(boot.lib && boot.lib.month) && boot.lib.month.title === 'Atomic Habits' && boot.lib.month.bookId === 'atomic-habits');
r = await call('libState', ['pich', '1234']);
ok('the other campus has its own (none yet)', r.ok && r.lib.month === null);
ok('“read the most” counts the campus’s books, without names', (await call('libState', ['dara', '1234'])).lib.top[0].bookId === 'atomic-habits' && (await call('libState', ['dara', '1234'])).lib.top[0].n === 2);

/* ---- sharing what you finish ---- */
r = await call('libState', ['tom', '1234']);
ok('nobody is in the feed until they choose to share', r.lib.feed.length === 0 && r.lib.mine.share === false && r.lib.mine.shareAsked === false);
r = await call('libSaveMine', ['dara', '1234', { share: true }]);
r = await call('libState', ['tom', '1234']);
ok('Dara shares: her finished books show for her campus', r.lib.feed.length === 2 && r.lib.feed.every((f) => f.id === 's_dara'));
ok('… and not for the other campus', (await call('libState', ['pich', '1234'])).lib.feed.length === 0);
r = await call('libSaveMine', ['dara', '1234', { share: false }]);
ok('sharing off again: gone from the feed, and she isn’t asked twice', (await call('libState', ['tom', '1234'])).lib.feed.length === 0 && r.lib.mine.shareAsked === true);

/* ---- the year's goal and the one thing I'll do ---- */
r = await call('libSaveMine', ['dara', '1234', { goal: 12, note: { bookId: 'grit', text: '  Finish the report I keep putting off  ' } }]);
ok('a goal for the year and a note from a book are kept', r.ok && r.lib.mine.goal === 12 && r.lib.mine.notes.grit.text === 'Finish the report I keep putting off');
r = await call('libSaveMine', ['dara', '1234', { goal: 9999 }]);
ok('a silly goal is no goal', r.lib.mine.goal === 0);
await call('libSaveMine', ['dara', '1234', { goal: 12 }]);
const men = await call('getMenteeLogs', ['tom', '1234', 's_dara']);
ok('her mentor sees what she has read, her plans and her goal — never the note', men.ok && men.library.read.grit === today && men.library.goal === 12 && !JSON.stringify(men).includes('putting off'));
ok('a teammate’s page carries none of it', !JSON.stringify(await call('staffProfile', ['lena', '1234', 's_dara'])).includes('putting off') && !(await call('staffProfile', ['lena', '1234', 's_dara'])).lib);
ok('the public roster carries none of it', !JSON.stringify(await call('teamRoster', [])).includes('"lib"'));
r = await call('libSaveMine', ['dara', '1234', { note: { bookId: 'grit', text: '' } }]);
ok('an empty note removes it', r.ok && !r.lib.mine.notes.grit);

/* ---- reading plans ---- */
r = await call('libSaveMine', ['dara', '1234', { plan: { id: 'habits', on: true } }]);
ok('starting a plan yourself', r.ok && r.lib.mine.plans.habits && r.lib.mine.plans.habits.by === '');
r = await call('libGivePlan', ['lena', '1234', 's_pp', 'new-leader', true]);
ok('leadership can’t give a plan to someone on another campus', !r.ok && r.err === 'not_authorized');
r = await call('libGivePlan', ['dara', '1234', 's_tom', 'new-leader', true]);
ok('nor can a mentee give one to their mentor', !r.ok && r.err === 'not_authorized');
r = await call('libGivePlan', ['tom', '1234', 's_dara', 'pre-marriage', true]);
ok('her mentor gives her a plan: it is on her list, from him', r.ok && r.plans['pre-marriage'].by === 's_tom' && (await call('libState', ['dara', '1234'])).lib.mine.plans['pre-marriage'].by === 's_tom');
r = await call('libGivePlan', ['tom', '1234', 's_dara', 'pre-marriage', false]);
ok('… and can take it back', r.ok && !r.plans['pre-marriage']);

/* ---- recommending a book ---- */
r = await call('libRecommend', ['dara', '1234', 's_dara', 'grit', 'Grit', '']);
ok('not to yourself', !r.ok && r.err === 'bad_person');
r = await call('libRecommend', ['dara', '1234', 's_old', 'grit', 'Grit', '']);
ok('not to someone no longer active', !r.ok && r.err === 'bad_person');
r = await call('libRecommend', ['dara', '1234', 's_pp', 'grit', 'Grit', 'You will love chapter two']);
ok('to anyone on staff, either campus', r.ok);
r = await call('libState', ['pich', '1234']);
const recId = r.lib.recs[0] && r.lib.recs[0].id;
ok('they see it, from whom, with the note', r.lib.recs.length === 1 && r.lib.recs[0].from.name === 'Dara Sok' && r.lib.recs[0].note === 'You will love chapter two' && r.lib.recs[0].bookId === 'grit');
r = await call('libRecommend', ['dara', '1234', 's_pp', 'grit', 'Grit', '']);
ok('the same book to the same person only once', !r.ok && r.err === 'already');
ok('nobody else sees it', (await call('libState', ['tom', '1234'])).lib.recs.length === 0);
r = await call('libRecDone', ['tom', '1234', recId]);
ok('only the one it was sent to can clear it', (await call('libState', ['pich', '1234'])).lib.recs.length === 1);
r = await call('libRecDone', ['pich', '1234', recId]);
ok('… and they can', r.ok && r.lib.recs.length === 0);
for (const b of ['a', 'b', 'c', 'd', 'f']) await call('libRecommend', ['dara', '1234', 's_tom', 'book-' + b, 'B', '']);
r = await call('libRecommend', ['dara', '1234', 's_tom', 'book-e', 'B', '']);
ok('five recommendations a day, no more', !r.ok && r.err === 'too_many');

/* ---- the weekly reading reminder's settings; taking the month's book down ---- */
r = await call('savePushPrefs', ['dara', '1234', { hour: 19, reading: true, readDay: 3 }]);
ok('the reading day is kept with the other reminder settings', r.ok && r.prefs.reading === true && r.prefs.readDay === 3);
r = await call('savePushPrefs', ['dara', '1234', { hour: 19, reading: false, readDay: 99 }]);
ok('… off is off, and a day that isn’t a day falls back to Saturday', r.prefs.reading === false && r.prefs.readDay === 6);
r = await call('libSetMonth', ['lena', '1234', '', '', '']);
ok('leadership takes the book of the month down', r.ok && r.lib.month === null);
ok('no sign-in, nothing', !(await call('libState', ['nobody', '1234'])).ok && !(await call('libSaveMine', ['nobody', '1234', { share: true }])).ok);
ok('a staff record keeps it all under lib', !!(await staffRow('s_dara')).lib && (await staffRow('s_dara')).lib.goal === 12);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
