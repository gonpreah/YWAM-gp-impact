/* Google Calendar (Oct 2026): an admin connects a calendar by its secret iCal address (Google's only, never sent back to a page); staff see its events — repeats, skipped and moved weeks, several-day stays, UTC times on Cambodia's clock — read at most every 30 minutes. Against the real api.js. */
import { REPO, tmpDir } from './env.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const TMP = tmpDir('gcal');
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
  mk({ id: 'ad', name: 'Ada Admin', username: 'ada', isAdmin: true }),
  mk({ id: 'c1', name: 'Cora Cafe', username: 'cora' }),
  mk({ id: 'ap', name: 'An Applicant', username: 'ap@e.com', kind: 'applicant', dept: '', ministry: '' })
];
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('ok   ' + n); } else { fail++; console.log('FAIL ' + n + (x ? '  → ' + x : '')); } };
const call = async (fn, args) => { const r = await api.default({ method: 'POST', json: async () => ({ fn, args }), headers: new Map() }, {}); return JSON.parse(await r.text()); };
const as = (u) => [u, '1234'];
const URL1 = 'https://calendar.google.com/calendar/ical/ywamsr%40example.org/private-0123456789abcdef/basic.ics';
/* a calendar as Google exports it: a yearly birthday, a weekly meeting (Cambodia's clock), a team
   staying three days, a one-off in UTC, a skipped week, one week moved, a cancelled event, a folded line */
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-TIMEZONE:Asia/Phnom_Penh',
  'BEGIN:VEVENT', 'UID:bday1', 'DTSTART;VALUE=DATE:20151024', 'DTEND;VALUE=DATE:20151025', 'RRULE:FREQ=YEARLY', 'SUMMARY:Sokha\'s birthday', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:staff1', 'DTSTART;TZID=Asia/Phnom_Penh:20261006T080000', 'DTEND;TZID=Asia/Phnom_Penh:20261006T093000', 'RRULE:FREQ=WEEKLY;BYDAY=TU', 'EXDATE;TZID=Asia/Phnom_Penh:20261027T080000',
  'SUMMARY:Staff meeting', 'LOCATION:Main hall\\, upstairs', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:staff1', 'RECURRENCE-ID;TZID=Asia/Phnom_Penh:20261103T080000', 'DTSTART;TZID=Asia/Phnom_Penh:20261104T080000', 'DTEND;TZID=Asia/Phnom_Penh:20261104T093000', 'SUMMARY:Staff meeting (moved)', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:team1', 'DTSTART;VALUE=DATE:20261022', 'DTEND;VALUE=DATE:20261025', 'SUMMARY:Grace Church team staying', 'DESCRIPTION:12 people\\nArriving by bus', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:spk1', 'DTSTART:20261028T020000Z', 'DTEND:20261028T030000Z', 'SUMMARY:Guest speaker: Pastor Example arriving at the airport and need', ' s a ride', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:x1', 'DTSTART;VALUE=DATE:20261023', 'SUMMARY:Called off', 'STATUS:CANCELLED', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
let fetches = 0, answer = 200;
globalThis.fetch = async (url) => { fetches++; if (url !== URL1) return { ok: false, status: 404, text: async () => '' }; return { ok: answer === 200, status: answer, text: async () => ICS }; };

