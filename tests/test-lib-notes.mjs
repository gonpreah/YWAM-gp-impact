/* The Library's highlights and notes, the server (Nov 2026, Andrew: "like the Bible app … highlight … write a note …
   private, or public for everyone in our base … comment on it, like it … ask for prayer — private, public, or just to
   your mentor"). Who sees a row, who may touch it, and that a prayer request is a real one on ☰ → Prayer. Made-up people. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('lib-notes');
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
for (const f of fs.readdirSync(REPO + '/netlify/functions')) if (f.endsWith('.js')) fs.copyFileSync(REPO + '/netlify/functions/' + f, TMP + '/' + f);
const blobs = await import(TMP + '/node_modules/@netlify/blobs/index.js');
const api = await import(TMP + '/api.js');
const mem = blobs.__mem;
const H = (p, s) => crypto.createHash('sha256').update(s + ':' + String(p), 'utf8').digest('hex');
const mk = o => Object.assign({ active: true, campus: 'siemreap', dept: 'Community Service', ministry: 'Cafe', role: 'Staff', staffType: 'campus' }, o, { pinSalt: o.id, pinHash: H('1234', o.id) });
const call = (fn, args) => api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}).then(r => r.json());
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } }

await call('getMyBoot', ['zz', '0000']);   // warm
mem.staff = [
  mk({ id: 'a1', name: 'Ana Reader', username: 'ana', mentorId: 'm1', mentorStatus: 'approved' }),
  mk({ id: 'm1', name: 'Mo Mentor', username: 'mo' }),
  mk({ id: 'b1', name: 'Bo Same', username: 'bo' }),
  mk({ id: 'p1', name: 'Pich Poipet', username: 'pich', campus: 'poipet' }),
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', isAdmin: true }),
  mk({ id: 'ap', name: 'App Licant', username: 'app@e.com', kind: 'applicant', applicant: { type: 'volunteer' } })
];
const B = 'atomic-habits', base = { bookId: B, title: 'Atomic Habits', lang: 'en' };
const seeIds = async (u, book) => ((await call('libNotes', [u, '1234', book || B])).notes || []).map(n => n.id).sort().join();

console.log('1. a highlight is mine alone');
let r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 1, p: 0, quote: 'Small habits add up.', color: 'yellow' }, base)]);
const hl = r.id;
ok('saved, and I see it', r.ok && r.notes.length === 1 && r.notes[0].color === 'yellow' && r.notes[0].vis === 'private' && r.notes[0].mine, r);
ok('nobody else sees a private highlight — not even the mentor', (await seeIds('mo')) === '' && (await seeIds('bo')) === '' && (await seeIds('ada')) === '');
r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 1, p: 0, quote: 'Small habits add up.', color: 'green' }, base)]);
ok('the same paragraph again changes my row, not a second one', r.notes.length === 1 && r.notes[0].id === hl && r.notes[0].color === 'green');
ok('a bad colour is no colour; a shared row needs words', (await call('libNoteSave', ['ana', '1234', Object.assign({ step: 2, p: 0, color: 'red', vis: 'campus' }, base)])).err === 'need_note');
ok('a bad book or place is refused', (await call('libNoteSave', ['ana', '1234', { bookId: '../x', step: 1, p: 0, color: 'yellow' }])).err === 'bad_book' &&
  (await call('libNoteSave', ['ana', '1234', Object.assign({ step: 99, p: 0, color: 'yellow' }, base)])).err === 'bad_place');

console.log('2. a note for the campus');
r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 2, p: 1, quote: 'Be the kind of person who…', note: 'This hit me: identity first.', vis: 'campus' }, base)]);
const pub = r.id;
ok('saved', r.ok && r.notes.find(n => n.id === pub).vis === 'campus');
ok('my campus sees it, with my name; the other campus does not', (await seeIds('bo')) === pub && (await seeIds('pich')) === '' &&
  (await call('libNotes', ['bo', '1234', B])).notes[0].name === 'Ana Reader');
ok('an applicant sees nothing and can write nothing', (await call('libNotes', ['app@e.com', '1234', B])).ok === false && (await call('libNoteSave', ['app@e.com', '1234', Object.assign({ step: 1, p: 0, color: 'yellow' }, base)])).ok === false);
r = await call('libNoteLike', ['bo', '1234', pub, true]);
ok('Bo likes it', r.ok && r.notes[0].likes === 1 && r.notes[0].iLiked);
r = await call('libNoteLike', ['bo', '1234', pub, true]);
ok('liking twice is still one', r.notes[0].likes === 1);
r = await call('libNoteComment', ['bo', '1234', pub, 'Same for me this week.']);
ok('Bo comments', r.ok && r.notes[0].comments.length === 1 && r.notes[0].comments[0].mine && r.notes[0].comments[0].name === 'Bo Same');
ok('an empty comment is refused', (await call('libNoteComment', ['bo', '1234', pub, '   '])).err === 'empty');
ok('Pich (other campus) cannot like or comment', (await call('libNoteLike', ['pich', '1234', pub, true])).ok === false && (await call('libNoteComment', ['pich', '1234', pub, 'hi'])).ok === false);
const cid = r.notes[0].comments[0].id;
ok('Mo cannot delete Bo’s comment; Ana (the note’s owner) can', (await call('libNoteUncomment', ['mo', '1234', pub, cid])).ok === false &&
  (await call('libNoteUncomment', ['ana', '1234', pub, cid])).notes.find(n => n.id === pub).comments.length === 0);
ok('only the owner changes it', (await call('libNoteSave', ['bo', '1234', Object.assign({ id: pub, step: 2, p: 1, note: 'mine now', vis: 'campus' }, base)])).ok === false);
ok('nothing of it on the public roster', !/identity first|Small habits/.test(JSON.stringify(await call('teamRoster', []))));

console.log('3. a note to my mentor, asking for prayer');
r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 3, p: 0, quote: 'Environment beats willpower.', note: 'Pray I set up my mornings well.', vis: 'mentor', prayer: true }, base)]);
const men = r.id, row = r.notes.find(n => n.id === men);
ok('saved, with a prayer request', r.ok && row.vis === 'mentor' && row.prayer && row.prayer.prayedN === 0, row);
ok('my mentor sees it; Bo does not', (await seeIds('mo')).split(',').includes(men) && !(await seeIds('bo')).split(',').includes(men));
const pr = (mem.prayers || []).find(x => x.lib && x.lib.noteId === men);
ok('it is a real prayer request, for the mentor, saying where it came from', !!pr && pr.scope === 'mentor' && pr.text === 'Pray I set up my mornings well.' && pr.lib.title === 'Atomic Habits', pr);
const pm = await call('getPrayers', ['mo', '1234']);
ok('… on Mo’s Prayer page, with the book', pm.prayers.some(x => x.id === pr.id && x.lib && x.lib.bookId === B) && !(await call('getPrayers', ['bo', '1234'])).prayers.some(x => x.id === pr.id));
r = await call('libNotePray', ['mo', '1234', men, true]);
ok('Mo prays from the note: the same count as ☰ → Prayer', r.ok && r.notes.find(n => n.id === men).prayer.prayedN === 1 && mem.prayers.find(x => x.id === pr.id).prayed.includes('m1'));
ok('Bo cannot pray on a note he cannot see', (await call('libNotePray', ['bo', '1234', men, true])).ok === false);
r = await call('libNoteSave', ['ana', '1234', Object.assign({ id: men, step: 3, p: 0, note: 'Pray I set up my mornings well.', vis: 'mentor', prayer: false }, base)]);
ok('taking the prayer off takes the request down', !r.notes.find(n => n.id === men).prayer && !(mem.prayers || []).some(x => x.id === pr.id));
const bm = mem.staff.find(s => s.id === 'b1');
ok('a mentor-only note needs a mentor', (await call('libNoteSave', ['bo', '1234', Object.assign({ step: 4, p: 0, note: 'x', vis: 'mentor' }, base)])).err === 'no_mentor' && !bm.mentorId);
r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 4, p: 2, note: 'Pray for my family.', vis: 'campus', prayer: true }, base)]);
const pc = r.id;
ok('a campus prayer request shows on everyone’s Prayer page there', (await call('getPrayers', ['bo', '1234'])).prayers.some(x => x.lib && x.lib.noteId === pc) && !(await call('getPrayers', ['pich', '1234'])).prayers.some(x => x.lib && x.lib.noteId === pc));
ok('a private note cannot ask for prayer', (await call('libNoteSave', ['ana', '1234', Object.assign({ step: 5, p: 0, note: 'just me', vis: 'private', prayer: true }, base)])).notes.find(n => n.step === 5).prayer === null);

console.log('4. back to private, the feed, deleting');
r = await call('libNoteComment', ['bo', '1234', pub, 'Love this.']);
r = await call('libNoteSave', ['ana', '1234', Object.assign({ id: pub, step: 2, p: 1, note: 'This hit me: identity first.', vis: 'private' }, base)]);
ok('made private: Bo no longer sees it, and its likes and comments go', !(await seeIds('bo')).split(',').includes(pub) && r.notes.find(n => n.id === pub).comments.length === 0 && r.notes.find(n => n.id === pub).likes === 0);
await call('libNoteSave', ['ana', '1234', Object.assign({ id: pub, step: 2, p: 1, note: 'This hit me: identity first.', vis: 'campus' }, base)]);
const boot = await call('getMyBoot', ['bo', '1234']);
ok('the boot’s Library carries the campus’s shared notes, newest first, short', boot.lib && boot.lib.notesFeed.length === 2 && boot.lib.notesFeed.every(n => n.name === 'Ana Reader' && n.bookId === B) && boot.lib.notesFeed[0].prayer === true, boot.lib && boot.lib.notesFeed);
ok('my own notes are not in my feed; a mentor note is in my mentor’s', (await call('getMyBoot', ['ana', '1234'])).lib.notesFeed.length === 0);
ok('Bo cannot delete Ana’s note; an admin of the campus can take a shared one down', (await call('libNoteDelete', ['bo', '1234', pub])).ok === false && (await call('libNoteDelete', ['ada', '1234', pub])).ok === true && !(await seeIds('bo')).split(',').includes(pub));
r = await call('libNoteDelete', ['ana', '1234', pc]);
ok('deleting my note takes its prayer request down too', r.ok && !(mem.prayers || []).some(x => x.lib && x.lib.noteId === pc));
r = await call('libNoteSave', ['ana', '1234', Object.assign({ step: 1, p: 0, color: '', note: '' }, base)]);
ok('no colour and no words: the row goes', r.ok && !r.notes.some(n => n.id === hl));
ok('a bad PIN gets nothing', (await call('libNotes', ['ana', '9999', B])).ok === false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