let r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
ok('no calendar yet: says so', r.ok && r.connected === false);
r = await call('adminGcal', [...as('cora'), { name: 'YWAM Siem Reap', url: URL1 }]);
ok('only an admin connects a calendar', r.ok === false);
r = await call('adminGcal', [...as('ada'), { name: 'Evil', url: 'https://evil.example.com/calendar/ical/a/b/basic.ics' }]);
ok('only a Google Calendar iCal address is taken', r.ok === false && r.err === 'bad_url');
r = await call('adminGcal', [...as('ada'), { name: 'Plain', url: URL1.replace('https:', 'http:') }]);
ok('… over https', r.ok === false);
r = await call('adminGcal', [...as('ada'), { name: 'YWAM Siem Reap', url: URL1 }]);
ok('connected, by name — and the secret address is never sent back', r.ok && r.cals.length === 1 && r.cals[0].name === 'YWAM Siem Reap' && !JSON.stringify(r).includes('private-0123'));
r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
const ev = r.events || [];
const on = (d) => ev.filter(e => e.date === d).map(e => e.title);
ok('staff see the events, and not the address', r.ok && r.connected && ev.length > 0 && !JSON.stringify(r).includes('private-0123'));
ok('a yearly birthday comes round', on('2026-10-24').includes('Sokha\'s birthday') && ev.find(e => e.title === 'Sokha\'s birthday').allDay === true);
ok('a weekly meeting on its Tuesdays, at 8:00 on Cambodia\'s clock, with where', on('2026-10-20').includes('Staff meeting') && ev.find(e => e.date === '2026-10-20' && e.title === 'Staff meeting').time === '08:00' && ev.find(e => e.title === 'Staff meeting').where === 'Main hall, upstairs');
ok('… a skipped week skipped', !on('2026-10-27').includes('Staff meeting'));
ok('… a moved week moved', !on('2026-11-03').includes('Staff meeting') && on('2026-11-04').includes('Staff meeting (moved)'), JSON.stringify(on('2026-11-03')) + JSON.stringify(on('2026-11-04')));
const team = ev.find(e => e.title === 'Grace Church team staying');
ok('a three-day stay: its first day and its last', team && team.date === '2026-10-22' && team.endDate === '2026-10-24' && team.notes === '12 people\nArriving by bus');
const spk = ev.find(e => /Guest speaker/.test(e.title));
ok('a time in UTC on Cambodia\'s clock (02:00Z → 09:00), and a folded line put back together', spk && spk.date === '2026-10-28' && spk.time === '09:00' && /needs a ride$/.test(spk.title), JSON.stringify(spk));
ok('a cancelled event isn\'t there', !ev.some(e => e.title === 'Called off'));
ok('in order: by day, all-day first, then by time', ev.every((e, i) => !i || ev[i - 1].date < e.date || (ev[i - 1].date === e.date && (ev[i - 1].allDay || !e.allDay))));
const n = fetches;
await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
ok('read at most every 30 minutes', fetches === n);
r = await call('getCalendar', ['ap@e.com', '1234', '2026-10-19', 31]);
ok('an applicant gets nothing', r.ok === false);
mem.gcalCache = {}; answer = 500;
r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
ok('Google not answering: no crash', r.ok === true);
r = await call('adminGcal', as('ada'));
ok('… and the admin sees it didn\'t work', /http_500/.test(r.cals[0].lastErr));
r = await call('adminGcal', [...as('ada'), { remove: r.cals[0].id }]);
ok('removed', r.ok && r.cals.length === 0);

console.log('=== kinds of events: a colour and the words that mark each ===');
answer = 200; mem.gcalCache = {};
r = await call('adminGcal', [...as('ada'), { name: 'YWAM Siem Reap', url: URL1 }]);
ok('the kinds come with the calendars: Events first (the catch-all), then birthdays, schools, teams, guests', r.ok && r.kinds.map(k => k.id).join() === 'event,bday,school,team,guest' && r.kinds[0].color === '' && r.kinds[1].color === 'green' && r.kinds[3].color === 'lavender');
r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
const kindOf = (t) => (r.events.find(e => e.title.indexOf(t) === 0) || {});
ok('a birthday is green, a team lavender, a guest speaker teal — a staff meeting plain, in the calendar\'s colour', kindOf('Sokha').kind === 'bday' && kindOf('Sokha').color === 'green' && kindOf('Grace Church').kind === 'team' && kindOf('Grace Church').color === 'lavender' && kindOf('Guest speaker').kind === 'guest' && kindOf('Guest speaker').color === 'teal' && kindOf('Staff meeting').kind === 'event' && kindOf('Staff meeting').color === r.cals[0].color, JSON.stringify(r.events.map(e => [e.title.slice(0, 12), e.kind, e.color])));
ok('… and everyone gets the kinds, for the chips', r.kinds.length === 5);
r = await call('adminGcal', [...as('cora'), { kind: { id: 'team', color: 'sky' } }]);
ok('only an admin changes them', r.ok === false);
r = await call('adminGcal', [...as('ada'), { kind: { id: 'team', color: 'sky', keywords: 'team, church' } }]);
ok('the admin: Teams in sky, marked by "team" or "church"', r.ok && r.kinds[3].color === 'sky' && r.kinds[3].keywords.join() === 'team,church');
mem.gcalCache = {}; r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
r = await call('adminGcal', as('ada'));
ok('… and reading the calendar again keeps them (the fetch bookkeeping used to drop them)', r.ok && r.kinds[3].color === 'sky' && r.kinds[3].keywords.join() === 'team,church');
r = await call('adminGcal', [...as('ada'), { kind: { id: 'team', color: 'neon' } }]);
ok('a colour off the palette means none', r.ok && r.kinds[3].color === '');
r = await call('adminGcal', [...as('ada'), { kind: { name: 'Worship', color: 'rose', keywords: ['worship'] } }]);
ok('a new kind', r.ok && r.kinds.length === 6 && r.kinds[5].name === 'Worship' && r.kinds[5].color === 'rose' && /^k/.test(r.kinds[5].id));
r = await call('adminGcal', [...as('ada'), { kindRemove: 'event' }]);
ok('the catch-all stays', r.ok === false && r.err === 'keep_first');
r = await call('adminGcal', [...as('ada'), { kindRemove: 'guest' }]);
ok('a kind removed', r.ok && !r.kinds.some(k => k.id === 'guest'));
r = await call('getCalendar', [...as('cora'), '2026-10-19', 31]);
ok('… its events are plain Events now, in the calendar\'s colour', kindOf('Guest speaker').kind === 'event' && kindOf('Guest speaker').color === r.cals[0].color);
r = await call('adminGcal', [...as('ada'), { remove: r.cals[0].id }]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
